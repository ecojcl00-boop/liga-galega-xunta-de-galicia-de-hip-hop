import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, ChevronLeft, X, Plus, Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// ── GroupEditor: edit participants for one group ──────────────────────────────
function GroupEditor({ group, participants, allSchoolParticipants, onChange }) {
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");

  // Show all school participants when empty, filter when typing
  const availableFromSchool = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allSchoolParticipants.filter(p =>
      (!term || p.name?.toLowerCase().includes(term)) &&
      !participants.some(ex => (ex.name || "").toLowerCase() === (p.name || "").toLowerCase())
    );
  }, [searchTerm, allSchoolParticipants, participants]);

  const noMatch = searchTerm.trim() && availableFromSchool.length === 0;

  const removeParticipant = (idx) => onChange(participants.filter((_, i) => i !== idx));

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditName(participants[idx]?.name || "");
  };

  const saveEdit = (idx) => {
    const updated = [...participants];
    updated[idx] = { ...updated[idx], name: editName };
    onChange(updated);
    setEditingIdx(null);
    setEditName("");
  };

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
    <div className="space-y-2">
      {participants.length === 0 && (
        <p className="text-xs text-muted-foreground px-1 py-2">Sin participantes. Añade al menos uno.</p>
      )}

      {participants.map((p, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
          {editingIdx === i ? (
            <>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveEdit(i); if (e.key === "Escape") setEditingIdx(null); }}
                autoFocus
                className="flex-1 h-7 text-sm"
              />
              <button onClick={() => saveEdit(i)} className="text-primary hover:text-primary/80 shrink-0" title="Guardar">
                <Check className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm flex-1">{p.name || p}</span>
              <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Editar nombre">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => removeParticipant(i)}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Quitar de esta inscripción"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/10 mt-2">
          <Input
            placeholder="Buscar o escribir nombre nuevo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />

          {!noMatch && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                {searchTerm.trim() ? "Participantes coincidentes:" : "Participantes de esta escuela:"}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-1">
                {availableFromSchool.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Todos ya están en la lista</p>
                ) : (
                  availableFromSchool.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => addExisting(p)}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted/60 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{p.name}</span>
                      {p.birth_date && <span className="text-muted-foreground text-xs ml-auto">{p.birth_date}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {noMatch && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                No encontrado en la escuela. Se añadirá como nuevo participante.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de nacimiento (opcional)</Label>
                <Input type="date" value={newBirth} onChange={e => setNewBirth(e.target.value)} />
              </div>
              <Button size="sm" onClick={addNew} className="w-full">
                Añadir "{searchTerm.trim()}"
              </Button>
            </div>
          )}

          <Button size="sm" variant="outline" onClick={resetAdd} className="w-full">Cancelar</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full gap-2 mt-1">
          <Plus className="w-4 h-4" /> Añadir participante
        </Button>
      )}
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────
const STEPS = ["Competición", "Grupos"];

export default function ReenrollmentWizard({ user, mySchoolName, myGroups, competitions, allGroups, registrations, onSuccess }) {
  const queryClient = useQueryClient();

  const singleComp = competitions.length === 1 ? competitions[0] : null;
  const [step, setStep] = useState(singleComp ? 2 : 1);
  const [selectedComp, setSelectedComp] = useState(singleComp);

  // Group currently open in editor (null = list view)
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [tempParticipants, setTempParticipants] = useState([]);

  // Groups confirmed in this session
  const [confirmedGroupIds, setConfirmedGroupIds] = useState(new Set());

  // All unique participants from this school
  const allSchoolParticipants = useMemo(() => {
    const seen = new Set();
    const result = [];
    allGroups
      .filter(g => g.school_name === mySchoolName)
      .forEach(g => {
        (g.participants || []).forEach(p => {
          const key = (p.name || "").toLowerCase().trim();
          if (key && !seen.has(key)) { seen.add(key); result.push(p); }
        });
      });
    return result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allGroups, mySchoolName]);

  // Groups already registered in DB for selected competition
  const alreadyInDbIds = useMemo(() =>
    new Set(registrations.filter(r => r.competition_id === selectedComp?.id).map(r => r.group_id)),
    [registrations, selectedComp]
  );

  const registeredIds = useMemo(() =>
    new Set([...alreadyInDbIds, ...confirmedGroupIds]),
    [alreadyInDbIds, confirmedGroupIds]
  );

  const availableGroups = myGroups.filter(g => !registeredIds.has(g.id));
  const activeGroup = myGroups.find(g => g.id === activeGroupId);

  const openEditor = (group) => {
    setActiveGroupId(group.id);
    setTempParticipants([...(group.participants || [])]);
  };

  const closeEditor = () => {
    setActiveGroupId(null);
    setTempParticipants([]);
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Registration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      const id = activeGroupId;
      setConfirmedGroupIds(prev => new Set([...prev, id]));
      closeEditor();
    }
  });

  const handleConfirmGroup = () => {
    if (!activeGroup || !selectedComp) return;
    createMutation.mutate({
      competition_id: selectedComp.id,
      competition_name: selectedComp.name,
      group_id: activeGroup.id,
      group_name: activeGroup.name,
      school_name: activeGroup.school_name,
      category: activeGroup.category,
      coach_name: activeGroup.coach_name,
      status: "confirmed",
      payment_status: "pending",
      participants_count: tempParticipants.length,
      participants: tempParticipants,
    });
  };

  // Progress
  const visibleSteps = singleComp ? STEPS.slice(1) : STEPS;
  const visibleStep = singleComp ? step - 1 : step;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1">
        {visibleSteps.map((label, i) => {
          const s = i + 1;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${visibleStep >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                <span className={`text-xs hidden sm:block ${visibleStep >= s ? "text-primary font-medium" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {s < visibleSteps.length && <div className={`flex-1 h-1 rounded transition-colors mb-4 ${visibleStep > s ? "bg-primary" : "bg-muted"}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1: Select competition */}
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

      {/* STEP 2: Group list + inline editor */}
      {step === 2 && (
        activeGroupId && activeGroup ? (
          /* ── Editor abierto para un grupo ── */
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">{activeGroup.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeGroup.category} · {mySchoolName}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {tempParticipants.length} participante{tempParticipants.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <GroupEditor
                group={activeGroup}
                participants={tempParticipants}
                allSchoolParticipants={allSchoolParticipants}
                onChange={setTempParticipants}
              />
              <div className="flex justify-between pt-3 border-t gap-2">
                <Button variant="outline" onClick={closeEditor} disabled={createMutation.isPending}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmGroup}
                  disabled={createMutation.isPending || tempParticipants.length === 0}
                  className="gap-2"
                >
                  {createMutation.isPending ? "Guardando..." : "Confirmar inscripción"}
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ── Lista de grupos ── */
          <Card>
            <CardHeader>
              <CardTitle>Selecciona un grupo para inscribir</CardTitle>
              <p className="text-sm text-muted-foreground">{selectedComp?.name} · {mySchoolName}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Groups available to register */}
              {availableGroups.length === 0 && confirmedGroupIds.size === 0 && alreadyInDbIds.size === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No hay grupos disponibles para inscribir.</p>
              ) : availableGroups.length === 0 ? (
                <p className="text-muted-foreground text-sm py-2 text-center">Todos tus grupos ya están inscritos en esta competición.</p>
              ) : (
                <div className="space-y-2">
                  {availableGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => openEditor(group)}
                      className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm">{group.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.category} · {group.participants?.length || 0} participantes
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Groups confirmed in this session */}
              {confirmedGroupIds.size > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inscritos en esta sesión</p>
                  {myGroups.filter(g => confirmedGroupIds.has(g.id)).map(g => (
                    <div key={g.id} className="p-3 rounded-xl border border-dashed bg-green-50/30 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.category}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">Inscrito</Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Already registered before this session */}
              {myGroups.filter(g => alreadyInDbIds.has(g.id)).length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ya inscritos en esta competición</p>
                  {myGroups.filter(g => alreadyInDbIds.has(g.id)).map(g => (
                    <div key={g.id} className="p-3 rounded-xl border border-dashed opacity-50 flex items-center gap-2 cursor-not-allowed">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-sm">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                {!singleComp && (
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                    <ChevronLeft className="w-4 h-4" /> Atrás
                  </Button>
                )}
                {confirmedGroupIds.size > 0 && (
                  <Button className="ml-auto gap-2" onClick={onSuccess}>
                    <Check className="w-4 h-4" />
                    Finalizar ({confirmedGroupIds.size} inscrito{confirmedGroupIds.size > 1 ? "s" : ""})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}