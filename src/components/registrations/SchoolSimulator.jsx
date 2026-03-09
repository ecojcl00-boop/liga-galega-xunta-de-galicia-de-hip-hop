import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import SchoolView from "./SchoolView";

export default function SchoolSimulator({ simulatedSchool, onExit, allGroups, competitions, registrations }) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky amber simulation banner */}
      <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2.5 flex items-center justify-between gap-4 shadow-md">
        <span className="text-sm font-semibold flex items-center gap-2">
          ⚠️ MODO SIMULACIÓN — Estás viendo la app como la escuela: <strong>{simulatedSchool}</strong>
          <span className="font-normal opacity-80 hidden sm:inline">· Esta vista no afecta datos ni permisos reales.</span>
        </span>
        <Button
          size="sm"
          onClick={onExit}
          className="gap-2 bg-amber-700 hover:bg-amber-800 text-white shrink-0 border-0"
        >
          <X className="w-4 h-4" /> Salir de simulación
        </Button>
      </div>

      {/* School view — filtered to simulated school only */}
      <SchoolView
        user={{
          email: `simulator@${simulatedSchool.toLowerCase().replace(/\s+/g, "")}.local`,
          full_name: "Simulador",
          role: "user",
          school_name: simulatedSchool,
        }}
        competitions={competitions}
        allGroups={allGroups}
        registrations={registrations}
      />
    </div>
  );
}