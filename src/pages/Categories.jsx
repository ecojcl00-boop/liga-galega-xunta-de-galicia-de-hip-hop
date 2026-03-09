import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Users, Lock } from "lucide-react";
import { useUser } from "@/lib/UserContext";

const MODALITIES = [
  { name: "Individual", categories: ["Mini Individual A", "Mini Individual B", "Individual"] },
  { name: "Parejas", categories: ["Mini Parejas A", "Mini Parejas B", "Parejas"] },
  { name: "Grupos", categories: ["Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium"] },
  { name: "Megacrew", categories: ["Megacrew"] },
];

function GroupRow({ group }) {
  const [open, setOpen] = useState(false);
  const participants = group.participants || [];
  return (
    <div className="rounded-lg bg-muted/20 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="text-left">
          <span className="font-medium text-sm">{group.name}</span>
          {group.school_name && (
            <span className="text-xs text-muted-foreground ml-2">· {group.school_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{participants.length} participantes</span>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1">
          {participants.length > 0 ? (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              {participants.map((p, i) => (
                <li key={i} className="text-sm text-foreground truncate">{p.name || p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Sin participantes registrados</p>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ name, groups }) {
  const [open, setOpen] = useState(false);
  const totalParticipants = groups.reduce((s, g) => s + (g.participants?.length || 0), 0);
  const schools = [...new Set(groups.map(g => g.school_name).filter(Boolean))];
  return (
    <div className="rounded-lg bg-muted/30 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-medium text-sm">{name}</span>
        <div className="flex gap-3 items-center text-xs text-muted-foreground">
          <span>{groups.length} grupos</span>
          <span>{totalParticipants} participantes</span>
          <span>{schools.length} escuelas</span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {groups.length > 0
            ? groups.map(g => <GroupRow key={g.id} group={g} />)
            : <p className="text-xs text-muted-foreground px-1">Sin grupos en esta categoría</p>
          }
        </div>
      )}
    </div>
  );
}

function ModalityCard({ modality, groupsByCategory }) {
  const [open, setOpen] = useState(true);
  const totalGroups = modality.categories.reduce((s, c) => s + (groupsByCategory[c]?.length || 0), 0);
  const totalParticipants = modality.categories.reduce(
    (s, c) => s + (groupsByCategory[c] || []).reduce((ss, g) => ss + (g.participants?.length || 0), 0), 0
  );
  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
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
          {modality.categories.map(cat => {
            const catGroups = groupsByCategory[cat] || [];
            return catGroups.length > 0 ? (
              <CategoryRow key={cat} name={cat} groups={catGroups} />
            ) : (
              <div key={cat} className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/20 opacity-50">
                <span className="text-sm">{cat}</span>
                <span className="text-xs text-muted-foreground">0 grupos</span>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

export default function Categories() {
  const user = useUser();
  const isAdmin = user?.role === "admin";

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups", user?.role, user?.school_name],
    queryFn: () => {
      if (isAdmin) return base44.entities.Group.list();
      if (!user?.school_name) return [];
      return base44.entities.Group.filter({ school_name: user.school_name });
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

  // Groups already filtered at query level for non-admin
  const groupsByCategory = {};
  groups.forEach(g => {
    const cat = g.category || "Sin categoría";
    if (!groupsByCategory[cat]) groupsByCategory[cat] = [];
    groupsByCategory[cat].push(g);
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground mt-1">
          {groups.length} grupos {!isAdmin && user?.school_name ? `· ${user.school_name}` : "inscritos"}
        </p>
      </div>
      <div className="space-y-4">
        {MODALITIES.map(mod => (
          <ModalityCard key={mod.name} modality={mod} groupsByCategory={groupsByCategory} />
        ))}
      </div>
    </div>
  );
}