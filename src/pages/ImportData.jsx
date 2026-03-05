import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ImportData() {
  const queryClient = useQueryClient();
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
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data
      const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre_grupo: { type: "string" },
                  escuela: { type: "string" },
                  categoria: { type: "string" },
                  nombre_entrenador: { type: "string" },
                  email_entrenador: { type: "string" },
                  telefono_entrenador: { type: "string" },
                  participantes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nombre: { type: "string" },
                        nacimiento: { type: "string" }
                      }
                    },
                    description: "All nombre_N/nacimiento_N pairs where nombre is not null"
                  }
                }
              }
            }
          }
        }
      });

      if (res.status === "success" && res.output?.rows) {
        const rows = res.output.rows;
        const groups = rows.map(r => ({
          name: r.nombre_grupo?.trim() || "Sin nombre",
          school_name: r.escuela?.trim() || "",
          category: r.categoria?.trim() || "",
          coach_name: r.nombre_entrenador?.trim() || "",
          coach_email: r.email_entrenador?.trim() || "",
          coach_phone: r.telefono_entrenador?.trim() || "",
          participants: (r.participantes || [])
            .filter(p => p.nombre)
            .map(p => ({ name: p.nombre.trim(), birth_date: p.nacimiento?.trim() || "" }))
        }));

        // Bulk create in batches of 20
        let created = 0;
        for (let i = 0; i < groups.length; i += 20) {
          const batch = groups.slice(i, i + 20);
          await base44.entities.Group.bulkCreate(batch);
          created += batch.length;
        }

        // Also create registrations
        const regs = groups.map(g => ({
          group_name: g.name,
          school_name: g.school_name,
          category: g.category,
          coach_name: g.coach_name,
          status: "confirmed",
          payment_status: "pending",
          participants_count: g.participants.length
        }));

        for (let i = 0; i < regs.length; i += 20) {
          const batch = regs.slice(i, i + 20);
          await base44.entities.Registration.bulkCreate(batch);
        }

        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["registrations"] });

        setResult({ success: true, count: created });
        toast.success(`${created} grupos importados correctamente`);
      } else {
        setResult({ success: false, error: res.details || "Error al extraer datos" });
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
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Importar Datos</h1>
        <p className="text-muted-foreground mt-1">Sube un archivo Excel con las inscripciones</p>
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
                <p className="text-xs text-muted-foreground">Excel o CSV</p>
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
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" /> Importar Datos
              </>
            )}
          </Button>

          {result && (
            <div className={`p-4 rounded-xl text-sm ${result.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {result.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{result.count} grupos importados correctamente</span>
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