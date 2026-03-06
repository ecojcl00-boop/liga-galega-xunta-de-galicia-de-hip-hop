import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, Trophy, ClipboardList } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import CategoryBreakdown from "../components/dashboard/CategoryBreakdown";
import RankingSummary from "../components/dashboard/RankingSummary";

export default function Dashboard() {
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-created_date"),
  });
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => base44.entities.Competition.list(),
  });

  const uniqueSchools = [...new Set(groups.map((g) => g.school_name).filter(Boolean))];
  const totalParticipants = groups.reduce((sum, g) => sum + (g.participants?.length || 0), 0);

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Home</h1>
        <p className="text-muted-foreground mt-1">Resumen general de la liga</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Escuelas" value={uniqueSchools.length} icon={School} color="bg-primary" />
        <StatCard title="Grupos" value={groups.length} icon={Users} color="bg-secondary" />
        <StatCard title="Participantes" value={totalParticipants} icon={ClipboardList} color="bg-secondary" />
        <StatCard title="Competiciones" value={competitions.length} icon={Trophy} color="bg-primary" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grupos por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown groups={groups} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingSummary />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}