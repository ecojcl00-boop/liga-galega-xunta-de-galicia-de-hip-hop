import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Users, BarChart3 } from "lucide-react";

const MODALITIES = [
  {
    name: "Individual",
    categories: ["Mini Individual A", "Mini Individual B", "Individual"],
  },
  {
    name: "Parejas",
    categories: ["Mini Parejas A", "Mini Parejas B", "Parejas"],
  },
  {
    name: "Grupos",
    categories: ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"],
  },
  {
    name: "Megacrew",
    categories: ["Megacrew"],
  },
];

function CategoryRow({ name, data }) {
  return (
    <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <span className="font-medium text-sm">{name}</span>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{data.groups} grupos</span>
        <span>{data.participants} participantes</span>
        <span>{data.schools} escuelas</span>
      </div>
    </div>
  );
}

function ModalityCard({ modality, categoryMap }) {
  const [open, setOpen] = useState(true);

  const totalGroups = modality.categories.reduce((s, c) => s + (categoryMap[c]?.groups || 0), 0);
  const totalParticipants = modality.categories.reduce((s, c) => s + (categoryMap[c]?.participants || 0), 0);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg">{modality.name}</h3>
            <p className="text-xs text-muted-foreground">{totalGroups} grupos · {totalParticipants} participantes</p>
          </div>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="px-5 pb-5 pt-0 space-y-2">
          {modality.categories.map((cat) => (
            categoryMap[cat] ? (
              <CategoryRow key={cat} name={cat} data={categoryMap[cat]} />
            ) : (
              <div key={cat} className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/20 opacity-50">
                <span className="text-sm">{cat}</span>
                <span className="text-xs text-muted-foreground">0 grupos</span>
              </div>
            )
          ))}
        </CardContent>
      )}
    </Card>
  );
}

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

  // Convert sets to counts
  const categoryData = {};
  Object.entries(categoryMap).forEach(([k, v]) => {
    categoryData[k] = { ...v, schools: v.schools.size };
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground mt-1">{groups.length} grupos inscritos</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : (
        <div className="space-y-4">
          {MODALITIES.map((mod) => (
            <ModalityCard key={mod.name} modality={mod} categoryMap={categoryData} />
          ))}
        </div>
      )}
    </div>
  );
}