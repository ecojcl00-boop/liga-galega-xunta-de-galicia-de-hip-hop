import { buildAliasMap, normalizeName, canonicalClub } from "@/lib/normalizacion";

export const TOTAL_JORNADAS_CIRCUITO = 5;
export const BEST_N = 3;
export const PUNTOS_POR_PUESTO = { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 20, 10: 10 };

const CLUBS_EXCLUIDOS_HARDCODED = ["5db", "cincodb", "cinco db"];

export function isClubExcluido(schoolName, escuelasExcluidas = []) {
  if (!schoolName) return false;
  const norm = schoolName.toLowerCase().trim();
  if (CLUBS_EXCLUIDOS_HARDCODED.some(e => norm.includes(e) || e.includes(norm))) return true;
  return escuelasExcluidas.some(s => s.toLowerCase().trim() === norm);
}

export function puntosParaPuesto(puesto) {
  return PUNTOS_POR_PUESTO[puesto] || 0;
}

function resultKey(r) {
  return `${normalizeName(r.grupo_nombre)}|${normalizeName(r.school_name || "")}`;
}

function applyAlias(r, aliasMap) {
  const key = resultKey(r);
  if (aliasMap.has(key)) {
    const alias = aliasMap.get(key);
    return {
      nombre: alias.canonical_nombre,
      school: alias.canonical_school,
      aliased: alias.nombre_original !== alias.canonical_nombre || alias.school_original !== alias.canonical_school,
      originalNombre: alias.nombre_original,
      originalSchool: alias.school_original,
    };
  }
  return {
    nombre: r.grupo_nombre,
    school: canonicalClub(r.school_name || ""),
    aliased: false,
  };
}

function groupKey(nombre, school) {
  return `${normalizeName(nombre)}|${normalizeName(school)}`;
}

export function calcularRankingLiga(resultados, categoria, aliasMap, escuelasExcluidas = []) {
  const grupos = new Map();

  resultados
    .filter(r => r.categoria === categoria)
    .forEach(r => {
      const resolved = applyAlias(r, aliasMap);

      if (isClubExcluido(resolved.school, escuelasExcluidas)) return;

      const key = groupKey(resolved.nombre, resolved.school);

      if (!grupos.has(key)) {
        grupos.set(key, {
          nombre: resolved.nombre,
          school: resolved.school,
          jornadas: {},
          puestos: {},
          aliases: [],
        });
      }
      const g = grupos.get(key);
      const pts = r.puntos_liga != null ? r.puntos_liga : puntosParaPuesto(r.puesto);
      g.jornadas[r.numero_jornada] = pts;
      g.puestos[r.numero_jornada] = r.puesto;

      if (resolved.aliased) {
        const entry = `J${r.numero_jornada}: "${r.grupo_nombre}" (${r.school_name})`;
        if (!g.aliases.includes(entry)) g.aliases.push(entry);
      }
    });

  const items = [...grupos.values()].map(g => {
    const jornadasParticipadas = Object.keys(g.jornadas).length;
    const allPts = Object.values(g.jornadas).sort((a, b) => b - a);
    const best3 = allPts.slice(0, BEST_N).reduce((s, p) => s + p, 0);
    const hasBonus = jornadasParticipadas >= TOTAL_JORNADAS_CIRCUITO;
    const total = hasBonus ? Math.round(best3 * 1.1) : best3;
    return { ...g, jornadasParticipadas, best3, total, hasBonus };
  });

  const jornadasOrdenadas = [...new Set(resultados.map(r => r.numero_jornada))].sort((a, b) => b - a);

  items.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;

    for (const j of jornadasOrdenadas) {
      const pA = a.puestos[j];
      const pB = b.puestos[j];
      if (pA != null && pB != null) {
        if (pA !== pB) return pA - pB;
        break;
      }
    }

    if (b.jornadasParticipadas !== a.jornadasParticipadas) return b.jornadasParticipadas - a.jornadasParticipadas;

    for (const j of jornadasOrdenadas) {
      const pA = a.puestos[j];
      const pB = b.puestos[j];
      if (pA != null && pB != null && pA !== pB) return pA - pB;
    }

    return a.nombre.localeCompare(b.nombre);
  });

  return items.map((g, i) => ({ ...g, posicion: i + 1 }));
}