import React, { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, ChevronLeft, X, Plus, Pencil, FileText, Music } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// ── ParticipantEditor ──────────────────────────────────────────────────────
function ParticipantEditor({ participants, allSchoolParticipants, onChange }) {
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");

  const availableFromSchool = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allSchoolParticipants.filter(p =>
      (!term || p.name?.toLowerCase().includes(term)) &&
      !participants.some(ex => (ex.name || "").toLowerCase() === (p.name || "").toLowerCase())
    );
  }, [searchTerm, allSchoolParticipants, participants]);

  const noMatch = searchTerm.trim() && availableFromSchool.length === 0;

  const remove = (idx) => onChange(participants.filter((_, i) => i !== idx));
  const startEdit = (idx) => { setEditingIdx(idx); setEditName(participants[idx]?.name || ""); };
  const saveEdit = (idx) => {
    const updated = [...participants];
    updated[idx] = { ...updated[idx], name: editName };
    onChange(updated);
    setEditingIdx(null);
  };
  const addExisting = (p) => { onChange([...participants, { name: p.name, birth_date: p.birth_date || "" }]); resetAdd(); };
  const addNew = () => { if (!searchTerm.trim()) return; onChange([...participants, { name: searchTerm.trim(), birth_date: newBirth }]); resetAdd(); };
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
                autoFocus className="flex-1 h-7 text-sm"
              />
              <button onClick={() => saveEdit(i)} className="text-primary hover:text-primary/80 shrink-0">
                <Check className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm flex-1">{p.name || p}</span>
              {p.birth_date && <span className="text-xs text-muted-foreground">{p.birth_date}</span>}
              <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/10 mt-2">
          <Input
            placeholder="Buscar o escribir nombre nuevo..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus
          />
          {!noMatch && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                {searchTerm.trim() ? "Coincidencias:" : "Participantes de la escuela:"}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-1">
                {availableFromSchool.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Ninguno</p>
                ) : availableFromSchool.map((p, i) => (
                  <button key={i} onClick={() => addExisting(p)}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted/60 transition-colors flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{p.name}</span>
                    {p.birth_date && <span className="text-muted-foreground text-xs ml-auto">{p.birth_date}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {noMatch && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">No encontrado. Se añadirá como nuevo.</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de nacimiento (opcional)</Label>
                <Input type="date" value={newBirth} onChange={e => setNewBirth(e.target.value)} />
              </div>
              <Button size="sm" onClick={addNew} className="w-full">Añadir "{searchTerm.trim()}"</Button>
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

// ── DocUploader ───────────────────────────────────────────────────────────
function DocUploader({ documents, onChange, uploading, onUpload }) {
  const authRef  = useRef(null);
  const musicRef = useRef(null);
  const otherRef = useRef(null);

  const remove = (idx) => onChange(documents.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Documentación <span className="font-normal">(opcional)</span></p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => authRef.current?.click()}>
          <FileText className="w-3.5 h-3.5" /> Autorización
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => musicRef.current?.click()}>
          <Music className="w-3.5 h-3.5" /> Música
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={() => otherRef.current?.click()}>
          <FileText className="w-3.5 h-3.5" /> Otro
        </Button>
        <input ref={authRef}  type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], "autorizacion"); e.target.value = ""; }} />
        <input ref={musicRef} type="file" accept=".mp3,audio/*"         className="hidden" onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], "musica");       e.target.value = ""; }} />
        <input ref={otherRef} type="file"                                className="hidden" onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], "otro");         e.target.value = ""; }} />
      </div>
      {uploading && <p className="text-xs text-muted-foreground animate-pulse">Subiendo...</p>}
      {documents.map((doc, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
          {doc.doc_type === "musica" ? <Music className="w-4 h-4 text-primary shrink-0" /> : <FileText className="w-4 h-4 text-primary shrink-0" />}
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm flex-1 truncate hover:underline text-primary">{doc.name}</a>
          <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── MAIN WIZARD ────────────────────────────────────────────────────────────
export default function ReenrollmentWizard({ user, mySchoolName, myGroups, competitions, allGroups, registrations, onSuccess }) {
  const queryClient = useQueryClient();

  // ── STATE ──
  const [currentStep, setCurrentStep] = useState("selectComp");
  const [selectedComp, setSelectedComp] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupParticipants, setGroupParticipants] = useState({});
  const [groupDocuments, setGroupDocuments] = useState({});
  const [uploadingGroup, setUploadingGroup] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  // ── DERIVED STATE ──
  const singleComp = competitions.length === 1 ? competitions[0] : null;
  const alreadyRegisteredIds = useMemo(() =>
    new Set(registrations.filter(r => r.competition_id === selectedComp?.id).map(r => r.group_id)),
    [registrations, selectedComp]
  );
  const availableGroups = myGroups.filter(g => !alreadyRegisteredIds.has(g.id));
  const selectedGroups = availableGroups.filter(g => selectedGroupIds.has(g.id));

  const allSchoolParticipants = useMemo(() => {
    const seen = new Set();
    const result = [];
    allGroups.filter(g => g.school_name === mySchoolName).forEach(g => {
      (g.participants || []).forEach(p => {
        const key = (p.name || "").toLowerCase().trim();
        if (key && !seen.has(key)) { seen.add(key); result.push(p); }
      });
    });
    return result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allGroups, mySchoolName]);

  // ── MUTATIONS ──
  const createMutation = useMutation({
    mutationFn: async (regs) => {
      for (const reg of regs) await base44.entities.Registration.create(reg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      setIsSuccess(true);
    },
  });

  // ── HANDLERS ──
  const toggleGroup = (id) => {
    const next = new Set(selectedGroupIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedGroupIds(next);
  };

  const startEditGroup = (groupId) => {
    const group = availableGroups.find(g => g.id === groupId);
    if (!group) return;
    if (!groupParticipants[groupId]) {
      setGroupParticipants(pp => ({ ...pp, [groupId]: [...(group.participants || [])] }));
    }
    if (!groupDocuments[groupId]) {
      setGroupDocuments(dd => ({ ...dd, [groupId]: [] }));
    }
    setEditingGroupId(groupId);
    setCurrentStep("editing");
  };

  const finishEditGroup = () => {
    setEditingGroupId(null);
    setCurrentStep("summary");
  };

  const handleUploadDoc = async (groupId, file, docType) => {
    setUploadingGroup(prev => ({ ...prev, [groupId]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setGroupDocuments(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), { name: file.name, url: file_url, doc_type: docType }],
    }));
    setUploadingGroup(prev => ({ ...prev, [groupId]: false }));
  };

  const handleConfirm = () => {
    const data = selectedGroups.map(group => {
      const ps   = groupParticipants[group.id] || group.participants || [];
      const docs = groupDocuments[group.id] || [];
      return {
        competition_id: selectedComp.id,
        competition_name: selectedComp.name,
        group_id: group.id,
        group_name: group.name,
        school_name: group.school_name,
        category: group.category,
        coach_name: group.coach_name,
        status: "pending",
        payment_status: "pending",
        participants_count: ps.length,
        participants: ps,
        documents: docs,
      };
    });
    createMutation.mutate(data);
  };

  // ── SUCCESS SCREEN ──
  if (isSuccess) {
    return (
      <div className="text-center space-y-4 py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">¡Inscripción enviada!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Tu inscripción está <strong>pendiente de revisión</strong> por el administrador.
        </p>
        <Button onClick={onSuccess}>Volver al panel</Button>
      </div>
    );
  }

  // ── STEP 1: SELECT COMPETITION ──
  if (currentStep === "selectComp") {
    return (
      <Card>
        <CardHeader><CardTitle>Selecciona la competición</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {competitions.map(c => (
            <button key={c.id} onClick={() => { setSelectedComp(c); setCurrentStep("selectGroups"); }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${selectedComp?.id === c.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <div className="font-semibold">{c.name}</div>
              {c.date && <div className="text-sm text-muted-foreground">{c.date}</div>}
              {c.location && <div className="text-sm text-muted-foreground">{c.location}</div>}
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── STEP 2: SELECT GROUPS (CHECKBOXES) ──
  if (currentStep === "selectGroups") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selecciona los grupos a inscribir</CardTitle>
          <p className="text-sm text-muted-foreground">{selectedComp?.name} · {mySchoolName}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Todos los grupos ya están inscritos.</p>
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
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{group.name}</div>
                      <div className="text-xs text-muted-foreground">{group.category} · {group.participants?.length || 0} participantes</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Already registered */}
          {myGroups.filter(g => alreadyRegisteredIds.has(g.id)).length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase">Ya inscritos</p>
              {myGroups.filter(g => alreadyRegisteredIds.has(g.id)).map(g => (
                <div key={g.id} className="p-4 rounded-xl border border-dashed opacity-50 flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.category}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            {!singleComp && (
              <Button variant="outline" onClick={() => setCurrentStep("selectComp")} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Atrás
              </Button>
            )}
            <div className="ml-auto">
              <Button
                disabled={selectedGroupIds.size === 0}
                onClick={() => {
                  const firstGroup = availableGroups.find(g => selectedGroupIds.has(g.id));
                  setEditingGroupId(firstGroup?.id || null);
                  setCurrentStep("editing");
                }}
                className="gap-2"
              >
                Siguiente ({selectedGroupIds.size}) <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── STEP 3: EDIT EACH GROUP ──
  if (currentStep === "editing") {
    const currentGroup = selectedGroups.find(g => g.id === editingGroupId) ?? selectedGroups[0];
    if (!currentGroup) return null;

    const groupIdx = selectedGroups.findIndex(g => g.id === currentGroup.id);
    const isFirst = groupIdx === 0;
    const isLast = groupIdx === selectedGroups.length - 1;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{currentGroup.name}</h2>
            <p className="text-sm text-muted-foreground">
              {currentGroup.category} · {mySchoolName} · Grupo {groupIdx + 1} de {selectedGroups.length}
            </p>
          </div>
          {selectedGroups.length > 1 && (
            <div className="flex gap-1">
              {selectedGroups.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === groupIdx ? "bg-primary" : i < groupIdx ? "bg-primary/40" : "bg-muted"}`} />
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <ParticipantEditor
              participants={groupParticipants[currentGroup.id] || []}
              allSchoolParticipants={allSchoolParticipants}
              onChange={(ps) => setGroupParticipants(prev => ({ ...prev, [currentGroup.id]: ps }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Documentación</CardTitle>
          </CardHeader>
          <CardContent>
            <DocUploader
              documents={groupDocuments[currentGroup.id] || []}
              onChange={(docs) => setGroupDocuments(prev => ({ ...prev, [currentGroup.id]: docs }))}
              uploading={!!uploadingGroup[currentGroup.id]}
              onUpload={(file, docType) => handleUploadDoc(currentGroup.id, file, docType)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (isFirst) setCurrentStep("selectGroups");
              else setEditingGroupId(selectedGroups[groupIdx - 1].id);
            }}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> {isFirst ? "Atrás" : "Anterior"}
          </Button>
          <Button
            onClick={() => {
              if (isLast) finishEditGroup();
              else setEditingGroupId(selectedGroups[groupIdx + 1].id);
            }}
            className="gap-2"
          >
            {isLast ? "Ver resumen" : "Siguiente"} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP 4: SUMMARY + CONFIRM ──
  if (currentStep === "summary") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Resumen de inscripción</h2>
          <p className="text-sm text-muted-foreground">{selectedComp?.name} · {mySchoolName}</p>
        </div>

        {selectedGroups.map(group => {
          const ps   = groupParticipants[group.id] || group.participants || [];
          const docs = groupDocuments[group.id] || [];
          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  <Badge variant="outline">{group.category} · {ps.length} participantes</Badge>
                </div>
                {group.coach_name && <p className="text-xs text-muted-foreground">Entrenador: {group.coach_name}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                {ps.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {ps.map((p, i) => (
                      <span key={i} className="text-sm text-muted-foreground">
                        {i + 1}. {p.name || p}
                        {p.birth_date && <span className="opacity-60 text-xs"> · {p.birth_date}</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin participantes.</p>
                )}
                {docs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {docs.map((doc, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border bg-muted/30">
                        {doc.doc_type === "musica" ? <Music className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {doc.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setEditingGroupId(selectedGroups[selectedGroups.length - 1].id)}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Volver a editar
          </Button>
          <Button onClick={handleConfirm} disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? "Enviando..." : "Confirmar inscripción"}
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
}