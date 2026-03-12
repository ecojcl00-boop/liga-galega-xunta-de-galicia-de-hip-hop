import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, Pencil, Shield, School } from "lucide-react";

export default function Usuarios() {
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState(null);
  const [editSchool, setEditSchool] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [editRole, setEditRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSchool, setInviteSchool] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteStatus, setInviteStatus] = useState(null); // null | "loading" | "ok" | "error"
  const [showInvite, setShowInvite] = useState(false);

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ["schools-list"],
    queryFn: () => base44.entities.School.list(),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      setEditingUser(null);
    },
  });

  const openEdit = (u) => {
    setEditingUser(u);
    setEditSchool(u.school_name || "__none__");
    setSchoolSearch("");
    setEditRole(u.role || "user");
  };

  const handleSave = () => {
    updateUser.mutate({
      id: editingUser.id,
      data: { 
        school_name: editSchool === "__none__" ? "" : editSchool, 
        role: editRole 
      },
    });
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviteStatus("loading");
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteStatus("ok");
      setInviteEmail("");
      setInviteSchool("");
      setInviteRole("user");
      qc.invalidateQueries({ queryKey: ["users-list"] });
    } catch (e) {
      setInviteStatus("error");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra roles y escuelas asignadas a cada cuenta.
          </p>
        </div>
        <Button onClick={() => { setShowInvite(true); setInviteStatus(null); }} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Invitar usuario
        </Button>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuarios registrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground p-6">Cargando...</p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    {u.school_name ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <School className="w-3 h-3" />
                        {u.school_name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Sin escuela</span>
                    )}
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "Admin" : "Escuela"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground p-6">No hay usuarios.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 pt-2">
              <div>
                <p className="text-sm font-medium mb-1">{editingUser.full_name || editingUser.email}</p>
                <p className="text-xs text-muted-foreground">{editingUser.email}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Escuela asignada</label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar escuela..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    <button
                      onClick={() => { setEditSchool("__none__"); setSchoolSearch(""); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                        editSchool === "__none__" ? "bg-primary/10 font-medium" : ""
                      }`}
                    >
                      Sin escuela
                    </button>
                    {schools
                      .filter((s) =>
                        s.name.toLowerCase().includes(schoolSearch.toLowerCase())
                      )
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setEditSchool(s.name); setSchoolSearch(""); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                            editSchool === s.name ? "bg-primary/10 font-medium" : ""
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                  {editSchool !== "__none__" && (
                    <p className="text-xs text-muted-foreground">
                      Seleccionada: <strong>{editSchool}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Rol
                </label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Escuela (user)</SelectItem>
                    <SelectItem value="admin">Administrador (admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={updateUser.isPending}>
                  {updateUser.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={(o) => !o && setShowInvite(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar usuario de escuela</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="coach@escuela.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rol</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Escuela</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Se enviará una invitación al email indicado. Una vez registrado, vuelve aquí para asignarle la escuela si es necesario.
            </div>

            {inviteStatus === "ok" && (
              <p className="text-sm text-green-600 font-medium">
                ✓ Invitación enviada. Cuando el usuario se registre, asígnale la escuela desde la tabla.
              </p>
            )}
            {inviteStatus === "error" && (
              <p className="text-sm text-destructive">
                Error al enviar la invitación. Comprueba el email e inténtalo de nuevo.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowInvite(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail || inviteStatus === "loading"}
              >
                {inviteStatus === "loading" ? "Enviando..." : "Enviar invitación"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}