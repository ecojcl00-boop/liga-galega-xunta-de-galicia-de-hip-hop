import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Check } from "lucide-react";

export default function AssignSchoolRow({ inv, schools, onAssigned, onDismiss }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState(inv.role || "user");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const canConfirm = role === "admin" || !!selected;

  const handleConfirm = async () => {
    if (!canConfirm || saving) return;
    setSaving(true);
    // Find the real user by email and update their role/school
    const users = await base44.entities.User.list();
    const matchedUser = users.find(u => u.email === inv.email);
    if (matchedUser) {
      await base44.entities.User.update(matchedUser.id, {
        role,
        school_name: role === "admin" ? (matchedUser.school_name || "") : selected,
      });
    }
    // Delete the pending invitation
    await base44.entities.InvitacionPendiente.delete(inv.id);
    setSaving(false);
    setDone(true);
    setTimeout(() => onAssigned(), 1200);
  };

  return (
    <div className="px-6 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{inv.email}</p>
          <p className="text-xs text-muted-foreground">Solicitud de acceso — sin escuela asignada</p>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setOpen(o => !o)}>
            Asignar acceso
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={onDismiss}>
            <Trash2 className="w-3.5 h-3.5" /> Ignorar
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 max-w-sm">
          {/* Role selector */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Rol</label>
            <Select value={role} onValueChange={(v) => { setRole(v); setSelected(""); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Escuela (user)</SelectItem>
                <SelectItem value="admin">Administrador (admin)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* School selector — only for user role */}
          {role === "user" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Escuela</label>
              <Input
                placeholder="Buscar escuela..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="max-h-36 overflow-y-auto border rounded-md">
                {filtered.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s.name); setSearch(""); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                      selected === s.name ? "bg-primary/10 font-medium" : ""
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirm button */}
          {canConfirm && (
            <div className="flex items-center gap-2 pt-1">
              {done ? (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Acceso confirmado
                </span>
              ) : (
                <>
                  {role === "user" && selected && (
                    <span className="text-xs text-muted-foreground">Escuela: <strong>{selected}</strong></span>
                  )}
                  {role === "admin" && (
                    <span className="text-xs text-muted-foreground">Se asignará rol <strong>administrador</strong></span>
                  )}
                  <Button size="sm" className="h-7 gap-1 ml-auto" onClick={handleConfirm} disabled={saving}>
                    <Check className="w-3.5 h-3.5" />
                    {saving ? "Guardando..." : "Confirmar"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}