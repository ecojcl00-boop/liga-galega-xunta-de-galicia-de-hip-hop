import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import LigaRankingView from "../components/rankings/LigaRankingView";
import { useSimulacro } from "../components/SimulacroContext";

export default function Rankings() {
  const { isSimulacro } = useSimulacro();

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ["ligaResultados", isSimulacro],
    queryFn: async () => {
      const all = await base44.entities.LigaResultado.list("-numero_jornada");
      return all.filter(r => isSimulacro ? r.is_simulacro === true : !r.is_simulacro);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando rankings...</div>;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {isSimulacro && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg text-sm">
          ⚠️ <strong>Modo Simulacro:</strong> Mostrando solo datos de prueba
        </div>
      )}

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Rankings de la Liga</h1>
        <p className="text-muted-foreground mt-1">Clasificación general por categorías</p>
      </div>

      <LigaRankingView resultados={resultados} />
    </div>
  );
}