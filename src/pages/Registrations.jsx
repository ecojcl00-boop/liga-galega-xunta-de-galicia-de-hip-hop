import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trophy, History } from "lucide-react";
import SchoolView from "../components/registrations/SchoolView";
import HistorialCompeticiones from "../components/registrations/HistorialCompeticiones";
import AdminInscripcionesPanel from "../components/registrations/AdminInscripcionesPanel";

export default function Registrations() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setUserLoading(false); })
      .catch(() => { setUser(null); setUserLoading(false); });
  }, []);

  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list("-date"),
    enabled: !!user,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list("-created_date"),
    enabled: !!user,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("name"),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Registration.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); closeGroupDialog(); },
  });

  const closeGroupDialog = () => { setShowGroupDialog(false); setSelectedCompetition(null); };

  const openCompetitions  = competitions.filter(c => c.registration_open);
  const compRegs          = selectedCompetition ? registrations.filter(r => r.competition_id === selectedCompetition?.id) : [];
  const registeredGroupIds = new Set(compRegs.map(r => r.group_id));
  const availableGroups   = groups.filter(g => !registeredGroupIds.has(g.id));

  const handleRegisterGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !selectedCompetition) return;
    createMutation.mutate({
      competition_id: selectedCompetition.id,
      competition_name: selectedCompetition.name,
      group_id: group.id,
      group_name: group.name,
      school_name: group.school_name,
      category: group.category,
      coach_name: group.coach_name,
      status: "confirmed",
      payment_status: "pending",
      participants_count: group.participants?.length || 0,
      participants: group.participants || [],
      documents: [],
    });
  };

  if (userLoading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;

  if (!user) {
    base44.auth.redirectToLogin(window.location.pathname);
    return null;
  }

  // School users → SchoolView
  if (user.role !== "admin") {
    return (
      <SchoolView
        user={user}
        competitions={competitions}
        allGroups={groups}
        registrations={registrations}
      />
    );
  }

  // Admin view
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inscripciones</h1>
        <p className="text-muted-foreground mt-1">{registrations.length} inscripciones totales</p>
      </div>

      <Tabs defaultValue="gestion">
        <TabsList>
          <TabsTrigger value="gestion" className="gap-2">
            <Trophy className="w-4 h-4" /> Gestión
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="w-4 h-4" /> Historial
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Gestión ── */}
        <TabsContent value="gestion" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowGroupDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Inscribir Grupo
            </Button>
          </div>
          <AdminInscripcionesPanel
            registrations={registrations}
            competitions={competitions}
            groups={groups}
          />
        </TabsContent>

        {/* ── Tab: Historial ── */}
        <TabsContent value="historial" className="mt-4">
          <HistorialCompeticiones
            competitions={competitions}
            registrations={registrations}
            groups={groups}
            isAdmin={true}
          />
        </TabsContent>
      </Tabs>

      {/* Admin: manual register group dialog */}
      <Dialog open={showGroupDialog} onOpenChange={(open) => !open && closeGroupDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inscribir Grupo en Competición</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Competición</Label>
              <Select value={selectedCompetition?.id || ""} onValueChange={(id) => setSelectedCompetition(competitions.find(c => c.id === id))}>
                <SelectTrigger><SelectValue placeholder="Selecciona una competición" /></SelectTrigger>
                <SelectContent>
                  {competitions.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCompetition && (
              <div className="space-y-2">
                <Label>Grupos disponibles ({availableGroups.length})</Label>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {availableGroups.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">Todos los grupos ya están inscritos en esta competición</p>
                  ) : (
                    availableGroups.map(group => (
                      <div key={group.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                        <div>
                          <div className="font-medium text-sm">{group.name}</div>
                          <div className="text-xs text-muted-foreground">{group.school_name} · {group.category}</div>
                          <div className="text-xs text-muted-foreground">{group.coach_name} · {group.participants?.length || 0} participantes</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleRegisterGroup(group.id)} disabled={createMutation.isPending}>
                          Inscribir
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={closeGroupDialog}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}