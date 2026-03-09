import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, Users, CheckCircle2, Circle, History, Lock } from "lucide-react";
import ReenrollmentWizard from "./ReenrollmentWizard.jsx";
import HistorialCompeticiones from "./HistorialCompeticiones";

const statusColors = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-primary/10 text-primary",
  complete:  "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels = {
  pending:   "🟡 Pendiente",
  confirmed: "🔵 Confirmado",
  complete:  "🟢 Completa",
  rejected:  "🔴 Rechazada",
  cancelled: "⚫ Cancelado",
};

// Normalize for comparison: lowercase, trim, no accents/tildes
function norm(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export default function SchoolView({ user, competitions, allGroups, registrations }) {
  const [showWizard, setShowWizard] = useState(false);

  // Derive school name via normalized comparison
  const mySchoolName = useMemo(() => {
    if (user.school_name?.trim()) return user.school_name.trim();
    // Fallback: match by coach email or created_by
    const matched = allGroups.find(g => g.coach_email === user.email || g.created_by === user.email);
    return matched?.school_name?.trim() || "";
  }, [allGroups, user]);

  // If no school found at all → show lockout, never show data
  if (!mySchoolName) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <h2 className="text-xl font-bold">Cuenta sin escuela asignada</h2>
            <p className="text-sm text-muted-foreground">Tu cuenta no está vinculada a ninguna escuela. Contacta con el administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use normalized comparison so typos/tildes don't break the match
  const myGroups = useMemo(() =>
    allGroups.filter(g => norm(g.school_name) === norm(mySchoolName)),
    [allGroups, mySchoolName]
  );

  const openCompetitions = competitions.filter(c => c.registration_open);

  // My registrations only — normalize school_name comparison
  const myRegistrations = useMemo(() =>
    registrations.filter(r => norm(r.school_name) === norm(mySchoolName)),
    [registrations, mySchoolName]
  );

  // Which group IDs are already registered per competition
  const registeredGroupIds = useMemo(() => {
    const map = {};
    myRegistrations.forEach(r => {
      if (!map[r.competition_id]) map[r.competition_id] = new Set();
      map[r.competition_id].add(r.group_id);
    });
    return map;
  }, [myRegistrations]);

  // Past registrations grouped by competition (for history)
  const byCompetition = useMemo(() => myRegistrations.reduce((acc, r) => {
    const key = r.competition_name || "Sin competición";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {}), [myRegistrations]);

  if (showWizard) {
    return (
      <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowWizard(false)} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Nueva inscripción</h1>
        </div>
        <ReenrollmentWizard
          user={user}
          mySchoolName={mySchoolName}
          myGroups={myGroups}
          competitions={openCompetitions}
          allGroups={allGroups}
          registrations={registrations}
          onSuccess={() => setShowWizard(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inscripciones</h1>
          {mySchoolName && <p className="text-muted-foreground mt-1">{mySchoolName}</p>}
        </div>
        {openCompetitions.length > 0 && myGroups.length > 0 && (
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Inscribirse a una competición
          </Button>
        )}
      </div>

      {/* My Groups — always visible */}
      {myGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Mis grupos ({myGroups.length})</h2>
          <div className="grid gap-2">
            {myGroups.map(group => {
              const registeredComps = openCompetitions.filter(c => registeredGroupIds[c.id]?.has(group.id));
              const pendingComps = openCompetitions.filter(c => !registeredGroupIds[c.id]?.has(group.id));
              return (
                <div key={group.id} className="flex items-center justify-between px-4 py-3 rounded-xl border bg-card gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{group.name}</div>
                      <div className="text-xs text-muted-foreground">{group.category} · {group.participants?.length || 0} participantes</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {registeredComps.map(c => (
                      <span key={c.id} className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> {c.name}
                      </span>
                    ))}
                    {pendingComps.map(c => (
                      <span key={c.id} className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <Circle className="w-3 h-3" /> Sin inscribir en {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open competition CTA */}
      {openCompetitions.length > 0 && myGroups.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-sm">{openCompetitions[0].name}</p>
              <p className="text-xs text-muted-foreground">Inscripciones abiertas</p>
            </div>
            <Button onClick={() => setShowWizard(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Inscribirse a una competición
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Registration history */}
      {myRegistrations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <History className="w-4 h-4" /> Historial de inscripciones
          </h2>
          <HistorialCompeticiones
            competitions={competitions}
            registrations={myRegistrations}
            groups={allGroups}
            isAdmin={false}
          />
        </div>
      )}

      {/* No groups at all */}
      {myGroups.length === 0 && myRegistrations.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto opacity-20 mb-3" />
            <p className="font-medium">No hay grupos asociados a {mySchoolName}</p>
            <p className="text-sm mt-1">Contacta con el administrador para añadir grupos.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}