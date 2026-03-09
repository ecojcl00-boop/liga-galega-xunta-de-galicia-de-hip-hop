import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/components/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Gavel, Upload, FileText, Download, Eye, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function JudgePanel() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ competicion_nombre: "", school_name: "Todas", notas: "" });
  const [fileInput, setFileInput] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["actaJueces"],
    queryFn: () => base44.entities.ActaJueces.list("-created_date"),
  });

  // School users only see docs addressed to them or "Todas"
  const visibleDocs = isAdmin
    ? documents
    : documents.filter(d => !d.school_name || d.school_name === "Todas" || d.school_name === user?.school_name);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ActaJueces.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actaJueces"] });
      setDeleteId(null);
    },
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fileInput) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: fileInput });
    await base44.entities.ActaJueces.create({
      competicion_nombre: form.competicion_nombre,
      school_name: form.school_name || "Todas",
      notas: form.notas,
      document_url: file_url,
      document_name: fileInput.name,
      fecha: new Date().toISOString().split("T")[0],
    });
    queryClient.invalidateQueries({ queryKey: ["actaJueces"] });
    setForm({ competicion_nombre: "", school_name: "Todas", notas: "" });
    setFileInput(null);
    setUploading(false);
    toast.success("Documento subido correctamente");
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
          <Gavel className="w-6 h-6 text-secondary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos de Jueces</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "Sube y gestiona actas y documentos de puntuaciones"
              : "Documentos disponibles para tu escuela"}
          </p>
        </div>
      </div>

      {/* Upload form — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Subir documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Competición *</Label>
                  <Input
                    placeholder="Ej: MARÍN 2026"
                    value={form.competicion_nombre}
                    onChange={e => setForm({ ...form, competicion_nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destinatario</Label>
                  <Input
                    placeholder='Nombre de escuela o "Todas"'
                    value={form.school_name}
                    onChange={e => setForm({ ...form, school_name: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">Escribe "Todas" para que todas las escuelas puedan verlo</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Input
                  placeholder="Información adicional..."
                  value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Archivo *</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setFileInput(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <Button type="submit" disabled={uploading || !fileInput} className="gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Subiendo..." : "Subir documento"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Documents list */}
      {visibleDocs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {isAdmin ? "No hay documentos subidos aún." : "No hay documentos disponibles para tu escuela."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {visibleDocs.length} documento{visibleDocs.length !== 1 ? "s" : ""}
          </p>
          {visibleDocs.map(doc => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.document_name || "Documento"}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{doc.competicion_nombre}</Badge>
                    {isAdmin && doc.school_name && (
                      <Badge variant="secondary" className="text-[10px]">{doc.school_name}</Badge>
                    )}
                    {doc.fecha && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(doc.fecha), "dd MMM yyyy", { locale: es })}
                      </span>
                    )}
                  </div>
                  {doc.notas && <p className="text-xs text-muted-foreground mt-1">{doc.notas}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <a href={doc.document_url} download={doc.document_name}>
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </a>
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(doc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
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