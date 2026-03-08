import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Users } from "lucide-react";

export default function AdminView() {
  const [filterCompetition, setFilterCompetition] = useState("all");
  const [filterSchool, setFilterSchool] = useState("all");

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list("-created_date", 500),
  });

  const competitions = [...new Set(registrations.map(r => r.competition_name).filter(Boolean))];
  const schools = [...new Set(registrations.map(r => r.school_name).filter(Boolean))];

  const filtered = registrations.filter(r => {
    if (filterCompetition !== "all" && r.competition_name !== filterCompetition) return false;
    if (filterSchool !== "all" && r.school_name !== filterSchool) return false;
    return true;
  });

  const statusColor = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const paymentColor = {
    paid: "bg-blue-100 text-blue-700",
    pending: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inscripciones</h1>
        <p className="text-muted-foreground mt-1">{filtered.length} inscripciones</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterCompetition} onValueChange={setFilterCompetition}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Competición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las competiciones</SelectItem>
            {competitions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSchool} onValueChange={setFilterSchool}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Escuela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las escuelas</SelectItem>
            {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Grupo</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Escuela</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Competición</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Categoría</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Participantes</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Pago</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={`border-b hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="py-3 px-4 font-medium">{r.group_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{r.school_name}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{r.competition_name}</td>
                    <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{r.category}</td>
                    <td className="py-3 px-4 text-center hidden md:table-cell">
                      <span className="flex items-center justify-center gap-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {r.participants_count || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] || ""}`}>
                        {r.status === "confirmed" ? "Confirmada" : r.status === "pending" ? "Pendiente" : "Cancelada"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center hidden lg:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColor[r.payment_status] || ""}`}>
                        {r.payment_status === "paid" ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Sin inscripciones</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}