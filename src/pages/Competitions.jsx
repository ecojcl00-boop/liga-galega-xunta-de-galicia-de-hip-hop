import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MapPin, Calendar, Trophy, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

const emptyForm = { name: "", date: "", location: "", registration_open: true };

export default function Competitions() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Competition.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Competition.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      setOpen(false);
      setEditTarget(null);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Competition.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      setDeleteConfirm(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, registration_open }) =>
      base44.entities.Competition.update(id, { registration_open }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["competitions"] }),
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (comp) => {
    setEditTarget(comp);
    setForm({ name: comp.name, date: comp.date || "", location: comp.location || "", registration_open: comp.registration_open });
    setOpen(true);
  };

  const handleSave = () => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Competiciones</h1>
          <p className="text-muted-foreground mt-1">Gestiona los eventos de la liga</p>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nueva
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : competitions.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No hay competiciones creadas</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map((comp) => (
            <Card key={comp.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg flex-1 mr-2">{comp.name}</h3>
                  <div className="flex items-center gap-1">
                    <Badge
                      className={
                        comp.registration_open
                          ? "bg-primary/10 text-primary border-0"
                          : "bg-muted text-muted-foreground border-0"
                      }
                    >
                      {comp.registration_open ? "Abierta" : "Cerrada"}
                    </Badge>
                  </div>
                </div>
                {comp.date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(new Date(comp.date), "dd/MM/yyyy")}</span>
                  </div>
                )}
                {comp.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{comp.location}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Inscripciones</span>
                    <Switch
                      checked={comp.registration_open}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: comp.id, registration_open: checked })
                      }
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(comp)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm(comp)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditTarget(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Competición" : "Nueva Competición"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.registration_open}
                onCheckedChange={(v) => setForm({ ...form, registration_open: v })}
              />
              <Label>Inscripciones abiertas</Label>
            </div>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="w-full bg-primary text-primary-foreground">
              {editTarget ? "Guardar cambios" : "Crear Competición"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar competición</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-2">
            ¿Seguro que quieres eliminar <strong>{deleteConfirm?.name}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}