import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/components/UserContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ClipboardList, FileText, Trophy, Lock,
  Plus, ChevronLeft, Calendar, Download,
  CheckCircle2, Circle, Settings, Trash2
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { downloadFile } from "@/components/utils/downloadFile";
import LigaRankingView from "@/components/rankings/LigaRankingView";
import ReenrollmentWizard from "@/components/registrations/ReenrollmentWizard";
import HistorialCompeticiones from "@/components/registrations/HistorialCompeticiones";
import { createPageUrl } from "@/utils";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const schoolName = user?.school_name?.trim() || "";

  // All hooks must be called unconditionally
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["portal_groups", schoolName],
    queryFn: () => base44.entities.Group.filter({ school_name: schoolName }, "name"),
    enabled: !!schoolName,
  });

  const { data: registrations = [], isLoading: regsLoading } = useQuery({
    queryKey: ["portal_registrations", schoolName],
    queryFn: () => base44.entities.Registration.filter({ school_name: schoolName }, "-created_date"),
    enabled: !!schoolName,
  });

  const { data: competitions = [] } = useQuery({
    queryKey: ["portal_competitions"],
    queryFn: () => base44.entities.Competition.list("-date"),
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

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // Delete user account via backend function
      await base44.functions.invoke("deleteMyAccount", {});
    },
    onSuccess: () => {
      base44.auth.logout(createPageUrl("Landing"));
    },
  });

  // Early returns after all hooks
  if (!user) return null;
  if (!user.school_name?.trim()) return <LockoutScreen />;

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
        <TabsList className="grid grid-cols-5 w-full mb-6">
          <TabsTrigger value="grupos" className="gap-1.5 select-none">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mis Grupos</span>
            <span className="sm:hidden">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="inscripciones" className="gap-1.5 select-none">
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inscripciones</span>
            <span className="sm:hidden">Inscr.</span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5 select-none">
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mis Documentos</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5 select-none">
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ranking</span>
            <span className="sm:hidden">Rank</span>
          </TabsTrigger>
          <TabsTrigger value="cuenta" className="gap-1.5 select-none">
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cuenta</span>
            <span className="sm:hidden">Cuenta</span>
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
                      onClick={() => downloadFile(acta.document_url, acta.document_name || acta.competicion_nombre || "acta")}
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar
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

        {/* ── Account Settings ── */}
        <TabsContent value="cuenta" className="space-y-4">
          <h2 className="text-lg font-semibold">Configuración de Cuenta</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="font-medium mb-1">Información de cuenta</h3>
                <p className="text-sm text-muted-foreground">Email: {user.email}</p>
                <p className="text-sm text-muted-foreground">Escuela: {schoolName}</p>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2 text-destructive">Zona de peligro</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Eliminar tu cuenta es una acción permanente. Todos tus datos asociados serán eliminados.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 select-none"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar mi cuenta
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente tu cuenta y todos los datos asociados a ella.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="select-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 select-none"
            >
              {deleteAccountMutation.isPending ? "Eliminando..." : "Sí, eliminar mi cuenta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}