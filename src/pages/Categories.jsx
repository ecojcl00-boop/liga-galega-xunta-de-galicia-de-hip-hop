import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Users } from "lucide-react";

export default function Categories() {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list(),
  });

  const categoryMap = {};
  groups.forEach((g) => {
    const cat = g.category || "Sin categoría";
    if (!categoryMap[cat]) {
      categoryMap[cat] = { groups: 0, participants: 0, schools: new Set() };
    }
    categoryMap[cat].groups++;
    categoryMap[cat].participants += g.participants?.length || 0;
    if (g.school_name) categoryMap[cat].schools.add(g.school_name);
  });

  const categoryOrder = [
    "Mini Individual A",
    "Mini Individual B",
    "Individual",
    "Mini Parejas A",
    "Mini Parejas B",
    "Parejas",
    "Baby",
    "Infantil",
    "Junior",
    "Youth",
    "Absoluta",
    "Premium",
    "Megacrew",
  ];

  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({ name, ...data, schools: data.schools.size }))
    .sort((a, b) => {
      const ai = categoryOrder.indexOf(a.name);
      const bi = categoryOrder.indexOf(b.name);
      if (ai === -1 && bi === -1) return b.groups - a.groups;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground mt-1">{categories.length} categorías activas</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No hay categorías</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.name} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <h3 className="font-bold text-lg mb-4">{cat.name}</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">{cat.groups}</p>
                    <p className="text-[10px] text-muted-foreground">Grupos</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">{cat.participants}</p>
                    <p className="text-[10px] text-muted-foreground">Participantes</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">{cat.schools}</p>
                    <p className="text-[10px] text-muted-foreground">Escuelas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}