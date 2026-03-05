import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";

export default function Registrations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list("-created_date"),
  });

  const filtered = registrations.filter((r) => {
    const matchSearch =
      !search ||
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

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inscripciones</h1>
        <p className="text-muted-foreground mt-1">{registrations.length} inscripciones totales</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Grupo</TableHead>
                  <TableHead>Escuela</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Entrenador</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sin inscripciones
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((reg) => (
                    <TableRow key={reg.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{reg.group_name}</TableCell>
                      <TableCell>{reg.school_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{reg.category}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{reg.coach_name}</TableCell>
                      <TableCell>{reg.participants_count || "-"}</TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[reg.status] || statusColors.pending} border-0 text-[10px]`}>
                          {reg.status === "confirmed" ? "Confirmado" : reg.status === "cancelled" ? "Cancelado" : "Pendiente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}