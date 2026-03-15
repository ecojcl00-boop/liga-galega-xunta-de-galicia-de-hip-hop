import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, MapPin, Users, ChevronDown, ChevronRight, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function ParticipantList({ group }) {
  const participants = group?.participants || [];
  if (!participants.length) {
    return <p className="text-xs text-muted-foreground italic py-1">Sin lista de participantes registrada</p>;
  }
  return (
    <div className="space-y-0.5 pt-1">
      {participants.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <User className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="font-medium">{p.name}</span>
          {p.birth_date && <span className="text-muted-foreground">{p.birth_date}</span>}
        </div>
      ))}
    </div>
  );
}

function GroupRow({ reg, group }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="font-medium text-sm truncate">{reg.group_name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{reg.category}</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 ml-2">
          <Users className="w-3 h-3" />
          <span>{reg.participants_count || group?.participants?.length || 0}</span>
        </div>
      </button>
      {open && (
        <div className="px-8 pb-3">
          {reg.coach_name && (
            <p className="text-xs text-muted-foreground mb-1">
              Entrenador/a: <span className="font-medium text-foreground">{reg.coach_name}</span>
            </p>
          )}
          <ParticipantList group={group} />
        </div>
      )}
    </div>
  );
}

function SchoolSection({ schoolName, regs, groups }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">{schoolName}</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">{regs.length} grupos</Badge>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {regs.map(reg => {
            const group = groups.find(g => g.id === reg.group_id);
            return <GroupRow key={reg.id} reg={reg} group={group} />;
          })}
        </div>
      )}
    </div>
  );
}

// competitions: all competitions
// registrations: all (admin) OR school's regs only (school view)
// groups: all groups for participant lookup
// isAdmin: boolean — if false, groups by school are NOT shown
function nd(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export default function HistorialCompeticiones({ competitions, registrations, groups, isAdmin }) {
  console.log('HistorialCompeticiones props:', { competitions, registrations });
  const [expandedComp, setExpandedComp] = useState(null);

  const sortedComps = useMemo(() =>
    [...competitions].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [competitions]
  );

  if (sortedComps.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Trophy className="w-10 h-10 mx-auto opacity-20 mb-3" />
        <p>No hay competiciones registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedComps.map(comp => {
        const compRegs = registrations.filter(r =>
          nd(r.competition_name) === nd(comp.name)
        );

        // School view: skip competitions where this school has no registrations
        if (!isAdmin && compRegs.length === 0) return null;

        const isExpanded = expandedComp === comp.id;

        const bySchool = isAdmin
          ? compRegs.reduce((acc, r) => {
              const s = r.school_name || "Sin escuela";
              if (!acc[s]) acc[s] = [];
              acc[s].push(r);
              return acc;
            }, {})
          : null;

        const schoolCount = bySchool ? Object.keys(bySchool).length : null;

        return (
          <Card key={comp.id} className="overflow-hidden">
            <button
              onClick={() => setExpandedComp(isExpanded ? null : comp.id)}
              className="w-full text-left"
            >
              <CardHeader className="pb-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {comp.name}
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </CardTitle>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {comp.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(comp.date), "dd MMM yyyy", { locale: es })}
                          </span>
                        )}
                        {comp.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {comp.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {compRegs.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {compRegs.length} grupos
                        {isAdmin && schoolCount ? ` · ${schoolCount} escuelas` : ""}
                      </Badge>
                    )}
                    {comp.registration_open !== undefined && comp.registration_open !== null && (
                      <Badge variant={comp.registration_open ? "default" : "outline"} className="text-[10px]">
                        {comp.registration_open ? "Abierta" : "Cerrada"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
            </button>

            {isExpanded && (
              <CardContent className="pt-0">
                {compRegs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin inscripciones en esta competición.</p>
                ) : isAdmin ? (
                  <div className="space-y-3">
                    {Object.entries(bySchool)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([schoolName, regs]) => (
                        <SchoolSection key={schoolName} schoolName={schoolName} regs={regs} groups={groups} />
                      ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {compRegs.map(reg => {
                      const group = groups.find(g => g.id === reg.group_id);
                      return <GroupRow key={reg.id} reg={reg} group={group} />;
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}