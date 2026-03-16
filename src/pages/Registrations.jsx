import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trophy, History, Eye } from "lucide-react";
import SchoolView from "../components/registrations/SchoolView";
import HistorialCompeticiones from "../components/registrations/HistorialCompeticiones";
import AdminInscripcionesPanel from "../components/registrations/AdminInscripcionesPanel";
import CreateGroupDialog from "../components/registrations/CreateGroupDialog.jsx";
import CreateIndividualDialog from "../components/registrations/CreateIndividualDialog.jsx";
import SchoolSimulator from "../components/registrations/SchoolSimulator.jsx";
import SchoolSelectorDialog from "../components/registrations/SchoolSelectorDialog.jsx";
import { useUser } from "@/components/UserContext";
import { useSimulacro } from "@/components/SimulacroContext";

// Build a deduplicated school list from group data using school_name as key
function buildSchoolOptions(groups) {
  const map = new Map();
  groups.forEach(g => {
    const key = g.school_name?.trim().toLowerCase();
    if (key && !map.has(key)) {
      map.set(key, { id: g.school_name, name: g.school_name });
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export default function Registrations() {
  const user = useUser();
  const { isSimulacro } = useSimulacro();

  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [showCreateIndividualDialog, setShowCreateIndividualDialog] = useState(false);
  const [showSchoolSimulator, setShowSchoolSimulator] = useState(false);
  const [simulatedSchool, setSimulatedSchool] = useState(null);

  const queryClient = useQueryClient();

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.LigaCompeticion.list("-date"),
    enabled: !!user,
  });

  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations", user?.role, user?.school_name, isSimulacro],
    queryFn: () => {
      if (user?.role === "admin") return base44.entities.Registration.list("-created_date");
      if (!user?.school_name) return [];
      // Load all and filter client-side to handle case/accent mismatches in school_name
      return base44.entities.Registration.list("-created_date");
    },
    select: (data) => {
      let filtered = isSimulacro ? data : data.filter(r => !r.is_simulacro);
      if (user?.role !== "admin" && user?.school_name) {
        filtered = filtered.filter(r => norm(r.school_name) === norm(user.school_name));
      }
      return filtered;
    },
    enabled: !!user,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", user?.role, user?.school_name],
    queryFn: () => {
      if (user?.role === "admin") return base44.entities.Group.list("name");
      if (!user?.school_name) return [];
      // Load all and filter client-side to handle case/accent mismatches in school_name
      return base44.entities.Group.list("name");
    },
    select: (data) => {
      if (user?.role !== "admin" && user?.school_name) {
        return data.filter(g => norm(g.school_name) === norm(user.school_name));
      }
      return data;
    },
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
      participants_count: group.participants?.length ?? 0,
      participants: group.participants || [],
      documents: [],
      is_simulacro: isSimulacro,
    });
  };

  if (!user) return null; // Layout handles redirect

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

  // Admin: simulating a school → show full school view inline with banner
  if (simulatedSchool) {
    return (
      <SchoolSimulator
        simulatedSchool={simulatedSchool}
        onExit={() => setSimulatedSchool(null)}
        allGroups={groups}
        competitions={competitions}
        registrations={registrations}
      />
    );
  }

  const schoolOptions = buildSchoolOptions(groups);
  const categoryOptions = [...new Map(groups.map(g => [g.category, { id: g.category, name: g.category }])).values()];

  // Admin view
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inscripciones</h1>
          <p className="text-muted-foreground mt-1">{registrations.length} inscripciones totales</p>
        </div>
        <Button onClick={() => setShowSchoolSimulator(true)} variant="outline" className="gap-2">
          <Eye className="w-4 h-4" /> Simular vista de escuela
        </Button>
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
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowCreateGroupDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo grupo
            </Button>
            <Button onClick={() => setShowCreateIndividualDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo participante
            </Button>
            <Button onClick={() => setShowGroupDialog(true)} variant="outline" className="gap-2">
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
              <Label>Competición (con inscripción abierta)</Label>
              <Select value={selectedCompetition?.id || ""} onValueChange={(id) => setSelectedCompetition(openCompetitions.find(c => c.id === id))}>
                <SelectTrigger><SelectValue placeholder="Selecciona una competición" /></SelectTrigger>
                <SelectContent>
                  {openCompetitions.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">No hay competiciones con inscripción abierta</div>
                  ) : (
                    openCompetitions.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
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

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={showCreateGroupDialog}
        onOpenChange={setShowCreateGroupDialog}
        categories={categoryOptions}
        schools={schoolOptions}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["groups"] }); }}
      />

      {/* Create Individual Dialog */}
      <CreateIndividualDialog
        open={showCreateIndividualDialog}
        onOpenChange={setShowCreateIndividualDialog}
        categories={categoryOptions}
        schools={schoolOptions}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["groups"] }); }}
      />

      {/* School Selector Dialog */}
      <SchoolSelectorDialog
        open={showSchoolSimulator}
        onOpenChange={setShowSchoolSimulator}
        allGroups={groups}
        onSelect={(school) => { setSimulatedSchool(school); setShowSchoolSimulator(false); }}
      />
    </div>
  );
}