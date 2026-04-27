import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "../components/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Upload, Download, Calendar, School, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { downloadFile } from "../components/utils/downloadFile";

export default function JudgePanel() {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    school_name: "",
    competicion_nombre: "",
    fecha: "",
    notas: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch actas - admin ve todas, escuela solo las suyas
  const { data: actas = [], isLoading } = useQuery({
    queryKey: ["actas"],
    queryFn: async () => {
      const all = await base44.entities.ActaJueces.list("-created_date");
      if (isAdmin) return all;
      // Para escuelas, mostrar todos los documentos
      return all;
    },
  });

  // Fetch schools for admin dropdown
  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: () => base44.entities.School.filter({ is_active: true }, "name"),
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ActaJueces.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actas"] }),
  });

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      // Create acta record with exact school_name match
      await base44.entities.ActaJueces.create({
        school_name: formData.school_name.trim(), // Trim to avoid extra spaces
        competition_name: formData.competicion_nombre,
        fecha: formData.fecha,
        file_url: uploadResult.file_url,
        file_name: selectedFile.name,
        notas: formData.notas,
      });

      queryClient.invalidateQueries({ queryKey: ["actas"] });
      setShowUploadForm(false);
      setFormData({ school_name: "", competicion_nombre: "", fecha: "", notas: "" });
      setSelectedFile(null);
    } catch (error) {
      console.error("Error uploading:", error);
      alert("Error al subir el documento");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Panel de Jueces</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? `${actas.length} documentos subidos`
              : actas.length > 0
                ? `Tienes ${actas.length} documento${actas.length > 1 ? 's' : ''} disponible${actas.length > 1 ? 's' : ''}`
                : "No hay documentos disponibles aún"
            }
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowUploadForm(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Subir Acta
          </Button>
        )}
      </div>

      {actas.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>{isAdmin ? "No hay actas subidas aún." : "Tu escuela no tiene actas de jueces disponibles."}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {actas.map((acta) => (
            <Card key={acta.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{acta.competition_name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{acta.file_name}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(acta.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <School className="w-3.5 h-3.5" />
                    <span>{acta.school_name}</span>
                  </div>
                  {acta.fecha && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{format(new Date(acta.fecha), "dd MMM yyyy")}</span>
                    </div>
                  )}
                  {acta.notas && (
                    <p className="text-xs text-muted-foreground mt-2">{acta.notas}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => downloadFile(acta.file_url)}
                >
                  <Download className="w-3.5 h-3.5" /> Descargar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog - Admin only */}
      {isAdmin && (
        <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Subir Acta de Jueces</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Escuela (opcional)</Label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={formData.school_name}
                  onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                >
                  <option value="">Disponible para todos</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Competición *</Label>
                <Input
                  value={formData.competicion_nombre}
                  onChange={(e) => setFormData({ ...formData, competicion_nombre: e.target.value })}
                  placeholder="Ej: MARÍN 2026"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Documento *</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  placeholder="Notas adicionales (opcional)"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowUploadForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Subiendo..." : "Subir"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}