import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, ChevronLeft, X, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

function GroupEditor({ group, participants, allSchoolParticipants, onChange }) {
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newBirth, setNewBirth] = useState("");

  const existingMatches = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return allSchoolParticipants.filter(p =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !participants.some(ex => (ex.name || "").toLowerCase() === (p.name || "").toLowerCase())
    );
  }, [searchTerm, allSchoolParticipants, participants]);

  const removeParticipant = (idx) => onChange(participants.filter((_, i) => i !== idx));

  const addExisting = (p) => {
    onChange([...participants, { name: p.name, birth_date: p.birth_date || "" }]);
    resetAdd();
  };

  const addNew = () => {
    if (!searchTerm.trim()) return;
    onChange([...participants, { name: searchTerm.trim(), birth_date: newBirth }]);
    resetAdd();
  };

  const resetAdd = () => { setAdding(false); setSearchTerm(""); setNewBirth(""); };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{group.name}</CardTitle>
          <Badge variant="outline" className="text-xs">{group.category} · {participants.length} part.</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
            <span className="text-sm">{p.name || p}</span>
            <button onClick={() => removeParticipant(i)} className="text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="border rounded-xl p-4 space-y-3 bg-muted/10 mt-2">
            <Input
              placeholder="Buscar nombre o escribir uno nuevo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {existingMatches.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Participantes existentes en la escuela:</p>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-1">
                  {existingMatches.map((p, i) => (
                    <button key={i} onClick={() => addExisting(p)}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted/60 transition-colors flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : searchTerm.trim() ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">No encontrado. Se añadirá como nuevo participante.</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha de nacimiento (opcional)</Label>
                  <Input type="date" value={newBirth} onChange={e => setNewBirth(e.target.value)} />
                </div>
                <Button size="sm" onClick={addNew} className="w-full">
                  Añadir "{searchTerm.trim()}"
                </Button>
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={resetAdd} className="w-full">Cancelar</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full gap-2 mt-1">
            <Plus className="w-4 h-4" /> Añadir participante
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

const STEPS = ["Competición", "Grupos", "Revisar", "Confirmar"];

export default function ReenrollmentWizard({ user, competitions, allGroups, registrations, onSuccess }) {
  const [step, setStep] = useState(1);
  const [selectedComp, setSelectedComp] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [groupParticipants, setGroupParticipants] = useState({});
  const queryClient = useQueryClient();

  const myGroups = useMemo(() =>
    allGroups.filter(g => g.coach_email === user.email || g.created_by === user.email),
    [allGroups, user.email]
  );

  const mySchoolName = myGroups[0]?.school_name || "";

  const allSchoolParticipants = useMemo(() => {
    const schoolGroups = allGroups.filter(g => g.school_name === mySchoolName);
    const seen = new Set();
    const result = [];
    schoolGroups.forEach(g => {
      (g.participants || []).forEach(p => {
        const key = (p.name || "").toLowerCase().trim();
        if (key && !seen.has(key)) { seen.add(key); result.push(p); }
      });
    });
    return result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allGroups, mySchoolName]);

  const alreadyRegisteredIds = useMemo(() =>
    new Set(registrations.filter(r => r.competition_id === selectedComp?.id).map(r => r.group_id)),
    [registrations, selectedComp]
  );

  const availableGroups = myGroups.filter(g => !alreadyRegisteredIds.has(g.id));
  const selectedGroups = availableGroups.filter(g => selectedGroupIds.has(g.id));

  const toggleGroup = (id) => {
    const isSelected = selectedGroupIds.has(id);
    const next = new Set(selectedGroupIds);
    if (isSelected) {
      next.delete(id);
    } else {
      next.add(id);
      if (!groupParticipants[id]) {
        const g = allGroups.find(gg => gg.id === id);
        setGroupParticipants(pp => ({ ...pp, [id]: [...(g?.participants || [])] }));
      }
    }
    setSelectedGroupIds(next);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      for (const reg of data) await base44.entities.Registration.create(reg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      onSuccess && onSuccess();
    }
  });

  const handleConfirm = () => {
    const data = selectedGroups.map(group => {
      const ps = groupParticipants[group.id] || group.participants || [];
      return {
        competition_id: selectedComp.id,
        competition_name: selectedComp.name,
        group_id: group.id,
        group_name: group.name,
        school_name: group.school_name,
        category: group.category,
        coach_name: group.coach_name,
        status: "confirmed",
        payment_status: "pending",
        participants_count: ps.length,
        participants: ps,
      };
    });
    createMutation.mutate(data);
  };

  if (myGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <p>No se encontraron grupos asociados a tu cuenta.</p>
          <p className="text-sm mt-1">Contacta con el administrador para vincular tu escuela.</p>
        </CardContent>
      </Card>
    );
  }

  if (competitions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <p>No hay competiciones abiertas para inscribirse en este momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => {
          const s = i + 1;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                <span className={`text-xs hidden sm:block ${step >= s ? "text-primary font-medium" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {s < 4 && <div className={`flex-1 h-1 rounded transition-colors mb-4 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Select competition */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Selecciona la competición</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {competitions.map(c => (
              <button key={c.id} onClick={() => setSelectedComp(c)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${selectedComp?.id === c.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <div className="font-semibold">{c.name}</div>
                {c.date && <div className="text-sm text-muted-foreground">{c.date}</div>}
                {c.location && <div className="text-sm text-muted-foreground">{c.location}</div>}
              </button>
            ))}
            <div className="flex justify-end pt-2">
              <Button disabled={!selectedComp} onClick={() => setStep(2)} className="gap-2">
                Siguiente <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select groups */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona tus grupos</CardTitle>
            <p className="text-sm text-muted-foreground">{selectedComp?.name} · {mySchoolName}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Todos tus grupos ya están inscritos en esta competición.</p>
            ) : (
              availableGroups.map(group => {
                const selected = selectedGroupIds.has(group.id);
                return (
                  <div key={group.id} onClick={() => toggleGroup(group.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{group.name}</div>
                        <div className="text-xs text-muted-foreground">{group.category} · {group.participants?.length || 0} participantes</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ChevronLeft className="w-4 h-4" />Atrás</Button>
              <Button disabled={selectedGroupIds.size === 0} onClick={() => setStep(3)} className="gap-2">
                Siguiente <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Edit participants */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Revisa y modifica los grupos</h2>
            <p className="text-sm text-muted-foreground">Puedes añadir o eliminar participantes para esta competición sin afectar los datos originales.</p>
          </div>
          {selectedGroups.map(group => (
            <GroupEditor
              key={group.id}
              group={group}
              participants={groupParticipants[group.id] || group.participants || []}
              allSchoolParticipants={allSchoolParticipants}
              onChange={(ps) => setGroupParticipants(prev => ({ ...prev, [group.id]: ps }))}
            />
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ChevronLeft className="w-4 h-4" />Atrás</Button>
            <Button onClick={() => setStep(4)} className="gap-2">Revisar inscripción <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Confirmar inscripción — {selectedComp?.name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {selectedGroups.map(group => {
              const ps = groupParticipants[group.id] || group.participants || [];
              return (
                <div key={group.id} className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold">{group.name}</span>
                    <Badge variant="outline">{group.category} · {ps.length} participantes</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {ps.map((p, i) => (
                      <span key={i} className="text-sm text-muted-foreground">{p.name || p}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(3)} className="gap-2"><ChevronLeft className="w-4 h-4" />Atrás</Button>
              <Button onClick={handleConfirm} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? "Guardando..." : "Confirmar inscripción"}
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}