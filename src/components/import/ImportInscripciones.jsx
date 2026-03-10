import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, Database } from "lucide-react";
import { useSimulacro } from "@/components/SimulacroContext";

export default function ImportInscripciones() {
  const [file, setFile] = useState(null);
  const [competitionName, setCompetitionName] = useState("");
  const [selectedCompId, setSelectedCompId] = useState("");
  const [competitions, setCompetitions] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const { isSimulacro } = useSimulacro();
  const fileRef = useRef(null);

  useEffect(() => {
    base44.entities.Competition.list("-date", 50).then(setCompetitions).catch(() => {});
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    setProgress("Subiendo archivo...");
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setProgress("Procesando Excel... (puede tardar según el tamaño)");
    const selectedComp = competitions.find(c => c.id === selectedCompId);
    const response = await base44.functions.invoke("processInscripciones", {
      file_url,
      competition_id: selectedCompId || null,
      competition_name: selectedComp?.name || competitionName || null,
      is_simulacro: isSimulacro,
    });

    const data = response.data;
    if (data.error) {
      setResult({ error: data.error });
    } else {
      setResult({ log: data.log, totalRows: data.totalRows });
    }
    setProgress("");
    setImporting(false);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" /> Importar Inscripciones desde Excel
        </h2>
        <p className="text-sm text-muted-foreground">
          Sube el Excel de inscripciones. Se crearán/actualizarán escuelas, grupos y participantes sin borrar ni duplicar datos existentes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Competición (opcional)</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedCompId}
              onChange={e => setSelectedCompId(e.target.value)}
            >
              <option value="">Sin vincular a competición</option>
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">O nombre manual</label>
            <Input
              placeholder="Ej: Marín 2026"
              value={competitionName}
              onChange={e => setCompetitionName(e.target.value)}
              disabled={!!selectedCompId}
            />
          </div>
        </div>

        <div
          onClick={() => !importing && fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => { setFile(e.target.files[0]); setResult(null); }}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">Haz clic para cambiar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Haz clic para seleccionar el Excel (.xlsx, .xls)</p>
            </div>
          )}
        </div>

        <Button onClick={handleImport} disabled={!file || importing} className="w-full">
          {importing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Importando..."}</>
            : <><Database className="w-4 h-4 mr-2" />Importar Inscripciones</>}
        </Button>

        {result?.error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{result.error}</span>
          </div>
        )}

        {result?.log && (
          <div className="space-y-3">
            <div className="font-semibold text-sm">Resultado — {result.totalRows} filas procesadas</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Escuelas nuevas", value: result.log.schoolsCreated, icon: "✅" },
                { label: "Escuelas actualizadas", value: result.log.schoolsUpdated, icon: "🔄" },
                { label: "Grupos nuevos", value: result.log.groupsCreated, icon: "✅" },
                { label: "Grupos actualizados", value: result.log.groupsUpdated, icon: "🔄" },
                { label: "Participantes añadidos", value: result.log.participantsCreated, icon: "✅" },
                { label: "Participantes ya existentes", value: result.log.participantsExisting, icon: "🔄" },
                { label: "Inscripciones creadas", value: result.log.registrationsCreated, icon: "✅" },
                { label: "Advertencias", value: result.log.warnings.length, icon: "⚠️" },
              ].map(item => (
                <div key={item.label} className="bg-muted/40 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{item.icon} {item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>

            {result.log.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
                <div className="font-medium text-xs text-yellow-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Advertencias ({result.log.warnings.length})
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {result.log.warnings.map((w, i) => <div key={i} className="text-xs text-yellow-700">{w}</div>)}
                </div>
              </div>
            )}

            {result.log.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="font-medium text-xs text-red-800 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Errores ({result.log.errors.length})
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {result.log.errors.map((e, i) => <div key={i} className="text-xs text-red-700">{e}</div>)}
                </div>
              </div>
            )}

            {result.log.errors.length === 0 && result.log.warnings.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" /> Importación completada sin errores
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}