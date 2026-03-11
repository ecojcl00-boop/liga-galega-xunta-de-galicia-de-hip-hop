import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const ALL_CATEGORIES = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

function ParticipantRow({ participant, onRemove }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
      <div className="flex-1">
        <div className="text-sm font-medium">{participant.name}</div>
        {participant.birth_date && <div className="text-xs text-muted-foreground">{participant.birth_date}</div>}
      </div>
      <button onClick={() => onRemove()} className="text-muted-foreground hover:text-destructive transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function EditGroupDialog({ open, onOpenChange, group, onSuccess }) {
  const queryClient = useQueryClient();

  const [groupName, setGroupName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [participants, setParticipants] = useState([]);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [participantBirth, setParticipantBirth] = useState("");

  useEffect(() => {
    if (group) {
      setGroupName(group.name || "");
      setSelectedCategory(group.category || "");
      setParticipants(group.participants || []);
    }
  }, [group]);

  const updateMutation = useMutation({
    mutationFn: async (data) => base44.entities.Group.update(group.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const addParticipant = () => {
    if (!participantName.trim()) return;
    setParticipants([...participants, { name: participantName.trim(), birth_date: participantBirth }]);
    setParticipantName("");
    setParticipantBirth("");
    setAddingParticipant(false);
  };

  const removeParticipant = (idx) => {
    setParticipants(participants.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!groupName.trim() || !selectedCategory || participants.length === 0) return;

    updateMutation.mutate({
      name: groupName.trim(),
      category: selectedCategory,
      participants: participants,
    });
  };

  const isFormValid = groupName.trim() && selectedCategory && participants.length > 0;

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Información del grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="groupName">Nombre del grupo *</Label>
                <Input
                  id="groupName"
                  placeholder="Ej: HipHop Seniors"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger id="category"><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground px-1">
                Escuela: <strong>{group.school_name}</strong>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Participantes ({participants.length}) *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {participants.length === 0 && (
                <p className="text-xs text-muted-foreground px-1 py-2">Añade al menos un participante</p>
              )}
              {participants.map((p, i) => (
                <ParticipantRow key={i} participant={p} onRemove={() => removeParticipant(i)} />
              ))}
              {addingParticipant ? (
                <div className="border rounded-xl p-3 space-y-2 bg-muted/10">
                  <Input
                    placeholder="Nombre completo"
                    value={participantName}
                    onChange={e => setParticipantName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addParticipant(); }}
                    autoFocus
                  />
                  <Input
                    type="date"
                    placeholder="Fecha de nacimiento"
                    value={participantBirth}
                    onChange={e => setParticipantBirth(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addParticipant} className="flex-1 gap-2">
                      <Check className="w-3.5 h-3.5" /> Añadir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAddingParticipant(false); setParticipantName(""); setParticipantBirth(""); }} className="flex-1">
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAddingParticipant(true)} className="w-full gap-2">
                  <Plus className="w-4 h-4" /> Añadir participante
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isFormValid || updateMutation.isPending}>
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}