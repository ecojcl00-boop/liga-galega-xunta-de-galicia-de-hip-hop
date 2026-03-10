import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/UserContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel, FileText, Calendar, Download, Trash2, School } from "lucide-react";
import { toast } from "sonner";
import { downloadFile } from "@/components/utils/downloadFile";
import ImportActaJueces from "@/components/import/ImportActaJueces";

export default function JudgePanel() {
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(null);

  const isAdmin = user?.role === "admin";

  const { data: actas = [], isLoading } = useQuery({
    queryKey: ["all_actas_admin"],
    queryFn: () => base44.entities.ActaJueces.list("-created_date", 500),
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ActaJueces.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_actas_admin"] });
      setConfirmDelete(null);
      toast.success("Documento eliminado");
    },
  });

  const handleOnSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["all_actas_admin"] });
  };

  const byCompetition = useMemo(() => {
    const map = {};
    actas.forEach(a => {
      const key = a.competicion_nombre || "Sin competición";
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [actas]);

  if (!isAdmin) {
    if (user) navigate(createPageUrl("PortalEscuela"), { replace: true });
    return null;
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Gavel className="w-7 h-7 text-primary" />
          Panel de Jueces
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sube actas de jueces y asígnalas a escuelas. Cada escuela solo ve sus propios documentos en su portal.
        </p>
      </div>

      {/* Upload section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b pb-2">Subir nuevo documento</h2>
        <ImportActaJueces onSuccess={handleOnSuccess} />
      </section>

      {/* Documents list */}
      <section className="space-y-4">
        <div className="border-b pb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Documentos subidos</h2>
          <Badge variant="secondary">{actas.length}</Badge>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
        ) : actas.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto opacity-20 mb-3" />
              <p>No hay documentos subidos todavía</p>
              <p className="text-sm mt-1">Usa el formulario de arriba para subir el primer documento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(byCompetition).map(([comp, items]) => (
              <div key={comp}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {comp} <span className="normal-case font-normal opacity-60">({items.length} doc{items.length !== 1 ? "s" : ""})</span>
                </h3>
                <div className="grid gap-2">
                  {items.map(acta => {
                    const fecha = acta.fecha
                      ? new Date(acta.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                          day: "2-digit", month: "short", year: "numeric"
                        })
                      : null;

                    return (
                      <div
                        key={acta.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {acta.document_name || acta.competicion_nombre}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-primary flex items-center gap-1">
                              <School className="w-3 h-3" /> {acta.school_name}
                            </span>
                            {fecha && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {fecha}
                              </span>
                            )}
                            {acta.notas && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{acta.notas}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            title={acta.document_url ? "Descargar" : "Archivo no disponible"}
                            disabled={!acta.document_url}
                            onClick={() => downloadFile(acta.document_url, acta.document_name || "acta")}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>

                          {confirmDelete === acta.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(acta.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Sí, eliminar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmDelete(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Eliminar"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(acta.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}