import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Groups() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-created_date"),
  });

  const categories = [...new Set(groups.map((g) => g.category).filter(Boolean))];
  const schools = [...new Set(groups.map((g) => g.school_name).filter(Boolean))];

  const filtered = groups.filter((g) => {
    const matchSearch =
      !search ||
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      g.coach_name?.toLowerCase().includes(search.toLowerCase()) ||
      g.school_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || g.category === categoryFilter;
    const matchSchool = schoolFilter === "all" || g.school_name === schoolFilter;
    return matchSearch && matchCat && matchSchool;
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No se encontraron grupos</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((group) => (
            <Card key={group.id} className="overflow-hidden hover:shadow-md transition-shadow">
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
                      {group.school_name} · {group.coach_name}
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
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                      }
                    >
                      {expanded[group.id] ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>

                {expanded[group.id] && group.participants?.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.participants.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/40 text-sm"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.birth_date}</span>
                        </div>
                      ))}
                    </div>
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