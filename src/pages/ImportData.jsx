import React from "react";
import { useUser } from "@/components/UserContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Database, Trophy, Gavel, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImportInscripciones from "@/components/import/ImportInscripciones";
import ImportLigaJornada from "@/components/import/ImportLigaJornada";
import ImportActaJueces from "@/components/import/ImportActaJueces";

export default function ImportData() {
  const user = useUser();
  const navigate = useNavigate();

  // Admin-only: redirect non-admins to their portal
  if (user && user.role !== "admin") {
    navigate(createPageUrl("PortalEscuela"), { replace: true });
    return null;
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-12">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Importar Datos</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Solo administradores. Tres herramientas de importación independientes.
          </p>
        </div>
      </div>

      {/* ── Opción 1 ── */}
      <section className="space-y-4">
        <div className="flex items-start gap-3 pb-3 border-b">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 mt-0.5">
            1
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Importar inscripciones desde Excel
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sube el .xlsx de inscripciones. Selecciona la competición antes de procesar.
              Nunca borra datos existentes — solo añade o actualiza.
            </p>
          </div>
        </div>
        <ImportInscripciones />
      </section>

      {/* ── Opción 2 ── */}
      <section className="space-y-4">
        <div className="flex items-start gap-3 pb-3 border-b">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 mt-0.5">
            2
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Importar resultados de jornada (liga)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sube el documento de resultados. Confirma el número de jornada antes de procesar.
              El ranking se recalcula automáticamente. No sobreescribe jornadas ya importadas.
            </p>
          </div>
        </div>
        <ImportLigaJornada />
      </section>

      {/* ── Opción 3 ── */}
      <section className="space-y-4">
        <div className="flex items-start gap-3 pb-3 border-b">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 mt-0.5">
            3
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" /> Subir puntuaciones de jueces
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Asigna el documento a una escuela y competición. Solo esa escuela lo verá en su portal privado.
            </p>
          </div>
        </div>
        <ImportActaJueces />
      </section>
    </div>
  );
}