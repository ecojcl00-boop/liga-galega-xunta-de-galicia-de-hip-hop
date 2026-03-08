import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, CheckCircle2 } from "lucide-react";

function removeDiacritics(str = "") {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function CleanupData() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleCleanup = async () => {
    setRunning(true);
    setResult(null);

    const log = {
      emptyParticipantsRemoved: 0,
      groupsWithCleanedParticipants: 0,
      duplicateGroupsRemoved: 0,
    };

    // ── Cargar todos los grupos ───────────────────────────────────────────────
    const allGroups = await base44.entities.Group.list("name", 500);

    // ── Paso 1: Limpiar participantes sin nombre dentro de cada grupo ─────────
    for (const group of allGroups) {
      const original = group.participants || [];
      const cleaned = original.filter(p => p.name && p.name.trim() !== "");
      if (cleaned.length < original.length) {
        const removed = original.length - cleaned.length;
        await base44.entities.Group.update(group.id, { participants: cleaned });
        log.emptyParticipantsRemoved += removed;
        log.groupsWithCleanedParticipants++;
      }
    }

    // ── Paso 2: Detectar y eliminar grupos duplicados exactos ─────────────────
    // Recargar después de limpiar participantes
    const freshGroups = await base44.entities.Group.list("name", 500);
    const seen = new Map(); // key → id del primer registro encontrado

    for (const group of freshGroups) {
      const key = `${removeDiacritics(group.name)}|${removeDiacritics(group.school_name || "")}|${removeDiacritics(group.category || "")}`;
      if (seen.has(key)) {
        // Es duplicado — eliminar este registro (conservar el primero encontrado)
        await base44.entities.Group.delete(group.id);
        log.duplicateGroupsRemoved++;
      } else {
        seen.set(key, group.id);
      }
    }

    setResult(log);
    setRunning(false);
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardContent className="p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-orange-500" /> Limpieza de Datos
        </h2>
        <p className="text-sm text-muted-foreground">
          Elimina participantes sin nombre dentro de los grupos, y elimina grupos duplicados exactos (mismo nombre + escuela + categoría). No borra ningún otro dato.
        </p>

        <Button
          variant="outline"
          onClick={handleCleanup}
          disabled={running}
          className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
        >
          {running
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Limpiando...</>
            : <><Trash2 className="w-4 h-4 mr-2" />Ejecutar Limpieza</>}
        </Button>

        {result && (
          <div className="bg-white border rounded-lg p-4 space-y-2 text-sm">
            <div className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Limpieza completada
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div>🗑️ Participantes vacíos eliminados: <strong>{result.emptyParticipantsRemoved}</strong> (en {result.groupsWithCleanedParticipants} grupos)</div>
              <div>🗑️ Grupos duplicados eliminados: <strong>{result.duplicateGroupsRemoved}</strong></div>
            </div>
            {result.emptyParticipantsRemoved === 0 && result.duplicateGroupsRemoved === 0 && (
              <div className="text-green-700 text-xs">No se encontraron datos incorrectos. La base de datos está limpia.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}