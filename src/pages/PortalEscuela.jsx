import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/components/UserContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ClipboardList, FileText, Trophy, Lock,
  Plus, ChevronLeft, Calendar, ExternalLink,
  CheckCircle2, Circle
} from "lucide-react";
import LigaRankingView from "@/components/rankings/LigaRankingView";
import ReenrollmentWizard from "@/components/registrations/ReenrollmentWizard";
import HistorialCompeticiones from "@/components/registrations/HistorialCompeticiones";

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

function LockoutScreen() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-sm w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-3">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <h2 className="text-xl font-bold">Cuenta sin escuela asignada</h2>
          <p className="text-sm text-muted-foreground">
            Tu cuenta no está vinculada a ninguna escuela. Contacta con el administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalEscuela() {
  const user = useUser();
  const [showWizard, setShowWizard] = useState(false);

  if (!user) return null;
  if (!user.school_name?.trim()) return <LockoutScreen />;

  const schoolName = user.school_name.trim();

  // All queries filter in DB — never list() + JS filter
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["portal_groups", schoolName],
    queryFn: () => base44.entities.Group.filter({ school_name: schoolName }, "name"),
  });

  const { data: registrations = [], isLoading: regsLoading } = useQuery({
    queryKey: ["portal_registrations", schoolName],
    queryFn: () => base44.entities.Registration.filter({ school_name: schoolName }, "-created_date"),
  });

  const { data: competitions = [] } = useQuery({
    queryKey: ["portal_competitions"],
    queryFn: () => base44.entities.Competition.list("-date"),
  });

  const { data: actas = [] } = useQuery({
    queryKey: ["portal_actas", schoolName],
    queryFn: () => base44.entities.ActaJueces.filter({ school_name: schoolName }, "-fecha"),
  });

  const { data: ligaResultados = [] } = useQuery({
    queryKey: ["portal_liga"],
    queryFn: () => base44.entities.LigaResultado.list(),
  });

  const openCompetitions = competitions.filter(c => c.registration_open);

  const registeredGroupIds = useMemo(() => {
    const map = {};
    registrations.forEach(r => {
      if (!map[r.competition_id]) map[r.competition_id] = new Set();
      map[r.competition_id].add(r.group_id);
    });
    return map;
  }, [registrations]);

  // Wizard view
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
          mySchoolName={schoolName}
          myGroups={groups}
          competitions={openCompetitions}
          allGroups={groups}
          registrations={registrations}
          onSuccess={() => setShowWizard(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <Tabs defaultValue="inscripciones">
        <TabsList className="grid grid-cols-4 w-full mb-6">
          <TabsTrigger value="grupos" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mis Grupos</span>
            <span className="sm:hidden">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="inscripciones" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inscripciones</span>
            <span className="sm:hidden">Inscr.</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mis Documentos</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            Ranking
          </TabsTrigger>
        </TabsList>

        {/* ── Mis Grupos ── */}
        <TabsContent value="grupos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mis Grupos</h2>
            <Badge variant="secondary">{groups.length} grupos</Badge>
          </div>
          {groupsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto opacity-20 mb-3" />
                <p>No hay grupos registrados para {schoolName}</p>
                <p className="text-sm mt-1">Contacta con el administrador para añadir grupos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {groups.map(group => (
                <Card key={group.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{group.name}</h3>
                          <Badge variant="outline" className="text-xs">{group.category}</Badge>
                        </div>
                        {group.coach_name && (
                          <p className="text-sm text-muted-foreground mt-1">Entrenador: {group.coach_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.participants?.length || 0} participantes
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {openCompetitions.map(c => {
                          const registered = registeredGroupIds[c.id]?.has(group.id);
                          return (
                            <span key={c.id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${registered ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                              {registered
                                ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                                : <Circle className="w-3 h-3 flex-shrink-0" />}
                              {c.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {group.participants?.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Participantes:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {group.participants.map((p, i) => (
                            <span key={i} className="text-xs bg-muted/50 rounded px-2 py-1 truncate">
                              {p.name || p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Inscripciones ── */}
        <TabsContent value="inscripciones" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Mis Inscripciones</h2>
            {openCompetitions.length > 0 && groups.length > 0 && (
              <Button onClick={() => setShowWizard(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Inscribirse a competición
              </Button>
            )}
          </div>

          {openCompetitions.length > 0 && groups.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-sm">{openCompetitions[0].name}</p>
                  <p className="text-xs text-muted-foreground">Inscripciones abiertas</p>
                </div>
                <Button onClick={() => setShowWizard(true)} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" /> Inscribirse
                </Button>
              </CardContent>
            </Card>
          )}

          {regsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
          ) : registrations.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <ClipboardList className="w-10 h-10 mx-auto opacity-20 mb-3" />
                <p>No hay inscripciones todavía</p>
              </CardContent>
            </Card>
          ) : (
            <HistorialCompeticiones
              competitions={competitions}
              registrations={registrations}
              groups={groups}
              isAdmin={false}
            />
          )}
        </TabsContent>

        {/* ── Mis Documentos ── */}
        <TabsContent value="documentos" className="space-y-4">
          <h2 className="text-lg font-semibold">Mis Documentos</h2>
          {actas.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto opacity-20 mb-3" />
                <p>No hay documentos disponibles para tu escuela todavía.</p>
                <p className="text-sm mt-1">El administrador subirá las actas de jueces aquí.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {actas.map(acta => {
                const fecha = acta.fecha
                  ? new Date(acta.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                      day: "2-digit", month: "short", year: "numeric"
                    })
                  : null;
                return (
                  <div key={acta.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {acta.document_name || acta.competicion_nombre}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{acta.competicion_nombre}</Badge>
                        {fecha && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {fecha}
                          </span>
                        )}
                      </div>
                      {acta.notas && <p className="text-xs text-muted-foreground mt-1">{acta.notas}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 flex-shrink-0"
                      onClick={() => window.open(acta.document_url, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Ver
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Ranking ── */}
        <TabsContent value="ranking">
          <LigaRankingView resultados={ligaResultados} />
        </TabsContent>
      </Tabs>
    </div>
  );
}