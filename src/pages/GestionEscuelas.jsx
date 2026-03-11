import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/UserContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  School, Plus, Pencil, UserPlus, CheckCircle2,
  Phone, Mail, Users, ToggleLeft, ToggleRight, Lock, Send, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = { name: "", coach_name: "", email: "", phone: "", city: "" };

export default function GestionEscuelas() {
  const user = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [deletingSchool, setDeletingSchool] = useState(null);

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["schools-management"],
    queryFn: () => base44.entities.School.list("name", 500),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups-for-school-mgmt"],
    queryFn: () => base44.entities.Group.list("school_name", 2000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-for-schools"],
    queryFn: () => base44.entities.User.list("email", 500),
  });

  // Groups count per school name
  const groupsBySchool = {};
  groups.forEach(g => {
    if (!g.school_name) return;
    groupsBySchool[g.school_name] = (groupsBySchool[g.school_name] || 0) + 1;
  });

  const updateSchool = useMutation({
    mutationFn: ({ id, data }) => base44.entities.School.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schools-management"] });
      setEditingSchool(null);
      toast.success("Escuela actualizada");
    },
  });

  const deleteSchool = useMutation({
    mutationFn: (id) => base44.entities.School.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schools-management"] });
      setDeletingSchool(null);
      toast.success("Escuela eliminada");
    },
  });

  const handleCreate = async () => {
    if (!form.name || !form.email) return;
    setCreating(true);
    setInviteResult(null);

    await base44.entities.School.create({
      name: form.name.trim(),
      coach_name: form.coach_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      is_active: true,
    });

    let invited = false;
    try {
      await base44.users.inviteUser(form.email.trim(), "user");
      invited = true;
    } catch {
      // User might already exist or email error
    }

    qc.invalidateQueries({ queryKey: ["schools-management"] });
    setInviteResult({ invited, email: form.email.trim(), school: form.name.trim() });
    setForm(EMPTY_FORM);
    setCreating(false);
    toast.success("Escuela creada" + (invited ? " · Invitación enviada" : ""));
  };

  const handleSaveEdit = () => {
    updateSchool.mutate({ id: editingSchool.id, data: { ...editForm } });
  };

  const handleToggleActive = (school) => {
    const nextActive = school.is_active === false ? true : false;
    updateSchool.mutate({ id: school.id, data: { is_active: nextActive } });
  };

  const handleResendAccess = async (school) => {
    if (!school.email) {
      toast.error("Esta escuela no tiene email configurado");
      return;
    }
    try {
      await base44.users.inviteUser(school.email, "user");
      toast.success(`Invitación reenviada a ${school.email}`);
    } catch (err) {
      toast.error("Error al reenviar la invitación: " + (err.message || "Inténtalo de nuevo"));
    }
  };

  const getUserForSchool = (school) => {
    if (!school.email) return null;
    return allUsers.find(u => u.email?.toLowerCase() === school.email.toLowerCase());
  };

  const activeSchools = schools.filter(s => s.is_active !== false);
  const inactiveSchools = schools.filter(s => s.is_active === false);

  if (user?.role !== "admin") {
    navigate(createPageUrl("Dashboard"), { replace: true });
    return null;
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <School className="w-7 h-7 text-primary" />
            Gestión de Escuelas
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {activeSchools.length} escuela{activeSchools.length !== 1 ? "s" : ""} activa{activeSchools.length !== 1 ? "s" : ""}
            {inactiveSchools.length > 0 && ` · ${inactiveSchools.length} desactivada${inactiveSchools.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setInviteResult(null); setForm(EMPTY_FORM); }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva escuela
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {activeSchools.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                <School className="w-10 h-10 mx-auto opacity-20" />
                <p className="text-sm">No hay escuelas registradas aún.</p>
                <p className="text-xs">Usa "Nueva escuela" para añadir la primera.</p>
              </CardContent>
            </Card>
          )}

          {activeSchools.map(school => {
            const linkedUser = getUserForSchool(school);
            const hasLinkedSchool = linkedUser && linkedUser.school_name === school.name;
            return (
              <Card key={school.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <School className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight">{school.name}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {school.coach_name && <span>{school.coach_name}</span>}
                      {school.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {school.email}
                        </span>
                      )}
                      {school.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {school.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {groupsBySchool[school.name] || 0} grupo{(groupsBySchool[school.name] || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      {hasLinkedSchool ? (
                        <Badge variant="secondary" className="text-[10px] gap-1 bg-green-100 text-green-700 border-green-200">
                          <CheckCircle2 className="w-3 h-3" /> Usuario vinculado
                        </Badge>
                      ) : linkedUser ? (
                        <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-700 border-amber-200">
                          ⚠️ Usuario existe pero sin escuela asignada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          Pendiente de registro
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handleResendAccess(school)}
                      disabled={!school.email}
                      className="gap-1.5"
                      title="Reenviar invitación por email"
                    >
                      <Send className="w-3.5 h-3.5" /> Reenviar acceso
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setEditingSchool(school); setEditForm({ name: school.name, coach_name: school.coach_name || "", email: school.email || "", phone: school.phone || "", city: school.city || "" }); }}
                      className="gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50 gap-1.5"
                      onClick={() => handleToggleActive(school)}
                      title="Desactivar escuela"
                    >
                      <ToggleRight className="w-4 h-4" /> Desactivar
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={() => setDeletingSchool(school)}
                      title="Eliminar escuela"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {inactiveSchools.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Desactivadas ({inactiveSchools.length})
              </p>
              <div className="space-y-2">
                {inactiveSchools.map(school => (
                  <Card key={school.id} className="opacity-50 border-dashed">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-through text-muted-foreground">{school.name}</p>
                        {school.email && <p className="text-xs text-muted-foreground">{school.email}</p>}
                      </div>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => handleToggleActive(school)}
                        className="shrink-0 gap-1.5 text-xs"
                      >
                        <ToggleLeft className="w-3.5 h-3.5" /> Reactivar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={o => { if (!o) setShowCreate(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Nueva escuela
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre de la escuela *</label>
              <Input
                placeholder="Ej: Escola Danza Vigo"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre del entrenador/a *</label>
              <Input
                placeholder="Ej: María García"
                value={form.coach_name}
                onChange={e => setForm(f => ({ ...f, coach_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Email del entrenador/a *{" "}
                <span className="font-normal text-muted-foreground">(acceso al portal)</span>
              </label>
              <Input
                type="email"
                placeholder="coach@escuela.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Teléfono{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                type="tel"
                placeholder="666 000 000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Ciudad / Localidad{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                placeholder="Ej: Vigo"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              />
            </div>

            {inviteResult && (
              <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm space-y-1.5">
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Escuela "{inviteResult.school}" creada correctamente
                </p>
                {inviteResult.invited ? (
                  <p className="text-xs opacity-80">
                    📧 Invitación enviada a <strong>{inviteResult.email}</strong>. Cuando el entrenador/a acepte la invitación, ve a "Usuarios" para asignarle la escuela "<strong>{inviteResult.school}</strong>".
                  </p>
                ) : (
                  <p className="text-xs opacity-80">
                    ⚠️ La escuela fue creada pero no se pudo enviar la invitación automáticamente. Puedes invitar al usuario manualmente desde "Gestión de Usuarios".
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                {inviteResult ? "Cerrar" : "Cancelar"}
              </Button>
              {!inviteResult && (
                <Button
                  onClick={handleCreate}
                  disabled={!form.name.trim() || !form.email.trim() || creating}
                  className="gap-2"
                >
                  {creating ? "Creando..." : <><UserPlus className="w-4 h-4" /> Crear e invitar</>}
                </Button>
              )}
              {inviteResult && (
                <Button
                  onClick={() => { setInviteResult(null); setForm(EMPTY_FORM); }}
                  variant="outline"
                >
                  Añadir otra
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingSchool} onOpenChange={o => { if (!o) setEditingSchool(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar escuela</DialogTitle>
          </DialogHeader>
          {editingSchool && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre de la escuela</label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre del entrenador/a</label>
                <Input value={editForm.coach_name} onChange={e => setEditForm(f => ({ ...f, coach_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono</label>
                <Input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ciudad / Localidad</label>
                <Input placeholder="Ej: Vigo" value={editForm.city || ""} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setEditingSchool(null)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={updateSchool.isPending}>
                  {updateSchool.isPending ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingSchool} onOpenChange={o => { if (!o) setDeletingSchool(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Seguro que quieres eliminar la escuela {deletingSchool?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos sus datos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSchool.mutate(deletingSchool.id)}
              disabled={deleteSchool.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSchool.isPending ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}