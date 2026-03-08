import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Users, Trophy, School, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react";

const STATUS_LABELS = { confirmed: "Confirmada", pending: "Pendiente", cancelled: "Cancelada" };
const PAYMENT_LABELS = { paid: "Pagado", pending: "Pendiente" };

function RegistrationCard({ reg }) {
  const [expanded, setExpanded] = useState(false);
  const participants = reg.participants_snapshot || [];

  return (
    <div className="rounded-lg border bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{reg.group_name}</span>
            <Badge variant="outline" className="text-[10px]">{reg.category}</Badge>
            <Badge
              className={`text-[10px] ${reg.status === "confirmed" ? "bg-green-500/10 text-green-700 border-green-300" : reg.status === "cancelled" ? "bg-red-500/10 text-red-700 border-red-300" : "bg-yellow-500/10 text-yellow-700 border-yellow-300"}`}
              variant="outline"
            >
              {STATUS_LABELS[reg.status] || reg.status}
            </Badge>
            <Badge
              className={`text-[10px] ${reg.payment_status === "paid" ? "bg-blue-500/10 text-blue-700 border-blue-300" : "bg-orange-500/10 text-orange-700 border-orange-300"}`}
              variant="outline"
            >
              {PAYMENT_LABELS[reg.payment_status] || reg.payment_status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <School className="w-3 h-3 inline mr-1" />{reg.school_name}
            {reg.coach_name && <> · {reg.coach_name}</>}
          </p>
          {participants.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Users className="w-3 h-3 inline mr-1" />{participants.length} participantes
            </p>
          )}
        </div>
        {participants.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        )}
      </div>
      {expanded && participants.length > 0 && (
        <div className="px-4 pb-4 pt-0 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mt-3">
            {participants.map((p, i) => (
              <div key={i} className="text-xs bg-muted/40 rounded px-2 py-1.5 flex items-center justify-between">
                <span className="font-medium truncate">{p.name}</span>
                {p.birth_date && <span className="text-muted-foreground ml-2 shrink-0">{p.birth_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Registrations() {
  const [selectedComp, setSelectedComp] = useState("all");
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const isAdmin = user?.role === "admin";

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list("-date"),
  });

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.Registration.list("-created_date", 500),
  });

  const filtered = selectedComp === "all"
    ? registrations
    : registrations.filter(r => r.competition_name === selectedComp || r.competition_id === selectedComp);

  const byCompetition = {};
  filtered.forEach(r => {
    const key = r.competition_name || r.competition_id || "Sin competición";
    if (!byCompetition[key]) byCompetition[key] = [];
    byCompetition[key].push(r);
  });

  const totalParticipants = filtered.reduce((s, r) => s + (r.participants_snapshot?.length || r.participants_count || 0), 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" /> Inscripciones
          </h1>
          <p className="text-muted-foreground mt-1">
            {filtered.length} inscripciones · {totalParticipants} participantes
          </p>
        </div>
      </div>

      {/* Filtro por competición */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedComp} onValueChange={setSelectedComp}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por competición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las competiciones</SelectItem>
            {competitions.map(c => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground space-y-3">
          <ClipboardList className="w-12 h-12 mx-auto opacity-20" />
          <p>No hay inscripciones todavía.</p>
          <p className="text-sm">Las inscripciones se crean al importar el Excel de inscripciones.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byCompetition).map(([comp, regs]) => (
            <Card key={comp}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  {comp}
                  <Badge variant="secondary" className="ml-auto">
                    {regs.length} {regs.length === 1 ? "grupo" : "grupos"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {regs.map(reg => (
                  <RegistrationCard key={reg.id} reg={reg} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}