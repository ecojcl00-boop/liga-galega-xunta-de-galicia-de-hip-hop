/**
 * Sistema de normalización y deduplicación de participantes/clubs para la Liga.
 * IMPORTANTE: La normalización se aplica SOLO para comparar, NUNCA se almacenan nombres normalizados.
 */

// ─────────────────────────────────────────────
// ALIASES DE CLUBS CONOCIDOS
// ─────────────────────────────────────────────
const CLUB_ALIAS_GROUPS = [
  ["ALL DANCE STUDIO", "CLUB ALL DANCE STUDIO", "ALL DANCE"],
  ["CLUB GRAVITTY", "GRAVITTY"],
  ["DA VIGO", "DANCE ACADEMY VIGO"],
  ["DANZA 10", "DANZA10", "D10"],
  ["STAR DANCE", "STARDANCE", "CLUB STAR DANCE"],
  ["SEVEN AND DANZA FERROL", "7 AND DANZA FERROL", "SEVEN AND DANZA"],
  ["CD DA RUA", "DA RUA"],
  ["PASO A PASO", "PASO A PASO DANCE"],
];

// Mapa: nombre_normalizado -> nombre_canónico del grupo
const CLUB_CANONICAL_MAP = new Map();
CLUB_ALIAS_GROUPS.forEach(group => {
  const canonical = group[0];
  group.forEach(alias => {
    CLUB_CANONICAL_MAP.set(normalizeClub(alias), canonical);
  });
});

