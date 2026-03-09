import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import SchoolView from "./SchoolView";

export default function SchoolSimulator({ open, onOpenChange, allGroups, competitions, registrations }) {
  const [selectedSchool, setSelectedSchool] = useState(null);

  // Get all unique schools
  const allSchools = useMemo(() => {
    const schools = [...new Set(allGroups.map(g => g.school_name).filter(Boolean))].sort();
    return schools;
  }, [allGroups]);

  // Simulate a school user
  if (selectedSchool) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 border-b">
            <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center gap-2">
              ⚠️ MODO SIMULACIÓN — Estás viendo la app como la escuela: <strong>{selectedSchool}</strong>. Esto no afecta datos ni permisos reales.
            </div>
            <div className="bg-card p-4 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSchool(null)}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="font-semibold">Vista simulada: {selectedSchool}</h2>
            </div>
          </div>
          
          <div className="p-4">
            <SchoolView
              user={{
                email: `simulator@${selectedSchool.toLowerCase().replace(/\s+/g, '')}.local`,
                full_name: "Simulador",
                role: "user",
                school_name: selectedSchool,
              }}
              competitions={competitions}
              allGroups={allGroups}
              registrations={registrations}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // School selector
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simular vista de escuela</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona una escuela para ver exactamente cómo se vería la interfaz desde el punto de vista de esa escuela. Esta simulación no afecta permisos ni roles.
          </p>

          <div className="space-y-2">
            <Label>Escuela</Label>
            <Select value={selectedSchool || ""} onValueChange={setSelectedSchool}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una escuela..." />
              </SelectTrigger>
              <SelectContent>
                {allSchools.map(school => (
                  <SelectItem key={school} value={school}>
                    {school}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {allSchools.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No hay escuelas registradas.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}