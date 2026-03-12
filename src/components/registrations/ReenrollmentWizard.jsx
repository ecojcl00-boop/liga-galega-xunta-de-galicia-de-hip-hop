import React, { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, ChevronRight, ChevronLeft, X, Plus, Pencil, FileText, Music, Loader2, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useSimulacro } from "@/components/SimulacroContext";
import { downloadFile } from "@/components/utils/downloadFile";

const CATEGORIES = [
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew",
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
];

// ── ParticipantEditor ──────────────────────────────────────────────────────
function ParticipantEditor({ participants, allSchoolParticipants, onChange, onNewParticipantPersisted }) {
  const [mode, setMode] = useState(null); // null | "search" | "create"
  const [searchTerm, setSearchTerm] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newApellidos, setNewApellidos] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");

  const availableFromSchool = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allSchoolParticipants.filter(p =>
      (!term || p.name?.toLowerCase().includes(term)) &&
      !participants.some(ex => (ex.name || "").toLowerCase() === (p.name || "").toLowerCase())
    );
  }, [searchTerm, allSchoolParticipants, participants]);

  const remove = (idx) => onChange(participants.filter((_, i) => i !== idx));
  const startEdit = (idx) => { setEditingIdx(idx); setEditName(participants[idx]?.name || ""); };
  const saveEdit = (idx) => {
    const updated = [...participants];
    updated[idx] = { ...updated[idx], name: editName };
    onChange(updated);
    setEditingIdx(null);
  };
  const addExisting = (p) => { onChange([...participants, { name: p.name, birth_date: p.birth_date || "" }]); resetAll(); };

  const handleCreateNew = async () => {
    if (!newNombre.trim()) return;
    const fullName = newApellidos.trim()
      ? `${newNombre.trim()} ${newApellidos.trim()}`
      : newNombre.trim();
    const p = { name: fullName, birth_date: newBirth };
    setSaving(true);
    onChange([...participants, p]);
    if (onNewParticipantPersisted) await onNewParticipantPersisted(p);
    setSaving(false);
    resetAll();
  };

  const resetAll = () => { setMode(null); setSearchTerm(""); setNewNombre(""); setNewApellidos(""); setNewBirth(""); };

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

      {/* ── Search existing ── */}
      {mode === "search" && (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/10 mt-2">
          <p className="text-sm font-medium">Seleccionar participante existente</p>
          <Input
            placeholder="Buscar por nombre..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-1">
            {availableFromSchool.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                {searchTerm.trim() ? "Sin coincidencias" : "No hay más participantes en esta escuela"}
              </p>
            ) : availableFromSchool.map((p, i) => (
              <button key={i} onClick={() => addExisting(p)}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted/60 transition-colors flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="flex-1">{p.name}</span>
                {p.birth_date && <span className="text-muted-foreground text-xs">{p.birth_date}</span>}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={resetAll} className="w-full">Cancelar</Button>
        </div>
      )}

      {/* ── Create new participant ── */}
      {mode === "create" && (
        <div className="border-2 border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5 mt-2">
          <p className="text-sm font-semibold text-primary">Crear participante nuevo</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                placeholder="Ej: María"
                value={newNombre}
                onChange={e => setNewNombre(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Apellidos</Label>
              <Input
                placeholder="Ej: García López"
                value={newApellidos}
                onChange={e => setNewApellidos(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Fecha de nacimiento</Label>
            <Input type="date" value={newBirth} onChange={e => setNewBirth(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resetAll} className="flex-1">Cancelar</Button>
            <Button
              size="sm"
              onClick={handleCreateNew}
              disabled={!newNombre.trim() || saving}
              className="flex-1 gap-2"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Guardando...</> : <><Check className="w-3.5 h-3.5" />Añadir</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Buttons ── */}
      {mode === null && (
        <div className="flex gap-2 mt-1">
          {allSchoolParticipants.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setMode("search")} className="flex-1 gap-2">
              <Plus className="w-4 h-4" /> Añadir existente
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setMode("create")} className="flex-1 gap-2 border-primary/40 text-primary hover:bg-primary/5">
            <Plus className="w-4 h-4" /> Crear participante nuevo
          </Button>
        </div>
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
        <input ref={authRef}  type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], "autorizacion"); e.target.value = ""; }} />
        <input ref={musicRef} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg"         className="hidden" onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], "musica");       e.target.value = ""; }} />
        <input ref={otherRef} type="file"                                className="hidden" onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0], "otro");         e.target.value = ""; }} />
      </div>
      {uploading && <p className="text-xs text-muted-foreground animate-pulse">Subiendo...</p>}
      {documents.map((doc, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
          {doc.doc_type === "musica" ? <Music className="w-4 h-4 text-primary shrink-0" /> : <FileText className="w-4 h-4 text-primary shrink-0" />}
          <button onClick={() => doc.url && downloadFile(doc.url, doc.name)} disabled={!doc.url} className="text-sm flex-1 truncate hover:underline text-primary text-left disabled:opacity-50 disabled:cursor-not-allowed">{doc.name}</button>
          <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── NewGroupForm ──────────────────────────────────────────────────────────
function NewGroupForm({ onCreated, onCancel, mySchoolName, coachName, coachEmail, coachPhone }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [participants, setParticipants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addingP, setAddingP] = useState(false);
  const [pName, setPName] = useState("");
  const [pBirth, setPBirth] = useState("");

  const addParticipant = () => {
    if (!pName.trim()) return;
    setParticipants(prev => [...prev, { name: pName.trim(), birth_date: pBirth }]);
    setPName(""); setPBirth(""); setAddingP(false);
  };
  const removeParticipant = (i) => setParticipants(prev => prev.filter((_, j) => j !== i));

  const handleCreate = async () => {
    if (!name.trim() || !category) return;
    setSaving(true);
    const newGroup = await base44.entities.Group.create({
      name: name.trim(),
      category,
      school_name: mySchoolName,
      coach_name: coachName || "",
      coach_email: coachEmail || "",
      coach_phone: coachPhone || "",
      participants,
    });
    setSaving(false);
    onCreated(newGroup);
  };

  return (
    <div className="mt-3 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
      <p className="text-sm font-semibold text-primary">Nuevo grupo</p>

      {/* Name + category */}
      <div className="space-y-2">
        <Input
          placeholder="Nombre del grupo *"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Categoría *" /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Entrenador: <strong>{coachName || "—"}</strong> · Escuela: <strong>{mySchoolName}</strong>
        </p>
      </div>

      {/* Participants */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          Participantes ({participants.length})
        </p>
        {participants.map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 text-sm">
            <span className="flex-1 font-medium">{p.name}</span>
            {p.birth_date && <span className="text-xs text-muted-foreground">{p.birth_date}</span>}
            <button onClick={() => removeParticipant(i)} className="text-muted-foreground hover:text-destructive">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {addingP ? (
          <div className="space-y-1.5 bg-white/60 p-2 rounded-lg">
            <Input
              placeholder="Nombre completo *"
              value={pName}
              onChange={e => setPName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addParticipant(); if (e.key === "Escape") { setAddingP(false); setPName(""); setPBirth(""); } }}
              autoFocus
              className="h-8 text-sm"
            />
            <Input type="date" value={pBirth} onChange={e => setPBirth(e.target.value)} className="h-8 text-sm" />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={addParticipant} disabled={!pName.trim()} className="flex-1 gap-1.5 h-8">
                <Check className="w-3.5 h-3.5" /> Añadir
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAddingP(false); setPName(""); setPBirth(""); }} className="h-8 px-3">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAddingP(true)} className="w-full gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" /> Añadir participante
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={!name.trim() || !category || saving}
          className="flex-1 gap-2"
        >
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
            : <><Check className="w-3.5 h-3.5" /> Guardar grupo y continuar</>}
        </Button>
      </div>
    </div>
  );
}

// ── MAIN WIZARD ────────────────────────────────────────────────────────────
export default function ReenrollmentWizard({ user, mySchoolName, myGroups, competitions, allGroups, registrations, onSuccess }) {
  const queryClient = useQueryClient();
  const { isSimulacro } = useSimulacro();

  // ── STATE ──
  const [currentStep, setCurrentStep] = useState("selectComp");
  const [selectedComp, setSelectedComp] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupParticipants, setGroupParticipants] = useState({});
  const [groupDocuments, setGroupDocuments] = useState({});
  const [uploadingGroup, setUploadingGroup] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extraGroups, setExtraGroups] = useState([]); // groups created during this wizard session
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const submitLock = useRef(false);

  // ── DERIVED STATE ──
  const singleComp = competitions.length === 1 ? competitions[0] : null;

  const alreadyRegisteredIds = useMemo(() =>
    new Set(registrations.filter(r => r.competition_id === selectedComp?.id).map(r => r.group_id)),
    [registrations, selectedComp]
  );

  // All my groups = fetched from server + newly created this session
  const allMyGroups = useMemo(() => [...myGroups, ...extraGroups], [myGroups, extraGroups]);

  const availableGroups = allMyGroups.filter(g => !alreadyRegisteredIds.has(g.id));
  const selectedGroups = availableGroups.filter(g => selectedGroupIds.has(g.id));

  // Coach info from existing groups (for new group form)
  const existingCoach = myGroups[0] || {};

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
      // Check for existing registrations and update or create accordingly
      for (const reg of regs) {
        const existing = await base44.entities.Registration.filter({
          group_id: reg.group_id,
          competition_id: reg.competition_id,
        });
        
        if (existing.length > 0) {
          // Update existing registration
          await base44.entities.Registration.update(existing[0].id, reg);
        } else {
          // Create new registration
          await base44.entities.Registration.create(reg);
        }
      }
      
      // After all registrations are created, send the 2 permitted emails
      if (regs.length > 0) {
        const firstReg = regs[0];
        const competitionName = firstReg.competition_name;
        const schoolName = firstReg.school_name;
        
        // Get coach email from the first group
        let coachEmail = null;
        if (firstReg.group_id) {
          const groups = await base44.entities.Group.filter({ id: firstReg.group_id });
          coachEmail = groups[0]?.coach_email;
        }
        
        // Get admin email
        const admins = await base44.entities.User.filter({ role: "admin" });
        const adminEmail = admins[0]?.email;
        
        // Email 1: To school (if coach email exists)
        if (coachEmail && coachEmail.includes("@")) {
          try {
            await base44.integrations.Core.SendEmail({
              from_name: "HipHop Galician Dance Tour",
              to: coachEmail,
              subject: `Inscripción confirmada — ${competitionName}`,
              body: `La inscripción de ${schoolName} para ${competitionName} ha sido registrada correctamente.`,
            });
          } catch (e) {
            console.warn("Failed to send school confirmation email:", e);
          }
        }
        
        // Email 2: To admin
        if (adminEmail && adminEmail.includes("@")) {
          try {
            await base44.integrations.Core.SendEmail({
              from_name: "HipHop Galician Dance Tour",
              to: adminEmail,
              subject: `Nueva inscripción — ${schoolName}`,
              body: `La escuela ${schoolName} ha completado su inscripción para ${competitionName}.`,
            });
          } catch (e) {
            console.warn("Failed to send admin notification email:", e);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsSuccess(true);
      setIsSubmitting(false);
      submitLock.current = false;
    },
    onError: () => {
      setIsSubmitting(false);
      submitLock.current = false;
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

    // Only pre-load from last registration (if it has participants)
    // Otherwise leave undefined so the edit step falls back to group.participants (same as summary)
    if (groupParticipants[groupId] === undefined) {
      const prevRegs = registrations
        .filter(r => r.group_id === groupId)
        .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
      const lastReg = prevRegs[0];
      if (lastReg?.participants?.length > 0) {
        setGroupParticipants(pp => ({ ...pp, [groupId]: [...lastReg.participants] }));
      }
      // If no lastReg, leave undefined → display will fall back to group.participants
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
    const uploadResult = await base44.integrations.Core.UploadFile({ file });
    const file_url = uploadResult?.file_url;
    if (file_url) {
      setGroupDocuments(prev => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), { name: file.name, url: file_url, doc_type: docType }],
      }));
    }
    setUploadingGroup(prev => ({ ...prev, [groupId]: false }));
  };

  const handleConfirm = () => {
    if (isSubmitting || submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    
    const data = selectedGroups.map(group => {
      const ps   = groupParticipants[group.id] ?? group.participants ?? [];
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
        is_simulacro: isSimulacro,
      };
    });
    createMutation.mutate(data);
  };

  // Called when a new group is successfully created from NewGroupForm
  const handleNewGroupCreated = (newGroup) => {
    setExtraGroups(prev => [...prev, newGroup]);
    setSelectedGroupIds(prev => new Set([...prev, newGroup.id]));
    setGroupDocuments(dd => ({ ...dd, [newGroup.id]: [] }));
    // Pre-load the participants the user just entered in NewGroupForm
    setGroupParticipants(pp => ({ ...pp, [newGroup.id]: newGroup.participants || [] }));
    setShowNewGroupForm(false);
    // Stay on selectGroups so the user sees the new group in the list and can continue normally
  };

  // Delete group handler
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      await base44.entities.Group.delete(groupToDelete.id);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      // Remove from selection if it was selected
      if (selectedGroupIds.has(groupToDelete.id)) {
        const next = new Set(selectedGroupIds);
        next.delete(groupToDelete.id);
        setSelectedGroupIds(next);
      }
      // Remove from extraGroups if it was created this session
      setExtraGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
    } finally {
      setIsDeleting(false);
      setGroupToDelete(null);
    }
  };

  // ── SUCCESS SCREEN ──
  if (isSuccess) {
    return (
      <div className="text-center space-y-4 py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">¡Inscripción confirmada correctamente!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Tu inscripción está <strong>pendiente de revisión</strong> por el administrador. Recibirás un email de confirmación.
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
    const allRegistered = allMyGroups.length > 0 && availableGroups.length === 0;
    
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Selecciona los grupos a inscribir</CardTitle>
            <p className="text-sm text-muted-foreground">{selectedComp?.name} · {mySchoolName}</p>
          </CardHeader>
          <CardContent className="space-y-3">
          {/* If no groups at all (first time), show create button prominently */}
          {myGroups.length === 0 && extraGroups.length === 0 && !showNewGroupForm ? (
            <div className="py-8 space-y-4 text-center">
              <p className="text-muted-foreground text-sm">No tienes grupos creados todavía.</p>
              <button
                onClick={() => setShowNewGroupForm(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" /> Crear primer grupo
              </button>
            </div>
          ) : allRegistered && !showNewGroupForm ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Todos tus grupos ya están inscritos en esta competición</p>
          ) : (
            allMyGroups.map(group => {
              const isRegistered = alreadyRegisteredIds.has(group.id);
              const selected = selectedGroupIds.has(group.id);
              const isNew = extraGroups.some(g => g.id === group.id);
              return (
                <div key={group.id}
                  className={`p-4 rounded-xl border-2 transition-colors ${
                    isRegistered 
                      ? "border-green-200 bg-green-50/50 opacity-60" 
                      : selected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/30"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={() => !isRegistered && toggleGroup(group.id)}
                      className={`flex items-center gap-3 flex-1 ${isRegistered ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isRegistered 
                          ? "bg-green-100 border-green-300" 
                          : selected 
                            ? "bg-primary border-primary" 
                            : "border-muted-foreground"
                      }`}>
                        {(selected || isRegistered) && <Check className={`w-3 h-3 ${isRegistered ? "text-green-600" : "text-primary-foreground"}`} />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {group.name}
                          {isRegistered && <Badge variant="outline" className="text-[10px] py-0 border-green-400 text-green-600 bg-green-50">Ya inscrito ✓</Badge>}
                          {isNew && !isRegistered && <Badge variant="outline" className="text-[10px] py-0 border-primary text-primary">Nuevo</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{group.category} · {group.participants?.length || 0} participantes</div>
                      </div>
                    </div>
                    {!isRegistered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroupToDelete(group);
                        }}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Eliminar grupo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* New group form */}
          {showNewGroupForm ? (
            <NewGroupForm
              mySchoolName={mySchoolName}
              coachName={existingCoach.coach_name || user?.full_name || ""}
              coachEmail={existingCoach.coach_email || user?.email || ""}
              coachPhone={existingCoach.coach_phone || ""}
              onCreated={handleNewGroupCreated}
              onCancel={() => setShowNewGroupForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowNewGroupForm(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="w-4 h-4" /> Añadir grupo nuevo
            </button>
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
                  if (firstGroup) startEditGroup(firstGroup.id);
                }}
                className="gap-2"
              >
                Siguiente ({selectedGroupIds.size}) <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar el grupo <strong>{groupToDelete?.name}</strong>?
              <br /><br />
              Esta acción <strong>no se puede deshacer</strong> y eliminará permanentemente el grupo y todos sus participantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Eliminando...</> : "Eliminar grupo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  // ── STEP 3: EDIT EACH GROUP ──
  if (currentStep === "editing") {
    const currentGroup = selectedGroups.find(g => g.id === editingGroupId) ?? selectedGroups[0];
    if (!currentGroup) return null;

    const groupIdx = selectedGroups.findIndex(g => g.id === currentGroup.id);
    const isFirst = groupIdx === 0;
    const isLast = groupIdx === selectedGroups.length - 1;

    // MEJORA 2: same fallback as summary — use group.participants if not yet edited
    const currentParticipants = groupParticipants[currentGroup.id] ?? currentGroup.participants ?? [];

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
              participants={currentParticipants}
              allSchoolParticipants={allSchoolParticipants}
              onChange={(ps) => setGroupParticipants(prev => ({ ...prev, [currentGroup.id]: ps }))}
              onNewParticipantPersisted={async (p) => {
                // Persist new participant into the group's participants list in DB
                const updatedParticipants = [
                  ...(currentGroup.participants || []),
                  p,
                ];
                await base44.entities.Group.update(currentGroup.id, { participants: updatedParticipants });
                queryClient.invalidateQueries({ queryKey: ["groups"] });
              }}
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
          const ps   = groupParticipants[group.id] ?? group.participants ?? [];
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
            onClick={() => {
              setEditingGroupId(selectedGroups[selectedGroups.length - 1].id);
              setCurrentStep("editing");
            }}
            disabled={isSubmitting}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Volver a editar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isSubmitting} 
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando inscripción...
              </>
            ) : (
              <>
                Confirmar inscripción
                <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
}