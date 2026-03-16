import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronRight, Download, Trash2, Users, FileText, Music, Search, Trophy, Loader2 } from "lucide-react";
import { downloadFile } from "@/components/utils/downloadFile";

const STATUS_CONFIG = {
  pending:   { label: "Pendiente",   color: "bg-yellow-100 text-yellow-700",  icon: "🟡" },
  confirmed: { label: "Confirmado",  color: "bg-primary/10 text-primary",     icon: "🔵" },
  complete:  { label: "Completa",    color: "bg-green-100 text-green-700",    icon: "🟢" },
  rejected:  { label: "Rechazada",   color: "bg-red-100 text-red-700",        icon: "🔴" },
  cancelled: { label: "Cancelado",   color: "bg-muted text-muted-foreground", icon: "⚫" },
};

// Force redeploy - 2026-03-13
const CATEGORY_ORDER = [
  "MINI INDIVIDUAL A", "MINI INDIVIDUAL B", "INDIVIDUAL",
  "MINI PAREJAS A", "MINI PAREJAS B", "PAREJAS",
  "BABY", "INFANTIL", "JUNIOR", "YOUTH", "ABSOLUTA", "PREMIUM", "MEGACREW"
];

const nd = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const resolveGroupParticipants = (reg, groups) => {
  const group = groups.find(g => g.id === reg.group_id) || groups.find(g => nd(g.name) === nd(reg.group_name));
  const groupParts = group?.participants || [];
  const regParts = reg.participants || [];
  return groupParts.length >= regParts.length ? groupParts : regParts;
};

const normalizeSchoolName = (name) => {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[,.\s]+/g, " ")
    .trim();
};

