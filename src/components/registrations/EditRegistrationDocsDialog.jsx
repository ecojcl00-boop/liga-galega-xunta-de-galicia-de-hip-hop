import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, FileText, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { downloadFile } from "@/components/utils/downloadFile";

function DocRow({ doc, onRemove }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{doc.name}</div>
          {doc.url && <div className="text-xs text-muted-foreground truncate">{doc.url.split("/").pop()}</div>}
        </div>
      </div>
      <button onClick={() => onRemove()} className="text-muted-foreground hover:text-destructive transition-colors ml-2">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function EditRegistrationDocsDialog({ open, onOpenChange, registration, onSuccess }) {
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState([]);
  const [addingDoc, setAddingDoc] = useState(false);
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (registration?.documents) {
      setDocuments(registration.documents || []);
    }
  }, [registration]);

  const updateMutation = useMutation({
    mutationFn: async (data) => base44.entities.Registration.update(registration.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal_registrations_all"] });
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const addDocument = async () => {
    if (!docName.trim() || !docFile) return;

    setUploading(true);
    try {
      const fileRes = await base44.integrations.Core.UploadFile({ file: docFile });
      const newDoc = { name: docName.trim(), url: fileRes.file_url };
      setDocuments([...documents, newDoc]);
      setDocName("");
      setDocFile(null);
      setAddingDoc(false);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error al subir el archivo. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (idx) => {
    setDocuments(documents.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    updateMutation.mutate({
      documents: documents,
    });
  };

  if (!registration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Actualizar documentos de inscripción</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-muted/20 border-muted">
            <CardContent className="pt-4 pb-3">
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Grupo:</span>
                  <span className="font-semibold">{registration.group_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Competición:</span>
                  <span className="font-semibold">{registration.competition_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Categoría:</span>
                  <Badge variant="outline" className="text-xs">{registration.category}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">
                Documentos ({documents.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal mt-1">
                Música, autorizaciones, permisos parentales, etc.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents.length === 0 && (
                <p className="text-xs text-muted-foreground px-1 py-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Sin documentos añadidos todavía
                </p>
              )}
              {documents.map((d, i) => (
                <DocRow key={i} doc={d} onRemove={() => removeDocument(i)} />
              ))}
              {addingDoc ? (
                <div className="border rounded-xl p-3 space-y-2 bg-muted/10">
                  <div className="space-y-2">
                    <Label htmlFor="docName" className="text-xs">Nombre del documento</Label>
                    <Input
                      id="docName"
                      placeholder="Ej: Música - HipHop Mix, Autorización parental"
                      value={docName}
                      onChange={e => setDocName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docFile" className="text-xs">Selecciona archivo</Label>
                    <Input
                      id="docFile"
                      type="file"
                      onChange={e => setDocFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={addDocument} 
                      disabled={!docName.trim() || !docFile || uploading}
                      className="flex-1 gap-2"
                    >
                      {uploading ? "Subiendo..." : <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Añadir
                      </>}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => { setAddingDoc(false); setDocName(""); setDocFile(null); }} 
                      className="flex-1"
                      disabled={uploading}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setAddingDoc(true)} 
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" /> Añadir documento
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}