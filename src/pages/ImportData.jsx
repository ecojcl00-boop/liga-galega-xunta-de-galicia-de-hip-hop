import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Users, FileText, Trophy } from "lucide-react";
import { toast } from "sonner";

export default function ImportData() {
  const [fileParticipantes, setFileParticipantes] = useState(null);
  const [fileResultados, setFileResultados] = useState(null);
  const [competitionName, setCompetitionName] = useState("");
  const [competitionDate, setCompetitionDate] = useState("");
  const [importingP, setImportingP] = useState(false);
  const [importingR, setImportingR] = useState(false);
  const [resultP, setResultP] = useState(null);
  const [resultR, setResultR] = useState(null);
  const fileRefP = useRef(null);
  const fileRefR = useRef(null);

  const handleImportParticipantes = async () => {
    if (!fileParticipantes) return;
    setImportingP(true);
    setResultP(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileParticipantes });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `This is an Excel file with dance group registrations. Each row has: nombre_grupo, escuela, categoria, nombre_entrenador, email_entrenador, telefono_entrenador, and then pairs of nombre_1/nacimiento_1 through nombre_46/nacimiento_46.
        
        Extract ALL 134 rows from this file. For each row, extract all participants (nombre_X / nacimiento_X pairs where nombre_X is not empty).
        
        Return a JSON with a "grupos" array where each element has:
        - nombre_grupo: string (exact group name)
        - escuela: string
        - participantes: array of {name: string, birth_date: string} - only non-empty names`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            grupos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre_grupo: { type: "string" },
                  escuela: { type: "string" },
                  participantes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        birth_date: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (res?.grupos?.length > 0) {
        const groups = await base44.entities.Group.list("-created_date", 200);
        let updated = 0, notFound = 0;

        for (const row of res.grupos) {
          if (!row.nombre_grupo) continue;
          const groupName = row.nombre_grupo.trim();
          const participants = (row.participantes || []).filter(p => p.name?.trim());
          if (!participants.length) continue;

          const match = groups.find(g =>
            g.name.trim().toLowerCase() === groupName.toLowerCase()
          );

          if (match) {
            await base44.entities.Group.update(match.id, { ...match, participants });
            updated++;
          } else {
            notFound++;
          }
        }

        setResultP({ success: true, updated, notFound, total: res.grupos.length });
        toast.success(`${updated} grupos actualizados`);
      } else {
        setResultP({ success: false, error: "No se pudieron extraer datos" });
      }
    } catch (err) {
      setResultP({ success: false, error: err.message });
      toast.error("Error en la importación");
    } finally {
      setImportingP(false);
    }
  };

  const handleImportResultados = async () => {
    if (!fileResultados || !competitionName) return;
    setImportingR(true);
    setResultR(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileResultados });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all competition results from this file. Each result has: group name (NOMBRE), club/school (CLUB), category (CATEGORÍA), and position/score (PUESTO which contains both position number and points like "1º - 85 PTS" or "1° - 85 PTS").
        
        Return a JSON with a "resultados" array where each element has:
        - group_name: string
        - school_name: string  
        - category: string
        - position: number (just the number)
        - score: number (just the decimal number from PTS)`,
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
                  score: { type: "number" }
                }
              }
            }
          }
        }
      });

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
    } catch (err) {
      setResultR({ success: false, error: err.message });
      toast.error("Error importando resultados");
    } finally {
      setImportingR(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Importar Datos</h1>
        <p className="text-muted-foreground mt-1">Importa participantes o resultados de competiciones</p>
      </div>

      {/* Participantes */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Importar Participantes
          </h2>
          <p className="text-sm text-muted-foreground">Sube el Excel de inscripciones para extraer participantes de cada grupo</p>

          <div onClick={() => fileRefP.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
            <input ref={fileRefP} type="file" accept=".xlsx,.xls,.csv" onChange={e => setFileParticipantes(e.target.files[0])} className="hidden" />
            {fileParticipantes ? (
              <div className="flex flex-col items-center gap-1">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
                <p className="font-medium text-sm">{fileParticipantes.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Seleccionar Excel de inscripciones</p>
              </div>
            )}
          </div>

          <Button onClick={handleImportParticipantes} disabled={!fileParticipantes || importingP} className="w-full">
            {importingP ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><Users className="w-4 h-4 mr-2" />Importar Participantes</>}
          </Button>

          {resultP && (
            <div className={`p-3 rounded-lg text-sm ${resultP.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {resultP.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{resultP.updated} grupos actualizados {resultP.notFound > 0 && `(${resultP.notFound} no encontrados)`}</span>
                </div>
              ) : <span>Error: {resultP.error}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
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