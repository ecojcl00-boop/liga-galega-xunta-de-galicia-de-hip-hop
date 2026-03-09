import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Users, CheckCircle, XCircle, Clock, FileText } from "lucide-react";

const STATUS_CONFIG = {
  pending:   { label: "Pendiente",  color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: "Confirmada", color: "bg-blue-100 text-blue-800",    icon: <CheckCircle className="w-3 h-3" /> },
  complete:  { label: "Completa",   color: "bg-green-100 text-green-800",  icon: <CheckCircle className="w-3 h-3" /> },
  rejected:  { label: "Rechazada",  color: "bg-red-100 text-red-800",      icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelada",  color: "bg-gray-100 text-gray-700",    icon: <XCircle className="w-3 h-3" /> },
};

export default function CompetitionRegistrationsPanel({ competition, registrations }) {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);

  const compRegs = registrations.filter(r => r.competition_id === competition.id || r.competition_name === competition.name);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Registration.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Registration.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); setDeleteId(null); },
  });

  if (compRegs.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No hay inscripciones en esta competición aún.
      </div>
    );
  }

  // Group by category
  const byCategory = compRegs.reduce((acc, r) => {
    const cat = r.category || "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{compRegs.length} inscripción{compRegs.length !== 1 ? "es" : ""}</p>

      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b, "es")).map(([cat, regs]) => (
        <div key={cat} className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 font-medium text-sm">{cat} — {regs.length} grupo{regs.length !== 1 ? "s" : ""}</div>
          <div className="divide-y">
            {regs.map(reg => {
              const statusCfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
              return (
                <div key={reg.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  {/* Group info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{reg.group_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                      <span>{reg.school_name}</span>
                      {reg.coach_name && <span>· {reg.coach_name}</span>}
                      {reg.participants_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />{reg.participants_count}
                        </span>
                      )}
                      {(reg.documents || []).length > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />{reg.documents.length} docs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status select */}
                  <Select
                    value={reg.status || "pending"}
                    onValueChange={(v) => updateMutation.mutate({ id: reg.id, data: { status: v } })}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
                        <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Current status badge */}
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                    {statusCfg.icon}{statusCfg.label}
                  </span>

                  {/* Delete */}
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => setDeleteId(reg.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar inscripción?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}