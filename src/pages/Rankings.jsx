import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Download } from "lucide-react";
import jsPDF from "jspdf";
import PodiumCategory from "../components/rankings/PodiumCategory";
import LigaRankingView from "../components/rankings/LigaRankingView";

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
  const [view, setView] = useState("liga"); // "liga" | "competition" | "global"

  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["competition_results"],
    queryFn: () => base44.entities.CompetitionResult.list("-competition_date", 500),
  });

  const { data: ligaResultados = [], isLoading: ligaLoading } = useQuery({
    queryKey: ["liga_resultados"],
    queryFn: () => base44.entities.LigaResultado.list("numero_jornada", 2000),
    select: (data) => data.filter(r => !r.is_simulacro),
  });

  const competitions = [...new Set(results.map(r => r.competition_name))];
  // Set initial competition dynamically from first available result
  React.useEffect(() => {
    if (!selectedCompetition && competitions.length > 0) {
      setSelectedCompetition(competitions[0]);
    }
  }, [competitions.length]);

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

  const drawTable = (doc, headers, colWidths, rows, startY) => {
    let y = startY;
    const rowH = 7;
    doc.setFillColor(220, 50, 120); doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont(undefined, "bold");
    let x = 14;
    colWidths.forEach((w, i) => { doc.rect(x, y, w, rowH, "F"); doc.text(headers[i], x + 1, y + 5); x += w; });
    y += rowH;
    doc.setTextColor(0, 0, 0); doc.setFont(undefined, "normal"); doc.setFontSize(8);
    rows.forEach((row, ri) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFillColor(ri % 2 === 0 ? 250 : 245, ri % 2 === 0 ? 250 : 245, ri % 2 === 0 ? 250 : 245);
      let rx = 14;
      colWidths.forEach((w, i) => { doc.rect(rx, y, w, rowH, "F"); });
      doc.setTextColor(0, 0, 0);
      let rx2 = 14;
      colWidths.forEach((w, i) => { doc.text(String(row[i] ?? "").substring(0, Math.floor(w / 2)), rx2 + 1, y + 5); rx2 += w; });
      y += rowH;
    });
    return y;
  };

  const downloadRankingPDF = () => {
    const doc = new jsPDF();
    if (view === "competition") {
      doc.setFontSize(16); doc.setFont(undefined, "bold");
      doc.text(`Ranking — ${selectedCompetition}`, 14, 15);
      let y = 22;
      orderedCategories.forEach(cat => {
        if (y > 260) { doc.addPage(); y = 14; }
        doc.setFontSize(10); doc.setFont(undefined, "bold"); doc.setTextColor(0,0,0);
        doc.text(cat, 14, y); y += 5;
        const rows = byCategory[cat].slice().sort((a,b) => a.position - b.position).map(r => [`${r.position}º`, r.group_name, r.school_name || "", r.score || ""]);
        y = drawTable(doc, ["Pos.", "Grupo", "Escuela", "Puntuación"], [14, 90, 60, 22], rows, y) + 4;
      });
      doc.save(`ranking_${selectedCompetition.replace(/ /g,"_")}.pdf`);
    } else {
      doc.setFontSize(16); doc.setFont(undefined, "bold");
      doc.text("Ranking Global — Todas las competiciones", 14, 15);
      let y = 22;
      globalCategories.forEach(cat => {
        if (y > 260) { doc.addPage(); y = 14; }
        const rows = globalRanking.filter(r => r.category === cat);
        doc.setFontSize(10); doc.setFont(undefined, "bold"); doc.setTextColor(0,0,0);
        doc.text(cat, 14, y); y += 5;
        y = drawTable(doc, ["Pos.", "Grupo", "Escuela", "Puntos"], [14, 90, 60, 22], rows.map((r,i) => [`${i+1}º`, r.group_name, r.school_name || "", r.points]), y) + 4;
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
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView("liga")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${view === "liga" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          🏆 Ranking de Liga
        </button>
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

      {view === "liga" ? (
        ligaLoading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando...</div>
        ) : (
          <LigaRankingView resultados={ligaResultados} />
        )
      ) : isLoading ? (
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