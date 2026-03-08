import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2, Users, School, Trophy, Lock, Download } from "lucide-react";
import jsPDF from "jspdf";
import SchoolView from "../components/registrations/SchoolView";

export default function Registrations() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => setUser(null)); }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const queryClient = useQueryClient();

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list("-date"),
  });

  const openCompetitions = competitions.filter(c => c.registration_open);

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list("-created_date"),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("name"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Registration.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); closeGroupDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Registration.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); setEditingReg(null); setEditForm(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Registration.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["registrations"] }); setDeleteId(null); },
  });

  const closeGroupDialog = () => { setShowGroupDialog(false); setSelectedCompetition(null); };

  const handleRegisterGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !selectedCompetition) return;
    createMutation.mutate({
      competition_id: selectedCompetition.id,
      competition_name: selectedCompetition.name,
      group_id: group.id,
      group_name: group.name,
      school_name: group.school_name,
      category: group.category,
      coach_name: group.coach_name,
      status: "confirmed",
      payment_status: "pending",
      participants_count: group.participants?.length || 0,
    });
  };

  const openEdit = (reg) => {
    setEditingReg(reg);
    setEditForm({
      status: reg.status || "confirmed",
      payment_status: reg.payment_status || "pending",
      participants_count: reg.participants_count || 0,
      coach_name: reg.coach_name || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingReg || !editForm) return;
    updateMutation.mutate({ id: editingReg.id, data: editForm });
  };

  const compRegs = selectedCompetition ? registrations.filter(r => r.competition_id === selectedCompetition?.id) : [];
  const registeredGroupIds = new Set(compRegs.map(r => r.group_id));
  const availableGroups = groups.filter(g => !registeredGroupIds.has(g.id));

  // Stats for the active open competition
  const activeComp = openCompetitions[0];
  const activeRegs = activeComp ? registrations.filter(r => r.competition_name === activeComp.name) : [];
  const uniqueSchools = new Set(activeRegs.map(r => r.school_name).filter(Boolean)).size;
  const totalParticipants = activeRegs.reduce((sum, r) => sum + (r.participants_count || 0), 0);

  const downloadPDF = (schoolFilter = null) => {
    const doc = new jsPDF("landscape");
    const data = schoolFilter
      ? registrations.filter(r => r.school_name === schoolFilter)
      : registrations;

    const title = schoolFilter ? `Inscripciones — ${schoolFilter}` : "Inscripciones — Todas las escuelas";
    doc.setFontSize(15);
    doc.setFont(undefined, "bold");
    doc.text(title, 14, 14);
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text(`Total: ${data.length} grupos · ${data.reduce((s, r) => s + (r.participants_count || 0), 0)} participantes`, 14, 21);

    const headers = ["Grupo", "Escuela", "Categoría", "Entrenador", "Part.", "Estado", "Pago"];
    const colWidths = [50, 45, 35, 45, 15, 25, 22];
    const rowH = 7;
    let y = 26;
    let x0 = 14;

    // Header row
    doc.setFillColor(220, 50, 120);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    let x = x0;
    headers.forEach((h, i) => { doc.rect(x, y, colWidths[i], rowH, "F"); doc.text(h, x + 2, y + 5); x += colWidths[i]; });
    y += rowH;

    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, "normal");
    data.forEach((r, ri) => {
      if (y > 185) { doc.addPage("landscape"); y = 14; }
      doc.setFillColor(ri % 2 === 0 ? 250 : 244, ri % 2 === 0 ? 250 : 244, ri % 2 === 0 ? 250 : 244);
      const row = [
        r.group_name || "", r.school_name || "", r.category || "", r.coach_name || "",
        String(r.participants_count || 0),
        r.status === "confirmed" ? "Confirmado" : r.status === "cancelled" ? "Cancelado" : "Pendiente",
        r.payment_status === "paid" ? "Pagado" : "Pendiente",
      ];
      let rx = x0;
      row.forEach((cell, i) => {
        doc.rect(rx, y, colWidths[i], rowH, "F");
        doc.text(String(cell), rx + 2, y + 5);
        rx += colWidths[i];
      });
      y += rowH;
    });

    const fname = schoolFilter ? `inscripciones_${schoolFilter.replace(/ /g, "_")}.pdf` : "inscripciones_total.pdf";
    doc.save(fname);
  };

  const schools = [...new Set(registrations.map(r => r.school_name).filter(Boolean))].sort();

  const filteredRegistrations = registrations.filter((r) => {
    const matchSearch = !search ||
      r.group_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.school_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColors = {
    confirmed: "bg-primary/10 text-primary",
    pending: "bg-accent text-accent-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const paymentColors = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
  };

  if (!user) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;

  // School users (non-admin) see the self-service view
  if (user.role !== "admin") {
    return (
      <SchoolView
        user={user}
        competitions={competitions}
        allGroups={groups}
        registrations={registrations}
      />
    );
  }

  if (openCompetitions.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Sin competiciones abiertas</h2>
        <p className="text-muted-foreground max-w-md">
          No hay ninguna competición con inscripciones abiertas en este momento.
          Ve a <strong>Competiciones</strong> para abrir el periodo de inscripción.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inscripciones</h1>
          <p className="text-muted-foreground mt-1">{registrations.length} inscripciones totales</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => downloadPDF()} className="gap-2">
            <Download className="w-4 h-4" /> PDF Total
          </Button>
          <Select onValueChange={(v) => downloadPDF(v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="PDF por escuela" />
            </SelectTrigger>
            <SelectContent>
              {schools.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowGroupDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Inscribir Grupo
          </Button>
        </div>
      </div>

      {/* Mini dashboard for open competition */}
      {activeComp && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{activeComp.name} — Inscripciones abiertas</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{activeRegs.length}</div>
                <div className="text-xs text-muted-foreground">Grupos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{uniqueSchools}</div>
                <div className="text-xs text-muted-foreground">Escuelas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalParticipants}</div>
                <div className="text-xs text-muted-foreground">Participantes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar grupo o escuela..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Registrations table */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Grupo</th>
                  <th className="text-left p-3 font-medium">Escuela</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Categoría</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Entrenador</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Part.</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Pago</th>
                  <th className="text-left p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-8">Sin inscripciones</td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 font-medium">{reg.group_name}</td>
                      <td className="p-3 text-muted-foreground">{reg.school_name}</td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{reg.category}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground hidden lg:table-cell">{reg.coach_name}</td>
                      <td className="p-3 hidden sm:table-cell">{reg.participants_count || "-"}</td>
                      <td className="p-3">
                        <Badge className={`${statusColors[reg.status] || statusColors.pending} border-0 text-[10px]`}>
                          {reg.status === "confirmed" ? "Confirmado" : reg.status === "cancelled" ? "Cancelado" : "Pendiente"}
                        </Badge>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge className={`${paymentColors[reg.payment_status] || paymentColors.pending} border-0 text-[10px]`}>
                          {reg.payment_status === "paid" ? "Pagado" : "Pendiente"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(reg)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(reg.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register group dialog */}
      <Dialog open={showGroupDialog} onOpenChange={(open) => !open && closeGroupDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inscribir Grupo en Competición</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Competición</Label>
              <Select value={selectedCompetition?.id || ""} onValueChange={(id) => setSelectedCompetition(openCompetitions.find(c => c.id === id))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una competición" />
                </SelectTrigger>
                <SelectContent>
                  {openCompetitions.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCompetition && (
              <div className="space-y-2">
                <Label>Grupos disponibles ({availableGroups.length})</Label>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {availableGroups.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">Todos los grupos ya están inscritos</p>
                  ) : (
                    availableGroups.map(group => (
                      <div key={group.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                        <div>
                          <div className="font-medium text-sm">{group.name}</div>
                          <div className="text-xs text-muted-foreground">{group.school_name} · {group.category}</div>
                          <div className="text-xs text-muted-foreground">{group.coach_name} · {group.participants?.length || 0} participantes</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleRegisterGroup(group.id)} disabled={createMutation.isPending}>
                          Inscribir
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={closeGroupDialog}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingReg} onOpenChange={(open) => !open && setEditingReg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Inscripción — {editingReg?.group_name}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Estado de inscripción</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado del pago</Label>
                <Select value={editForm.payment_status} onValueChange={(v) => setEditForm({ ...editForm, payment_status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nº participantes</Label>
                <Input type="number" value={editForm.participants_count} onChange={(e) => setEditForm({ ...editForm, participants_count: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Entrenador</Label>
                <Input value={editForm.coach_name} onChange={(e) => setEditForm({ ...editForm, coach_name: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingReg(null)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar inscripción?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}