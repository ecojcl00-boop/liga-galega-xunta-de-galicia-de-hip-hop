import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Download } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import PodiumCategory from "../components/rankings/PodiumCategory";

const CATEGORY_ORDER = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
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

const POINTS_MAP = { 1: 12, 2: 9, 3: 7, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

function buildGlobalRanking(results) {
  // Sum points per group+category across all competitions
  const map = {};
  results.forEach(r => {
    const pts = POINTS_MAP[r.position] || 0;
    const key = `${r.group_name}||${r.category}`;
    if (!map[key]) map[key] = { group_name: r.group_name, school_name: r.school_name, category: r.category, points: 0, comps: [] };
    map[key].points += pts;
    map[key].comps.push({ competition: r.competition_name, position: r.position, pts });
  });
  return Object.values(map).sort((a, b) => b.points - a.points);
}

export default function Rankings() {
  const [view, setView] = useState("competition"); // "competition" | "global"
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

  const globalRanking = buildGlobalRanking(results);
  const globalCategories = [...new Set(globalRanking.map(r => r.category))].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  const downloadRankingPDF = () => {
    const doc = new jsPDF();
    if (view === "competition") {
      doc.setFontSize(16);
      doc.text(`Ranking — ${selectedCompetition}`, 14, 15);
      let y = 22;
      orderedCategories.forEach(cat => {
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text(cat, 14, y);
        y += 5;
        doc.autoTable({
          startY: y,
          head: [["Pos.", "Grupo", "Escuela", "Puntuación"]],
          body: byCategory[cat].sort((a,b) => a.position - b.position).map(r => [
            `${r.position}º`, r.group_name, r.school_name || "", r.score || "",
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 50, 120] },
          margin: { left: 14 },
        });
        y = doc.lastAutoTable.finalY + 6;
      });
      doc.save(`ranking_${selectedCompetition.replace(/ /g,"_")}.pdf`);
    } else {
      doc.setFontSize(16);
      doc.text("Ranking Global — Todas las competiciones", 14, 15);
      let y = 22;
      globalCategories.forEach(cat => {
        const rows = globalRanking.filter(r => r.category === cat);
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text(cat, 14, y);
        y += 5;
        doc.autoTable({
          startY: y,
          head: [["Pos.", "Grupo", "Escuela", "Puntos"]],
          body: rows.map((r, i) => [`${i+1}º`, r.group_name, r.school_name || "", r.points]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [220, 50, 120] },
          margin: { left: 14 },
        });
        y = doc.lastAutoTable.finalY + 6;
      });
      doc.save("ranking_global.pdf");
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-primary" /> Rankings
          </h1>
          <p className="text-muted-foreground mt-1">Resultados por competición y ranking global</p>
        </div>
        <Button variant="outline" onClick={downloadRankingPDF} className="gap-2">
          <Download className="w-4 h-4" /> Descargar PDF
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("competition")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === "competition" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          Por competición
        </button>
        <button
          onClick={() => setView("global")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === "global" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          Ranking global
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : view === "competition" ? (
        <>
          <div className="flex gap-2 flex-wrap">
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
          {orderedCategories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Sin resultados</div>
          ) : (
            <div className="space-y-6">
              {orderedCategories.map(cat => (
                <Card key={cat}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Medal className="w-5 h-5 text-primary" />
                      {cat}
                      <Badge variant="secondary" className="ml-auto">{byCategory[cat].length} {byCategory[cat].length === 1 ? "grupo" : "grupos"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <PodiumCategory results={byCategory[cat]} category={cat} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Global ranking */
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">Puntos acumulados en todas las competiciones (1º=12, 2º=9, 3º=7, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1)</p>
          {globalCategories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Sin resultados</div>
          ) : globalCategories.map(cat => {
            const rows = globalRanking.filter(r => r.category === cat);
            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Medal className="w-5 h-5 text-primary" />{cat}
                    <Badge variant="secondary" className="ml-auto">{rows.length} grupos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  {rows.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${i === 0 ? "bg-yellow-500/10" : i === 1 ? "bg-gray-400/10" : i === 2 ? "bg-amber-600/10" : "bg-muted/30"}`}>
                      <span className={`font-bold w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>{i+1}º</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{r.group_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.school_name}</p>
                      </div>
                      <span className="font-bold text-primary tabular-nums">{r.points} pts</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}