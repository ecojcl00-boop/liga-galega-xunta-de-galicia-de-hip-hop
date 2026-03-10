import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Loader2, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useSimulacro } from "@/components/SimulacroContext";

export default function ImportLigaJornada() {
  const [file, setFile] = useState(null);
  const [jornada, setJornada] = useState("");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const { isSimulacro } = useSimulacro();

  const handleImport = async () => {
    if (!file || !jornada) return;
    setLoading(true);
    setResult(null);

    // 1. Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // 2. Extract results via LLM
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extrae todos los resultados de esta competición de hip-hop / danza.
Por cada grupo o participante identifica:
- group_name: nombre exacto del grupo tal como aparece en el documento
- school_name: nombre de la escuela o club si aparece, sino cadena vacía
- category: categoría exacta (ej: Mini Individual B, Baby, Infantil, Junior, Youth, Absoluta, Megacrew...)
- position: número entero del puesto (1=primero, 2=segundo, 3=tercero...)

NO inventes datos. Extrae exactamente lo que aparece. Si hay empate, usa el mismo número para ambos.
Extrae TODOS los grupos sin omitir ninguno.`,
      file_urls: [file_url],
      response_json_schema: {
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
                position: { type: "number" }
              }
            }
          }
        }
      }
    });

    if (!extracted?.resultados?.length) {
      setResult({ success: false, error: "No se pudieron extraer resultados del documento" });
      setLoading(false);
      return;
    }

    // 3. Send to backend to save and recalculate ranking
    const response = await base44.functions.invoke("saveAndRankLigaJornada", {
      numero_jornada: parseInt(jornada),
      nombre_competicion: nombre || `Jornada ${jornada}`,
      fecha: fecha || undefined,
      ubicacion: ubicacion || undefined,
      resultados: extracted.resultados,
      is_simulacro: isSimulacro,
    });

    setResult(response.data);
    if (response.data?.success) {
      toast.success(`Jornada ${jornada}: ${response.data.log?.ok?.length || 0} resultados guardados`);
    } else {
      toast.error(response.data?.error || "Error al importar");
    }
    setLoading(false);
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" /> Importar Jornada de Liga
        </h2>
        <p className="text-sm text-muted-foreground">
          Sube el documento de resultados de una jornada. El ranking de liga se recalculará automáticamente.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Número de jornada * (1–5)</label>
            <Input type="number" min="1" max="5" placeholder="Ej: 1" value={jornada} onChange={e => setJornada(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nombre competición (opcional)</label>
            <Input placeholder="Ej: Marín 2026" value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha (opcional)</label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ubicación (opcional)</label>
            <Input placeholder="Ej: Marín, Pontevedra" value={ubicacion} onChange={e => setUbicacion(e.target.value)} />
          </div>
        </div>

        <div onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
            onChange={e => setFile(e.target.files[0])} className="hidden" />
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <FileText className="w-8 h-8 text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">Haz clic para cambiar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">PDF, Excel o Word con los resultados</p>
            </div>
          )}
        </div>

        <Button onClick={handleImport} disabled={!file || !jornada || loading} className="w-full">
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando documento...</>
            : <><Trophy className="w-4 h-4 mr-2" />Importar Jornada {jornada || "?"}</>}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg text-sm space-y-3 ${result.success ? "bg-primary/10" : "bg-destructive/10 text-destructive"}`}>
            {result.success ? (
              <>
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  Jornada {jornada} importada correctamente
                </div>

                {result.log?.ok?.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">✅ {result.log.ok.length} resultados registrados:</p>
                    <div className="max-h-36 overflow-y-auto space-y-0.5">
                      {result.log.ok.map((r, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{r.puesto}º · <span className="font-medium">{r.grupo}</span> · {r.categoria}</p>
                      ))}
                    </div>
                  </div>
                )}

                {result.log?.notFound?.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-600 mb-1">⚠️ {result.log.notFound.length} grupos no encontrados en BD (guardados igualmente):</p>
                    <div className="max-h-24 overflow-y-auto">
                      {result.log.notFound.map((n, i) => <p key={i} className="text-xs text-amber-600">{n}</p>)}
                    </div>
                  </div>
                )}

                {result.log?.duplicates?.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-600 mb-1">⚠️ {result.log.duplicates.length} duplicados detectados (no procesados):</p>
                    <div className="max-h-24 overflow-y-auto">
                      {result.log.duplicates.map((d, i) => <p key={i} className="text-xs text-amber-600">{d}</p>)}
                    </div>
                  </div>
                )}

                {result.log?.top3 && Object.keys(result.log.top3).length > 0 && (
                  <div>
                    <p className="font-medium text-foreground mb-1">📊 Top 3 actualizado por categoría:</p>
                    {Object.entries(result.log.top3).map(([cat, top]) => (
                      <p key={cat} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{cat}:</span>{" "}
                        {top.map((g, i) => `${i + 1}º ${g.nombre}`).join(" · ")}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <span>❌ Error: {result.error}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}