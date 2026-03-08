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

function removeDiacritics(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeCategory(raw) {
  if (!raw) return null;
  const clean = removeDiacritics(raw).replace(/\s+/g, " ");
  return CATEGORY_MAP[clean] || null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Apply updates sequentially, pausing every N calls to avoid rate limits
async function applyUpdates(entity, updates, batchSize = 5, delayMs = 300) {
  for (let i = 0; i < updates.length; i++) {
    const { id, data } = updates[i];
    await entity.update(id, data);
    if ((i + 1) % batchSize === 0 && i + 1 < updates.length) {
      await sleep(delayMs);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, competition_id, competition_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // ── Download & parse Excel ────────────────────────────────────────────────
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: `No se pudo descargar el archivo: ${fileRes.status}` }, { status: 400 });

    const arrayBuffer = await fileRes.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });

    const log = {
      schoolsCreated: 0, schoolsUpdated: 0,
      participantsCreated: 0, participantsExisting: 0,
      groupsCreated: 0, groupsUpdated: 0,
      registrationsCreated: 0,
      warnings: [], errors: [],
    };

    // ── Load all existing data (3 calls total) ────────────────────────────────
    const [existingSchools, existingGroups, existingRegs] = await Promise.all([
      base44.entities.School.list("name", 500),
      base44.entities.Group.list("name", 500),
      competition_id
        ? base44.entities.Registration.filter({ competition_id }, "-created_date", 500)
        : Promise.resolve([]),
    ]);

    // ── Build lookup maps ─────────────────────────────────────────────────────
    const schoolMap = new Map(existingSchools.map(s => [removeDiacritics(s.name), s]));
    const groupMap = new Map(existingGroups.map(g => {
      const catNorm = normalizeCategory(g.category);
      const catKey = removeDiacritics(catNorm || g.category || "");
      return [`${removeDiacritics(g.name)}|${removeDiacritics(g.school_name || "")}|${catKey}`, g];
    }));
    const regSet = new Set(existingRegs.map(r => r.group_id));

    // ── Parse all rows first, no DB calls yet ────────────────────────────────
    const parsedRows = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const groupName = String(row["nombre_grupo"] || "").trim();
      const schoolName = String(row["escuela"] || "").trim();
      const categoryRaw = String(row["categoria"] || "").trim();
      const coachName = String(row["nombre_entrenador"] || "").trim();
      const coachEmail = String(row["email_entrenador"] || "").trim().toLowerCase();
      const coachPhone = String(row["telefono_entrenador"] || "").trim();

      if (!groupName) { log.errors.push(`Fila ${rowNum}: Nombre de grupo vacío — omitida`); continue; }

      const category = normalizeCategory(categoryRaw);
      if (!category) { log.errors.push(`Fila ${rowNum} (${groupName}): Categoría no reconocida "${categoryRaw}" — omitida`); continue; }

      const participants = [];
      for (let n = 1; n <= 46; n++) {
        const name = String(row[`nombre_${n}`] || "").trim();
        if (!name) continue;
        const birth = String(row[`nacimiento_${n}`] || "").trim();
        participants.push({ name, birth_date: birth });
        if (!birth) log.warnings.push(`Fila ${rowNum} (${groupName}): "${name}" sin fecha de nacimiento`);
      }
      if (participants.length === 0) log.warnings.push(`Fila ${rowNum} (${groupName}): Sin participantes`);

      parsedRows.push({ rowNum, groupName, schoolName, categoryRaw, category, coachName, coachEmail, coachPhone, participants });
    }

    // ── PHASE 1: Schools ──────────────────────────────────────────────────────
    // Identify unique schools, avoid duplicate creates
    const schoolsToCreate = new Map(); // key → data
    const schoolsToUpdate = [];        // { id, data }

    for (const row of parsedRows) {
      const key = removeDiacritics(row.schoolName);
      const existing = schoolMap.get(key);
      if (!existing) {
        if (!schoolsToCreate.has(key)) {
          schoolsToCreate.set(key, { name: row.schoolName, email: row.coachEmail, phone: row.coachPhone });
        }
      } else {
        const upd = {};
        if (!existing.email && row.coachEmail) upd.email = row.coachEmail;
        if (!existing.phone && row.coachPhone) upd.phone = row.coachPhone;
        if (Object.keys(upd).length > 0 && !schoolsToUpdate.find(u => u.id === existing.id)) {
          schoolsToUpdate.push({ id: existing.id, data: upd });
          Object.assign(existing, upd); // update local cache
        }
      }
    }

    // bulkCreate new schools
    if (schoolsToCreate.size > 0) {
      const newSchools = await base44.entities.School.bulkCreate([...schoolsToCreate.values()]);
      log.schoolsCreated = Array.isArray(newSchools) ? newSchools.length : schoolsToCreate.size;
      (Array.isArray(newSchools) ? newSchools : []).forEach(s => {
        schoolMap.set(removeDiacritics(s.name), s);
      });
    }
    // Apply school updates
    if (schoolsToUpdate.length > 0) {
      await applyUpdates(base44.entities.School, schoolsToUpdate, 5, 200);
      log.schoolsUpdated = schoolsToUpdate.length;
    }
    await sleep(300);

    // ── PHASE 2: Groups ────────────────────────────────────────────────────────
    const groupsToCreate = new Map(); // key → data
    const groupsToUpdate = [];        // { id, data, key }

    for (const row of parsedRows) {
      const schoolKey = removeDiacritics(row.schoolName);
      const school = schoolMap.get(schoolKey);
      const schoolId = school?.id || null;

      const groupKey = `${removeDiacritics(row.groupName)}|${schoolKey}|${removeDiacritics(row.category)}`;
      const existing = groupMap.get(groupKey);

      if (!existing) {
        if (!groupsToCreate.has(groupKey)) {
          groupsToCreate.set(groupKey, {
            name: row.groupName,
            school_name: row.schoolName,
            school_id: schoolId,
            category: row.category,
            coach_name: row.coachName,
            coach_email: row.coachEmail,
            coach_phone: row.coachPhone,
            participants: row.participants,
          });
        }
      } else {
        // Merge participants
        const existingNames = new Set((existing.participants || []).map(p => removeDiacritics(p.name)));
        const newParticipants = row.participants.filter(p => !existingNames.has(removeDiacritics(p.name)));
        // Also update birth_dates for existing participants if they were empty
        const mergedParticipants = (existing.participants || []).map(ep => {
          if (!ep.birth_date) {
            const fromExcel = row.participants.find(p => removeDiacritics(p.name) === removeDiacritics(ep.name));
            if (fromExcel?.birth_date) return { ...ep, birth_date: fromExcel.birth_date };
          }
          return ep;
        });
        mergedParticipants.push(...newParticipants);

        log.participantsCreated += newParticipants.length;
        log.participantsExisting += row.participants.length - newParticipants.length;

        const upd = { participants: mergedParticipants };
        if (!existing.coach_name && row.coachName) upd.coach_name = row.coachName;
        if (!existing.coach_email && row.coachEmail) upd.coach_email = row.coachEmail;
        if (!existing.coach_phone && row.coachPhone) upd.coach_phone = row.coachPhone;
        if (!existing.school_id && schoolId) upd.school_id = schoolId;

        // Always update to ensure participants are merged (check if actually changed)
        const alreadyQueued = groupsToUpdate.find(u => u.id === existing.id);
        if (!alreadyQueued) {
          groupsToUpdate.push({ id: existing.id, data: upd });
          Object.assign(existing, upd);
        } else {
          // Merge into existing queued update
          alreadyQueued.data = { ...alreadyQueued.data, participants: mergedParticipants };
        }
      }
    }

    // bulkCreate new groups
    if (groupsToCreate.size > 0) {
      const newGroups = await base44.entities.Group.bulkCreate([...groupsToCreate.values()]);
      log.groupsCreated = Array.isArray(newGroups) ? newGroups.length : groupsToCreate.size;
      (Array.isArray(newGroups) ? newGroups : []).forEach(g => {
        const catKey = removeDiacritics(g.category || "");
        const gk = `${removeDiacritics(g.name)}|${removeDiacritics(g.school_name || "")}|${catKey}`;
        groupMap.set(gk, g);
      });
      // Count participants from newly created groups
      for (const gData of groupsToCreate.values()) {
        log.participantsCreated += (gData.participants || []).length;
      }
    }
    await sleep(300);

    // Apply group updates in batches
    if (groupsToUpdate.length > 0) {
      await applyUpdates(base44.entities.Group, groupsToUpdate, 5, 400);
      log.groupsUpdated = groupsToUpdate.length;
    }
    await sleep(300);

    // ── PHASE 3: Registrations ─────────────────────────────────────────────────
    if (competition_id) {
      const regsToCreate = [];
      for (const row of parsedRows) {
        const schoolKey = removeDiacritics(row.schoolName);
        const groupKey = `${removeDiacritics(row.groupName)}|${schoolKey}|${removeDiacritics(row.category)}`;
        const group = groupMap.get(groupKey);
        if (group && !regSet.has(group.id)) {
          regsToCreate.push({
            competition_id,
            competition_name: competition_name || "",
            group_id: group.id,
            group_name: group.name,
            school_name: row.schoolName,
            category: row.category,
            coach_name: row.coachName,
            status: "confirmed",
            payment_status: "pending",
            participants_count: row.participants.length,
          });
          regSet.add(group.id); // prevent double
        }
      }
      if (regsToCreate.length > 0) {
        await base44.entities.Registration.bulkCreate(regsToCreate);
        log.registrationsCreated = regsToCreate.length;
      }
    }

    return Response.json({ success: true, log, totalRows: rawRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});