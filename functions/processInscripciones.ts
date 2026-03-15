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

// Run updates one at a time with delay to avoid rate limits
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

    const { file_url, competition_id, competition_name, is_simulacro } = await req.json();
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
      registrationsCreated: 0,
      warnings: [], errors: [],
    };

    // ── Load existing data ────────────────────────────────────────────────────
    const [existingSchools, existingGroups, existingRegs] = await Promise.all([
      base44.entities.School.list("name", 500),
      base44.entities.Group.list("name", 500),
      competition_id
        ? base44.entities.Registration.filter({ competition_id }, "-created_date", 500)
        : Promise.resolve([]),
    ]);

    console.log(`[INFO] Loaded: ${existingSchools.length} schools, ${existingGroups.length} groups, ${existingRegs.length} regs`);

    const schoolMap = new Map(existingSchools.map(s => [nd(s.name), s]));

    // Reverse lookup: school email → school name, to resolve groups with missing school_name
    const emailToSchoolName = new Map(
      existingSchools.filter(s => s.email).map(s => [nd(s.email), s.name])
    );

    // Fix Bug 1: resolve school_name for existing groups that have it empty/null so that
    // reimporting the same Excel never creates duplicates due to a missing school_name in the DB.
    for (const g of existingGroups) {
      if (!g.school_name?.trim()) {
        const resolved = g.coach_email ? emailToSchoolName.get(nd(g.coach_email)) : null;
        g.school_name = resolved || "";
      }
    }

    const groupMap = new Map(existingGroups.map(g => {
      const catKey = nd(normalizeCategory(g.category) || g.category || "");
      return [`${nd(g.name)}|${nd(g.school_name || "")}|${catKey}`, g];
    }));
    const regSet = new Set(existingRegs.map(r => r.group_id));

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

    // ── DEBUG: dump first 5 groupMap keys to diagnose deduplication misses ─────
    const groupMapKeys = [...groupMap.keys()];
    console.log(`[DEBUG] groupMap size: ${groupMapKeys.length}`);
    console.log(`[DEBUG] First 5 groupMap keys: ${JSON.stringify(groupMapKeys.slice(0, 5))}`);

    // ── GROUPS ────────────────────────────────────────────────────────────────
    const newGroupsData = [];
    const groupUpdates = [];
    const seenGroupKeys = new Set();
    let debugMissCount = 0;

    for (const row of parsedRows) {
      const schoolKey = nd(row.schoolName);
      const school = schoolMap.get(schoolKey);
      const schoolId = school?.id || null;
      const groupKey = `${nd(row.groupName)}|${schoolKey}|${nd(row.category)}`;

      if (seenGroupKeys.has(groupKey)) {
        log.warnings.push(`Fila ${row.rowNum} (${row.groupName}): Grupo duplicado en Excel — segunda ocurrencia omitida`);
        continue;
      }
      seenGroupKeys.add(groupKey);

      const existing = groupMap.get(groupKey);

      // DEBUG: for the first 5 misses, print both keys to spot the mismatch
      if (!existing && debugMissCount < 5) {
        debugMissCount++;
        // Find the closest key in the map by group name to compare
        const nameKey = nd(row.groupName);
        const candidateKey = groupMapKeys.find(k => k.startsWith(nameKey + "|"));
        console.log(`[DEBUG MISS ${debugMissCount}] Excel key : "${groupKey}"`);
        console.log(`[DEBUG MISS ${debugMissCount}] Map candid: "${candidateKey ?? "(no match by name)"}"`);
        console.log(`[DEBUG MISS ${debugMissCount}] Raw values — name:"${row.groupName}" school:"${row.schoolName}" category:"${row.category}"`);
      }

      if (!existing) {
        newGroupsData.push({
          name: row.groupName, school_name: row.schoolName, school_id: schoolId,
          category: row.category, coach_name: row.coachName,
          coach_email: row.coachEmail, coach_phone: row.coachPhone,
          participants: row.participants,
        });
        log.participantsCreated += row.participants.length;
      } else {
        // Smart diff: only update if something actually changed
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
        const fieldUpd = {};
        if (!existing.coach_name && row.coachName) fieldUpd.coach_name = row.coachName;
        if (!existing.coach_email && row.coachEmail) fieldUpd.coach_email = row.coachEmail;
        if (!existing.coach_phone && row.coachPhone) fieldUpd.coach_phone = row.coachPhone;
        if (!existing.school_id && schoolId) fieldUpd.school_id = schoolId;

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
        const catKey = nd(normalizeCategory(g.category) || g.category || "");
        groupMap.set(`${nd(g.name)}|${nd(g.school_name || "")}|${catKey}`, g);
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

    // ── REGISTRATIONS ─────────────────────────────────────────────────────────
    if (competition_id) {
      const regsToCreate = [];
      for (const row of parsedRows) {
        const schoolKey = nd(row.schoolName);
        const groupKey = `${nd(row.groupName)}|${schoolKey}|${nd(row.category)}`;
        const group = groupMap.get(groupKey);
        if (group && !regSet.has(group.id)) {
          regsToCreate.push({
            competition_id, competition_name: competition_name || "",
            group_id: group.id, group_name: group.name,
            school_name: row.schoolName, category: row.category, coach_name: row.coachName,
            status: "confirmed", payment_status: "pending",
            participants_count: row.participants.length,
            is_simulacro: !!is_simulacro,
          });
          regSet.add(group.id);
        }
      }
      if (regsToCreate.length > 0) {
        await base44.entities.Registration.bulkCreate(regsToCreate);
        log.registrationsCreated = regsToCreate.length;
        console.log(`[INFO] Created ${log.registrationsCreated} registrations`);
      }
    }

    console.log(`[INFO] Done. Log: ${JSON.stringify({ ...log, warnings: log.warnings.length, errors: log.errors.length })}`);
    return Response.json({ success: true, log, totalRows: rawRows.length });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});