import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Medal, Trophy } from "lucide-react";

const CATEGORY_ORDER = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

const CATEGORY_LABEL = { "Megacrew": "Mega Crew" };
function catLabel(c) { return CATEGORY_LABEL[c] || c; }

function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

// Ranking by position counts, with judge score as final tiebreaker
function calcularRanking(resultados, categoria, judgeScores = []) {
  const grupos = new Map();
  resultados
    .filter(r => r.categoria === categoria)
    .forEach(r => {
      const key = nd(r.grupo_nombre);
      if (!grupos.has(key)) grupos.set(key, { nombre: r.grupo_nombre, school: r.school_name || "", puestos: {} });
      grupos.get(key).puestos[r.numero_jornada] = r.puesto;
    });

  // Accumulated puntuacion from LigaResultado (primary numeric tiebreaker)
  const puntMap = new Map();
  resultados
    .filter(r => r.categoria === categoria && r.puntuacion > 0)
    .forEach(r => {
      const key = nd(r.grupo_nombre);
      puntMap.set(key, (puntMap.get(key) || 0) + r.puntuacion);
    });

  // Accumulated judge scores per group in this category (secondary tiebreaker)
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
    // Primary criteria: position count (1st first, then 2nd, etc.)
    for (let pos = 1; pos <= maxPos; pos++) {
      const ac = Object.values(a.puestos).filter(p => p === pos).length;
      const bc = Object.values(b.puestos).filter(p => p === pos).length;
      if (bc !== ac) return bc - ac;
    }
    // Tiebreaker 1: accumulated puntuacion from LigaResultado
    const pa = puntMap.get(nd(a.nombre)) || 0;
    const pb = puntMap.get(nd(b.nombre)) || 0;
    if (pb !== pa) return pb - pa;
    // Tiebreaker 2: accumulated judge scores
    const sa = scoreMap.get(nd(a.nombre)) || 0;
    const sb = scoreMap.get(nd(b.nombre)) || 0;
    if (sb !== sa) return sb - sa;
    return a.nombre.localeCompare(b.nombre);
  });

  return items.map((g, i) => ({
    ...g,
    posicion: i + 1,
    puntuacion: puntMap.get(nd(g.nombre)) || 0,
    judgeScore: scoreMap.get(nd(g.nombre)) || 0,
  }));
}

function PosCell({ pos }) {
  if (!pos) return <span className="text-muted-foreground/30">—</span>;
  if (pos === 1) return <span className="font-bold text-yellow-500">{pos}º</span>;
  if (pos === 2) return <span className="font-semibold text-gray-400">{pos}º</span>;
  if (pos === 3) return <span className="font-semibold text-amber-600">{pos}º</span>;
  return <span className="text-foreground">{pos}º</span>;
}

