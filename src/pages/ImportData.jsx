import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, FileText, Trophy, Gavel } from "lucide-react";
import { toast } from "sonner";

export default function ImportData() {
  const [fileJueces, setFileJueces] = useState(null);
  const [fileResultados, setFileResultados] = useState(null);
  const [competitionNameJ, setCompetitionNameJ] = useState("");
  const [competitionDateJ, setCompetitionDateJ] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [competitionDate, setCompetitionDate] = useState("");
  const [importingJ, setImportingJ] = useState(false);
  const [importingR, setImportingR] = useState(false);
  const [resultJ, setResultJ] = useState(null);
  const [resultR, setResultR] = useState(null);
  const fileRefJ = useRef(null);
  const fileRefR = useRef(null);

  const handleImportJueces = async () => {
    if (!fileJueces || !competitionNameJ) return;
    setImportingJ(true);
    setResultJ(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: fileJueces });

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extrae todas las puntuaciones de jueces de este archivo. Cada fila tiene: nombre del grupo, escuela/club, categoría, nombre del juez, y puntuaciones de técnica, musicalidad, creatividad y ejecución (0-10 cada una).
      
      Devuelve un JSON con un array "scores" donde cada elemento tiene:
      - group_name: string (nombre del grupo)
      - school_name: string (club/escuela)
      - category: string (categoría)
      - judge_name: string (nombre del juez)
      - technique: number (0-10)
      - musicality: number (0-10)
      - creativity: number (0-10)
      - execution: number (0-10)
      - total: number (media de los 4 criterios)
      
      Extrae TODOS los registros del archivo sin omitir ninguno.`,
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
                school_name: { type: "string" },
                category: { type: "string" },
                judge_name: { type: "string" },
                technique: { type: "number" },
                musicality: { type: "number" },
                creativity: { type: "number" },
                execution: { type: "number" },
                total: { type: "number" }
              }
            }
          }
        }
      }
    });

    if (res?.scores?.length > 0) {
      const records = res.scores.map(s => ({
        competition_id: competitionNameJ,
        group_name: s.group_name,
        school_name: s.school_name,
        category: s.category,
        judge_name: s.judge_name,
        technique: s.technique,
        musicality: s.musicality,
        creativity: s.creativity,
        execution: s.execution,
        total: s.total ?? ((s.technique + s.musicality + s.creativity + s.execution) / 4)
      }));

      await base44.entities.JudgeScore.bulkCreate(records);
      setResultJ({ success: true, total: records.length });
      toast.success(`${records.length} puntuaciones importadas`);
    } else {
      setResultJ({ success: false, error: "No se pudieron extraer puntuaciones" });
    }

    setImportingJ(false);
  };

  const handleImportResultados = async () => {
    if (!fileResultados || !competitionName) return;
    setImportingR(true);
    setResultR(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: fileResultados });

    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          resultados: {
            type: "array",
            items: {
              type: "object",
              properties: {
                group_name: { type: "string" },
                school_name: { type: "string" },
                category: { type: "string" },
                position: { type: "number" },
                score: { type: "number" }
              }
            }
          }
        }
      }
    });

    const res = extracted?.output;

    if (res?.resultados?.length > 0) {
      const records = res.resultados.map(r => ({
        competition_name: competitionName,
        competition_date: competitionDate || undefined,
        group_name: r.group_name,
        school_name: r.school_name,
        category: r.category,
        position: r.position,
        score: r.score
      }));

      await base44.entities.CompetitionResult.bulkCreate(records);
      setResultR({ success: true, total: records.length });
      toast.success(`${records.length} resultados importados`);
    } else {
      setResultR({ success: false, error: "No se pudieron extraer resultados" });
    }

    setImportingR(false);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Importar Datos</h1>
        <p className="text-muted-foreground mt-1">Importa puntuaciones de jueces o resultados de competiciones</p>
      </div>

      {/* Puntuaciones Jueces */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" /> Importar Puntuaciones de Jueces
          </h2>
          <p className="text-sm text-muted-foreground">Sube un Excel, PDF o Word con las puntuaciones desglosadas por juez. Se mostrarán en el Panel de Jueces por competición.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre de la competición *</label>
              <Input placeholder="Ej: Marín 2026" value={competitionNameJ} onChange={e => setCompetitionNameJ(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha (opcional)</label>
              <Input type="date" value={competitionDateJ} onChange={e => setCompetitionDateJ(e.target.value)} />
            </div>
          </div>

          <div onClick={() => fileRefJ.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
            <input ref={fileRefJ} type="file" accept=".xlsx,.xls,.csv,.pdf,.doc,.docx" onChange={e => setFileJueces(e.target.files[0])} className="hidden" />
            {fileJueces ? (
              <div className="flex flex-col items-center gap-1">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
                <p className="font-medium text-sm">{fileJueces.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">PDF, Excel o Word con puntuaciones de jueces</p>
              </div>
            )}
          </div>

          <Button onClick={handleImportJueces} disabled={!fileJueces || !competitionNameJ || importingJ} className="w-full">
            {importingJ ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><Gavel className="w-4 h-4 mr-2" />Importar Puntuaciones</>}
          </Button>

          {resultJ && (
            <div className={`p-3 rounded-lg text-sm ${resultJ.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {resultJ.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{resultJ.total} puntuaciones importadas correctamente</span>
                </div>
              ) : <span>Error: {resultJ.error}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados Competición */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> Importar Resultados de Competición
          </h2>
          <p className="text-sm text-muted-foreground">Sube un PDF, Excel o Word con los resultados para actualizar el ranking</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre de la competición *</label>
              <Input placeholder="Ej: Marín 2026" value={competitionName} onChange={e => setCompetitionName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha (opcional)</label>
              <Input type="date" value={competitionDate} onChange={e => setCompetitionDate(e.target.value)} />
            </div>
          </div>

          <div onClick={() => fileRefR.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
            <input ref={fileRefR} type="file" accept=".xlsx,.xls,.csv,.pdf,.doc,.docx" onChange={e => setFileResultados(e.target.files[0])} className="hidden" />
            {fileResultados ? (
              <div className="flex flex-col items-center gap-1">
                <FileText className="w-8 h-8 text-primary" />
                <p className="font-medium text-sm">{fileResultados.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">PDF, Excel o Word con resultados</p>
              </div>
            )}
          </div>

          <Button onClick={handleImportResultados} disabled={!fileResultados || !competitionName || importingR} className="w-full">
            {importingR ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><Trophy className="w-4 h-4 mr-2" />Importar Resultados</>}
          </Button>

          {resultR && (
            <div className={`p-3 rounded-lg text-sm ${resultR.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {resultR.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{resultR.total} resultados importados correctamente</span>
                </div>
              ) : <span>Error: {resultR.error}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}