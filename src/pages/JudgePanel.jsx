import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useUser } from "@/components/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Download, Trash2, Eye, Gavel, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

function normalize(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function JudgePanel() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const mySchool = user?.school_name || "";

  const [actas, setActas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadActas = async () => {
    setLoading(true);
    const all = await base44.entities.ActaJueces.list("-created_date", 200);
    // Non-admin: only show their school's docs (or "TODAS")
    const filtered = isAdmin
      ? all
      : all.filter(a =>
          a.school_name === "TODAS" ||
          normalize(a.school_name) === normalize(mySchool)
        );
    setActas(filtered);
    setLoading(false);
  };

  useEffect(() => { loadActas(); }, []);

  const handleDelete = async () => {
    await base44.entities.ActaJueces.delete(deletingId);
    setDeletingId(null);
    loadActas();
  };

  const displayed = actas.filter(a => {
    const q = normalize(search);
    if (!q) return true;
    return (
      normalize(a.school_name).includes(q) ||
      normalize(a.competicion_nombre).includes(q) ||
      normalize(a.document_name).includes(q) ||
      normalize(a.notas).includes(q)
    );
  });

  // Group by competition
  const grouped = displayed.reduce((acc, a) => {
    const key = a.competicion_nombre || "Sin competición";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gavel className="w-7 h-7 text-primary" /> Panel de Jueces
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isAdmin
              ? "Documentos de puntuaciones subidos por el administrador."
              : "Documentos de puntuaciones de tu escuela. Solo lectura."}
          </p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="text-xs self-start sm:self-center">
            Vista administrador
          </Badge>
        )}
      </div>

      {/* Search */}
      {actas.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por escuela, competición, archivo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Cargando documentos...</div>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {actas.length === 0
                ? "Aún no hay documentos de jueces disponibles."
                : "No hay resultados para tu búsqueda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([comp, docs]) => (
            <div key={comp}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 pl-1">
                {comp}
              </h2>
              <div className="space-y-3">
                {docs.map(acta => (
                  <Card key={acta.id} className="overflow-hidden">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {acta.document_name || "Documento de jueces"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {isAdmin && (
                            <Badge variant="secondary" className="text-xs">
                              {acta.school_name === "TODAS" ? "Todas las escuelas" : acta.school_name}
                            </Badge>
                          )}
                          {acta.fecha && (
                            <span className="text-xs text-muted-foreground">{acta.fecha}</span>
                          )}
                          {acta.notas && (
                            <span className="text-xs text-muted-foreground italic truncate max-w-xs">
                              {acta.notas}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => window.open(acta.document_url, "_blank")}
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          asChild
                        >
                          <a href={acta.document_url} download target="_blank" rel="noreferrer">
                            <Download className="w-3.5 h-3.5" /> Descargar
                          </a>
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingId(acta.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento dejará de estar disponible para la escuela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}