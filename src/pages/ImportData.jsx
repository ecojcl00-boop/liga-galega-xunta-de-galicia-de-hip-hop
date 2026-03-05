import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

// Parse a CSV/TSV row handling commas inside fields
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export default function ImportData() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      // Upload file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Use LLM to extract all rows with participants
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract ALL rows from this Excel/CSV file. Each row has: nombre_grupo, escuela, categoria, nombre_entrenador, email_entrenador, telefono_entrenador, and then pairs of nombre_1/nacimiento_1 through nombre_46/nacimiento_46.
        
        Return a JSON array where each element has:
        - nombre_grupo: string
        - escuela: string  
        - categoria: string
        - nombre_entrenador: string
        - email_entrenador: string
        - telefono_entrenador: string
        - participantes: array of {name: string, birth_date: string} - only include entries where name is not empty
        
        Extract ALL 134 rows. Do not skip any row. Include all participants for each group.`,
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

      if (res && res.grupos && res.grupos.length > 0) {
        // Get all groups from DB
        const groups = await base44.entities.Group.list("-created_date", 200);

        let updated = 0;
        let notFound = 0;

        for (const row of res.grupos) {
          if (!row.nombre_grupo || !row.participantes || row.participantes.length === 0) continue;

          // Find matching group by name
          const groupName = row.nombre_grupo.trim();
          const match = groups.find(g =>
            g.name.trim().toLowerCase() === groupName.toLowerCase()
          );

          if (match) {
            const participants = row.participantes.filter(p => p.name && p.name.trim());
            await base44.entities.Group.update(match.id, {
              ...match,
              participants
            });
            updated++;
          } else {
            notFound++;
          }
        }

        setResult({ success: true, updated, notFound, total: res.grupos.length });
        toast.success(`${updated} grupos actualizados con participantes`);
      } else {
        setResult({ success: false, error: "No se pudieron extraer datos del archivo" });
        toast.error("Error al procesar el archivo");
      }
    } catch (err) {
      setResult({ success: false, error: err.message });
      toast.error("Error en la importación");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Importar Participantes</h1>
        <p className="text-muted-foreground mt-1">Sube el Excel para extraer y asignar participantes a los grupos</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Haz clic para seleccionar archivo</p>
                <p className="text-xs text-muted-foreground">Excel o CSV con las inscripciones</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full h-12 bg-primary text-primary-foreground"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extrayendo participantes...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" /> Importar Participantes
              </>
            )}
          </Button>

          {result && (
            <div className={`p-4 rounded-xl text-sm ${result.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {result.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">{result.updated} grupos actualizados</span>
                  </div>
                  {result.notFound > 0 && (
                    <p className="text-xs opacity-80">({result.notFound} grupos no encontrados en la BD)</p>
                  )}
                </div>
              ) : (
                <span>Error: {result.error}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}