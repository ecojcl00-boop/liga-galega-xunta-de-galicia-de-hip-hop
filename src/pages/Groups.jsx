import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Users, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/UserContext";

const MODALITY_MAP = {
  Individual: ["Mini Individual A", "Mini Individual B", "Individual"],
  Parejas: ["Mini Parejas A", "Mini Parejas B", "Parejas"],
  Grupos: ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"],
  Megacrew: ["Megacrew"],
};
const INDIVIDUAL_ORDER = ["Mini Individual A", "Mini Individual B", "Individual"];
const PAREJAS_ORDER = ["Mini Parejas A", "Mini Parejas B", "Parejas"];
const GRUPOS_SUBCATEGORIES = ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"];
const MODALITY_TABS = ["Individual", "Parejas", "Grupos", "Megacrew"];

function GroupCard({ group, showBirthDate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base">{group.name}</h3>
              <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{group.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {group.school_name}{group.coach_name ? ` · ${group.coach_name}` : ""}
            </p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{group.participants?.length || 0} participantes</span>
            </div>
          </div>
          {group.participants?.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(prev => !prev)}>
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
                  {showBirthDate && p.birth_date && (
                    <span className="text-xs text-muted-foreground">{p.birth_date}</span>
                  )}
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
  const [indSubTab, setIndSubTab] = useState("Mini Individual A");
  const [parSubTab, setParSubTab] = useState("Mini Parejas A");

  const user = useUser();
  const isAdmin = user?.role === "admin";

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups", user?.role, user?.school_name],
    queryFn: () => {
      if (isAdmin) return base44.entities.Group.list("-created_date");
      if (!user?.school_name) return [];
      return base44.entities.Group.filter({ school_name: user.school_name }, "-created_date");
    },
    enabled: !!user,
  });

  if (groupsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!isAdmin && !user?.school_name) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <h2 className="text-xl font-bold">Cuenta sin escuela asignada</h2>
            <p className="text-sm text-muted-foreground">Tu cuenta no está vinculada a ninguna escuela. Contacta con el administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const schools = isAdmin
    ? [...new Set(groups.map(g => g.school_name).filter(Boolean))].sort()
    : [];

  const getOrder = (cat) => {
    if (INDIVIDUAL_ORDER.includes(cat)) return INDIVIDUAL_ORDER.indexOf(cat);
    if (PAREJAS_ORDER.includes(cat)) return PAREJAS_ORDER.indexOf(cat);
    return 0;
  };

  const filteredForTab = groups
    .filter(g => {
      let category;
      if (tab === "Grupos") category = g.category === subTab;
      else if (tab === "Individual") category = g.category === indSubTab;
      else if (tab === "Parejas") category = g.category === parSubTab;
      else category = MODALITY_MAP[tab]?.includes(g.category);
      const matchSearch =
        !search ||
        g.name?.toLowerCase().includes(search.toLowerCase()) ||
        g.coach_name?.toLowerCase().includes(search.toLowerCase()) ||
        g.school_name?.toLowerCase().includes(search.toLowerCase());
      const matchSchool = isAdmin ? (schoolFilter === "all" || g.school_name === schoolFilter) : true;
      return category && matchSearch && matchSchool;
    })
    .sort((a, b) => getOrder(a.category) - getOrder(b.category));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Grupos</h1>
        <p className="text-muted-foreground mt-1">
          {groups.length} grupos {!isAdmin && user?.school_name ? `· ${user.school_name}` : "inscritos"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isAdmin ? "Buscar grupo, escuela o entrenador..." : "Buscar grupo o entrenador..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {isAdmin && (
          <Select value={schoolFilter} onValueChange={setSchoolFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Escuela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las escuelas</SelectItem>
              {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          {MODALITY_TABS.map(m => {
            const count = groups.filter(g => MODALITY_MAP[m]?.includes(g.category)).length;
            return (
              <TabsTrigger key={m} value={m} className="flex gap-1.5 items-center">
                {m}
                <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {MODALITY_TABS.map(m => (
          <TabsContent key={m} value={m} className="mt-4">
            {m === "Grupos" && (
              <div className="flex flex-wrap gap-2 mb-4">
                {GRUPOS_SUBCATEGORIES.map(sub => {
                  const count = groups.filter(g => g.category === sub).length;
                  return (
                    <button key={sub} onClick={() => setSubTab(sub)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${subTab === sub ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {sub} <span className="ml-1 opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
            {m === "Individual" && (
              <div className="flex flex-wrap gap-2 mb-4">
                {INDIVIDUAL_ORDER.map(sub => {
                  const count = groups.filter(g => g.category === sub).length;
                  return (
                    <button key={sub} onClick={() => setIndSubTab(sub)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${indSubTab === sub ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {sub} <span className="ml-1 opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
            {m === "Parejas" && (
              <div className="flex flex-wrap gap-2 mb-4">
                {PAREJAS_ORDER.map(sub => {
                  const count = groups.filter(g => g.category === sub).length;
                  return (
                    <button key={sub} onClick={() => setParSubTab(sub)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${parSubTab === sub ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {sub} <span className="ml-1 opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
            {filteredForTab.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No se encontraron grupos</div>
            ) : (
              <div className="grid gap-3">
                {filteredForTab.map(group => (
                  <GroupCard key={group.id} group={group} showBirthDate={isAdmin} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}