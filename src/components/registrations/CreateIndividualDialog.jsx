import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function CreateIndividualDialog({ open, onOpenChange, categories, schools, onSuccess }) {
  const queryClient = useQueryClient();

  const [participantName, setParticipantName] = useState("");
  const [participantBirth, setParticipantBirth] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [coachName, setCoachName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [coachPhone, setCoachPhone] = useState("");

  const createMutation = useMutation({
    mutationFn: async (groupData) => {
      const created = await base44.entities.Group.create(groupData);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      onSuccess();
      resetForm();
      onOpenChange(false);
    },
  });

  const resetForm = () => {
    setParticipantName("");
    setParticipantBirth("");
    setSelectedCategory("");
    setSelectedSchool("");
    setCoachName("");
    setCoachEmail("");
    setCoachPhone("");
  };

  const handleCreate = () => {
    if (!participantName.trim() || !selectedCategory || !selectedSchool) {
      return;
    }

    const schoolObj = schools.find(s => s.id === selectedSchool);
    const categoryObj = categories.find(c => c.id === selectedCategory);

    createMutation.mutate({
      name: participantName.trim(),
      school_id: selectedSchool,
      school_name: schoolObj?.name || "",
      coach_name: coachName.trim() || "",
      coach_email: coachEmail.trim() || "",
      coach_phone: coachPhone.trim() || "",
      category: categoryObj?.name || "",
      participants: [
        {
          name: participantName.trim(),
          birth_date: participantBirth,
        },
      ],
    });
  };

  const isFormValid = participantName.trim() && selectedCategory && selectedSchool;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear participante individual</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Participant info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Participante *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="participantName">Nombre completo *</Label>
                <Input
                  id="participantName"
                  placeholder="Ej: Juan García López"
                  value={participantName}
                  onChange={e => setParticipantName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="participantBirth">Fecha de nacimiento</Label>
                <Input
                  id="participantBirth"
                  type="date"
                  value={participantBirth}
                  onChange={e => setParticipantBirth(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Category and School */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Información de registro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category"><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school">Escuela *</Label>
                  <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger id="school"><SelectValue placeholder="Selecciona escuela" /></SelectTrigger>
                    <SelectContent>
                      {schools.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coach info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">Entrenador (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="coachName">Nombre</Label>
                <Input
                  id="coachName"
                  placeholder="Nombre del entrenador"
                  value={coachName}
                  onChange={e => setCoachName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="coachEmail">Email</Label>
                  <Input
                    id="coachEmail"
                    type="email"
                    placeholder="email@example.com"
                    value={coachEmail}
                    onChange={e => setCoachEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coachPhone">Teléfono</Label>
                  <Input
                    id="coachPhone"
                    placeholder="+34 600 000 000"
                    value={coachPhone}
                    onChange={e => setCoachPhone(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!isFormValid || createMutation.isPending}>
            {createMutation.isPending ? "Creando..." : "Crear participante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}