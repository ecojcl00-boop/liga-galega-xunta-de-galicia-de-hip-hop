import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Trophy, Users, AlertCircle } from "lucide-react";
import ReRegistrationWizard from "./ReRegistrationWizard";

export default function SchoolDashboard({ user }) {
  const [showWizard, setShowWizard] = useState(false);
  const queryClient = useQueryClient();
  const schoolName = user.school_name;

  const { data: registrations = [], refetch } = useQuery({
    queryKey: ["my_registrations", schoolName],
    queryFn: () =>
      schoolName
        ? base44.entities.Registration.filter({ school_name: schoolName }, "-created_date", 200)
        : Promise.resolve([]),
    enabled: !!schoolName,
  });

  if (!schoolName) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="font-medium">Tu cuenta no tiene una escuela asignada.</p>
          <p className="text-muted-foreground text-sm mt-1">Contacta con el administrador para vincular tu cuenta a una escuela.</p>
        </div>
      </div>
    );
  }

  if (showWizard) {
    return (
      <ReRegistrationWizard
        user={user}
        schoolName={schoolName}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["registrations"] });
          setShowWizard(false);
        }}
      />
    );
  }

  // Group by competition
  const byCompetition = {};
  registrations.forEach(r => {
    const comp = r.competition_name || "Sin competición";
    if (!byCompetition[comp]) byCompetition[comp] = [];
    byCompetition[comp].push(r);
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Mis Inscripciones</h1>
          <p className="text-muted-foreground mt-1">{schoolName}</p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Nueva inscripción
        </Button>
      </div>

      {Object.keys(byCompetition).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No tienes inscripciones aún.</p>
            <p className="text-sm mt-1">Pulsa "Nueva inscripción" para empezar.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(byCompetition).map(([comp, regs]) => (
          <Card key={comp}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                {comp}
                <Badge variant="secondary" className="ml-auto">{regs.length} grupos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {regs.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.group_name}</p>
                    <p className="text-xs text-muted-foreground">{r.category}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <Users className="w-3.5 h-3.5" />
                    {r.participants_count || 0}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    r.status === "confirmed" ? "bg-green-100 text-green-700" :
                    r.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                  }`}>
                    {r.status === "confirmed" ? "Confirmada" : r.status === "pending" ? "Pendiente" : "Cancelada"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}