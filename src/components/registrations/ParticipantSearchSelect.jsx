import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Search, X } from "lucide-react";

export default function ParticipantSearchSelect({ allGroups = [], onSelectParticipant, onCancel }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Extract all participants from all groups
  const allParticipants = useMemo(() => {
    const participants = [];
    allGroups.forEach(group => {
      if (group.participants && Array.isArray(group.participants)) {
        group.participants.forEach(p => {
          participants.push({
            ...p,
            group_id: group.id,
            group_name: group.name,
            school_name: group.school_name,
            category: group.category,
          });
        });
      }
    });
    return participants;
  }, [allGroups]);

  // Filter participants by search query
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return allParticipants.filter(p =>
      p.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 15); // Limit to 15 results
  }, [searchQuery, allParticipants]);

  return (
    <div className="space-y-3 border rounded-xl p-4 bg-muted/10">
      <div className="space-y-2">
        <Label htmlFor="searchParticipant">Buscar participante existente</Label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            id="searchParticipant"
            placeholder="Escribe nombre para buscar..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
      </div>

      {searchQuery.trim() && filteredParticipants.length === 0 && (
        <p className="text-xs text-muted-foreground px-2 py-1">No se encontraron participantes</p>
      )}

      {filteredParticipants.length > 0 && (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {filteredParticipants.map((participant, idx) => (
            <button
              key={idx}
              onClick={() => onSelectParticipant(participant)}
              className="w-full text-left px-3 py-2 rounded-lg bg-card hover:bg-accent transition-colors border border-transparent hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{participant.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {participant.school_name} • {participant.category}
                  </div>
                  {participant.birth_date && (
                    <div className="text-xs text-muted-foreground">Nac: {participant.birth_date}</div>
                  )}
                </div>
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              </div>
            </button>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onCancel} className="w-full gap-2">
        <X className="w-3.5 h-3.5" /> Cancelar búsqueda
      </Button>
    </div>
  );
}