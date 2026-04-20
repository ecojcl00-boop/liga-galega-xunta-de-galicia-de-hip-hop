import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Medal, Trophy, Star } from "lucide-react";

const TOTAL_JORNADAS_CIRCUITO = 5;
const BEST_N = 3; // cuenta las 3 mejores

const CATEGORY_ORDER = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

const PUNTOS_POR_PUESTO = { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 20, 10: 10 };

function puntosParaPuesto(puesto) {
  return PUNTOS_POR_PUESTO[puesto] || 0;
}

function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function calcularRankingLiga(resultados, categoria, jornadasDisputadas) {
  const grupos = new Map();

  resultados
    .filter(r => r.categoria === categoria)
    .forEach(r => {
      const key = nd(r.grupo_nombre);
      if (!grupos.has(key)) {
        grupos.set(key, {
          nombre: r.grupo_nombre,
          school: r.school_name || "",
          jornadas: {}, // jornada -> puntos_liga
        });
      }
      const pts = r.puntos_liga != null ? r.puntos_liga : puntosParaPuesto(r.puesto);
      grupos.get(key).jornadas[r.numero_jornada] = pts;
    });

  const items = [...grupos.values()].map(g => {
    const jornadasParticipadas = Object.keys(g.jornadas).length;
    const allPts = Object.values(g.jornadas).sort((a, b) => b - a);
    const best3 = allPts.slice(0, BEST_N).reduce((s, p) => s + p, 0);
    const hasBonus = jornadasParticipadas >= TOTAL_JORNADAS_CIRCUITO;
    const total = hasBonus ? Math.round(best3 * 1.1) : best3;

    return { ...g, jornadasParticipadas, best3, total, hasBonus };
  });

  items.sort((a, b) => b.total - a.total || b.best3 - a.best3 || a.nombre.localeCompare(b.nombre));

  return items.map((g, i) => ({ ...g, posicion: i + 1 }));
}

function PodiumCard({ group, rank, jornadas }) {
  const cfg = {
    1: { bg: "bg-yellow-500/10 border-yellow-500/40", icon: "🥇" },
    2: { bg: "bg-gray-300/20 border-gray-400/30", icon: "🥈" },
    3: { bg: "bg-amber-600/10 border-amber-700/30", icon: "🥉" }
  }[rank];

  return (
    <div className={`flex-1 ${rank === 2 ? "mt-8" : rank === 3 ? "mt-12" : ""}`}>
      <div className={`border-2 rounded-xl p-3 text-center ${cfg.bg} flex flex-col items-center gap-1.5`}>
        <span className="text-2xl">{cfg.icon}</span>
        <p className={`font-bold text-sm leading-tight line-clamp-2 ${rank === 1 ? "text-base" : ""}`}>{group.nombre}</p>
        <p className="text-xs text-muted-foreground truncate w-full">{group.school}</p>
        <p className="text-lg font-bold text-primary">
          {group.total} pts
          {group.hasBonus && <span className="text-xs ml-1 text-yellow-500">★</span>}
        </p>
        <div className="flex flex-wrap gap-1 justify-center">
          {jornadas.map(j => (
            <span key={j} className="text-xs bg-background/70 rounded px-1.5 py-0.5 border">
              J{j}: {group.jornadas[j] != null ? <span className="font-medium">{group.jornadas[j]}</span> : <span className="text-muted-foreground/40">—</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRanking({ categoria, resultados, jornadas }) {
  const [expanded, setExpanded] = useState(false);
  const ranking = calcularRankingLiga(resultados, categoria, jornadas.length);
  if (ranking.length === 0) return null;
  const top3 = ranking.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Medal className="w-5 h-5 text-primary" />
          {categoria}
          <Badge variant="secondary" className="ml-auto">
            {ranking.length} {ranking.length === 1 ? "grupo" : "grupos"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Podium */}
        <div className="flex gap-3 items-end px-2 pb-2">
          {top3[1] ? <PodiumCard group={top3[1]} rank={2} jornadas={jornadas} /> : <div className="flex-1 mt-8" />}
          <PodiumCard group={top3[0]} rank={1} jornadas={jornadas} />
          {top3[2] ? <PodiumCard group={top3[2]} rank={3} jornadas={jornadas} /> : <div className="flex-1 mt-12" />}
        </div>

        {ranking.length > 3 && (
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} className="w-full gap-2">
            {expanded
              ? <><ChevronUp className="w-4 h-4" />Ocultar clasificación completa</>
              : <><ChevronDown className="w-4 h-4" />Ver clasificación completa ({ranking.length} grupos)</>}
          </Button>
        )}

        {(expanded || ranking.length <= 3) && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pos.</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Grupo</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Club</th>
                  {jornadas.map(j => (
                    <th key={j} className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">J{j}</th>
                  ))}
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((g, i) => (
                  <tr key={i} className={`border-t ${i === 0 ? "bg-yellow-500/5" : i === 1 ? "bg-gray-400/5" : i === 2 ? "bg-amber-600/5" : ""}`}>
                    <td className="py-2 px-3">
                      <span className={`font-bold tabular-nums ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {g.posicion}º
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium">
                      {g.nombre}
                      {g.hasBonus && <Star className="w-3 h-3 inline ml-1 text-yellow-500 fill-yellow-400" />}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">{g.school}</td>
                    {jornadas.map(j => (
                      <td key={j} className="text-center py-2 px-2 tabular-nums text-xs">
                        {g.jornadas[j] != null
                          ? <span className={g.jornadas[j] > 0 ? "font-medium" : "text-muted-foreground"}>{g.jornadas[j]}</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    ))}
                    <td className="text-center py-2 px-3 font-bold text-primary tabular-nums">
                      {g.total}
                      {g.hasBonus && <span className="text-yellow-500 text-xs ml-0.5">★</span>}
                    </td>
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Jornadas disputadas:</span>
          {jornadas.map(j => (
            <span key={j} className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">J{j}</span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400" />
          Bonus +10% por asistir a las 5 jornadas
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        Puntuación: suma de las <strong>3 mejores jornadas</strong> de cada participante (de 5 en total). 1º=100pts · 2º=90 · 3º=80 · 4º=70 · 5º=60 · 6º=50 · 7º=40 · 8º=30 · 9º=20 · 10º=10
      </div>

      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="Filtrar categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-6">
        {displayCategories.map(cat => (
          <CategoryRanking
            key={cat}
            categoria={cat}
            resultados={resultados}
            jornadas={jornadas}
          />
        ))}
      </div>
    </div>
  );
}