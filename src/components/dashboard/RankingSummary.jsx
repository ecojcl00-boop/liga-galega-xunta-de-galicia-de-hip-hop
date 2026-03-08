import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Trophy } from "lucide-react";

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

function calcularRanking(resultados, categoria) {
  const grupos = new Map();
  resultados
    .filter(r => r.categoria === categoria)
    .forEach(r => {
      const key = nd(r.grupo_nombre);
      if (!grupos.has(key)) grupos.set(key, { nombre: r.grupo_nombre, school: r.school_name || "", puestos: {} });
      grupos.get(key).puestos[r.numero_jornada] = r.puesto;
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
    return a.nombre.localeCompare(b.nombre);
  });

  return items.map((g, i) => ({ ...g, posicion: i + 1 }));
}

const medalEmoji = { 1: "🥇", 2: "🥈", 3: "🥉" };
const medalColor = {
  1: "text-yellow-500 bg-yellow-500/10 border border-yellow-500/20",
  2: "text-gray-400 bg-gray-400/10 border border-gray-400/20",
  3: "text-amber-600 bg-amber-600/10 border border-amber-600/20",
};

export default function RankingSummary() {
  const { data: resultados = [] } = useQuery({
    queryKey: ["liga_resultados_home"],
    queryFn: () => base44.entities.LigaResultado.list(),
  });

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
        const top3 = calcularRanking(resultados, cat).slice(0, 3);
        if (top3.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              {catLabel(cat)}
            </p>
            <div className="grid gap-1">
              {top3.map((g, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${medalColor[i + 1] || "bg-muted/30"}`}>
                  <span className="text-base">{medalEmoji[i + 1]}</span>
                  <span className="font-medium text-sm flex-1 truncate">{g.nombre}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">{g.school}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}