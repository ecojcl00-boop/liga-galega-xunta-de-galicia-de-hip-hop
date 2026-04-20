import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import LigaRankingView from "../components/rankings/LigaRankingView";
import JornadaResultados from "../components/rankings/JornadaResultados";
import ImportarResultados from "../components/rankings/ImportarResultados";
import { useSimulacro } from "../components/SimulacroContext";
import { useUser } from "../components/UserContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const JORNADAS_INFO = [
  { numero: 1, nombre: "Marín", fecha: "1-mar" },
  { numero: 2, nombre: "Fene", fecha: "2-mar" },
  { numero: 3, nombre: "Narón", fecha: "25-abr" },
  { numero: 4, nombre: "Lugo", fecha: "7-jun" },
  { numero: 5, nombre: "Vigo", fecha: "21-jun" },
];

export default function Rankings() {
  const { isSimulacro } = useSimulacro();
  const user = useUser();
  const isAdmin = user?.role === "admin";

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ["ligaResultados", isSimulacro],
    queryFn: async () => {
      const all = await base44.entities.LigaResultado.list("-numero_jornada");
      return all.filter(r => isSimulacro ? r.is_simulacro === true : !r.is_simulacro);
    },
  });

  const { data: competiciones = [] } = useQuery({
    queryKey: ["ligacompeticions"],
    queryFn: () => base44.entities.LigaCompeticion.list(),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando rankings...</div>;
  }

  // Jornadas que tienen datos
  const jornadasConDatos = [...new Set(resultados.map(r => r.numero_jornada))].sort((a, b) => a - b);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {isSimulacro && (
        <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg text-sm">
          ⚠️ <strong>Modo Simulacro:</strong> Mostrando solo datos de prueba
        </div>
      )}

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Liga Galega Xunta de Galicia Hip Hop</h1>
        <p className="text-muted-foreground mt-1">Circuito 2026 · 5 jornadas</p>
      </div>

      {isAdmin && !isSimulacro && <ImportarResultados />}

      <Tabs defaultValue="rankings">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="rankings" className="font-semibold">🏆 Rankings</TabsTrigger>
          {JORNADAS_INFO.map(j => {
            const hasData = jornadasConDatos.includes(j.numero);
            return (
              <TabsTrigger
                key={j.numero}
                value={`jornada-${j.numero}`}
                className={!hasData ? "opacity-50" : ""}
              >
                J{j.numero} · {j.nombre}
                {!hasData && <span className="ml-1 text-xs text-muted-foreground">({j.fecha})</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="rankings" className="mt-6">
          <LigaRankingView resultados={resultados} />
        </TabsContent>

        {JORNADAS_INFO.map(j => {
          const jornadaResultados = resultados.filter(r => r.numero_jornada === j.numero);
          const comp = competiciones.find(c => c.numero_jornada === j.numero);
          return (
            <TabsContent key={j.numero} value={`jornada-${j.numero}`} className="mt-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold">Jornada {j.numero} — {j.nombre}</h2>
                {comp && <p className="text-sm text-muted-foreground">{comp.name} · {j.fecha}</p>}
              </div>
              <JornadaResultados resultados={jornadaResultados} competicion={comp} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}