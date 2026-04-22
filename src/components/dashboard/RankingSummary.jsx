import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSimulacro } from "@/components/SimulacroContext";
import { buildAliasMap } from "@/lib/normalizacion";
import { calcularRankingLiga } from "@/lib/calcularRankingLiga";

const CATEGORY_ORDER = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

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

  const { data: escuelas = [] } = useQuery({
    queryKey: ["schoolsExcluidasLiga"],
    queryFn: () => base44.entities.School.filter({ excluida_de_liga: true }),
  });

  const aliasMap = buildAliasMap(grupoAliases);
  const escuelasExcluidas = escuelas.map(s => s.name);

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
        const top3 = calcularRankingLiga(resultados, cat, aliasMap, escuelasExcluidas).slice(0, 3);
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