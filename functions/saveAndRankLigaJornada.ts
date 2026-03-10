import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function calcularRanking(resultados, categoria, judgeScores = []) {
  const grupos = new Map();
  resultados
    .filter(r => r.categoria === categoria)
    .forEach(r => {
      const key = nd(r.grupo_nombre);
      if (!grupos.has(key)) {
        grupos.set(key, { nombre: r.grupo_nombre, school: r.school_name || "", puestos: {} });
      }
      grupos.get(key).puestos[r.numero_jornada] = r.puesto;
    });

  // Accumulate puntuacion from LigaResultado (primary numeric tiebreaker)
  const puntMap = new Map();
  resultados
    .filter(r => r.categoria === categoria && r.puntuacion > 0)
    .forEach(r => {
      const key = nd(r.grupo_nombre);
      puntMap.set(key, (puntMap.get(key) || 0) + r.puntuacion);
    });

  // Accumulate judge scores per group for secondary tiebreaker
  const scoreMap = new Map();
  judgeScores
    .filter(s => nd(s.category || "") === nd(categoria))
    .forEach(s => {
      const key = nd(s.group_name || "");
      scoreMap.set(key, (scoreMap.get(key) || 0) + (s.total || 0));
    });

  const items = [...grupos.values()];
  const allVals = items.flatMap(g => Object.values(g.puestos));
  const maxPos = allVals.length > 0 ? Math.max(...allVals) : 10;

  items.sort((a, b) => {
    for (let pos = 1; pos <= maxPos; pos++) {
      const ac = Object.values(a.puestos).filter(p => p === pos).length;
      const bc = Object.values(b.puestos).filter(p => p === pos).length;
      if (bc !== ac) return bc - ac;
    }
    // Final tiebreaker: accumulated puntuacion from LigaResultado, then judge scores
    const pa = puntMap ? (puntMap.get(nd(a.nombre)) || 0) : 0;
    const pb = puntMap ? (puntMap.get(nd(b.nombre)) || 0) : 0;
    if (pb !== pa) return pb - pa;
    const sa = scoreMap.get(nd(a.nombre)) || 0;
    const sb = scoreMap.get(nd(b.nombre)) || 0;
    if (sb !== sa) return sb - sa;
    return a.nombre.localeCompare(b.nombre);
  });

  return items.map((g, i) => ({ ...g, posicion: i + 1 }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { numero_jornada, nombre_competicion, fecha, ubicacion, notas, resultados, is_simulacro } = await req.json();

    if (!numero_jornada || !resultados?.length) {
      return Response.json({ error: 'numero_jornada y resultados son requeridos' }, { status: 400 });
    }

    const log = { ok: [], notFound: [], duplicates: [], errors: [], top3: {} };
    const today = new Date().toISOString().split('T')[0];

    // Load existing data in parallel
    const [allGroups, existingResultsAll] = await Promise.all([
      base44.asServiceRole.entities.Group.list("name", 500),
      base44.asServiceRole.entities.LigaResultado.filter({ numero_jornada: Number(numero_jornada) }, "-created_date", 1000)
    ]);
    // Only check duplicates within the same simulacro context
    const existingResults = existingResultsAll.filter(r => !!r.is_simulacro === !!is_simulacro);

    console.log(`[INFO] J${numero_jornada}: ${resultados.length} recibidos, ${existingResults.length} ya en BD`);

    // Create or reuse LigaCompeticion record
    const existingComps = await base44.asServiceRole.entities.LigaCompeticion.filter({ numero_jornada: Number(numero_jornada) });
    const sameTypeComps = existingComps.filter(c => !!c.is_simulacro === !!is_simulacro);
    let compId;
    if (sameTypeComps.length > 0) {
      compId = sameTypeComps[0].id;
    } else {
      const comp = await base44.asServiceRole.entities.LigaCompeticion.create({
        nombre: nombre_competicion || `Jornada ${numero_jornada}`,
        fecha: fecha || today,
        ubicacion: ubicacion || "",
        numero_jornada: Number(numero_jornada),
        notas: notas || "",
        is_simulacro: !!is_simulacro,
      });
      compId = comp.id;
    }

    // Process results
    const affectedCategories = new Set();
    const toCreate = [];

    for (const r of resultados) {
      if (!r.group_name || !r.category || !r.position) {
        log.errors.push(`Datos incompletos: ${JSON.stringify(r)}`);
        continue;
      }

      const normName = nd(r.group_name);
      const normCat = nd(r.category);

      // Duplicate check
      const isDup = existingResults.some(e => nd(e.grupo_nombre) === normName && nd(e.categoria) === normCat);
      if (isDup) {
        log.duplicates.push(`${r.group_name} (${r.category})`);
        continue;
      }

      // Group lookup
      const group = allGroups.find(g => nd(g.name) === normName);
      if (!group) log.notFound.push(r.group_name);

      toCreate.push({
        competicion_id: compId,
        competicion_nombre: nombre_competicion || `Jornada ${numero_jornada}`,
        numero_jornada: Number(numero_jornada),
        grupo_id: group?.id || null,
        grupo_nombre: r.group_name,
        grupo_nombre_original: group ? null : r.group_name,
        school_name: r.school_name || group?.school_name || "",
        categoria: r.category,
        puesto: Number(r.position),
        puntuacion: r.score ? Number(r.score) : null,
        is_simulacro: !!is_simulacro,
      });

      affectedCategories.add(r.category);
      log.ok.push({ grupo: r.group_name, categoria: r.category, puesto: r.position });
    }

    // Bulk save
    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.LigaResultado.bulkCreate(toCreate);
      await sleep(400);
    }

    console.log(`[INFO] Guardados ${toCreate.length}, duplicados ${log.duplicates.length}, no encontrados ${log.notFound.length}`);

    // Recalculate ranking for log summary (top3 only — no snapshots stored, ranking is always live)
    if (affectedCategories.size > 0) {
      const [allResultados, allJudgeScores] = await Promise.all([
        base44.asServiceRole.entities.LigaResultado.list("-numero_jornada", 2000),
        base44.asServiceRole.entities.JudgeScore.list("group_name", 5000),
      ]);
      const rankingResultados = allResultados.filter(r => !r.is_simulacro);
      for (const cat of affectedCategories) {
        const ranking = calcularRanking(rankingResultados, cat, allJudgeScores);
        log.top3[cat] = ranking.slice(0, 3).map(g => ({ nombre: g.nombre, puestos: g.puestos }));
      }
    }

    console.log(`[INFO] Done — ok:${log.ok.length} notFound:${log.notFound.length} dups:${log.duplicates.length}`);
    return Response.json({ success: true, log });

  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});