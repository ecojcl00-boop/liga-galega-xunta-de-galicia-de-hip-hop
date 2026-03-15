import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";

export default function SchoolSelectorDialog({ open, onOpenChange, allGroups, onSelect }) {
  const [selected, setSelected] = useState("");

  const allSchools = useMemo(() => {
    const normalized = allGroups
      .map(g => g.school_name?.trim())
      .filter(Boolean);
    return [...new Set(normalized)].sort((a, b) => a.localeCompare(b, "es"));
  }, [allGroups]);

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
    setSelected("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> Simular vista de escuela
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona una escuela para ver exactamente cómo se vería la app desde su punto de vista. No afecta datos ni permisos reales.
          </p>
          <div className="space-y-2">
            <Label>Escuela</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una escuela..." />
              </SelectTrigger>
              <SelectContent>
                {allSchools.map(school => (
                  <SelectItem key={school} value={school}>{school}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {allSchools.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No hay grupos con escuela registrada.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={!selected} onClick={handleConfirm} className="gap-2">
              <Eye className="w-4 h-4" /> Ver como escuela
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}