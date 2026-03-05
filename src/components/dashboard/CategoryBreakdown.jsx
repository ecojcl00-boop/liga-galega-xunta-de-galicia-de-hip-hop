import React from "react";

export default function CategoryBreakdown({ groups }) {
  const categoryCount = {};
  (groups || []).forEach((g) => {
    const cat = g.category || "Sin categoría";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  const sorted = Object.entries(categoryCount).sort(([, a], [, b]) => b - a);
  const max = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Sin datos</p>
      )}
      {sorted.map(([category, count]) => (
        <div key={category}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate">{category}</span>
            <span className="text-xs text-muted-foreground">{count} grupos</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}