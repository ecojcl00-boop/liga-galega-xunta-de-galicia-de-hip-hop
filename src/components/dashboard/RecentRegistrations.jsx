import React from "react";
import { Badge } from "@/components/ui/badge";

export default function RecentRegistrations({ registrations }) {
  if (!registrations || registrations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No hay inscripciones recientes
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {registrations.slice(0, 8).map((reg) => (
        <div
          key={reg.id}
          className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{reg.group_name}</p>
            <p className="text-xs text-muted-foreground truncate">{reg.school_name} · {reg.coach_name}</p>
          </div>
          <Badge variant="outline" className="ml-2 text-[10px] shrink-0">
            {reg.category}
          </Badge>
        </div>
      ))}
    </div>
  );
}