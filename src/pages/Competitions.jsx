import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Trophy, MapPin, Calendar, Users, ClipboardList, Download } from "lucide-react";
import CompetitionRegistrationsPanel from "../components/registrations/CompetitionRegistrationsPanel";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useUser } from "../components/UserContext";

const emptyForm = { name: "", date: "", location: "", registration_open: true };

export default function Competitions() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [viewingRegs, setViewingRegs] = useState(null); // competition object

  const queryClient = useQueryClient();

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list("date"),
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Competition.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["competitions"] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Competition.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["competitions"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Competition.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["competitions"] }); setDeleteId(null); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, registration_open }) => base44.entities.Competition.update(id, { registration_open }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["competitions"] }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name || "", date: c.date || "", location: c.location || "", registration_open: c.registration_open ?? true }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) { updateMutation.mutate({ id: editing.id, data: form }); }
    else { createMutation.mutate(form); }
  };

  const nd = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const getRegistrationCount = (comp) => {
    return registrations.filter(r =>
      r.competition_id === comp.id || nd(r.competition_name) === nd(comp.name)
    ).length;
  };

  const exportCompetitionPDF = (comp) => {
    // PASO 1: inscripciones de esta competición por id o nombre normalizado
    const compRegs = registrations.filter(r =>
      r.competition_id === comp.id || nd(r.competition_name) === nd(comp.name)
    );

    // PASO 2 & 3: agrupar participantes por escuela usando group.participants
    const participantsBySchool = {};
    compRegs.forEach(reg => {
      const schoolName = reg.school_name || "Sin escuela";
      if (!participantsBySchool[schoolName]) participantsBySchool[schoolName] = [];
      const group = groups.find(g => g.id === reg.group_id)
        || groups.find(g => nd(g.name) === nd(reg.group_name));
      (group?.participants || []).forEach(p => {
        const name = (p?.name || "").trim();
        if (!name) return;
        participantsBySchool[schoolName].push({ name, birth_date: p?.birth_date || "" });
      });
    });

    const sortedSchools = Object.keys(participantsBySchool).sort((a, b) => a.localeCompare(b, "es"));

    // PASO 5: generar PDF
    const doc = new jsPDF();

    // Título
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(comp.name, 20, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (comp.date) { doc.text(comp.date, 20, 28); }
    let y = comp.date ? 38 : 30;

    let totalGlobal = 0;

    sortedSchools.forEach(school => {
      // PASO 4: deduplicar — clave es birth_date si existe, si no nombre+primer apellido
      const seen = new Map();
      participantsBySchool[school].forEach(p => {
        const nameParts = nd(p.name).split(" ").filter(Boolean);
        const nameKey = nameParts.slice(0, 2).join(" ");
        const key = p.birth_date?.trim() ? p.birth_date.trim() : nameKey;
        if (!seen.has(key)) seen.set(key, p);
      });
      const unique = [...seen.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
      const count = unique.length;
      totalGlobal += count;

      if (y > 260) { doc.addPage(); y = 20; }

      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text(school, 20, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      unique.forEach((p, i) => {
        if (y > 280) { doc.addPage(); y = 20; }
        const line = p.birth_date ? `${i + 1}. ${p.name}  (${p.birth_date})` : `${i + 1}. ${p.name}`;
        doc.text(line, 25, y);
        y += 6;
      });

      if (y > 280) { doc.addPage(); y = 20; }
      doc.setFont(undefined, 'italic');
      doc.text(`Total: ${count} participante${count !== 1 ? 's' : ''}`, 25, y);
      doc.setFont(undefined, 'normal');
      y += 12;
    });

    // Total global
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL GENERAL: ${totalGlobal} participantes`, 20, y);

    doc.save(`Participantes_${comp.name.replace(/\s+/g, '_')}.pdf`);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Competiciones</h1>
          <p className="text-muted-foreground mt-1">{competitions.length} competiciones registradas</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2 w-full md:w-auto">
            <Plus className="w-4 h-4" /> Nueva Competición
          </Button>
        )}
      </div>

      {competitions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No hay competiciones aún. Crea la primera.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {competitions.map((comp) => {
            const regCount = getRegistrationCount(comp);
            return (
              <Card key={comp.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-start gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {comp.name}
                          {regCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-normal">{regCount} inscritos</Badge>
                          )}
                        </CardTitle>
                        <Badge variant={comp.registration_open ? "default" : "secondary"} className="mt-1 text-[10px]">
                          {comp.registration_open ? "Inscripciones abiertas" : "Inscripciones cerradas"}
                        </Badge>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0 self-end md:self-start">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Descargar PDF participantes" onClick={() => exportCompetitionPDF(comp)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver inscritos" onClick={() => setViewingRegs(comp)}>
                          <ClipboardList className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(comp)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(comp.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {comp.date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{format(new Date(comp.date), "dd MMM yyyy", { locale: es })}</span>
                      </div>
                    )}
                    {comp.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{comp.location}</span>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-xs text-muted-foreground">Inscripciones</span>
                      <Switch
                        checked={comp.registration_open ?? false}
                        onCheckedChange={(val) => toggleMutation.mutate({ id: comp.id, registration_open: val })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Competición" : "Nueva Competición"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: MARÍN 2026" required />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ej: Marín, Pontevedra" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Inscripciones abiertas</Label>
              <Switch checked={form.registration_open} onCheckedChange={(val) => setForm({ ...form, registration_open: val })} />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeForm} className="w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="w-full sm:w-auto">
                {editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Registrations panel Dialog */}
      <Dialog open={!!viewingRegs} onOpenChange={(open) => !open && setViewingRegs(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Inscritos: {viewingRegs?.name}
            </DialogTitle>
          </DialogHeader>
          {viewingRegs && (
            <CompetitionRegistrationsPanel
              competition={viewingRegs}
              registrations={registrations}
              competitions={competitions}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar competición?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}