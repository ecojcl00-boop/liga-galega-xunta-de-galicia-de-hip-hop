import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, Users, CheckCircle2, Circle, History, Lock, Pencil, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import ReenrollmentWizard from "./ReenrollmentWizard.jsx";
import HistorialCompeticiones from "./HistorialCompeticiones";
import CreateGroupDialog from "./CreateGroupDialog";
import EditGroupDialog from "./EditGroupDialog";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingParticipant, setEditingParticipant] = useState(null); // { groupId, participantIndex }
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

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

  // Group structure by modality and category
  const modalityStructure = [
    {
      name: "Individual",
      categories: ["Mini Individual A", "Mini Individual B", "Individual"]
    },
    {
      name: "Parejas",
      categories: ["Mini Parejas A", "Mini Parejas B", "Parejas"]
    },
    {
      name: "Grupos",
      categories: ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"]
    },
    {
      name: "Mega Crew",
      categories: ["Megacrew"]
    }
  ];

  // Group myGroups by modality structure
  const groupedByModality = useMemo(() => {
    return modalityStructure.map(modality => {
      const categoriesWithGroups = modality.categories.map(category => {
        const groups = myGroups.filter(g => g.category === category);
        return groups.length > 0 ? { category, groups } : null;
      }).filter(Boolean);
      
      return categoriesWithGroups.length > 0 ? { ...modality, categoriesWithGroups } : null;
    }).filter(Boolean);
  }, [myGroups]);

  const openCompetitions = competitions.filter(c => c.registration_open);

  // My registrations only — normalize school_name comparison
  const myRegistrations = useMemo(() =>
    registrations.filter(r => norm(r.school_name) === norm(mySchoolName)),
    [registrations, mySchoolName]
  );

  // Which group IDs are already registered per competition (by ID and by name)
  const registeredGroupIds = useMemo(() => {
    const map = {};
    myRegistrations.forEach(r => {
      // Index by competition_id
      if (r.competition_id) {
        if (!map[r.competition_id]) map[r.competition_id] = new Set();
        map[r.competition_id].add(r.group_id);
      }
      // Also index by competition_name
      if (r.competition_name) {
        if (!map[r.competition_name]) map[r.competition_name] = new Set();
        map[r.competition_name].add(r.group_id);
      }
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

  const toggleExpanded = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const startEditParticipant = (groupId, participantIndex, participant) => {
    setEditingParticipant({ groupId, participantIndex });
    setEditName(participant.name || "");
    setEditBirthDate(participant.birth_date || "");
  };

  const cancelEditParticipant = () => {
    setEditingParticipant(null);
    setEditName("");
    setEditBirthDate("");
  };

  const saveEditParticipant = async () => {
    if (!editingParticipant || !editName.trim()) return;
    
    setIsSaving(true);
    const group = myGroups.find(g => g.id === editingParticipant.groupId);
    if (!group) {
      setIsSaving(false);
      return;
    }

    const updatedParticipants = [...(group.participants || [])];
    updatedParticipants[editingParticipant.participantIndex] = {
      name: editName.trim(),
      birth_date: editBirthDate
    };

    await base44.entities.Group.update(group.id, { participants: updatedParticipants });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    
    setIsSaving(false);
    cancelEditParticipant();
  };

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
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowCreateGroup(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Crear grupo nuevo
          </Button>
          {openCompetitions.length > 0 && (
            <Button onClick={() => setShowWizard(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Inscribirse a una competición
            </Button>
          )}
        </div>
      </div>

      {/* My Groups — always visible */}
      {myGroups.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-base font-semibold">Mis grupos ({myGroups.length})</h2>
          
          {groupedByModality.map(modality => (
            <div key={modality.name} className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">{modality.name}</h3>
              
              {modality.categoriesWithGroups.map(({ category, groups }) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase pl-2">{category}</h4>
                  
                  <div className="grid gap-2">
                    {groups.map(group => {
                      const registeredComps = openCompetitions.filter(c => 
                        registeredGroupIds[c.id]?.has(group.id) || registeredGroupIds[c.name]?.has(group.id)
                      );
                      const isExpanded = expandedGroups.has(group.id);
                      const participants = group.participants || [];
                      
                      return (
                        <Card key={group.id} className="overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                            <div className="flex items-center gap-3 flex-1">
                              <button
                                onClick={() => toggleExpanded(group.id)}
                                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
                              </button>
                              <div className="flex-1">
                                <div className="font-semibold text-sm">{group.name}</div>
                                <div className="text-xs text-muted-foreground">{participants.length} participantes</div>
                                {registeredComps.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {registeredComps.map(c => (
                                      <Badge key={c.id} className="text-[10px] bg-green-100 text-green-700 border-green-300">
                                        Inscrito en {c.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => { setSelectedGroup(group); setShowEditGroup(true); }}
                                className="gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Modificar
                              </Button>
                              {openCompetitions.length > 0 && (
                                <Button 
                                  size="sm" 
                                  onClick={() => setShowWizard(true)}
                                  className="gap-2"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Inscribir
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Expanded participants list */}
                          {isExpanded && participants.length > 0 && (
                            <div className="border-t bg-muted/10 px-4 py-3">
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                                Participantes ({participants.length})
                              </div>
                              <div className="space-y-2">
                                {participants.map((participant, idx) => {
                                  const isEditing = editingParticipant?.groupId === group.id && editingParticipant?.participantIndex === idx;
                                  
                                  if (isEditing) {
                                    return (
                                      <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border-2 border-primary">
                                        <Input
                                          value={editName}
                                          onChange={e => setEditName(e.target.value)}
                                          placeholder="Nombre completo"
                                          className="flex-1 h-8 text-sm"
                                          autoFocus
                                          onKeyDown={e => {
                                            if (e.key === "Enter") saveEditParticipant();
                                            if (e.key === "Escape") cancelEditParticipant();
                                          }}
                                        />
                                        <Input
                                          type="date"
                                          value={editBirthDate}
                                          onChange={e => setEditBirthDate(e.target.value)}
                                          className="w-36 h-8 text-sm"
                                        />
                                        <button
                                          onClick={saveEditParticipant}
                                          disabled={isSaving || !editName.trim()}
                                          className="text-primary hover:text-primary/80 shrink-0 disabled:opacity-50"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={cancelEditParticipant}
                                          disabled={isSaving}
                                          className="text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card hover:bg-muted/20 transition-colors group">
                                      <span className="text-sm flex-1">{participant.name}</span>
                                      {participant.birth_date && (
                                        <span className="text-xs text-muted-foreground">{participant.birth_date}</span>
                                      )}
                                      <button
                                        onClick={() => startEditParticipant(group.id, idx, participant)}
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {isExpanded && participants.length === 0 && (
                            <div className="border-t bg-muted/10 px-4 py-6 text-center">
                              <p className="text-sm text-muted-foreground">Sin participantes</p>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
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

      {/* No groups at all — CTA to create */}
      {myGroups.length === 0 && myRegistrations.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <Users className="w-10 h-10 mx-auto opacity-20" />
            <div>
              <p className="font-medium text-foreground">No hay grupos asociados a {mySchoolName}</p>
              <p className="text-sm text-muted-foreground mt-1">Crea tu primer grupo para empezar a inscribirte en competiciones.</p>
            </div>
            <Button onClick={() => setShowCreateGroup(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Crear grupo nuevo e inscribirse
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        schools={[{ id: mySchoolName, name: mySchoolName }]}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["groups"] });
          setShowCreateGroup(false);
          setShowWizard(true);
        }}
      />

      <EditGroupDialog
        open={showEditGroup}
        onOpenChange={setShowEditGroup}
        group={selectedGroup}
        schools={[{ id: mySchoolName, name: mySchoolName }]}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["groups"] });
          setShowEditGroup(false);
          setSelectedGroup(null);
        }}
      />
    </div>
  );
}