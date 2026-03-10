import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ImportActaJueces({ onSuccess }) {
  const [file, setFile] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [notas, setNotas] = useState("");
  const [schools, setSchools] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.School.list("name", 500),
      base44.entities.Competition.list("-date", 50),
    ]).then(([allSchools, comps]) => {
      const activeSchools = allSchools
        .filter(s => s.is_active !== false)
        .map(s => s.name)
        .sort();
      setSchools(activeSchools);
      setCompetitions(comps);
    });
  }, []);

  const handleSubmit = async () => {
    if (!file || !schoolName || !competitionId) return;
    setLoading(true);
    setResult(null);

    const comp = competitions.find(c => c.id === competitionId);
    const savedSchoolName = schoolName === "__todas__" ? "TODAS" : schoolName;

    // 1. Upload file
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    const file_url = uploadResult?.file_url;

    if (!file_url) {
      toast.error("Error al subir el archivo: no se obtuvo URL. Inténtalo de nuevo.");
      setLoading(false);
      return;
    }

    // 2. Save as ActaJueces — viewable by the school in their portal
    await base44.entities.ActaJueces.create({
      school_name: savedSchoolName,
      competicion_nombre: comp?.name || "",
      fecha: comp?.date || null,
      document_url: file_url,
      document_name: file.name,
      notas: notas || "",
    });

    // 3. Try to extract structured scores via LLM (for ranking tiebreaker)
    let scoresExtracted = 0;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extrae todas las puntuaciones de jueces de este archivo de resultados de danza/hip-hop.
Por cada registro identifica: nombre exacto del grupo, categoría, nombre del juez (si aparece), y puntuaciones numéricas.
Si hay criterios separados (técnica, musicalidad, creatividad, ejecución), extráelos.
Si solo hay un total, úsalo en "total". NO inventes datos.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  group_name: { type: "string" },
                  category:   { type: "string" },
                  judge_name: { type: "string" },
                  technique:  { type: "number" },
                  musicality: { type: "number" },
                  creativity: { type: "number" },
                  execution:  { type: "number" },
                  total:      { type: "number" },
                }
              }
            }
          }
        }
      });

      if (res?.scores?.length > 0) {
        const records = res.scores
          .filter(s => s.group_name && (s.total > 0 || s.technique > 0))
          .map(s => ({
            competition_id: comp?.id || competitionId,
            group_name:  s.group_name,
            school_name: savedSchoolName === "TODAS" ? "" : savedSchoolName,
            category:    s.category || "",
            judge_name:  s.judge_name || "",
            technique:   s.technique  || 0,
            musicality:  s.musicality || 0,
            creativity:  s.creativity || 0,
            execution:   s.execution  || 0,
            total: s.total || ((s.technique + s.musicality + s.creativity + s.execution) / 4) || 0,
          }));

        if (records.length > 0) {
          await base44.entities.JudgeScore.bulkCreate(records);
          scoresExtracted = records.length;
        }
      }
    } catch {
      // Score extraction is best-effort — document is saved either way
    }

    setResult({ success: true, scoresExtracted, school: savedSchoolName });
    toast.success("Documento subido correctamente");
    setFile(null);
    setNotas("");
    setLoading(false);
    if (onSuccess) onSuccess();
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          El documento quedará disponible solo para la escuela seleccionada en su portal privado.
          Las puntuaciones extraídas se usarán como criterio de desempate final en el ranking de liga.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Escuela destinataria *</label>
            <Select value={schoolName} onValueChange={setSchoolName}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar escuela..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas las escuelas</SelectItem>
                {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Competición *</label>
            <Select value={competitionId} onValueChange={setCompetitionId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar competición..." />
              </SelectTrigger>
              <SelectContent>
                {competitions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Notas (opcional)</label>
          <Input
            placeholder="Ej: Acta de jueces jornada 1"
            value={notas}
            onChange={e => setNotas(e.target.value)}
          />
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
            onChange={e => { setFile(e.target.files[0]); setResult(null); }}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <FileText className="w-8 h-8 text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">Haz clic para cambiar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">PDF, Excel, Word o imagen</p>
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!file || !schoolName || !competitionId || loading}
          className="w-full"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando y subiendo...</>
            : "Subir documento de jueces"}
        </Button>

        {result?.success && (
          <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Documento subido y asignado a {result.school}
            </div>
            {result.scoresExtracted > 0 ? (
              <p className="text-xs opacity-80">
                ✅ {result.scoresExtracted} puntuaciones extraídas y guardadas para desempate en rankings.
              </p>
            ) : (
              <p className="text-xs opacity-70">
                ⚠️ No se pudieron extraer puntuaciones estructuradas. El documento sigue disponible para descarga.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}