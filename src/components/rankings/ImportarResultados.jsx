import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, CheckCircle, AlertCircle, FileUp } from "lucide-react";

const calcularPuntosLiga = (puesto) => {
  const tabla = { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 20, 10: 10 };
  return tabla[puesto] || 0;
};

export default function ImportarResultados() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [resultadosFile, setResultadosFile] = useState(null);
  const [resultadosCompetition, setResultadosCompetition] = useState("");
  const [status, setStatus] = useState(null);

  const { data: competitions = [] } = useQuery({
    queryKey: ["ligacompeticions"],
    queryFn: () => base44.entities.LigaCompeticion.list(),
  });

  const handleImport = async () => {
    if (!resultadosFile || !resultadosCompetition) {
      setStatus({ type: "error", message: "Selecciona un archivo y una competición" });
      return;
    }

    setLoading(true);
    setStatus({ type: "loading", message: "Subiendo archivo..." });

    const { file_url } = await base44.integrations.Core.UploadFile({ file: resultadosFile });

    setStatus({ type: "loading", message: "Extrayendo resultados..." });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          numero_jornada: { type: "number" },
          grupo_nombre: { type: "string" },
          school_name: { type: "string" },
          categoria: { type: "string" },
          puesto: { type: "number" },
          puntuacion: { type: "number" },
        },
      },
    });

    if (result.status === "error") {
      setStatus({ type: "error", message: result.details });
      setLoading(false);
      return;
    }

    setStatus({ type: "loading", message: "Calculando puntos y guardando..." });

    const resultados = result.output.map((r) => ({
      ...r,
      competicion_id: resultadosCompetition,
      puntos_liga: calcularPuntosLiga(r.puesto),
      is_simulacro: false,
    }));

    await base44.entities.LigaResultado.bulkCreate(resultados);

    queryClient.invalidateQueries({ queryKey: ["ligaResultados"] });

    setStatus({
      type: "success",
      message: `✅ Importados ${resultados.length} resultados correctamente`,
    });
    setLoading(false);
    setResultadosFile(null);
    setResultadosCompetition("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="w-4 h-4" />
          Importar Resultados de Competición
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Competición</label>
          <Select value={resultadosCompetition} onValueChange={setResultadosCompetition}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una competición" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((comp) => (
                <SelectItem key={comp.id} value={comp.id}>
                  {comp.name} {comp.numero_jornada ? `— Jornada ${comp.numero_jornada}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Archivo (.xlsx o .pdf)</label>
          <Input
            type="file"
            accept=".xlsx,.xls,.pdf"
            onChange={(e) => setResultadosFile(e.target.files[0])}
            disabled={loading}
          />
        </div>

        <Button
          onClick={handleImport}
          disabled={!resultadosFile || !resultadosCompetition || loading}
          className="w-full gap-2"
        >
          <Upload className="w-4 h-4" />
          {loading ? "Importando..." : "Importar Resultados"}
        </Button>

        {status && (
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
              status.type === "success"
                ? "border-green-500 bg-green-50 text-green-800"
                : status.type === "error"
                ? "border-red-500 bg-red-50 text-red-800"
                : "border-blue-400 bg-blue-50 text-blue-800"
            }`}
          >
            {status.type === "success" && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {status.type === "error" && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {status.type === "loading" && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-0.5 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}