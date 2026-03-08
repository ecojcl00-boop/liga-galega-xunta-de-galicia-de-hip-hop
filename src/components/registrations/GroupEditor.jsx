import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Search, X } from "lucide-react";

export default function GroupEditor({ group, allSchoolParticipants, edits, onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newBirth, setNewBirth] = useState("");

  const participants = edits.participants || [];

  const existingNames = useMemo(() =>
    new Set(participants.map(p => p.name?.toLowerCase().trim())),
    [participants]
  );

  const availableToAdd = useMemo(() =>
    allSchoolParticipants.filter(p =>
      !existingNames.has(p.name?.toLowerCase().trim()) &&
      (search === "" || p.name?.toLowerCase().includes(search.toLowerCase()))
    ),
    [allSchoolParticipants, existingNames, search]
  );

  function toggleIncluded(index) {
    const updated = participants.map((p, i) => i === index ? { ...p, included: !p.included } : p);
    onChange({ ...edits, participants: updated });
  }

  function addExisting(p) {
    onChange({ ...edits, participants: [...participants, { ...p, included: true, isNew: false }] });
    setShowAdd(false);
    setSearch("");
  }

  function addNew() {
    if (!newName.trim()) return;
    onChange({
      ...edits,
      participants: [
        ...participants,
        { name: newName.trim(), birth_date: newBirth.trim(), included: true, isNew: true },
      ],
    });
    setNewName("");
    setNewBirth("");
    setShowAdd(false);
  }

  function closeAdd() {
    setShowAdd(false);
    setSearch("");
    setNewName("");
    setNewBirth("");
  }

  const includedCount = participants.filter(p => p.included).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{includedCount} de {participants.length} participantes incluidos</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(v => !v)}>
          <UserPlus className="w-3.5 h-3.5" />
          Añadir participante
        </Button>
      </div>

      {/* Participant list */}
      <div className="space-y-1">
        {participants.map((p, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
              p.included ? "bg-muted/30" : "opacity-40 bg-muted/10"
            }`}
          >
            <Checkbox checked={p.included} onCheckedChange={() => toggleIncluded(i)} />
            <span className={`text-sm flex-1 ${!p.included ? "line-through text-muted-foreground" : ""}`}>
              {p.name}
            </span>
            {p.isNew && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Nuevo</span>
            )}
          </div>
        ))}
        {participants.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">Sin participantes registrados</p>
        )}
      </div>

      {/* Add participant panel */}
      {showAdd && (
        <div className="border rounded-xl p-3 space-y-3 bg-card mt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Añadir participante</p>
            <button onClick={closeAdd} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Existing participants search */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Participantes existentes de la escuela</p>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="max-h-36 overflow-y-auto border rounded-lg divide-y divide-border">
              {availableToAdd.length > 0 ? (
                availableToAdd.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => addExisting(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors"
                  >
                    {p.name}
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground px-3 py-2.5">
                  {search ? "Sin coincidencias" : "Todos los participantes conocidos ya están en el grupo"}
                </p>
              )}
            </div>
          </div>

          {/* New participant form */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">O añadir persona nueva</p>
            <Input
              placeholder="Nombre completo *"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Fecha de nacimiento (dd/mm/aaaa)"
              value={newBirth}
              onChange={e => setNewBirth(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" className="w-full h-8" onClick={addNew} disabled={!newName.trim()}>
              Añadir nuevo participante
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}