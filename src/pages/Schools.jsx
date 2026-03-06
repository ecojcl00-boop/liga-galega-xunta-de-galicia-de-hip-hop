import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { School, Users, Mail, Phone } from "lucide-react";

export default function Schools() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const isAdmin = user?.role === "admin";

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
  });

  // Derive schools from groups
  const schoolMap = {};
  groups.forEach((g) => {
    const name = g.school_name;
    if (!name) return;
    if (!schoolMap[name]) {
      schoolMap[name] = {
        name,
        email: g.coach_email,
        phone: g.coach_phone,
        groups: [],
        participants: 0,
      };
    }
    schoolMap[name].groups.push(g);
    schoolMap[name].participants += g.participants?.length || 0;
  });

  const schools = Object.values(schoolMap).sort((a, b) => a.name.localeCompare(b.name, "es"));

  const totalParticipants = schools.reduce((sum, s) => sum + s.participants, 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Escuelas</h1>
        <p className="text-muted-foreground mt-1">{schools.length} escuelas · {groups.length} grupos · {totalParticipants} participantes</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : schools.length === 0 ? (
        <div className="text-center py-16">
          <School className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No hay escuelas registradas</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((school) => (
            <Card key={school.name} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <School className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg">{school.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">{school.groups.length}</p>
                    <p className="text-[10px] text-muted-foreground">Grupos</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">{school.participants}</p>
                    <p className="text-[10px] text-muted-foreground">Participantes</p>
                  </div>
                </div>
                {isAdmin && school.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{school.email}</span>
                  </div>
                )}
                {isAdmin && school.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span>{school.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}