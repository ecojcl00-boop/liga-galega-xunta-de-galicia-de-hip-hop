import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Check } from "lucide-react";

export default function AssignSchoolRow({ inv, schools, onAssigned, onDismiss }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    await base44.entities.InvitacionPendiente.update(inv.id, {
      school_name: selected,
      status: "pending"
    });
    setSaving(false);
    onAssigned();
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
            Asignar escuela
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={onDismiss}>
            <Trash2 className="w-3.5 h-3.5" /> Ignorar
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 max-w-sm">
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
          {selected && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Seleccionada: <strong>{selected}</strong></span>
              <Button size="sm" className="h-7 gap-1" onClick={handleConfirm} disabled={saving}>
                <Check className="w-3.5 h-3.5" />
                {saving ? "Guardando..." : "Confirmar"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}