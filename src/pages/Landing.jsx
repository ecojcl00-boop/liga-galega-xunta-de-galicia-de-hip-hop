import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Shield, School, ChevronRight, Music } from "lucide-react";

export default function Landing() {
  // If already logged in, redirect based on role
  useEffect(() => {
    base44.auth.me()
      .then((user) => {
        if (!user) return;
        const dest = user.role === "admin"
          ? createPageUrl("Dashboard")
          : createPageUrl("PortalEscuela");
        window.location.replace(dest);
      })
      .catch(() => {});
  }, []);

  // Read ?next= param to pass through after login
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || createPageUrl("Dashboard");

  const handleLogin = () => {
    base44.auth.redirectToLogin(next);
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] flex flex-col items-center justify-center p-4">
      {/* Branding */}
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
          <Music className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          HIPHOP<span className="text-primary">GDT</span>
        </h1>
        <p className="text-[hsl(0,0%,55%)] text-sm mt-2 max-w-xs">
          Galician Dance Tour — Plataforma de gestión de competiciones
        </p>
      </div>

      {/* Two access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">

        {/* Admin */}
        <button
          onClick={handleLogin}
          className="group text-left rounded-2xl border border-[hsl(0,0%,18%)] bg-[hsl(0,0%,8%)] p-6 hover:border-primary/60 hover:bg-[hsl(0,0%,10%)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <ChevronRight className="w-5 h-5 text-[hsl(0,0%,35%)] group-hover:text-primary transition-colors mt-1" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Administrador</h2>
          <ul className="space-y-1">
            {[
              "Gestión de todas las escuelas y grupos",
              "Control de inscripciones y competiciones",
              "Importación de resultados y puntuaciones",
              "Actas de jueces y documentos",
              "Panel de usuarios y roles",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-[hsl(0,0%,55%)]">
                <span className="text-primary mt-0.5 shrink-0">·</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-2 text-primary text-sm font-semibold">
            Acceder como administrador
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        {/* School */}
        <button
          onClick={handleLogin}
          className="group text-left rounded-2xl border border-[hsl(0,0%,18%)] bg-[hsl(0,0%,8%)] p-6 hover:border-[hsl(316,60%,70%)]/40 hover:bg-[hsl(0,0%,10%)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,22%)] flex items-center justify-center">
              <School className="w-5 h-5 text-[hsl(0,0%,70%)]" />
            </div>
            <ChevronRight className="w-5 h-5 text-[hsl(0,0%,35%)] group-hover:text-[hsl(0,0%,60%)] transition-colors mt-1" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Escuelas</h2>
          <ul className="space-y-1">
            {[
              "Consulta tus grupos y participantes",
              "Gestiona tus inscripciones a competiciones",
              "Descarga tus actas de jueces",
              "Sigue el ranking general de la liga",
              "Resultados de tus grupos",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-[hsl(0,0%,55%)]">
                <span className="text-[hsl(0,0%,45%)] mt-0.5 shrink-0">·</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-2 text-[hsl(0,0%,70%)] text-sm font-semibold">
            Acceder como escuela
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      <p className="mt-8 text-xs text-[hsl(0,0%,30%)] text-center max-w-xs">
        Ambos accesos usan el mismo botón de inicio de sesión. El sistema te redirigirá automáticamente según tu rol.
      </p>
    </div>
  );
}