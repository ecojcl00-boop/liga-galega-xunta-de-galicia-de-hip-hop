import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODALITY_MAP = {
  Individual: ["Mini Individual A", "Mini Individual B", "Individual"],
  Parejas: ["Mini Parejas A", "Mini Parejas B", "Parejas"],
  Grupos: ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"],
  Megacrew: ["Megacrew"],
};

const GRUPOS_SUBCATEGORIES = ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"];

const MODALITY_TABS = ["Individual", "Parejas", "Grupos", "Megacrew"];

function GroupCard({ group }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base">{group.name}</h3>
              <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                {group.category}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {group.school_name} {group.coach_name ? `· ${group.coach_name}` : ""}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{group.participants?.length || 0} participantes</span>
            </div>
          </div>
          {group.participants?.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(prev => !prev)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
        {expanded && group.participants?.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/40 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.birth_date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Groups() {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [tab, setTab] = useState("Individual");
  const [subTab, setSubTab] = useState("Baby");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-created_date"),
  });

  const schools = [...new Set(groups.map((g) => g.school_name).filter(Boolean))].sort();

  const filteredForTab = groups.filter((g) => {
    const inModality = MODALITY_MAP[tab]?.includes(g.category);
    const matchSearch =
      !search ||
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.coach_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.school_name?.toLowerCase().includes(search.toLowerCase());
    const matchSchool = schoolFilter === "all" || g.school_name === schoolFilter;
    return inModality && matchSearch && matchSchool;
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Grupos</h1>
        <p className="text-muted-foreground mt-1">{groups.length} grupos inscritos</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo, escuela o entrenador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={schoolFilter} onValueChange={setSchoolFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Escuela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las escuelas</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          {MODALITY_TABS.map((m) => {
            const count = groups.filter(g => MODALITY_MAP[m]?.includes(g.category)).length;
            return (
              <TabsTrigger key={m} value={m} className="flex gap-1.5 items-center">
                {m}
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {MODALITY_TABS.map((m) => (
          <TabsContent key={m} value={m} className="mt-4">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Cargando...</div>
            ) : filteredForTab.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No se encontraron grupos</div>
            ) : (
              <div className="grid gap-3">
                {filteredForTab.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}