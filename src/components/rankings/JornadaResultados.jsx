import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy } from "lucide-react";
import { buildAliasMap, normalizeName } from "@/lib/normalizacion";

const CATEGORY_ORDER = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium", "Megacrew"
];

function PosCell({ pos }) {
  if (pos === 1) return <span className="font-bold text-yellow-500">1º</span>;
  if (pos === 2) return <span className="font-semibold text-gray-400">2º</span>;
  if (pos === 3) return <span className="font-semibold text-amber-600">3º</span>;
  return <span className="text-foreground">{pos}º</span>;
}

function AliasIcon({ original, canonical }) {
  if (!original || original === canonical) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded text-xs bg-primary/15 text-primary cursor-help ml-1 font-bold select-none">≡</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Guardado como: <span className="font-semibold">"{original}"</span></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CategoryResults({ categoria, resultados, aliasMap }) {
  const items = resultados
    .filter(r => r.categoria === categoria)
    .map(r => {
      const key = `${normalizeName(r.grupo_nombre)}|${normalizeName(r.school_name || "")}`;
      const alias = aliasMap.has(key) ? aliasMap.get(key) : null;
      return {
        ...r,
        display_nombre: alias ? alias.canonical_nombre : r.grupo_nombre,
        display_school: alias ? alias.canonical_school : r.school_name,
        is_aliased: alias && alias.nombre_original !== alias.canonical_nombre,
      };
    })
    .sort((a, b) => a.puesto - b.puesto);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {categoria}
          <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium w-12">Pos.</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Grupo / Nombre</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Club</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Puntuación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={i} className={`border-t ${i === 0 ? "bg-yellow-500/5" : i === 1 ? "bg-gray-400/5" : i === 2 ? "bg-amber-600/5" : ""}`}>
                  <td className="py-2 px-3"><PosCell pos={r.puesto} /></td>
                  <td className="py-2 px-3 font-medium">
                    {r.display_nombre}
                    {r.is_aliased && <AliasIcon original={r.grupo_nombre} canonical={r.display_nombre} />}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">{r.display_school || "—"}</td>
                  <td className="py-2 px-3 text-center tabular-nums text-xs text-muted-foreground">
                    {r.puntuacion > 0 ? r.puntuacion.toFixed(3) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JornadaResultados({ resultados, competicion }) {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: grupoAliases = [] } = useQuery({
    queryKey: ["grupoAliases"],
    queryFn: () => base44.entities.GrupoAlias.filter({ estado: "unificado" }),
  });
  const aliasMap = buildAliasMap(grupoAliases);

  const allCategories = [...new Set(resultados.map(r => r.categoria))].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  const displayCategories = selectedCategory === "all" ? allCategories : [selectedCategory];

  if (resultados.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground space-y-3">
        <Trophy className="w-12 h-12 mx-auto opacity-20" />
        <p className="font-medium">No hay resultados para esta jornada todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {competicion && competicion.date && (
        <div className="text-sm text-muted-foreground">📅 {competicion.date}</div>
      )}

      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="Filtrar categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="space-y-4">
        {displayCategories.map(cat => (
          <CategoryResults key={cat} categoria={cat} resultados={resultados} aliasMap={aliasMap} />
        ))}
      </div>
    </div>
  );
}