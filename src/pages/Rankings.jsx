import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSimulacro } from "../components/SimulacroContext";

const CATEGORIES = [
  { key: "Predance 4-6 años", label: "Predance 4-6 años" },
  { key: "Iniciación 7-8 años", label: "Iniciación 7-8 años" },
  { key: "Infantil 9-11 años", label: "Infantil 9-11 años" },
  { key: "Junior 12-15 años", label: "Junior 12-15 años" },
  { key: "Youth 16-18 años", label: "Youth 16-18 años" },
  { key: "Senior +18 años", label: "Senior +18 años" },
];

const normalizeGroupName = (name) => {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
};

export default function Rankings() {
  const { isSimulacro } = useSimulacro();
  const [selectedCompetition, setSelectedCompetition] = useState("");

  // Fetch all liga resultados with simulacro filter
  const { data: allResultados = [], isLoading: loadingResultados } = useQuery({
    queryKey: ["ligaResultados", isSimulacro],
    queryFn: async () => {
      const all = await base44.entities.LigaResultado.list("-numero_jornada");
      return all.filter(r => isSimulacro ? r.is_simulacro === true : !r.is_simulacro);
    },
  });

  // Fetch competitions for dropdown
  const { data: competitions = [] } = useQuery({
    queryKey: ["ligaCompeticiones", isSimulacro],
    queryFn: async () => {
      const all = await base44.entities.LigaCompeticion.list("-fecha");
      const filtered = all.filter(c => isSimulacro ? c.is_simulacro === true : !c.is_simulacro);
      return filtered;
    },
  });

  // Calculate Liga Ranking
  const calculateLigaRanking = (categoria) => {
    const results = allResultados.filter(r => r.categoria === categoria);
    const groupMap = {};

    results.forEach(r => {
      const key = normalizeGroupName(r.grupo_nombre);
      if (!key) return;

      if (!groupMap[key]) {
        groupMap[key] = {
          grupo_nombre: r.grupo_nombre,
          school_name: r.school_name,
          categoria: r.categoria,
          positions: { "1": 0, "2": 0, "3": 0 },
          totalPoints: 0,
          bestScore: 0,
          jornadas: [],
        };
      }

      groupMap[key].jornadas.push({
        jornada: r.numero_jornada,
        puesto: r.puesto,
        puntuacion: r.puntuacion,
      });

      if (r.puesto >= 1 && r.puesto <= 3) {
        groupMap[key].positions[r.puesto.toString()]++;
      }

      const points = r.puesto === 1 ? 5 : r.puesto === 2 ? 3 : r.puesto === 3 ? 1 : 0;
      groupMap[key].totalPoints += points;

      if (r.puntuacion && r.puntuacion > groupMap[key].bestScore) {
        groupMap[key].bestScore = r.puntuacion;
      }
    });

    return Object.values(groupMap).sort((a, b) => {
      if (a.positions["1"] !== b.positions["1"]) return b.positions["1"] - a.positions["1"];
      if (a.positions["2"] !== b.positions["2"]) return b.positions["2"] - a.positions["2"];
      if (a.positions["3"] !== b.positions["3"]) return b.positions["3"] - a.positions["3"];
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.bestScore !== b.bestScore) return b.bestScore - a.bestScore;
      return a.grupo_nombre.localeCompare(b.grupo_nombre);
    });
  };

  // Get results for selected competition
  const getCompetitionResults = () => {
    if (!selectedCompetition) return {};
    
    const comp = competitions.find(c => c.id === selectedCompetition);
    if (!comp) return {};

    const results = allResultados.filter(
      r => r.competicion_nombre === comp.nombre && r.numero_jornada === comp.numero_jornada
    );

    const byCategory = {};
    CATEGORIES.forEach(cat => {
      byCategory[cat.key] = results
        .filter(r => r.categoria === cat.key)
        .sort((a, b) => {
          if (a.puesto !== b.puesto) return a.puesto - b.puesto;
          return (b.puntuacion || 0) - (a.puntuacion || 0);
        });
    });

    return byCategory;
  };

  const renderPodiumBadge = (position) => {
    const config = {
      1: { bg: "bg-yellow-500", text: "text-yellow-950", icon: "🥇" },
      2: { bg: "bg-gray-400", text: "text-gray-950", icon: "🥈" },
      3: { bg: "bg-amber-700", text: "text-amber-50", icon: "🥉" },
    };
    const c = config[position];
    if (!c) return <Badge variant="outline">{position}°</Badge>;
    return (
      <Badge className={`${c.bg} ${c.text} font-bold`}>
        {c.icon} {position}°
      </Badge>
    );
  };

  if (loadingResultados) {
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
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Rankings</h1>
        <p className="text-muted-foreground mt-1">Clasificaciones y resultados de la liga</p>
      </div>

      <Tabs defaultValue="liga" className="space-y-4">
        <TabsList>
          <TabsTrigger value="liga">Ranking de la Liga</TabsTrigger>
          <TabsTrigger value="competicion">Por Competición</TabsTrigger>
        </TabsList>

        {/* Ranking de la Liga */}
        <TabsContent value="liga" className="space-y-6">
          {CATEGORIES.map((cat) => {
            const ranking = calculateLigaRanking(cat.key);
            if (ranking.length === 0) return null;

            return (
              <Card key={cat.key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    {cat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-semibold">Pos</th>
                          <th className="text-left py-2 px-2 font-semibold">Grupo</th>
                          <th className="text-left py-2 px-2 font-semibold">Escuela</th>
                          <th className="text-center py-2 px-2 font-semibold">🥇</th>
                          <th className="text-center py-2 px-2 font-semibold">🥈</th>
                          <th className="text-center py-2 px-2 font-semibold">🥉</th>
                          <th className="text-center py-2 px-2 font-semibold">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.map((g, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 font-bold">
                              {idx < 3 ? renderPodiumBadge(idx + 1) : `${idx + 1}°`}
                            </td>
                            <td className="py-2 px-2 font-medium">{g.grupo_nombre}</td>
                            <td className="py-2 px-2 text-muted-foreground">{g.school_name}</td>
                            <td className="py-2 px-2 text-center">{g.positions["1"] || "-"}</td>
                            <td className="py-2 px-2 text-center">{g.positions["2"] || "-"}</td>
                            <td className="py-2 px-2 text-center">{g.positions["3"] || "-"}</td>
                            <td className="py-2 px-2 text-center font-semibold">{g.totalPoints}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Por Competición */}
        <TabsContent value="competicion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Selecciona una competición</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Elige una competición" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.nombre} - Jornada {comp.numero_jornada}
                      {comp.fecha && ` (${new Date(comp.fecha).toLocaleDateString()})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedCompetition ? (
            (() => {
              const resultsByCategory = getCompetitionResults();
              const hasResults = Object.values(resultsByCategory).some(arr => arr.length > 0);

              if (!hasResults) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <Medal className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No hay resultados para esta competición</p>
                  </div>
                );
              }

              return CATEGORIES.map((cat) => {
                const results = resultsByCategory[cat.key];
                if (!results || results.length === 0) return null;

                return (
                  <Card key={cat.key}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Medal className="w-5 h-5 text-primary" />
                        {cat.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-semibold">Puesto</th>
                              <th className="text-left py-2 px-2 font-semibold">Grupo</th>
                              <th className="text-left py-2 px-2 font-semibold">Escuela</th>
                              <th className="text-center py-2 px-2 font-semibold">Puntuación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((r, idx) => (
                              <tr key={idx} className="border-b hover:bg-muted/50">
                                <td className="py-2 px-2 font-bold">
                                  {r.puesto <= 3 ? renderPodiumBadge(r.puesto) : `${r.puesto}°`}
                                </td>
                                <td className="py-2 px-2 font-medium">{r.grupo_nombre}</td>
                                <td className="py-2 px-2 text-muted-foreground">{r.school_name}</td>
                                <td className="py-2 px-2 text-center">
                                  {r.puntuacion ? r.puntuacion.toFixed(2) : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Medal className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Selecciona una competición para ver sus resultados</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}