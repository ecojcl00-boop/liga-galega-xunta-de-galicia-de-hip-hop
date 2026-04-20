import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Trophy } from "lucide-react";
import { useSimulacro } from "@/components/SimulacroContext";
import { buildAliasMap, normalizeName, canonicalClub } from "@/lib/normalizacion";

const CATEGORY_ORDER = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

const TOTAL_JORNADAS_CIRCUITO = 5;
const BEST_N = 3;
const PUNTOS_POR_PUESTO = { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 20, 10: 10 };

function applyAlias(r, aliasMap) {
  const key = `${normalizeName(r.grupo_nombre)}|${normalizeName(r.school_name || "")}`;
  if (aliasMap.has(key)) {
    const alias = aliasMap.get(key);
    return { nombre: alias.canonical_nombre, school: alias.canonical_school };
  }
  return { nombre: r.grupo_nombre, school: canonicalClub(r.school_name || "") };
}

function calcularRankingLiga(resultados, categoria, aliasMap) {
  const grupos = new Map();

  resultados
    .filter(r => r.categoria === categoria)
    .forEach(r => {
      const resolved = applyAlias(r, aliasMap);
      const key = `${normalizeName(resolved.nombre)}|${normalizeName(resolved.school)}`;
      if (!grupos.has(key)) {
        grupos.set(key, { nombre: resolved.nombre, school: resolved.school, jornadas: {} });
      }
      const g = grupos.get(key);
      const pts = r.puntos_liga != null ? r.puntos_liga : (PUNTOS_POR_PUESTO[r.puesto] || 0);
      g.jornadas[r.numero_jornada] = pts;
    });

  const items = [...grupos.values()].map(g => {
    const jornadasParticipadas = Object.keys(g.jornadas).length;
    const allPts = Object.values(g.jornadas).sort((a, b) => b - a);
    const best3 = allPts.slice(0, BEST_N).reduce((s, p) => s + p, 0);
    const hasBonus = jornadasParticipadas >= TOTAL_JORNADAS_CIRCUITO;
    const total = hasBonus ? Math.round(best3 * 1.1) : best3;
    return { ...g, total, hasBonus };
  });

  items.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  return items;
}

const medalEmoji = { 1: "🥇", 2: "🥈", 3: "🥉" };
const medalColor = {
  1: "text-yellow-500 bg-yellow-500/10 border border-yellow-500/20",
  2: "text-gray-400 bg-gray-400/10 border border-gray-400/20",
  3: "text-amber-600 bg-amber-600/10 border border-amber-600/20",
};

export default function RankingSummary() {
  const { isSimulacro } = useSimulacro();

  const { data: resultados = [] } = useQuery({
    queryKey: ["liga_resultados_home", isSimulacro],
    queryFn: () => base44.entities.LigaResultado.list(),
    select: (data) => data.filter(r => isSimulacro ? r.is_simulacro : !r.is_simulacro),
  });

  const { data: grupoAliases = [] } = useQuery({
    queryKey: ["grupoAliases"],
    queryFn: () => base44.entities.GrupoAlias.filter({ estado: "unificado" }),
  });

  const aliasMap = buildAliasMap(grupoAliases);

  const allCategories = [...new Set(resultados.map(r => r.categoria))].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  if (allCategories.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-4">Sin resultados de liga disponibles</p>;
  }

  return (
    <div className="space-y-5">
      {allCategories.map(cat => {
        const top3 = calcularRankingLiga(resultados, cat, aliasMap).slice(0, 3);
        if (top3.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</p>
            <div className="grid gap-1">
              {top3.map((g, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${medalColor[i + 1] || "bg-muted/30"}`}>
                  <span className="text-base">{medalEmoji[i + 1]}</span>
                  <span className="font-medium text-sm flex-1 truncate">{g.nombre}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">{g.school}</span>
                  <span className="text-xs font-bold text-primary ml-1">{g.total} pts</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}