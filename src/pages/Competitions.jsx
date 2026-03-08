import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Trophy, MapPin, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const emptyForm = { name: "", date: "", location: "", registration_open: true };

export default function Competitions() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);

  const queryClient = useQueryClient();

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list("date"),
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list(),
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

  const getRegistrationCount = (competitionName) => {
    return registrations.filter(r => r.competition_name === competitionName).length;
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Competiciones</h1>
          <p className="text-muted-foreground mt-1">{competitions.length} competiciones registradas</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva Competición
        </Button>
      </div>

      {competitions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No hay competiciones aún. Crea la primera.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {competitions.map((comp) => {
            const regCount = getRegistrationCount(comp.name);
            return (
              <Card key={comp.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{comp.name}</CardTitle>
                        <Badge variant={comp.registration_open ? "default" : "secondary"} className="mt-1 text-[10px]">
                          {comp.registration_open ? "Inscripciones abiertas" : "Inscripciones cerradas"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(comp)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(comp.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    {comp.date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(comp.date), "dd MMM yyyy", { locale: es })}</span>
                      </div>
                    )}
                    {comp.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{comp.location}</span>
                      </div>
                    )}
                    {regCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{regCount} inscripciones</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="text-xs text-muted-foreground">Inscripciones</span>
                    <Switch
                      checked={comp.registration_open ?? false}
                      onCheckedChange={(val) => toggleMutation.mutate({ id: comp.id, registration_open: val })}
                    />
                  </div>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
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