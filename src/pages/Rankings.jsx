import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";

const CATEGORY_ORDER = [
  "Mini Parejas A", "Mini Parejas B", "Mini Individual A", "Mini Individual B",
  "Individual", "Parejas", "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

function positionColor(pos) {
  if (pos === 1) return "text-yellow-500";
  if (pos === 2) return "text-gray-400";
  if (pos === 3) return "text-amber-600";
  return "text-muted-foreground";
}

function positionBg(pos) {
  if (pos === 1) return "bg-yellow-500/10 border-yellow-500/30";
  if (pos === 2) return "bg-gray-400/10 border-gray-400/30";
  if (pos === 3) return "bg-amber-600/10 border-amber-600/30";
  return "bg-muted/30 border-transparent";
}

export default function Rankings() {
  const [selectedCompetition, setSelectedCompetition] = useState("Marín 2026");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["competition_results"],
    queryFn: () => base44.entities.CompetitionResult.list("-competition_date", 500),
  });

  const competitions = [...new Set(results.map(r => r.competition_name))];

  const filtered = results
    .filter(r => r.competition_name === selectedCompetition)
    .filter(r => selectedCategory === "all" || r.category === selectedCategory)
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      if (a.category !== b.category) {
        if (ai === -1 && bi === -1) return a.category.localeCompare(b.category);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.position - b.position;
    });

  const categories = [...new Set(results.filter(r => r.competition_name === selectedCompetition).map(r => r.category))];

  // Group by category
  const byCategory = {};
  filtered.forEach(r => {
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

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-primary" /> Rankings
          </h1>
          <p className="text-muted-foreground mt-1">Resultados por competición</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Competición" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORY_ORDER.filter(c => categories.includes(c)).map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : orderedCategories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Sin resultados</div>
      ) : (
        <div className="space-y-6">
          {orderedCategories.map(cat => (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Medal className="w-5 h-5 text-primary" />
                  {cat}
                  <Badge variant="secondary" className="ml-auto">{byCategory[cat].length} grupos</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {byCategory[cat].map(r => (
                    <div key={r.id} className={`flex items-center gap-4 px-5 py-3 border ${positionBg(r.position)}`}>
                      <span className={`text-2xl font-bold w-10 text-center ${positionColor(r.position)}`}>
                        {r.position}º
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{r.group_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.school_name}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xl font-bold ${positionColor(r.position)}`}>
                          {r.score}
                        </span>
                        <p className="text-[10px] text-muted-foreground">PTS</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}