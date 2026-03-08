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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, competition_id, competition_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // Download and parse Excel
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: `No se pudo descargar el archivo: ${fileRes.status}` }, { status: 400 });

    const arrayBuffer = await fileRes.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: false, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });

    const log = {
      schoolsCreated: 0, schoolsUpdated: 0,
      participantsCreated: 0, participantsExisting: 0,
      groupsCreated: 0, groupsUpdated: 0,
      registrationsCreated: 0,
      warnings: [], errors: [],
    };

    // Load all existing data upfront (one batch per entity)
    const [existingSchools, existingGroups, existingRegs] = await Promise.all([
      base44.entities.School.list("name", 500),
      base44.entities.Group.list("name", 500),
      competition_id
        ? base44.entities.Registration.filter({ competition_id }, "-created_date", 500)
        : Promise.resolve([]),
    ]);

    // Build lookup maps (case+diacritics insensitive)
    const schoolMap = new Map(existingSchools.map(s => [removeDiacritics(s.name), s]));
    const groupMap = new Map(existingGroups.map(g => {
      const catNorm = normalizeCategory(g.category);
      const catKey = removeDiacritics(catNorm || g.category || "");
      return [`${removeDiacritics(g.name)}|${removeDiacritics(g.school_name || "")}|${catKey}`, g];
    }));
    const regMap = new Set(existingRegs.map(r => r.group_id));

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const groupName = String(row["nombre_grupo"] || "").trim();
      const schoolName = String(row["escuela"] || "").trim();
      const categoryRaw = String(row["categoria"] || "").trim();
      const coachName = String(row["nombre_entrenador"] || "").trim();
      const coachEmail = String(row["email_entrenador"] || "").trim().toLowerCase();
      const coachPhone = String(row["telefono_entrenador"] || "").trim();

      if (!groupName) {
        log.errors.push(`Fila ${rowNum}: Nombre de grupo vacío — omitida`);
        continue;
      }

      const category = normalizeCategory(categoryRaw);
      if (!category) {
        log.errors.push(`Fila ${rowNum} (${groupName}): Categoría no reconocida "${categoryRaw}" — omitida`);
        continue;
      }

      // Parse participants (nombre_1..nombre_46 + nacimiento_1..nacimiento_46)
      const participants = [];
      for (let n = 1; n <= 46; n++) {
        const name = String(row[`nombre_${n}`] || "").trim();
        if (!name) continue;
        const birth = String(row[`nacimiento_${n}`] || "").trim();
        participants.push({ name, birth_date: birth });
        if (!birth) {
          log.warnings.push(`Fila ${rowNum} (${groupName}): "${name}" sin fecha de nacimiento`);
        }
      }

      if (participants.length === 0) {
        log.warnings.push(`Fila ${rowNum} (${groupName}): Sin participantes encontrados`);
      }

      const schoolKey = removeDiacritics(schoolName);

      // ── School UPSERT ──────────────────────────────────────────────────────
      let school = schoolMap.get(schoolKey);
      if (!school) {
        school = await base44.entities.School.create({ name: schoolName, email: coachEmail, phone: coachPhone });
        schoolMap.set(schoolKey, school);
        log.schoolsCreated++;
      } else {
        const updates = {};
        if (!school.email && coachEmail) updates.email = coachEmail;
        if (!school.phone && coachPhone) updates.phone = coachPhone;
        if (Object.keys(updates).length > 0) {
          await base44.entities.School.update(school.id, updates);
          Object.assign(school, updates);
          log.schoolsUpdated++;
        }
      }

      // ── Group UPSERT ───────────────────────────────────────────────────────
      const groupKey = `${removeDiacritics(groupName)}|${schoolKey}|${removeDiacritics(category)}`;
      let group = groupMap.get(groupKey);

      if (!group) {
        group = await base44.entities.Group.create({
          name: groupName,
          school_name: schoolName,
          school_id: school.id,
          category,
          coach_name: coachName,
          coach_email: coachEmail,
          coach_phone: coachPhone,
          participants,
        });
        groupMap.set(groupKey, group);
        log.groupsCreated++;
        log.participantsCreated += participants.length;
      } else {
        const existingNames = new Set((group.participants || []).map(p => removeDiacritics(p.name)));
        const newParticipants = participants.filter(p => !existingNames.has(removeDiacritics(p.name)));

        // Merge: update birth_dates on existing participants if missing, add new ones
        const mergedParticipants = (group.participants || []).map(ep => {
          if (!ep.birth_date) {
            const fromExcel = participants.find(p => removeDiacritics(p.name) === removeDiacritics(ep.name));
            if (fromExcel?.birth_date) return { ...ep, birth_date: fromExcel.birth_date };
          }
          return ep;
        });
        mergedParticipants.push(...newParticipants);

        const updates = { participants: mergedParticipants };
        if (!group.coach_name && coachName) updates.coach_name = coachName;
        if (!group.coach_email && coachEmail) updates.coach_email = coachEmail;
        if (!group.coach_phone && coachPhone) updates.coach_phone = coachPhone;
        if (!group.school_id) updates.school_id = school.id;

        await base44.entities.Group.update(group.id, updates);
        Object.assign(group, updates);
        log.groupsUpdated++;
        log.participantsCreated += newParticipants.length;
        log.participantsExisting += participants.length - newParticipants.length;
      }

      // ── Registration UPSERT ────────────────────────────────────────────────
      if (competition_id && !regMap.has(group.id)) {
        await base44.entities.Registration.create({
          competition_id,
          competition_name: competition_name || "",
          group_id: group.id,
          group_name: group.name,
          school_name: schoolName,
          category,
          coach_name: coachName,
          status: "confirmed",
          payment_status: "pending",
          participants_count: participants.length,
        });
        regMap.add(group.id);
        log.registrationsCreated++;
      }
    }

    return Response.json({ success: true, log, totalRows: rawRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});