function normalizeClub(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['''´`\-_]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalClub(str = "") {
  const norm = normalizeClub(str);
  // Buscar en el mapa
  if (CLUB_CANONICAL_MAP.has(norm)) return CLUB_CANONICAL_MAP.get(norm);
  // Buscar coincidencia parcial
  for (const [key, canonical] of CLUB_CANONICAL_MAP) {
    if (norm.includes(key) || key.includes(norm)) return canonical;
  }
  return str.trim().toUpperCase();
}

export function clubsMatch(a = "", b = "") {
  const ca = canonicalClub(a);
  const cb = canonicalClub(b);
  if (ca === cb) return true;
  // Fuzzy sobre canonicals normalizados
  return levenshteinSim(normalizeClub(ca), normalizeClub(cb)) >= 0.80;
}

// ─────────────────────────────────────────────
// NORMALIZACIÓN DE NOMBRES DE GRUPOS
// ─────────────────────────────────────────────
export function normalizeName(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")       // tildes
    .replace(/['''´`\-_]/g, "")            // apóstrofos y guiones
    .replace(/[^\w\s]/g, "")               // otros especiales
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Versión con palabras ordenadas alfabéticamente (para "Sara Ferreiro" == "Ferreiro Sara") */
function normalizeNameSorted(str = "") {
  const n = normalizeName(str);
  const words = n.split(" ");
  if (words.length === 2) return words.sort().join(" ");
  return n;
}

// ─────────────────────────────────────────────
// DISTANCIA DE LEVENSHTEIN
// ─────────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function levenshteinSim(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

// ─────────────────────────────────────────────
// COMPARACIÓN DE NOMBRES DE GRUPOS
// ─────────────────────────────────────────────
export function groupNameSim(a = "", b = "") {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;

  // Versión con palabras ordenadas
  const sa = normalizeNameSorted(a);
  const sb = normalizeNameSorted(b);
  if (sa === sb) return 0.99;

  // Singular/plural (diferencia de "s" al final)
  if (na === nb + "s" || nb === na + "s") return 0.97;

  // Contención completa
  if (na.includes(nb) || nb.includes(na)) return 0.95;

  // Levenshtein normal
  const sim = levenshteinSim(na, nb);
  // Levenshtein con palabras ordenadas
  const simSorted = levenshteinSim(sa, sb);

  return Math.max(sim, simSorted);
}

// ─────────────────────────────────────────────
// DETECCIÓN DE DUPLICADOS
// ─────────────────────────────────────────────
const NAME_SIM_THRESHOLD = 0.85;
const CLUB_SIM_THRESHOLD = 0.80;

/**
 * Dado un array de LigaResultado, devuelve pares de posibles duplicados.
 * @param {Array} resultados
 * @param {Array} aliasesIgnorados - array de {key_a, key_b} que el admin marcó como "diferentes"
 * @returns {Array} pares: { a, b, nameSim, clubSim, categoria }
 */
export function detectarDuplicados(resultados, aliasesIgnorados = []) {
  const ignoredSet = new Set(aliasesIgnorados.map(x => pairKey(x.key_a, x.key_b)));

  // Agrupar por categoría
  const porCategoria = {};
  resultados.forEach(r => {
    if (!porCategoria[r.categoria]) porCategoria[r.categoria] = [];
    porCategoria[r.categoria].push(r);
  });

  const pares = [];

  Object.entries(porCategoria).forEach(([categoria, items]) => {
    // Construir lista única por (grupo_nombre, school_name, numero_jornada)
    const unique = [];
    const seen = new Set();
    items.forEach(r => {
      const k = `${normalizeName(r.grupo_nombre)}|${normalizeClub(r.school_name)}|${r.numero_jornada}`;
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(r);
      }
    });

    // Comparar todos los pares
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];

        // No comparar registros de la misma jornada del mismo club (son distintos participantes)
        if (a.numero_jornada === b.numero_jornada && normalizeClub(a.school_name) === normalizeClub(b.school_name)) continue;

        const nameSim = groupNameSim(a.grupo_nombre, b.grupo_nombre);
        if (nameSim < NAME_SIM_THRESHOLD) continue;

        // Si son exactamente iguales ya los agrupa la lógica de ranking, saltar
        if (normalizeName(a.grupo_nombre) === normalizeName(b.grupo_nombre) &&
            canonicalClub(a.school_name) === canonicalClub(b.school_name)) continue;

        const clubSim = clubsMatch(a.school_name, b.school_name) ? 1 : levenshteinSim(normalizeClub(canonicalClub(a.school_name)), normalizeClub(canonicalClub(b.school_name)));
        if (clubSim < CLUB_SIM_THRESHOLD) continue;

        const ka = resultKey(a);
        const kb = resultKey(b);
        if (ignoredSet.has(pairKey(ka, kb))) continue;

        pares.push({ a, b, nameSim, clubSim, categoria });
      }
    }
  });

  // Deduplicar pares (puede haber repetidos de distintas jornadas)
  const paresUnicos = [];
  const paresSet = new Set();
  pares.forEach(p => {
    const k = pairKey(normalizeName(p.a.grupo_nombre) + normalizeClub(p.a.school_name), normalizeName(p.b.grupo_nombre) + normalizeClub(p.b.school_name)) + "|" + p.categoria;
    if (!paresSet.has(k)) {
      paresSet.add(k);
      paresUnicos.push(p);
    }
  });

  return paresUnicos.sort((a, b) => b.nameSim - a.nameSim);
}

function resultKey(r) {
  return `${normalizeName(r.grupo_nombre)}|${normalizeClub(r.school_name)}`;
}

function pairKey(a, b) {
  return [a, b].sort().join("||");
}

/**
 * Dado un mapa de aliases (Map: normKey -> canonical), aplica aliases a un resultado
 * para obtener nombre y club canonicales.
 */
export function applyAliases(result, aliasMap) {
  const key = resultKey(result);
  if (aliasMap.has(key)) {
    const alias = aliasMap.get(key);
    return { ...result, grupo_nombre: alias.canonical_nombre, school_name: alias.canonical_school };
  }
  return result;
}

/**
 * Construye un Map de aliases desde el array de GrupoAlias persistidos.
 * Cada alias tiene: key_original (normKey del resultado), canonical_nombre, canonical_school
 */
export function buildAliasMap(grupoAliases) {
  const map = new Map();
  grupoAliases.forEach(a => {
    if (a.key_original) map.set(a.key_original, a);
  });
  return map;
}

export { resultKey, pairKey };