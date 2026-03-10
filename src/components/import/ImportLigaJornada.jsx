import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, CheckCircle2, Trophy, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useSimulacro } from "@/components/SimulacroContext";

export default function ImportLigaJornada() {
  const [file, setFile] = useState(null);
  const [jornada, setJornada] = useState("");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [ubicacion, setUbicacion] = useState("");

  // step: "form" | "preview" | "done"
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const fileRef = useRef(null);
  const { isSimulacro } = useSimulacro();

  const handleExtract = async () => {
    if (!file || !jornada) return;
    setLoading(true);
    setLoadingMsg("Leyendo documento y extrayendo resultados...");

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza este documento de resultados de competición de hip-hop / danza. Puede ser Excel (.xlsx) o PDF.

Para Excel: busca columnas con nombres como "nombre" o "grupo" (nombre del grupo), "club" o "escuela" (escuela), "categoria" o "categoría" (categoría), "puesto" (posición), "puntos" o "pts" (puntuación). Si alguna columna no existe, continúa con las demás.

Para PDF: el formato típico es filas con: NOMBRE_GRUPO | ESCUELA | CATEGORÍA | PUESTO
Ejemplo de campo puesto: "1º", "1", "1º - 97,5 PTS"

Por cada participante o grupo extrae:
- group_name: nombre exacto del grupo tal como aparece en el documento
- school_name: nombre de la escuela o club (columna "club" o "escuela"), cadena vacía si no aparece
- category: categoría exacta (ej: Baby, Infantil, Junior, Youth, Absoluta, Mini Individual A, Mini Individual B, Parejas, Megacrew...)
- position: número ENTERO del puesto. Extrae solo el primer número entero: "1º" → 1, "1º - 97,5 PTS" → 1, "3" → 3, "2º - 95 PTS" → 2
- score: puntuación numérica decimal si aparece. Búscala en columna "puntos"/"pts" O dentro del campo puesto (el número decimal): "1º - 97,5 PTS" → 97.5, "2º - 95,00 PTS" → 95.0. Pon 0 si no hay puntuación.

Reglas importantes:
- NO inventes datos. Extrae exactamente lo que aparece en el documento.
- Si hay empate (mismo puesto para varios grupos), usa el mismo número para ambos.
- Extrae TODOS los grupos sin omitir ninguno.
- Si una fila no tiene nombre de grupo ni categoría, omítela y regístrala como error.`,
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
                position: { type: "number" },
                score: { type: "number" },
              }
            }
          },
          errores: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    if (!extracted?.resultados?.length) {
      toast.error("No se pudieron extraer resultados del documento");
      setLoading(false);
      return;
    }

    setPreview(extracted);
    setStep("preview");
    setLoading(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setLoadingMsg("Guardando resultados y recalculando ranking...");

    const response = await base44.functions.invoke("saveAndRankLigaJornada", {
      numero_jornada: parseInt(jornada),
      nombre_competicion: nombre || `Jornada ${jornada}`,
      fecha: fecha || undefined,
      ubicacion: ubicacion || undefined,
      resultados: preview.resultados,
      is_simulacro: isSimulacro,
    });

    setResult(response.data);
    setStep("done");
    setLoading(false);
    if (response.data?.success) {
      toast.success(`Jornada ${jornada}: ${response.data.log?.ok?.length || 0} resultados guardados`);
    } else {
      toast.error(response.data?.error || "Error al importar");
    }
  };

  const handleReset = () => {
    setFile(null);
    setJornada("");
    setNombre("");
    setFecha("");
    setUbicacion("");
    setStep("form");
    setPreview(null);
    setResult(null);
    setLoading(false);
  };

  // ── PASO 2: PREVIEW ──
  if (step === "preview") {
    const { resultados, errores = [] } = preview;
    const categories = [...new Set(resultados.map(r => r.category))].sort();
    const hasScores = resultados.some(r => r.score > 0);

    return (
      <Card className="border-primary/30">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setStep("form")} disabled={loading} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver
            </Button>
            <h2 className="font-bold text-lg">Revisar resultados extraídos</h2>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Revisa que los datos sean correctos antes de importar.
              Jornada <strong>{jornada}</strong> · <strong>{resultados.length}</strong> resultados detectados.
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Badge key={cat} variant="secondary">
                {cat}: {resultados.filter(r => r.category === cat).length}
              </Badge>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Grupo</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Escuela</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Categoría</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Puesto</th>
                  {hasScores && <th className="text-center py-2 px-3 text-muted-foreground font-medium">Pts.</th>}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 px-3 font-medium">{r.group_name}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs hidden sm:table-cell">{r.school_name || "—"}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{r.category}</td>
                    <td className="py-2 px-3 text-center font-bold">{r.position}º</td>
                    {hasScores && (
                      <td className="py-2 px-3 text-center text-xs text-muted-foreground">
                        {r.score > 0 ? r.score.toFixed(1) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errores.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1">⚠️ {errores.length} filas con problemas (omitidas):</p>
              <div className="max-h-20 overflow-y-auto">
                {errores.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("form")} disabled={loading} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={loading} className="flex-1">
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{loadingMsg}</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirmar e importar</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── PASO 3: DONE ──
  if (step === "done") {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-6 space-y-4">
          {result?.success ? (
            <>
              <div className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="w-5 h-5" />
                Jornada {jornada} importada correctamente
              </div>

              {result.log?.ok?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-1">✅ {result.log.ok.length} resultados registrados:</p>
                  <div className="max-h-36 overflow-y-auto space-y-0.5">
                    {result.log.ok.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {r.puesto}º · <span className="font-medium">{r.grupo}</span> · {r.categoria}
                      </p>
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
            <div className="text-destructive">❌ Error: {result?.error}</div>
          )}

          <Button variant="outline" onClick={handleReset} className="w-full">
            Nueva importación
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── PASO 1: FORM ──
  return (
    <Card className="border-primary/30">
      <CardContent className="p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" /> Importar Jornada de Liga
        </h2>
        <p className="text-sm text-muted-foreground">
          Sube el documento de resultados (PDF o Excel). Se mostrará un resumen para revisar y confirmar antes de guardar.
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

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
            onChange={e => setFile(e.target.files[0])}
            className="hidden"
          />
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

        <Button onClick={handleExtract} disabled={!file || !jornada || loading} className="w-full">
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{loadingMsg}</>
            : <><Trophy className="w-4 h-4 mr-2" />Extraer y previsualizar resultados</>}
        </Button>
      </CardContent>
    </Card>
  );
}