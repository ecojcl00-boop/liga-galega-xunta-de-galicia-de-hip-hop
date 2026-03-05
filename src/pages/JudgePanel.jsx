import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gavel, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function ScoreSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-2xl font-bold text-primary">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-3 rounded-full appearance-none cursor-pointer bg-muted
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

export default function JudgePanel() {
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
      queryClient.invalidateQueries({ queryKey: ["scores"] });
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
    <div className="p-4 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
          <Gavel className="w-8 h-8 text-secondary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Panel de Jueces</h1>
        <p className="text-muted-foreground mt-1">Puntúa las actuaciones</p>
      </div>

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
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} — {g.category}
                  </SelectItem>
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
              {saved ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Guardado
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" /> Guardar Puntuación
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}