export default function AdminInscripcionesPanel({ registrations, competitions, groups = [] }) {
  const queryClient = useQueryClient();

  const [filterComp, setFilterComp]     = useState("all");
  const [filterSchool, setFilterSchool] = useState("all");
  const [filterCat, setFilterCat]       = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]             = useState("");

  const [expandedComps, setExpandedComps] = useState(new Set());
  const [expandedCats, setExpandedCats]   = useState(new Set());
  const [expandedRegs, setExpandedRegs]   = useState(new Set());

  const [editingRejection, setEditingRejection] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [downloadingKeys, setDownloadingKeys] = useState(new Set());
  const [downloadErrors, setDownloadErrors] = useState({});

  const handleDownload = async (docKey, url, name) => {
    setDownloadingKeys(prev => new Set(prev).add(docKey));
    setDownloadErrors(prev => { const n = { ...prev }; delete n[docKey]; return n; });
    try {
      await downloadFile(url, name || "archivo");
    } catch (e) {
      setDownloadErrors(prev => ({ ...prev, [docKey]: true }));
    } finally {
      setDownloadingKeys(prev => { const n = new Set(prev); n.delete(docKey); return n; });
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Registration.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Registration.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); setDeleteId(null); },
  });

  // Build canonical school names (first occurrence wins) merging duplicates by normalized name
  const { allSchools, schoolNormMap } = (() => {
    const normToCanonical = new Map(); // normalized → canonical display name
    registrations.forEach(r => {
      if (r.school_name) {
        const norm = normalizeSchoolName(r.school_name);
        if (!normToCanonical.has(norm)) normToCanonical.set(norm, r.school_name);
      }
    });
    const canonical = [...normToCanonical.values()].sort();
    // Map every raw school_name → its canonical name for filtering
    const normMap = new Map();
    registrations.forEach(r => {
      if (r.school_name) normMap.set(r.school_name, normToCanonical.get(normalizeSchoolName(r.school_name)));
    });
    return { allSchools: canonical, schoolNormMap: normMap };
  })();
  const allCategories = (() => {
    const cats = [...new Set(registrations.map(r => r.category).filter(Boolean))];
    return cats.sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a.toUpperCase());
      const bIdx = CATEGORY_ORDER.indexOf(b.toUpperCase());
      if (aIdx === -1) return bIdx === -1 ? 0 : 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  })();
  const allCompNames   = [...new Set(registrations.map(r => r.competition_name).filter(Boolean))].sort();

  const filtered = registrations.filter(r => {
    if (filterComp !== "all" && r.competition_name !== filterComp) return false;
    if (filterSchool !== "all" && schoolNormMap.get(r.school_name) !== filterSchool) return false;
    if (filterCat !== "all" && r.category !== filterCat) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesGroupName = r.group_name?.toLowerCase().includes(searchLower) ?? false;
      const matchesSchoolName = r.school_name?.toLowerCase().includes(searchLower) ?? false;
      const matchesCoachName = r.coach_name?.toLowerCase().includes(searchLower) ?? false;
      const matchesCompName = r.competition_name?.toLowerCase().includes(searchLower) ?? false;
      if (!matchesGroupName && !matchesSchoolName && !matchesCoachName && !matchesCompName) return false;
    }
    return true;
  });

  // Group: competition → category → registrations
  const grouped = filtered.reduce((acc, r) => {
    const comp = r.competition_name || "Sin competición";
    if (!acc[comp]) acc[comp] = {};
    const cat = r.category || "Sin categoría";
    if (!acc[comp][cat]) acc[comp][cat] = [];
    acc[comp][cat].push(r);
    return acc;
  }, {});

  const exportCSV = (compName = null) => {
    // Validate that compName is a string (not an event object)
    const validCompName = typeof compName === 'string' ? compName : null;
    const toExport = validCompName ? filtered.filter(r => r.competition_name === validCompName) : (csvComp === "all" ? filtered : filtered.filter(r => r.competition_name === csvComp));
    
    // Find max number of participants across all registrations
    const maxParticipants = Math.max(...toExport.map(r => (r.participants || []).length), 0);
    
    // Build headers with participant columns
    const baseHeaders = ["Competición", "Categoría", "Grupo", "Escuela", "Entrenador", "Participantes", "Estado", "Pago"];
    const participantHeaders = [];
    for (let i = 1; i <= maxParticipants; i++) {
      participantHeaders.push(`Participante ${i}`, `Participante ${i} - Fecha nacimiento`);
    }
    const headers = [...baseHeaders, ...participantHeaders];
    
    // Build rows with participant data
    const rows = toExport.map(r => {
      const baseRow = [
        r.competition_name, r.category, r.group_name, r.school_name,
        r.coach_name, r.participants_count || 0, r.status, r.payment_status,
      ];
      const participantCells = [];
      for (let i = 0; i < maxParticipants; i++) {
        const participant = (r.participants || [])[i];
        participantCells.push(
          participant ? (participant.name || participant) : "",
          participant?.birth_date || ""
        );
      }
      return [...baseRow, ...participantCells];
    });
    
    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const filename = validCompName ? `inscripciones_${validCompName.replace(/[^a-z0-9]/gi, '_')}.csv` : (csvComp === "all" ? "inscripciones.csv" : `inscripciones_${csvComp.replace(/[^a-z0-9]/gi, '_')}.csv`);
    a.download = filename;
    a.click();
  };

  const toggle = (setter) => (key) =>
    setter(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleStatusChange = (reg, newStatus) => {
    updateMutation.mutate({ id: reg.id, data: { status: newStatus } });
    if (newStatus !== "rejected") {
      setEditingRejection(prev => { const n = { ...prev }; delete n[reg.id]; return n; });
    }
  };

  const handleSaveRejection = (reg) => {
    updateMutation.mutate({ id: reg.id, data: { rejection_reason: editingRejection[reg.id] ?? "" } });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar grupo o escuela..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterComp} onValueChange={setFilterComp}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Competición" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las competiciones</SelectItem>
            {allCompNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSchool} onValueChange={setFilterSchool}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Escuela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las escuelas</SelectItem>
            {allSchools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v, { label, icon }]) => (
              <SelectItem key={v} value={v}>{icon} {label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* CSV Download */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <Button variant="outline" onClick={() => exportCSV()} className="gap-2 shrink-0 w-full sm:w-auto">
          <Download className="w-4 h-4" />
          Descargar CSV — {filterComp === "all" ? "Todas las competiciones" : filterComp} ({filterComp === "all" ? filtered.length : filtered.filter(r => r.competition_name === filterComp).length})
        </Button>
      </div>

      {/* Hierarchical view */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No hay inscripciones con los filtros seleccionados.
        </div>
      ) : (
        Object.entries(grouped).map(([comp, catGroups]) => {
          const totalRegs = Object.values(catGroups).flat().length;
          const isCompOpen = expandedComps.has(comp);
          return (
            <div key={comp} className="rounded-xl border bg-card overflow-hidden">
              {/* Competition header */}
              <div className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                <button
                  onClick={() => toggle(setExpandedComps)(comp)}
                  className="flex items-center gap-3 flex-1"
                >
                  <Trophy className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold">{comp}</span>
                  <Badge variant="outline" className="text-xs">{totalRegs} grupos</Badge>
                  {isCompOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />}
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); exportCSV(comp); }}
                  className="gap-1.5 text-xs shrink-0 ml-3"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar CSV — {comp}
                </Button>
              </div>

              {isCompOpen && (
                <div className="divide-y border-t">
                  {Object.entries(catGroups).map(([cat, regs]) => {
                    const catKey = `${comp}::${cat}`;
                    const isCatOpen = expandedCats.has(catKey);
                    return (
                      <div key={cat}>
                        {/* Category header */}
                        <button
                          onClick={() => toggle(setExpandedCats)(catKey)}
                          className="w-full px-7 py-3 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <span className="font-medium text-sm">{cat} — {regs.length} grupo{regs.length !== 1 ? "s" : ""}</span>
                          {isCatOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>

                        {isCatOpen && (
                          <div className="divide-y">
                            {regs.map(reg => {
                              const isRegOpen = expandedRegs.has(reg.id);
                              const statusCfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
                              return (
                                <div key={reg.id}>
                                  {/* Group row */}
                                  <div className="px-9 py-3 flex items-center gap-3 flex-wrap">
                                    <button
                                      onClick={() => toggle(setExpandedRegs)(reg.id)}
                                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                    >
                                      {isRegOpen
                                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                      <span className="font-medium text-sm truncate">{reg.group_name}</span>
                                      <span className="text-xs text-muted-foreground truncate hidden sm:block">{reg.school_name}</span>
                                    </button>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                     <Users className="w-3 h-3 inline mr-0.5" />{resolveGroupParticipants(reg, groups).length || reg.participants_count || 0}
                                    </span>
                                    {(reg.documents || []).length > 0 && (
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        <FileText className="w-3 h-3 inline mr-0.5" />{reg.documents.length}
                                      </span>
                                    )}
                                    {/* Inline status */}
                                    <Select value={reg.status || "pending"} onValueChange={(v) => handleStatusChange(reg, v)}>
                                      <SelectTrigger className="w-32 h-7 text-xs shrink-0">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(STATUS_CONFIG).map(([v, { label, icon }]) => (
                                          <SelectItem key={v} value={v} className="text-xs">{icon} {label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost" size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                      onClick={() => setDeleteId(reg.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>

                                  {/* Expanded details */}
                                  {isRegOpen && (
                                    <div className="px-12 pb-4 space-y-4 bg-muted/5">
                                      {/* Info row */}
                                      {(reg.coach_name || reg.payment_status) && (
                                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                          {reg.coach_name && <span>Entrenador: <strong>{reg.coach_name}</strong></span>}
                                          <span>Pago: <strong>{reg.payment_status === "paid" ? "Pagado" : "Pendiente"}</strong></span>
                                        </div>
                                      )}

                                      {/* Participants */}
                                      {(() => {
                                       const parts = resolveGroupParticipants(reg, groups);
                                       return (
                                         <div>
                                           <p className="text-xs font-medium text-muted-foreground mb-2">Participantes ({parts.length})</p>
                                           {parts.length === 0 ? (
                                             <p className="text-xs text-muted-foreground italic">Sin lista de participantes registrada.</p>
                                           ) : (
                                             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
                                               {parts.map((p, i) => (
                                                 <span key={i} className="text-xs text-muted-foreground">
                                                   {i + 1}. {p.name || p}
                                                   {p.birth_date && <span className="opacity-60"> ({p.birth_date})</span>}
                                                 </span>
                                               ))}
                                             </div>
                                           )}
                                         </div>
                                       );
                                      })()}

                                      {/* Documents */}
                                      {(reg.documents || []).length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2">Documentos</p>
                                          <div className="flex flex-wrap gap-2">
                                            {(reg.documents || []).map((doc, i) => {
                                              const docKey = `${reg.id}-${i}`;
                                              const isLoading = downloadingKeys.has(docKey);
                                              const hasError = downloadErrors[docKey];
                                              return (
                                                <button
                                                  key={i}
                                                  disabled={isLoading}
                                                  onClick={() => handleDownload(docKey, doc.url, doc.name || "archivo")}
                                                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60
                                                    ${hasError ? "border-destructive text-destructive" : "hover:bg-muted/30"}`}
                                                >
                                                  {isLoading
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : doc.doc_type === "musica"
                                                      ? <Music className="w-3.5 h-3.5 text-primary" />
                                                      : <FileText className="w-3.5 h-3.5 text-primary" />}
                                                  {doc.name}
                                                  {isLoading
                                                    ? <span className="text-muted-foreground ml-0.5">Descargando…</span>
                                                    : hasError
                                                      ? <span className="ml-0.5">Error – reintentar</span>
                                                      : <Download className="w-3 h-3 text-muted-foreground ml-0.5" />}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* Rejection reason */}
                                      {reg.status === "rejected" && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Motivo de rechazo</p>
                                          <div className="flex gap-2 max-w-lg">
                                            <Input
                                              value={editingRejection[reg.id] ?? reg.rejection_reason ?? ""}
                                              onChange={e => setEditingRejection(prev => ({ ...prev, [reg.id]: e.target.value }))}
                                              placeholder="Indica el motivo al inscrito..."
                                              className="h-8 text-xs flex-1"
                                            />
                                            <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => handleSaveRejection(reg)}>
                                              Guardar
                                            </Button>
                                          </div>
                                          {reg.rejection_reason && editingRejection[reg.id] === undefined && (
                                            <p className="text-xs text-muted-foreground mt-1">Guardado: "{reg.rejection_reason}"</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Delete confirm */}
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