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
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeCategory(raw) {
  if (!raw) return null;
  return CATEGORY_MAP[nd(raw).replace(/\s+/g, " ")] || null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sequentialUpdates(entity, updates, delayMs = 350) {
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
      schoolsCreated: 0, schoolsUpdated: 0,
      participantsCreated: 0, participantsExisting: 0,
      groupsCreated: 0, groupsUpdated: 0,
      registrationsReconnected: 0,
      warnings: [], errors: [],
    };

    // ── Load existing data ────────────────────────────────────────────────────
    const [existingSchools, existingGroups] = await Promise.all([
      base44.entities.School.list("name", 500),
      base44.asServiceRole.entities.Group.list("name", 2000),
    ]);

    console.log(`[INFO] Loaded: ${existingSchools.length} schools, ${existingGroups.length} groups`);

    const schoolMap = new Map(existingSchools.map(s => [nd(s.name), s]));

    // Clave de deduplicación = nd(name)|nd(category) — sin school_name.
    // Nombre + categoría identifica unívocamente un grupo en esta liga.
    const groupMap = new Map(existingGroups.map(g => [
      `${nd(g.name)}|${nd(g.category || "")}|${nd(g.school_name || "")}`,
      g,
    ]));

    // ── Parse all rows in memory first ────────────────────────────────────────
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
        if (!birth) log.warnings.push(`Fila ${rowNum} (${groupName}): "${name}" sin fecha de nacimiento`);
      }
      if (participants.length === 0) log.warnings.push(`Fila ${rowNum} (${groupName}): Sin participantes`);

      parsedRows.push({ rowNum, groupName, schoolName, category, coachName, coachEmail, coachPhone, participants });
    }

    // ── SCHOOLS ───────────────────────────────────────────────────────────────
    const newSchoolsData = [];
    const schoolUpdates = [];
    const seenSchoolKeys = new Set();

    for (const row of parsedRows) {
      const key = nd(row.schoolName);
      if (seenSchoolKeys.has(key)) continue;
      seenSchoolKeys.add(key);

      const existing = schoolMap.get(key);
      if (!existing) {
        newSchoolsData.push({ name: row.schoolName, email: row.coachEmail, phone: row.coachPhone });
      } else {
        const upd = {};
        if (!existing.email && row.coachEmail) upd.email = row.coachEmail;
        if (!existing.phone && row.coachPhone) upd.phone = row.coachPhone;
        if (Object.keys(upd).length > 0) schoolUpdates.push({ id: existing.id, data: upd });
      }
    }

    if (newSchoolsData.length > 0) {
      const created = await base44.entities.School.bulkCreate(newSchoolsData);
      log.schoolsCreated = newSchoolsData.length;
      (Array.isArray(created) ? created : []).forEach(s => schoolMap.set(nd(s.name), s));
      console.log(`[INFO] Created ${log.schoolsCreated} schools`);
    }
    if (schoolUpdates.length > 0) {
      await sequentialUpdates(base44.entities.School, schoolUpdates, 300);
      log.schoolsUpdated = schoolUpdates.length;
      schoolUpdates.forEach(u => { const s = existingSchools.find(s => s.id === u.id); if (s) Object.assign(s, u.data); });
    }
    if (newSchoolsData.length + schoolUpdates.length > 0) await sleep(400);

    // ── GROUPS ────────────────────────────────────────────────────────────────
    const newGroupsData = [];
    const groupUpdates = [];
    const seenGroupKeys = new Set();

    for (const row of parsedRows) {
      const groupKey = `${nd(row.groupName)}|${nd(row.category)}|${nd(row.schoolName)}`;

      if (seenGroupKeys.has(groupKey)) {
        log.warnings.push(`Fila ${row.rowNum} (${row.groupName}): Grupo duplicado en Excel — segunda ocurrencia omitida`);
        continue;
      }
      seenGroupKeys.add(groupKey);

      const schoolKey = nd(row.schoolName);
      const school = schoolMap.get(schoolKey);
      const schoolId = school?.id || null;

      const existing = groupMap.get(groupKey);

      if (!existing) {
        newGroupsData.push({
          name: row.groupName, school_name: row.schoolName, school_id: schoolId,
          category: row.category, coach_name: row.coachName,
          coach_email: row.coachEmail, coach_phone: row.coachPhone,
          participants: row.participants,
        });
        log.participantsCreated += row.participants.length;
      } else {
        const existingNames = new Set((existing.participants || []).map(p => nd(p.name)));
        const newParticipants = row.participants.filter(p => !existingNames.has(nd(p.name)));

        const updatedExisting = (existing.participants || []).map(ep => {
          if (!ep.birth_date) {
            const match = row.participants.find(p => nd(p.name) === nd(ep.name));
            if (match?.birth_date) return { ...ep, birth_date: match.birth_date };
          }
          return ep;
        });

        const birthChanged = updatedExisting.some((p, i) => p.birth_date !== (existing.participants || [])[i]?.birth_date);
        const fieldUpd: Record<string, any> = {};
        if (row.schoolName && nd(row.schoolName) !== nd(existing.school_name || "")) fieldUpd.school_name = row.schoolName;
        if (schoolId && !existing.school_id) fieldUpd.school_id = schoolId;
        if (!existing.coach_name && row.coachName) fieldUpd.coach_name = row.coachName;
        if (!existing.coach_email && row.coachEmail) fieldUpd.coach_email = row.coachEmail;
        if (!existing.coach_phone && row.coachPhone) fieldUpd.coach_phone = row.coachPhone;

        const needsUpdate = newParticipants.length > 0 || birthChanged || Object.keys(fieldUpd).length > 0;

        log.participantsCreated += newParticipants.length;
        log.participantsExisting += row.participants.length - newParticipants.length;

        if (needsUpdate) {
          const mergedParticipants = [...updatedExisting, ...newParticipants];
          groupUpdates.push({ id: existing.id, data: { participants: mergedParticipants, ...fieldUpd } });
          Object.assign(existing, { participants: mergedParticipants, ...fieldUpd });
        }
      }
    }

    console.log(`[INFO] Groups to create: ${newGroupsData.length}, to update: ${groupUpdates.length}`);

    if (newGroupsData.length > 0) {
      const created = await base44.entities.Group.bulkCreate(newGroupsData);
      log.groupsCreated = newGroupsData.length;
      (Array.isArray(created) ? created : []).forEach(g => {
        groupMap.set(`${nd(g.name)}|${nd(g.category || "")}|${nd(g.school_name || "")}`, g);
      });
      console.log(`[INFO] Created ${log.groupsCreated} groups`);
    }
    if (newGroupsData.length > 0) await sleep(500);

    if (groupUpdates.length > 0) {
      console.log(`[INFO] Applying ${groupUpdates.length} group updates...`);
      await sequentialUpdates(base44.entities.Group, groupUpdates, 400);
      log.groupsUpdated = groupUpdates.length;
    }
    if (groupUpdates.length > 0) await sleep(500);

    // ── RECONECTAR INSCRIPCIONES HUÉRFANAS ───────────────────────────────────
    // Build a lookup: nd(group.name) → group, from the final groupMap state
    const groupByName = new Map();
    for (const [, g] of groupMap) {
      const nameKey = nd(g.name);
      if (!groupByName.has(nameKey)) groupByName.set(nameKey, g);
    }

    // Load all existing group IDs for fast orphan detection
    const validGroupIds = new Set([...groupMap.values()].map(g => g.id));

    const allRegistrations = await base44.asServiceRole.entities.Registration.list("-created_date", 2000);
    console.log(`[INFO] Loaded ${allRegistrations.length} registrations for reconnect pass`);

    const regReconnects = [];
    for (const reg of allRegistrations) {
      if (reg.group_id && validGroupIds.has(reg.group_id)) continue; // already connected
      if (!reg.group_name) continue; // nothing to match on
      const match = groupByName.get(nd(reg.group_name));
      if (match && match.id !== reg.group_id) {
        regReconnects.push({ id: reg.id, data: { group_id: match.id } });
      }
    }

    console.log(`[INFO] Registrations to reconnect: ${regReconnects.length}`);
    if (regReconnects.length > 0) {
      await sleep(1000);
      await sequentialUpdates(base44.asServiceRole.entities.Registration, regReconnects, 600);
      log.registrationsReconnected = regReconnects.length;
    }

    console.log(`[INFO] Done. Log: ${JSON.stringify({ ...log, warnings: log.warnings.length, errors: log.errors.length })}`);
    return Response.json({ success: true, log, totalRows: rawRows.length });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