function PodiumCard({ group, rank, jornadas }) {
  const cfg = {
    1: { bg: "bg-yellow-500/10 border-yellow-500/40", icon: "🥇", offset: "" },
    2: { bg: "bg-gray-300/20 border-gray-400/30", icon: "🥈", offset: "mt-8" },
    3: { bg: "bg-amber-600/10 border-amber-700/30", icon: "🥉", offset: "mt-12" }
  }[rank];

  return (
    <div className={`flex-1 ${cfg.offset}`}>
      <div className={`border-2 rounded-xl p-3 text-center ${cfg.bg} flex flex-col items-center gap-1.5`}>
        <span className="text-2xl">{cfg.icon}</span>
        <p className={`font-bold text-sm leading-tight line-clamp-2 ${rank === 1 ? "text-base" : ""}`}>{group.nombre}</p>
        <p className="text-xs text-muted-foreground truncate w-full">{group.school}</p>
        <div className="flex flex-wrap gap-1 justify-center mt-1">
          {jornadas.map(j => (
            <span key={j} className="text-xs bg-background/70 rounded px-1.5 py-0.5 border">
              J{j}:{" "}
              {group.puestos[j]
                ? <span className={group.puestos[j] === 1 ? "text-yellow-500 font-bold" : ""}>{group.puestos[j]}º</span>
                : <span className="text-muted-foreground/40">—</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRanking({ categoria, resultados, jornadas, judgeScores }) {
  const [expanded, setExpanded] = useState(false);
  const ranking = calcularRanking(resultados, categoria, judgeScores);
  if (ranking.length === 0) return null;

  const top3 = ranking.slice(0, 3);
  const hasScores = ranking.some(g => g.puntuacion > 0 || g.judgeScore > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Medal className="w-5 h-5 text-primary" />
          {catLabel(categoria)}
          <Badge variant="secondary" className="ml-auto">
            {ranking.length} {ranking.length === 1 ? "grupo" : "grupos"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">

        {/* Podium: 2nd | 1st | 3rd */}
        <div className="flex gap-3 items-end px-2 pb-2">
          {top3[1] ? <PodiumCard group={top3[1]} rank={2} jornadas={jornadas} /> : <div className="flex-1 mt-8" />}
          <PodiumCard group={top3[0]} rank={1} jornadas={jornadas} />
          {top3[2] ? <PodiumCard group={top3[2]} rank={3} jornadas={jornadas} /> : <div className="flex-1 mt-12" />}
        </div>

        {/* Expand button */}
        {ranking.length > 3 && (
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} className="w-full gap-2">
            {expanded
              ? <><ChevronUp className="w-4 h-4" />Ocultar clasificación completa</>
              : <><ChevronDown className="w-4 h-4" />Ver clasificación completa ({ranking.length} grupos)</>}
          </Button>
        )}

        {/* Full table */}
        {(expanded || ranking.length <= 3) && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pos.</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Grupo</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Escuela</th>
                  {jornadas.map(j => (
                    <th key={j} className="text-center py-2 px-3 text-muted-foreground font-medium">J{j}</th>
                  ))}
                  {hasScores && (
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium" title="Puntuación acumulada (criterio de desempate final)">
                      Pts.
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {ranking.map((g, i) => (
                  <tr
                    key={i}
                    className={`border-t ${i === 0 ? "bg-yellow-500/5" : i === 1 ? "bg-gray-400/5" : i === 2 ? "bg-amber-600/5" : ""}`}
                  >
                    <td className="py-2 px-3">
                      <span className={`font-bold tabular-nums ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {g.posicion}º
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium">{g.nombre}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">{g.school}</td>
                    {jornadas.map(j => (
                      <td key={j} className="text-center py-2 px-3 tabular-nums">
                        <PosCell pos={g.puestos[j]} />
                      </td>
                    ))}
                    {hasScores && (
                      <td className="text-center py-2 px-3 text-xs tabular-nums text-muted-foreground">
                        {g.puntuacion > 0 ? g.puntuacion.toFixed(1) : g.judgeScore > 0 ? g.judgeScore.toFixed(1) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LigaRankingView({ resultados }) {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: judgeScores = [] } = useQuery({
    queryKey: ["judge_scores_ranking"],
    queryFn: () => base44.entities.JudgeScore.list(),
  });

  const allCategories = [...new Set(resultados.map(r => r.categoria))].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  const jornadas = [...new Set(resultados.map(r => r.numero_jornada))].sort((a, b) => a - b);
  const displayCategories = selectedCategory === "all" ? allCategories : [selectedCategory];

  if (resultados.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground space-y-3">
        <Trophy className="w-12 h-12 mx-auto opacity-20" />
        <p className="font-medium">No hay resultados de liga todavía.</p>
        <p className="text-sm">Importa la primera jornada desde <span className="font-medium text-foreground">Importar Datos</span>.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Jornadas disputadas:</span>
          {jornadas.map(j => (
            <span key={j} className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">J{j}</span>
          ))}
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-52 ml-auto">
            <SelectValue placeholder="Filtrar categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {displayCategories.map(cat => (
          <CategoryRanking
            key={cat}
            categoria={cat}
            resultados={resultados}
            jornadas={jornadas}
            judgeScores={judgeScores}
          />
        ))}
      </div>
    </div>
  );
}