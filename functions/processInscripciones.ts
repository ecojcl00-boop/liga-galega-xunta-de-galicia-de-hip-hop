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
  return CATEGORY_MAP[nd(raw)] || null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, competition_id, competition_name, is_simulacro } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });
    if (!competition_id) return Response.json({ error: 'competition_id required' }, { status: 400 });

    // ── PASO 1: Parsear Excel ─────────────────────────────────────────────────
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: `No se pudo descargar el archivo: ${fileRes.status}` }, { status: 400 });

    const ab = await fileRes.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array', raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });

    console.log(`[INFO] Parsed ${rawRows.length} rows from Excel`);

    const log = {
      registrationsCreated: 0,
      registrationsSkipped: 0,
      groupsNotFound: [],
      warnings: [], errors: [],
    };

    // ── PASO 2: Cargar grupos y registraciones existentes ─────────────────────
    const allGroups = [];
    const PAGE_SIZE = 500;
    let offset = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.Group.list("name", PAGE_SIZE, offset);
      allGroups.push(...page);
      console.log(`[INFO] Groups page offset=${offset}: got ${page.length}`);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const existingRegs = await base44.entities.Registration.filter({ competition_id }, "-created_date", 500);

    console.log(`[INFO] Loaded: ${allGroups.length} groups, ${existingRegs.length} regs for this competition`);

    // Clave de deduplicación = nd(name)|nd(category)
    const groupMap = new Map(allGroups.map(g => [
      `${nd(g.name)}|${nd(g.category || "")}|${nd(g.school_name || "")}`,
      g,
    ]));

    const regSet = new Set(existingRegs.map(r => r.group_id));

    // ── PASO 3: Parsear filas ─────────────────────────────────────────────────
    const parsedRows = [];
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const rowNum = i + 2;
      const groupName = String(r["nombre_grupo"] || "").trim();
      const schoolName = String(r["escuela"] || "").trim();
      const categoryRaw = String(r["categoria"] || "").trim();
      const coachName = String(r["nombre_entrenador"] || "").trim();

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

      parsedRows.push({ rowNum, groupName, schoolName, category, coachName, participants });
    }

    // ── PASO 4: REGISTRATIONS ─────────────────────────────────────────────────
    const regsToCreate = [];
    const seenGroupKeys = new Set();

    for (const row of parsedRows) {
      const groupKey = `${nd(row.groupName)}|${nd(row.category)}|${nd(row.schoolName)}`;

      if (seenGroupKeys.has(groupKey)) {
        log.warnings.push(`Fila ${row.rowNum} (${row.groupName}): Grupo duplicado en Excel — segunda ocurrencia omitida`);
        continue;
      }
      seenGroupKeys.add(groupKey);

      const group = groupMap.get(groupKey);
      if (!group) {
        log.groupsNotFound.push({ groupName: row.groupName, category: row.category, key: groupKey });
        log.errors.push(`Fila ${row.rowNum} (${row.groupName}): Grupo no encontrado en la BD — ¿importaste primero los grupos?`);
        continue;
      }

      if (regSet.has(group.id)) {
        log.registrationsSkipped++;
        continue;
      }

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
        is_simulacro: !!is_simulacro,
      });
      regSet.add(group.id);
    }

    if (regsToCreate.length > 0) {
      await base44.entities.Registration.bulkCreate(regsToCreate);
      log.registrationsCreated = regsToCreate.length;
      console.log(`[INFO] Created ${log.registrationsCreated} registrations`);
    }

    console.log(`[INFO] Done. Log: ${JSON.stringify({ ...log, warnings: log.warnings.length, errors: log.errors.length })}`);
    return Response.json({ success: true, log, totalRows: rawRows.length });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
