import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

function ResultDisplay({ result }) {
  if (!result) return null;

  if (result.error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{result.error}</span>
      </div>
    );
  }

  if (!result.log) return null;

  const stats = [
    { label: "Escuelas nuevas", value: result.log.schoolsCreated },
    { label: "Escuelas actualizadas", value: result.log.schoolsUpdated },
    { label: "Grupos nuevos", value: result.log.groupsCreated },
    { label: "Grupos actualizados", value: result.log.groupsUpdated },
    { label: "Participantes añadidos", value: result.log.participantsCreated },
    { label: "Participantes existentes", value: result.log.participantsExisting },
    { label: "Advertencias", value: result.log.warnings.length },
  ];

  return (
    <div className="space-y-3">
      <div className="font-semibold text-sm">Resultado — {result.totalRows} filas procesadas</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map(item => (
          <div key={item.label} className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{item.value}</div>
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
  );
}

export default function ImportarGrupos() {
  const user = useUser();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-lg font-bold">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground">Solo los administradores pueden acceder a esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      setProgress("Subiendo archivo...");
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setProgress("Procesando Excel...");
      const response = await base44.functions.invoke("importGroups", { file_url });

      const data = response.data;
      if (data.error) {
        setResult({ error: data.error });
      } else {
        setResult({ log: data.log, totalRows: data.totalRows });
      }
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setProgress("");
      setImporting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h1 className="font-bold text-2xl flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" /> Importar Grupos desde Excel
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sube un archivo Excel para crear o actualizar escuelas, grupos y participantes.
            </p>
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
                <p className="text-sm text-muted-foreground">Haz clic para seleccionar el Excel</p>
              </div>
            )}
          </div>

          <Button onClick={handleImport} disabled={!file || importing} className="w-full">
            {importing
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Importando..."}</>
              : <><FileSpreadsheet className="w-4 h-4 mr-2" />Importar</>}
          </Button>

          <ResultDisplay result={result} />
        </CardContent>
      </Card>
    </div>
  );
}