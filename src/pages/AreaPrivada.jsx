import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Lock, Download, Calendar, School } from "lucide-react";
import { downloadFile } from "@/components/utils/downloadFile";
import { useUser } from "@/components/UserContext";

function ActaCard({ acta }) {
  const fecha = acta.fecha
    ? new Date(acta.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{acta.document_name || acta.competicion_nombre}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className="text-xs">{acta.competicion_nombre}</Badge>
          {fecha && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />{fecha}
            </span>
          )}
        </div>
        {acta.notas && <p className="text-xs text-muted-foreground mt-1">{acta.notas}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 flex-shrink-0"
        onClick={() => downloadFile(acta.document_url, acta.document_name || acta.competicion_nombre || "acta")}
      >
        <Download className="w-3.5 h-3.5" /> Descargar
      </Button>
    </div>
  );
}

export default function AreaPrivada() {
  const user = useUser();
  const [form, setForm] = useState({ school_name: "", competicion_nombre: "", fecha: "", notas: "" });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // DB-level filter: admin gets all, school user gets only theirs
  const { data: allActas = [] } = useQuery({
    queryKey: ["actas_jueces", user?.role, user?.school_name],
    queryFn: () => {
      if (user?.role === "admin") return base44.entities.ActaJueces.list("-fecha", 500);
      if (!user?.school_name) return [];
      return base44.entities.ActaJueces.filter({ school_name: user.school_name }, "-fecha");
    },
    enabled: !!user,
  });

  if (!user) return null; // Layout handles redirect before this renders

  const isAdmin = user.role === "admin";
  const mySchool = user.school_name;

  // Group actas by school for admin view (allActas already scoped at DB level)
  const bySchool = {};
  allActas.forEach(a => {
    if (!bySchool[a.school_name]) bySchool[a.school_name] = [];
    bySchool[a.school_name].push(a);
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.school_name || !form.competicion_nombre) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.ActaJueces.create({
      ...form,
      document_url: file_url,
      document_name: file.name,
    });
    queryClient.invalidateQueries({ queryKey: ["actas_jueces"] });
    setForm({ school_name: "", competicion_nombre: "", fecha: "", notas: "" });
    setFile(null);
    e.target.reset();
    setUploading(false);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Lock className="w-6 h-6 text-primary" />
          {isAdmin ? "Área Privada — Gestión de Actas" : "Mis Puntuaciones"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "Sube y gestiona las actas de jueces por escuela."
            : `Documentos de puntuaciones de ${mySchool || "tu escuela"}.`}
        </p>
      </div>

      {/* Admin: upload form */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> Subir acta de jueces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Escuela *</label>
                  <Input
                    placeholder="Nombre de la escuela"
                    value={form.school_name}
                    onChange={e => setForm({ ...form, school_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Competición *</label>
                  <Input
                    placeholder="Ej: Hip-hop Marín"
                    value={form.competicion_nombre}
                    onChange={e => setForm({ ...form, competicion_nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Fecha</label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm({ ...form, fecha: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <Input
                    placeholder="Notas opcionales"
                    value={form.notas}
                    onChange={e => setForm({ ...form, notas: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Documento *</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-muted hover:file:bg-muted/80 cursor-pointer"
                  required
                />
              </div>
              <Button type="submit" disabled={uploading} className="gap-2">
                <Upload className="w-4 h-4" />
                {uploading ? "Subiendo..." : "Subir acta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Non-admin without school */}
      {!isAdmin && !mySchool && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Tu cuenta no tiene ninguna escuela asignada. Contacta con el administrador.
          </CardContent>
        </Card>
      )}

      {/* Actas display: DB already scoped data, no JS filter needed */}
      {isAdmin ? (
        Object.keys(bySchool).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No hay actas subidas todavía. Usa el formulario superior para subir la primera.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(bySchool)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([school, actas]) => (
                <Card key={school}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <School className="w-4 h-4 text-primary" />
                      {school}
                      <Badge variant="secondary" className="ml-auto">
                        {actas.length} {actas.length === 1 ? "acta" : "actas"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {actas
                      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
                      .map(a => <ActaCard key={a.id} acta={a} />)}
                  </CardContent>
                </Card>
              ))}
          </div>
        )
      ) : mySchool ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Actas de jueces
              {allActas.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{allActas.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allActas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay actas disponibles para tu escuela todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {allActas
                  .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
                  .map(a => <ActaCard key={a.id} acta={a} />)}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}