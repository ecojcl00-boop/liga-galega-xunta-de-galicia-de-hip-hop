import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Trophy } from "lucide-react";

const CATEGORY_ORDER = [
  "Mini Parejas A", "Mini Parejas B", "Mini Individual A", "Mini Individual B",
  "Individual", "Parejas", "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

const medalEmoji = { 1: "🥇", 2: "🥈", 3: "🥉" };
const medalColor = {
  1: "text-yellow-500 bg-yellow-50",
  2: "text-gray-500 bg-gray-50",
  3: "text-amber-600 bg-amber-50",
};

export default function RankingSummary() {
  const { data: results = [] } = useQuery({
    queryKey: ["competition_results"],
    queryFn: () => base44.entities.CompetitionResult.list("-competition_date", 500),
  });

  // Get top 3 per category for Marín 2026
  const marinResults = results.filter(r => r.competition_name === "Marín 2026");
  const byCategory = {};
  marinResults.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  });

  const orderedCategories = Object.keys(byCategory).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  if (orderedCategories.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-4">Sin resultados disponibles</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Trophy className="w-4 h-4 text-primary" />
        <span className="font-medium text-foreground">Marín 2026</span>
        <span>— Top 3 por categoría</span>
      </div>
      <div className="space-y-3">
        {orderedCategories.map(cat => {
          const top3 = byCategory[cat].sort((a, b) => a.position - b.position).slice(0, 3);
          return (
            <div key={cat} className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</p>
              <div className="grid gap-1">
                {top3.map(r => (
                  <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${medalColor[r.position] || "bg-muted/30 text-foreground"}`}>
                    <span className="text-base">{medalEmoji[r.position] || `${r.position}º`}</span>
                    <span className="font-medium text-sm flex-1 truncate">{r.group_name}</span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">{r.school_name}</span>
                    <span className="font-bold text-sm">{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}