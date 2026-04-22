import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Ban, CheckCircle2 } from "lucide-react";

export default function GestionExclusionesLiga() {
  const queryClient = useQueryClient();

  const { data: escuelas = [], isLoading } = useQuery({
    queryKey: ["schoolsAll"],
    queryFn: () => base44.entities.School.list("name"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, excluida }) => base44.entities.School.update(id, { excluida_de_liga: excluida }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolsAll"] });
      queryClient.invalidateQueries({ queryKey: ["schoolsExcluidasLiga"] });
    },
  });

  const excluidas = escuelas.filter(s => s.excluida_de_liga);
  const activas = escuelas.filter(s => !s.excluida_de_liga);

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Cargando escuelas...</div>;

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-amber-600" />
            Solo participación — no puntúan para la liga
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Los equipos de estas escuelas aparecen en los resultados de cada jornada, pero sus puntos <strong>no se computan</strong> en el ranking total de liga.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {excluidas.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">Ninguna escuela excluida actualmente.</p>
          )}
          {excluidas.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div>
                <span className="font-medium text-sm">{s.name}</span>
                {s.city && <span className="text-xs text-muted-foreground ml-2">({s.city})</span>}
                <Badge variant="outline" className="ml-2 text-xs border-amber-400 text-amber-700 dark:text-amber-400">Solo participación</Badge>
              </div>
              <Switch
                checked={true}
                onCheckedChange={() => toggleMutation.mutate({ id: s.id, excluida: false })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Escuelas que puntúan para liga
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
          {activas.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40">
              <div>
                <span className="font-medium text-sm">{s.name}</span>
                {s.city && <span className="text-xs text-muted-foreground ml-2">({s.city})</span>}
              </div>
              <Switch
                checked={false}
                onCheckedChange={() => toggleMutation.mutate({ id: s.id, excluida: true })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}