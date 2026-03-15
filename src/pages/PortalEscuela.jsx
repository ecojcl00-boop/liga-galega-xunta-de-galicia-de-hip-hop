import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/UserContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock, Plus, Calendar, Download, FileText,
  Users, CheckCircle2, Home, Trophy, ClipboardList
} from "lucide-react";
import { downloadFile } from "@/components/utils/downloadFile";
import LigaRankingView from "@/components/rankings/LigaRankingView";
import ReenrollmentWizard from "@/components/registrations/ReenrollmentWizard";
import HistorialCompeticiones from "@/components/registrations/HistorialCompeticiones";
import Dashboard from "@/pages/Dashboard";

function nd(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Modalidades y orden ──────────────────────────────────────────────────────
const MODALITY_ORDER = [
  {
    label: "Individual",
    categories: ["Mini Individual A", "Mini Individual B", "Individual"],
  },
  {
    label: "Parejas",
    categories: ["Mini Parejas A", "Mini Parejas B", "Parejas"],
  },
  {
    label: "Grupos",
    categories: ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"],
  },
  {
    label: "Mega Crew",
    categories: ["Megacrew"],
  },
];

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Pantalla de bloqueo ──────────────────────────────────────────────────────
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

// ── Tab: Competiciones ───────────────────────────────────────────────────────
function TabCompeticiones({ competitions, registrations, schoolName }) {
  if (competitions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto opacity-20 mb-3" />
          <p>No hay competiciones registradas todavía.</p>
        </CardContent>
      </Card>
    );
  }

  console.log("TabCompeticiones debug:", { schoolName, registrationsCount: registrations.length, firstReg: registrations[0]?.school_name });

  return (
    <div className="grid gap-3">
      {competitions.map(comp => {
        const fecha = formatDate(comp.date);
        const myCount = registrations.filter(r =>
          (r.competition_id === comp.id || nd(r.competition_name) === nd(comp.name)) && nd(r.school_name) === nd(schoolName)
        ).length;
        return (
          <Card key={comp.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                    {comp.name}
                    {myCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-normal">{myCount} grupos inscritos</Badge>
                    )}
                  </h3>
                  {fecha && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {fecha}
                    </p>
                  )}
                  {comp.location && (
                    <p className="text-sm text-muted-foreground">{comp.location}</p>
                  )}
                </div>
                <Badge variant={comp.registration_open ? "default" : "outline"} className="shrink-0">
                  {comp.registration_open ? "Inscripciones abiertas" : "Inscripciones cerradas"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Tab: Mis Grupos ──────────────────────────────────────────────────────────
function TabMisGrupos({ groups, registrations, competitions, loading }) {
  // Para cada grupo, obtener los participantes del último registro o del grupo directamente
  function getParticipants(group) {
    const regsForGroup = registrations
      .filter(r => r.group_id === group.id)
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    const lastReg = regsForGroup[0];
    if (lastReg?.participants?.length > 0) return lastReg.participants;
    return group.participants || [];
  }

  // Saber si el grupo está inscrito en alguna competición
  function getRegisteredCompetitions(group) {
    return competitions.filter(comp =>
      registrations.some(r =>
        (r.group_id === group.id) &&
        (r.competition_id === comp.id || r.competition_name === comp.name)
      )
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>;
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto opacity-20 mb-3" />
          <p>No hay grupos registrados para tu escuela.</p>
          <p className="text-sm mt-1">Contacta con el administrador para añadir grupos.</p>
        </CardContent>
      </Card>
    );
  }

  // Organizar por modalidad y categoría
  const groupsByCategory = {};
  groups.forEach(g => {
    const cat = g.category || "Otros";
    if (!groupsByCategory[cat]) groupsByCategory[cat] = [];
    groupsByCategory[cat].push(g);
  });

  return (
    <div className="space-y-6">
      {MODALITY_ORDER.map(modality => {
        const modalityGroups = modality.categories.flatMap(cat => groupsByCategory[cat] || []);
        if (modalityGroups.length === 0) return null;

        return (
          <div key={modality.label}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {modality.label}
            </h3>
            <div className="grid gap-3">
              {modality.categories.flatMap(cat =>
                (groupsByCategory[cat] || []).map(group => {
                  const participants = getParticipants(group);
                  const registeredComps = getRegisteredCompetitions(group);

                  return (
                    <Card key={group.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{group.name}</h4>
                              <Badge variant="outline" className="text-xs">{group.category}</Badge>
                            </div>
                            {group.coach_name && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Entrenador: {group.coach_name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {participants.length} participante{participants.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          {registeredComps.length > 0 && (
                            <div className="flex flex-col gap-1 items-end">
                              {registeredComps.map(comp => (
                                <span
                                  key={comp.id}
                                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  {comp.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {participants.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Participantes:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {participants.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                                  <span className="flex-1 font-medium">{p.name || p}</span>
                                  {p.birth_date && (
                                    <span className="text-muted-foreground shrink-0">
                                      {p.birth_date}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {/* Grupos con categoría no mapeada */}
      {(() => {
        const mappedCats = MODALITY_ORDER.flatMap(m => m.categories);
        const ungrouped = groups.filter(g => !mappedCats.includes(g.category));
        if (ungrouped.length === 0) return null;
        return (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Otros</h3>
            <div className="grid gap-3">
              {ungrouped.map(group => {
                const participants = getParticipants(group);
                const registeredComps = getRegisteredCompetitions(group);
                return (
                  <Card key={group.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold">{group.name}</h4>
                            <Badge variant="outline" className="text-xs">{group.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{participants.length} participante{participants.length !== 1 ? "s" : ""}</p>
                        </div>
                        {registeredComps.length > 0 && (
                          <div className="flex flex-col gap-1 items-end">
                            {registeredComps.map(comp => (
                              <span key={comp.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />{comp.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {participants.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Participantes:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {participants.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                                <span className="flex-1 font-medium">{p.name || p}</span>
                                {p.birth_date && <span className="text-muted-foreground shrink-0">{p.birth_date}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Tab: Documentos ──────────────────────────────────────────────────────────
function TabDocumentos({ actas }) {
  if (actas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto opacity-20 mb-3" />
          <p>No hay documentos disponibles para tu escuela todavía.</p>
          <p className="text-sm mt-1">El administrador subirá las actas de jueces aquí.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {actas.map(acta => {
        const fecha = formatDate(acta.fecha);
        return (
          <div
            key={acta.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {acta.file_name || acta.competition_name}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">{acta.competition_name}</Badge>
                {fecha && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {fecha}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0"
              onClick={() => downloadFile(acta.file_url, acta.file_name || acta.competition_name || "acta")}
            >
              <Download className="w-3.5 h-3.5" /> Descargar
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function PortalEscuela() {
  const user = useUser();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);

  const schoolName = user?.school_name?.trim() || "";

  function nd(str) {
    return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  // Todos los hooks incondicionalmente
  const { data: allGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["portal_groups_all"],
    queryFn: () => base44.entities.Group.list("name"),
  });

  const { data: allRegistrations = [] } = useQuery({
    queryKey: ["portal_registrations_all"],
    queryFn: () => base44.entities.Registration.list("-created_date"),
  });

  const groups = allGroups.filter(g => nd(g.school_name) === nd(schoolName));
  const registrations = allRegistrations.filter(r => nd(r.school_name) === nd(schoolName));

  const { data: competitions = [] } = useQuery({
    queryKey: ["portal_competitions"],
    queryFn: () => base44.entities.LigaCompeticion.list("-date"),
  });

  const { data: actas = [] } = useQuery({
    queryKey: ["portal_actas", schoolName],
    queryFn: () => base44.entities.ActaJueces.filter({ school_name: schoolName }, "-fecha"),
    enabled: !!schoolName,
  });

  const { data: ligaResultados = [] } = useQuery({
    queryKey: ["portal_liga"],
    queryFn: () => base44.entities.LigaResultado.list(),
  });

  // Returns condicionales DESPUÉS de todos los hooks
  if (!user) return null;
  if (user.role !== "admin" && !schoolName) return <LockoutScreen />;

  const openCompetitions = competitions.filter(c => c.registration_open);
  const resultadosSinSimulacro = useMemo(
    () => ligaResultados.filter(r => !r.is_simulacro),
    [ligaResultados]
  );

  // Wizard a pantalla completa
  if (showWizard) {
    return (
      <div className="p-4 lg:p-8 space-y-4 max-w-4xl mx-auto">
        <ReenrollmentWizard
          user={user}
          mySchoolName={schoolName}
          myGroups={groups}
          competitions={openCompetitions}
          allGroups={groups}
          registrations={registrations}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["portal_registrations", schoolName] });
            queryClient.invalidateQueries({ queryKey: ["portal_groups", schoolName] });
            setShowWizard(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <Tabs defaultValue="home">
        <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
          <TabsTrigger value="home" className="gap-1.5">
            <Home className="w-3.5 h-3.5" /> Home
          </TabsTrigger>
          <TabsTrigger value="competiciones" className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Competiciones
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Mis Grupos
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Ranking
          </TabsTrigger>
        </TabsList>

        {/* ── Home ── */}
        <TabsContent value="home">
          <Dashboard />
        </TabsContent>

        {/* ── Competiciones ── */}
        <TabsContent value="competiciones" className="space-y-4">
          <h2 className="text-lg font-semibold">Competiciones</h2>
          <TabCompeticiones competitions={competitions} registrations={registrations} schoolName={schoolName} />
        </TabsContent>

        {/* ── Mis Grupos ── */}
        <TabsContent value="grupos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mis Grupos</h2>
            <Badge variant="secondary">{groups.length} grupos</Badge>
          </div>
          <TabMisGrupos
            groups={groups}
            registrations={registrations}
            competitions={competitions}
            loading={groupsLoading}
          />
        </TabsContent>



        {/* ── Documentos ── */}
        <TabsContent value="documentos" className="space-y-4">
          <h2 className="text-lg font-semibold">Documentos</h2>
          <TabDocumentos actas={actas} />
        </TabsContent>

        {/* ── Ranking ── */}
        <TabsContent value="ranking">
          <LigaRankingView resultados={resultadosSinSimulacro} />
        </TabsContent>
      </Tabs>
    </div>
  );
}