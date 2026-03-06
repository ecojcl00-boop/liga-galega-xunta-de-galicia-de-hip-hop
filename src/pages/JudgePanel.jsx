import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gavel, Save, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// ──────────────────────────────────────────────
// Score entry form (manual)
// ──────────────────────────────────────────────
function ScoreSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-2xl font-bold text-primary">{value.toFixed(1)}</span>
      </div>
      <input
        type="range" min="0" max="10" step="0.5" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-3 rounded-full appearance-none cursor-pointer bg-muted
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>0</span><span>5</span><span>10</span>
      </div>
    </div>
  );
}

function EntryForm() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [judgeName, setJudgeName] = useState("");
  const [scores, setScores] = useState({ technique: 5, musicality: 5, creativity: 5, execution: 5 });
  const [saved, setSaved] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.JudgeScore.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["judgeScores"] });
      setSaved(true);
      toast.success("Puntuación guardada correctamente");
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const total = (scores.technique + scores.musicality + scores.creativity + scores.execution) / 4;
  const group = groups.find((g) => g.id === selectedGroup);

  const handleSave = () => {
    saveMutation.mutate({
      group_id: selectedGroup,
      group_name: group?.name,
      category: group?.category,
      judge_name: judgeName,
      ...scores,
      total,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <Label>Tu nombre</Label>
            <Input value={judgeName} onChange={(e) => setJudgeName(e.target.value)} placeholder="Nombre del juez" />
          </div>
          <div>
            <Label>Grupo</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name} — {g.category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedGroup && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Puntuación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScoreSlider label="Técnica" value={scores.technique} onChange={(v) => setScores({ ...scores, technique: v })} />
            <ScoreSlider label="Musicalidad" value={scores.musicality} onChange={(v) => setScores({ ...scores, musicality: v })} />
            <ScoreSlider label="Creatividad" value={scores.creativity} onChange={(v) => setScores({ ...scores, creativity: v })} />
            <ScoreSlider label="Ejecución" value={scores.execution} onChange={(v) => setScores({ ...scores, execution: v })} />
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Puntuación Total</p>
              <p className="text-5xl font-bold text-primary">{total.toFixed(2)}</p>
            </div>
            <Button
              onClick={handleSave}
              disabled={!judgeName || saveMutation.isPending}
              className="w-full h-14 text-lg bg-primary text-primary-foreground"
            >
              {saved ? <><CheckCircle2 className="w-5 h-5 mr-2" />Guardado</> : <><Save className="w-5 h-5 mr-2" />Guardar Puntuación</>}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Scores viewer (imported)
// ──────────────────────────────────────────────
const SCORE_FIELDS = [
  { key: "technique", label: "Técnica" },
  { key: "musicality", label: "Musicalidad" },
  { key: "creativity", label: "Creatividad" },
  { key: "execution", label: "Ejecución" },
];

function ScoreRow({ score }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2 px-3 font-medium text-sm">{score.group_name}</td>
      <td className="py-2 px-3 text-xs text-muted-foreground">{score.school_name || "—"}</td>
      {SCORE_FIELDS.map(f => (
        <td key={f.key} className="py-2 px-3 text-center text-sm tabular-nums">
          {score[f.key] != null ? Number(score[f.key]).toFixed(1) : "—"}
        </td>
      ))}
      <td className="py-2 px-3 text-center font-bold text-primary tabular-nums">
        {score.total != null ? Number(score.total).toFixed(2) : "—"}
      </td>
    </tr>
  );
}

function JudgeBlock({ judgeName, scores }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/10 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Gavel className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{judgeName}</span>
          <Badge variant="secondary" className="text-xs">{scores.length} grupos</Badge>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="py-2 px-3 text-left font-medium">Grupo</th>
                <th className="py-2 px-3 text-left font-medium">Escuela</th>
                {SCORE_FIELDS.map(f => (
                  <th key={f.key} className="py-2 px-3 text-center font-medium">{f.label}</th>
                ))}
                <th className="py-2 px-3 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {scores.sort((a, b) => (b.total || 0) - (a.total || 0)).map((s, i) => (
                <ScoreRow key={i} score={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CategoryBlock({ categoryName, scores }) {
  const [open, setOpen] = useState(true);

  // Group by judge
  const byJudge = {};
  scores.forEach(s => {
    const j = s.judge_name || "Sin juez";
    if (!byJudge[j]) byJudge[j] = [];
    byJudge[j].push(s);
  });

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{scores.length}</span>
          </div>
          <span className="font-bold text-base">{categoryName}</span>
          <Badge variant="outline" className="text-xs">{Object.keys(byJudge).length} jueces</Badge>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="px-5 pb-5 pt-0 space-y-3">
          {Object.entries(byJudge).sort(([a], [b]) => a.localeCompare(b)).map(([judge, ss]) => (
            <JudgeBlock key={judge} judgeName={judge} scores={ss} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function ScoresViewer() {
  const { data: allScores = [], isLoading } = useQuery({
    queryKey: ["judgeScores"],
    queryFn: () => base44.entities.JudgeScore.list(),
  });

  // Group by competition then category
  const byCompetition = {};
  allScores.forEach(s => {
    const comp = s.competition_id || "Sin competición";
    if (!byCompetition[comp]) byCompetition[comp] = {};
    const cat = s.category || "Sin categoría";
    if (!byCompetition[comp][cat]) byCompetition[comp][cat] = [];
    byCompetition[comp][cat].push(s);
  });

  const competitions = Object.keys(byCompetition).sort();
  const [selectedComp, setSelectedComp] = useState(null);
  const activeComp = selectedComp || competitions[0];

  if (isLoading) return <div className="text-center py-16 text-muted-foreground">Cargando...</div>;
  if (allScores.length === 0) return (
    <div className="text-center py-16">
      <Gavel className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground">No hay puntuaciones importadas aún.</p>
      <p className="text-sm text-muted-foreground mt-1">Importa un documento en "Importar Datos".</p>
    </div>
  );

  const categories = activeComp ? byCompetition[activeComp] : {};

  const CATEGORY_ORDER = [
    "Mini Individual A", "Mini Individual B", "Individual",
    "Mini Parejas A", "Mini Parejas B", "Parejas",
    "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium",
    "Megacrew"
  ];

  const sortedCats = Object.keys(categories).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <div className="space-y-6">
      {/* Competition selector */}
      {competitions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {competitions.map(c => (
            <Button
              key={c}
              variant={activeComp === c ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedComp(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      {competitions.length === 1 && (
        <div className="flex items-center gap-2">
          <Badge className="text-sm px-3 py-1">{activeComp}</Badge>
          <span className="text-xs text-muted-foreground">{allScores.length} puntuaciones</span>
        </div>
      )}

      {sortedCats.map(cat => (
        <CategoryBlock key={cat} categoryName={cat} scores={categories[cat]} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
export default function JudgePanel() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
          <Gavel className="w-6 h-6 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Jueces</h1>
          <p className="text-muted-foreground text-sm">Puntuaciones y resultados por categoría</p>
        </div>
      </div>

      <ScoresViewer />
    </div>
  );
}