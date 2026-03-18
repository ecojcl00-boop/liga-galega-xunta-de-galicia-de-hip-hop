import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as XLSX from 'npm:xlsx@0.18.5';

const CATEGORY_MAP = {
  "mini individual a": "Mini Individual A",
  "mini individual b": "Mini Individual B",
  "individual": "Individual",
  "mini parejas a": "Mini Parejas A",
  "mini parejas b": "Mini Parejas B",
  "parejas": "Parejas",
  "baby": "Baby",
  "infantil": "Infantil",
  "junior": "Junior",
  "youth": "Youth",
  "absoluta": "Absoluta",
  "premium": "Premium",
  "mega crew": "Mega Crew",
  "megacrew": "Mega Crew",
  "mega-crew": "Mega Crew",
};

function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeCategory(raw) {
  if (!raw) return null;
  return CATEGORY_MAP[nd(raw).replace(/\s+/g, " ")] || null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sequentialUpdates(entity, updates, delayMs = 400) {
  for (let i = 0; i < updates.length; i++) {
    await entity.update(updates[i].id, updates[i].data);
    if (i + 1 < updates.length) await sleep(delayMs);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // ── Parse Excel ───────────────────────────────────────────────────────────
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: `No se pudo descargar el archivo: ${fileRes.status}` }, { status: 400 });

    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });

    console.log(`[INFO] Parsed ${rawRows.length} rows from Excel`);

    const log = {
      groupsOk: [],          // verificados sin cambios
      groupsCorrected: [],   // corregidos con detalle
      groupsCreated: [],     // creados nuevos
      participantsAdded: [], // { participant, group }
      participantsRemoved: [], // { participant, group }
      warnings: [],
      errors: [],
    };

    // ── Load existing data ────────────────────────────────────────────────────
    const [existingSchools, existingGroups] = await Promise.all([
      base44.entities.School.list("name", 500),
      base44.entities.Group.list("name", 500),
    ]);

    console.log(`[INFO] Loaded: ${existingSchools.length} schools, ${existingGroups.length} groups`);

    const schoolMap = new Map(existingSchools.map(s => [nd(s.name), s]));
    const groupMap = new Map(existingGroups.map(g => {
      const catKey = nd(normalizeCategory(g.category) || g.category || "");
      return [`${nd(g.name)}|${nd(g.school_name || "")}|${catKey}`, g];
    }));

    // ── Parse all rows in memory ──────────────────────────────────────────────
    const parsedRows = [];
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const rowNum = i + 2;
      const groupName = String(r["nombre_grupo"] || "").trim();
      const schoolName = String(r["escuela"] || "").trim();
      const categoryRaw = String(r["categoria"] || "").trim();
      const coachName = String(r["nombre_entrenador"] || "").trim();
      const coachEmail = String(r["email_entrenador"] || "").trim().toLowerCase();
      const coachPhone = String(r["telefono_entrenador"] || "").trim();

      if (!groupName) { log.errors.push(`Fila ${rowNum}: Nombre de grupo vacío — omitida`); continue; }
      const category = normalizeCategory(categoryRaw);
      if (!category) { log.errors.push(`Fila ${rowNum} (${groupName}): Categoría no reconocida "${categoryRaw}" — omitida`); continue; }

      const participants = [];
      for (let n = 1; n <= 46; n++) {
        const name = String(r[`nombre_${n}`] || "").trim();
        if (!name) continue;
        const birth = String(r[`nacimiento_${n}`] || "").trim();
        participants.push({ name, birth_date: birth });
      }

      parsedRows.push({ rowNum, groupName, schoolName, category, coachName, coachEmail, coachPhone, participants });
    }

    // ── Compare each Excel group against DB ───────────────────────────────────
    const groupUpdates = [];
    const groupsToCreate = [];

    for (const row of parsedRows) {
      const schoolKey = nd(row.schoolName);
      const groupKey = `${nd(row.groupName)}|${schoolKey}|${nd(row.category)}`;
      const existing = groupMap.get(groupKey);

      if (!existing) {
        // Group doesn't exist in DB → create it
        const school = schoolMap.get(schoolKey);
        groupsToCreate.push({
          name: row.groupName, school_name: row.schoolName,
          school_id: school?.id || null, category: row.category,
          coach_name: row.coachName, coach_email: row.coachEmail,
          coach_phone: row.coachPhone, participants: row.participants,
        });
        log.groupsCreated.push(row.groupName);
        continue;
      }

      // ── EXACT SYNC: compute what should be the final participant list ──────
      const excelNames = new Set(row.participants.map(p => nd(p.name)));
      const dbParticipants = existing.participants || [];

      // Participants to REMOVE: in DB for this group but NOT in Excel
      const toRemove = dbParticipants.filter(p => !excelNames.has(nd(p.name)));

      // Build the kept participants (those that are in the Excel)
      const kept = dbParticipants.filter(p => excelNames.has(nd(p.name)));
      const keptNames = new Set(kept.map(p => nd(p.name)));

      // Participants to ADD: in Excel but NOT in DB for this group
      const toAdd = row.participants.filter(p => !keptNames.has(nd(p.name)));

      // Update birth_dates for kept participants if missing
      const updatedKept = kept.map(ep => {
        if (!ep.birth_date) {
          const match = row.participants.find(p => nd(p.name) === nd(ep.name));
          if (match?.birth_date) return { ...ep, birth_date: match.birth_date };
        }
        return ep;
      });

      const finalParticipants = [...updatedKept, ...toAdd];
      const needsUpdate = toRemove.length > 0 || toAdd.length > 0;

      if (!needsUpdate) {
        log.groupsOk.push(row.groupName);
      } else {
        const changes = [];
        toAdd.forEach(p => {
          log.participantsAdded.push({ participant: p.name, group: row.groupName });
          changes.push(`➕ ${p.name}`);
        });
        toRemove.forEach(p => {
          log.participantsRemoved.push({ participant: p.name, group: row.groupName });
          changes.push(`➖ ${p.name}`);
        });
        log.groupsCorrected.push({ group: row.groupName, changes });
        groupUpdates.push({ id: existing.id, data: { participants: finalParticipants } });
        Object.assign(existing, { participants: finalParticipants });
      }
    }

    // ── Apply changes ─────────────────────────────────────────────────────────
    if (groupsToCreate.length > 0) {
      await base44.entities.Group.bulkCreate(groupsToCreate);
      console.log(`[INFO] Created ${groupsToCreate.length} new groups`);
      await sleep(400);
    }

    if (groupUpdates.length > 0) {
      console.log(`[INFO] Applying ${groupUpdates.length} group updates...`);
      await sequentialUpdates(base44.entities.Group, groupUpdates, 400);
    }

    console.log(`[INFO] Done. Ok: ${log.groupsOk.length}, Corrected: ${log.groupsCorrected.length}, Created: ${log.groupsCreated.length}`);
    return Response.json({ success: true, log });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});