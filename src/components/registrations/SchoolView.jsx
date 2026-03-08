import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trophy, ChevronLeft } from "lucide-react";
import ReenrollmentWizard from "./ReenrollmentWizard";

export default function SchoolView({ user, competitions, allGroups, registrations }) {
  const [showWizard, setShowWizard] = useState(false);

  const myGroups = allGroups.filter(g => g.coach_email === user.email || g.created_by === user.email);
  const mySchoolName = myGroups[0]?.school_name || "";
  const openCompetitions = competitions.filter(c => c.registration_open);

  // Registrations for my school, grouped by competition
  const myRegistrations = registrations.filter(r => r.school_name === mySchoolName);
  const byCompetition = myRegistrations.reduce((acc, r) => {
    const key = r.competition_name || "Sin competición";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const statusColors = {
    confirmed: "bg-primary/10 text-primary",
    pending: "bg-accent text-accent-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            {showWizard ? "Nueva inscripción" : "Mis Inscripciones"}
          </h1>
          {mySchoolName && <p className="text-muted-foreground mt-1">{mySchoolName}</p>}
        </div>
        {!showWizard && openCompetitions.length > 0 && (
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva inscripción
          </Button>
        )}
      </div>

      {showWizard ? (
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setShowWizard(false)} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
          <ReenrollmentWizard
            user={user}
            competitions={openCompetitions}
            allGroups={allGroups}
            registrations={registrations}
            onSuccess={() => setShowWizard(false)}
          />
        </div>
      ) : (
        <>
          {myRegistrations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Trophy className="w-12 h-12 mx-auto opacity-20" />
              <p className="font-medium">Sin inscripciones todavía</p>
              {openCompetitions.length > 0 && (
                <p className="text-sm">Usa el botón "Nueva inscripción" para registrar tus grupos</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(byCompetition).map(([compName, regs]) => (
                <Card key={compName}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Trophy className="w-4 h-4 text-primary shrink-0" />
                      <CardTitle className="text-base">{compName}</CardTitle>
                      <Badge variant="secondary" className="ml-auto">{regs.length} grupos</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {regs.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 gap-2 flex-wrap">
                        <div>
                          <div className="font-medium text-sm">{r.group_name}</div>
                          <div className="text-xs text-muted-foreground">{r.category} · {r.participants_count || 0} participantes</div>
                        </div>
                        <Badge className={`${statusColors[r.status] || statusColors.pending} border-0 text-[10px]`}>
                          {r.status === "confirmed" ? "Confirmado" : r.status === "cancelled" ? "Cancelado" : "Pendiente"}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}