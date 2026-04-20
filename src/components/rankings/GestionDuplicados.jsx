import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectarDuplicados, pairKey, normalizeName, canonicalClub } from "@/lib/normalizacion";
import { Check, X, Clock, Layers, AlertTriangle, RefreshCw } from "lucide-react";

function simColor(v) {
  if (v >= 0.97) return "bg-red-100 text-red-700 border-red-200";
  if (v >= 0.90) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

function suggestCanonical(nameA, nameB) {
  // Preferir el más largo (más completo), o el que tiene capitalización mixta
  const a = nameA.trim(), b = nameB.trim();
  const aHasMixed = a !== a.toUpperCase() && a !== a.toLowerCase();
  const bHasMixed = b !== b.toUpperCase() && b !== b.toLowerCase();
  if (aHasMixed && !bHasMixed) return a;
  if (bHasMixed && !aHasMixed) return b;
  return a.length >= b.length ? a : b;
}

function PairCard({ par, aliases, onUnificar, onIgnorar, onPosponer }) {
  const keyA = `${normalizeName(par.a.grupo_nombre)}|${normalizeName(par.a.school_name)}`;
  const keyB = `${normalizeName(par.b.grupo_nombre)}|${normalizeName(par.b.school_name)}`;
  const pk = pairKey(keyA, keyB);
  const existing = aliases.find(a => a.par_key === pk);

  // Inicializar con el canónico guardado si existe, si no sugerir
  const existingCanonical = existing?.estado === "unificado" ? existing : null;
  const [canonName, setCanonName] = useState(() =>
    existingCanonical ? existingCanonical.canonical_nombre : suggestCanonical(par.a.grupo_nombre, par.b.grupo_nombre)
  );
  const [canonSchool, setCanonSchool] = useState(() =>
    existingCanonical ? existingCanonical.canonical_school : suggestCanonical(canonicalClub(par.a.school_name), canonicalClub(par.b.school_name))
  );
  const [editing, setEditing] = useState(false);

  const isUnificado = existing?.estado === "unificado";
  const isIgnorado = existing?.estado === "ignorado";
  const showFields = !isIgnorado && (!isUnificado || editing);

  const estadoBadge = existing ? (
    isUnificado
      ? <Badge className="bg-green-100 text-green-700 border-green-200">✓ Unificado</Badge>
      : isIgnorado
        ? <Badge variant="outline" className="text-muted-foreground">✗ Ignorado</Badge>
        : <Badge variant="outline">⏸ Pendiente</Badge>
  ) : null;

  return (
    <Card className={`border-l-4 ${isUnificado ? "border-l-green-400 opacity-80" : isIgnorado ? "border-l-gray-300 opacity-60" : "border-l-orange-400"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{par.categoria}</Badge>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${simColor(par.nameSim)}`}>
              {Math.round(par.nameSim * 100)}% similitud
            </span>
            {estadoBadge}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Jornada {par.a.numero_jornada}</p>
            <p className="font-semibold">{par.a.grupo_nombre}</p>
            <p className="text-xs text-muted-foreground">{par.a.school_name}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Jornada {par.b.numero_jornada}</p>
            <p className="font-semibold">{par.b.grupo_nombre}</p>
            <p className="text-xs text-muted-foreground">{par.b.school_name}</p>
          </div>
        </div>

        {/* Si ya unificado y no editando: mostrar resumen del canónico */}
        {isUnificado && !editing && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-green-700 font-medium">Nombre canónico:</p>
              <p className="text-sm font-semibold truncate">{canonName} <span className="text-xs font-normal text-muted-foreground">— {canonSchool}</span></p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => setEditing(true)}>
              ✏️ Editar
            </Button>
          </div>
        )}

        {showFields && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground font-medium">Nombre canónico (editable):</p>
            <Input
              value={canonName}
              onChange={e => setCanonName(e.target.value)}
              placeholder="Nombre canónico"
              className="h-8 text-sm"
            />
            <Input
              value={canonSchool}
              onChange={e => setCanonSchool(e.target.value)}
              placeholder="Club canónico"
              className="h-8 text-sm"
            />
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="gap-1.5 h-8" onClick={() => { onUnificar(par, canonName, canonSchool); setEditing(false); }}>
            <Check className="w-3.5 h-3.5" /> {isUnificado ? "Guardar cambios" : "Unificar"}
          </Button>
          {!isIgnorado && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => { onIgnorar(par); setEditing(false); }}>
              <X className="w-3.5 h-3.5" /> Son diferentes
            </Button>
          )}
          {!isUnificado && (
            <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-muted-foreground" onClick={() => onPosponer(par)}>
              <Clock className="w-3.5 h-3.5" /> Posponer
            </Button>
          )}
          {(isIgnorado || isUnificado) && (
            <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-muted-foreground" onClick={() => { onPosponer(par); setEditing(false); }}>
              <Clock className="w-3.5 h-3.5" /> Resetear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GestionDuplicados() {
  const qc = useQueryClient();
  const [filterEstado, setFilterEstado] = useState("pendientes");
  const [filterCategoria, setFilterCategoria] = useState("all");

  const { data: resultados = [], isLoading: loadingR } = useQuery({
    queryKey: ["ligaResultados-todos"],
    queryFn: () => base44.entities.LigaResultado.list(),
  });

  const { data: aliases = [], isLoading: loadingA } = useQuery({
    queryKey: ["grupoAliases"],
    queryFn: () => base44.entities.GrupoAlias.list(),
  });

  const createAlias = useMutation({
    mutationFn: (data) => base44.entities.GrupoAlias.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grupoAliases"] }),
  });

  const updateAlias = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GrupoAlias.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grupoAliases"] }),
  });

  const ignorados = useMemo(() =>
    aliases.filter(a => a.estado === "ignorado").map(a => ({ key_a: a.key_original, key_b: a.key_original })),
    [aliases]
  );

  const duplicados = useMemo(() => {
    if (!resultados.length) return [];
    return detectarDuplicados(resultados, []);
  }, [resultados]);

  const allCategorias = [...new Set(duplicados.map(d => d.categoria))].sort();

  const displayed = duplicados.filter(par => {
    const keyA = `${normalizeName(par.a.grupo_nombre)}|${normalizeName(par.a.school_name)}`;
    const keyB = `${normalizeName(par.b.grupo_nombre)}|${normalizeName(par.b.school_name)}`;
    const pk = pairKey(keyA, keyB);
    const existing = aliases.find(a => a.par_key === pk);
    const estado = existing?.estado || "pendiente";

    if (filterEstado === "pendientes" && estado !== "pendiente") return false;
    if (filterEstado === "unificados" && estado !== "unificado") return false;
    if (filterEstado === "ignorados" && estado !== "ignorado") return false;
    if (filterCategoria !== "all" && par.categoria !== filterCategoria) return false;
    return true;
  });

  async function saveAlias(par, canonNombre, canonSchool, estado) {
    const keyA = `${normalizeName(par.a.grupo_nombre)}|${normalizeName(par.a.school_name)}`;
    const keyB = `${normalizeName(par.b.grupo_nombre)}|${normalizeName(par.b.school_name)}`;
    const pk = pairKey(keyA, keyB);

    // Eliminar aliases anteriores de este par
    const existing = aliases.filter(a => a.par_key === pk);
    for (const e of existing) {
      await base44.entities.GrupoAlias.delete(e.id);
    }

    if (estado === "ignorado" || estado === "pendiente") {
      // Solo guardamos un registro con estado
      await createAlias.mutateAsync({
        key_original: keyA, nombre_original: par.a.grupo_nombre, school_original: par.a.school_name,
        canonical_nombre: par.a.grupo_nombre, canonical_school: par.a.school_name,
        categoria: par.categoria, par_key: pk, estado,
      });
      return;
    }

    // Unificado: guardar alias para ambos lados
    await createAlias.mutateAsync({
      key_original: keyA, nombre_original: par.a.grupo_nombre, school_original: par.a.school_name,
      canonical_nombre: canonNombre, canonical_school: canonSchool,
      categoria: par.categoria, par_key: pk, estado: "unificado",
    });
    await createAlias.mutateAsync({
      key_original: keyB, nombre_original: par.b.grupo_nombre, school_original: par.b.school_name,
      canonical_nombre: canonNombre, canonical_school: canonSchool,
      categoria: par.categoria, par_key: pk, estado: "unificado",
    });
    qc.invalidateQueries({ queryKey: ["grupoAliases"] });
    qc.invalidateQueries({ queryKey: ["ligaResultados"] });
    qc.invalidateQueries({ queryKey: ["liga_resultados_home"] });
  }

  const pendientesCount = duplicados.filter(par => {
    const keyA = `${normalizeName(par.a.grupo_nombre)}|${normalizeName(par.a.school_name)}`;
    const keyB = `${normalizeName(par.b.grupo_nombre)}|${normalizeName(par.b.school_name)}`;
    const pk = pairKey(keyA, keyB);
    return !aliases.find(a => a.par_key === pk);
  }).length;

  if (loadingR || loadingA) {
    return <div className="p-8 text-center text-muted-foreground">Analizando duplicados...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Gestión de duplicados</h2>
        </div>
        {pendientesCount > 0 && (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {pendientesCount} pendientes
          </Badge>
        )}
        <Button size="sm" variant="outline" className="ml-auto gap-1.5 h-8"
          onClick={() => { qc.invalidateQueries({ queryKey: ["ligaResultados-todos"] }); qc.invalidateQueries({ queryKey: ["grupoAliases"] }); }}>
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        El sistema detecta automáticamente grupos/participantes que pueden ser el mismo equipo escrito de forma diferente en distintas jornadas. Revisa y unifica para que el ranking sea correcto.
      </p>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendientes">Pendientes</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="unificados">Unificados</SelectItem>
            <SelectItem value="ignorados">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {allCategorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-3">
          <Check className="w-10 h-10 mx-auto opacity-20" />
          <p className="font-medium">
            {filterEstado === "pendientes" ? "No hay duplicados pendientes de revisión" : "No hay resultados para este filtro"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((par, i) => (
            <PairCard
              key={i}
              par={par}
              aliases={aliases}
              onUnificar={(p, cn, cs) => saveAlias(p, cn, cs, "unificado")}
              onIgnorar={(p) => saveAlias(p, "", "", "ignorado")}
              onPosponer={(p) => saveAlias(p, "", "", "pendiente")}
            />
          ))}
        </div>
      )}
    </div>
  );
}