import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, Trophy, ClipboardList } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
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
      {/* Hero / Logo */}
      <div className="flex flex-col items-center justify-center py-8 lg:py-12 text-center">
        <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-xl mb-4">
          <span className="text-primary-foreground font-black text-6xl leading-none">G</span>
        </div>
        <h1 className="text-3xl lg:text-5xl font-black tracking-tight mt-2">HipHop Galician Dance Tour</h1>
        <p className="text-muted-foreground mt-2 text-lg">Temporada 2025–2026</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Escuelas" value={uniqueSchools.length} icon={School} color="bg-primary" />
        <StatCard title="Grupos" value={groups.length} icon={Users} color="bg-secondary" />
        <StatCard title="Participantes" value={totalParticipants} icon={ClipboardList} color="bg-secondary" />
        <StatCard title="Competiciones" value={competitions.length} icon={Trophy} color="bg-primary" />
      </div>

      {/* Rankings compactos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Ranking Global de Liga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RankingSummary />
        </CardContent>
      </Card>
    </div>
  );
}