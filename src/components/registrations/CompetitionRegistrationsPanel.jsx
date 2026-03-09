import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Users, CheckCircle, XCircle, Clock, FileText, Download } from "lucide-react";
import { jsPDF } from "jspdf";

const STATUS_CONFIG = {
  pending:   { label: "Pendiente",  color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: "Confirmada", color: "bg-blue-100 text-blue-800",    icon: <CheckCircle className="w-3 h-3" /> },
  complete:  { label: "Completa",   color: "bg-green-100 text-green-800",  icon: <CheckCircle className="w-3 h-3" /> },
  rejected:  { label: "Rechazada",  color: "bg-red-100 text-red-800",      icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: "Cancelada",  color: "bg-gray-100 text-gray-700",    icon: <XCircle className="w-3 h-3" /> },
};

function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

export default function CompetitionRegistrationsPanel({ competition, registrations, competitions = [] }) {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);

  const compRegs = registrations.filter(
    r => r.competition_id === competition.id || r.competition_name === competition.name
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Registration.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Registration.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); setDeleteId(null); },
  });

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxW = pageW - margin * 2;
    let y = 20;

    const checkPage = (needed = 10) => {
      if (y + needed > 275) { doc.addPage(); y = 20; }
    };

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Inscripciones: ${competition.name}`, margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleDateString("es-ES")}`, margin, y);
    y += 5;
    doc.text(`Total: ${compRegs.length} inscripciones`, margin, y);
    y += 10;
    doc.setTextColor(0);

    // By school
    const bySchool = compRegs.reduce((acc, r) => {
      const school = r.school_name || "Sin escuela";
      if (!acc[school]) acc[school] = [];
      acc[school].push(r);
      return acc;
    }, {});

    Object.entries(bySchool).sort(([a], [b]) => a.localeCompare(b, "es")).forEach(([school, regs]) => {
      checkPage(14);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(230, 230, 230);
      doc.rect(margin - 2, y - 5, maxW + 4, 9, "F");
      doc.text(school, margin, y);
      y += 9;

      regs.forEach(reg => {
        checkPage(8);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const statusLabel = STATUS_CONFIG[reg.status]?.label || reg.status || "Pendiente";
        const line = `• ${reg.group_name}${reg.category ? ` [${reg.category}]` : ""} — ${statusLabel}`;
        const wrapped = doc.splitTextToSize(line, maxW - 4);
        wrapped.forEach(l => { checkPage(5); doc.text(l, margin + 2, y); y += 5; });

        if (reg.participants?.length > 0) {
          reg.participants.slice(0, 20).forEach(p => {
            checkPage(4);
            doc.setFontSize(8);
            doc.setTextColor(100);
            const pName = `    ${p.name || p}${p.birth_date ? ` (${p.birth_date})` : ""}`;
            doc.text(pName, margin + 6, y);
            y += 4;
          });
          doc.setTextColor(0);
        }
        y += 2;
      });
      y += 3;
    });

    // Changes comparison with previous competition
    const sortedComps = [...competitions].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1; if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
    const currentIdx = sortedComps.findIndex(c => c.id === competition.id);
    const prevComp = currentIdx > 0 ? sortedComps[currentIdx - 1] : null;

    if (prevComp) {
      const prevRegs = registrations.filter(
        r => r.competition_id === prevComp.id || r.competition_name === prevComp.name
      );

      if (prevRegs.length > 0) {
        checkPage(20);
        y += 4;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setDrawColor(180);
        doc.line(margin, y - 2, pageW - margin, y - 2);
        doc.text(`Cambios respecto a: ${prevComp.name}`, margin, y + 4);
        y += 12;

        const currentGroupKeys = new Set(compRegs.map(r => nd(r.group_name)));
        const prevGroupKeys    = new Set(prevRegs.map(r => nd(r.group_name)));

        const newGroups     = compRegs.filter(r => !prevGroupKeys.has(nd(r.group_name)));
        const removedGroups = prevRegs.filter(r => !currentGroupKeys.has(nd(r.group_name)));

        doc.setFontSize(9);

        if (newGroups.length > 0) {
          checkPage(8);
          doc.setFont("helvetica", "bold");
          doc.text("GRUPOS NUEVOS:", margin, y); y += 5;
          doc.setFont("helvetica", "normal");
          newGroups.forEach(r => {
            checkPage(5);
            doc.setTextColor(0, 130, 0);
            doc.text(`  + ${r.group_name} (${r.school_name || ""})`, margin, y); y += 4;
          });
          doc.setTextColor(0); y += 3;
        }

        if (removedGroups.length > 0) {
          checkPage(8);
          doc.setFont("helvetica", "bold");
          doc.text("GRUPOS QUE YA NO ESTÁN:", margin, y); y += 5;
          doc.setFont("helvetica", "normal");
          removedGroups.forEach(r => {
            checkPage(5);
            doc.setTextColor(180, 0, 0);
            doc.text(`  - ${r.group_name} (${r.school_name || ""})`, margin, y); y += 4;
          });
          doc.setTextColor(0); y += 3;
        }

        if (newGroups.length === 0 && removedGroups.length === 0) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100);
          doc.text("Sin cambios en grupos respecto a la competición anterior.", margin, y);
          doc.setTextColor(0);
        }
      }
    }

    const safeName = competition.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    doc.save(`inscripciones-${safeName}.pdf`);
  };

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {compRegs.length} inscripción{compRegs.length !== 1 ? "es" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2">
          <Download className="w-4 h-4" /> Descargar PDF
        </Button>
      </div>

      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b, "es")).map(([cat, regs]) => (
        <div key={cat} className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 font-medium text-sm">
            {cat} — {regs.length} grupo{regs.length !== 1 ? "s" : ""}
          </div>
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