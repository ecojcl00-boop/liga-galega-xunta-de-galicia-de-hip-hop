import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, Trophy, Users, Loader2 } from "lucide-react";
import GroupEditor from "./GroupEditor";

const STEPS = ["Competición", "Grupos", "Revisar", "Confirmar"];

export default function ReRegistrationWizard({ user, schoolName, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [competition, setCompetition] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [groupEdits, setGroupEdits] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions_open"],
    queryFn: () => base44.entities.Competition.filter({ registration_open: true }),
  });

  const { data: myGroups = [] } = useQuery({
    queryKey: ["my_groups", schoolName],
    queryFn: () => base44.entities.Group.filter({ school_name: schoolName }),
    enabled: !!schoolName,
  });

  // All known participants for this school (flattened, deduped by name)
  const allSchoolParticipants = useMemo(() => {
    const seen = new Set();
    const result = [];
    myGroups.forEach(g => {
      (g.participants || []).forEach(p => {
        const key = p.name?.toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          result.push({ name: p.name, birth_date: p.birth_date || "" });
        }
      });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [myGroups]);

  // Group myGroups by category
  const groupsByCategory = useMemo(() => {
    const map = {};
    myGroups.forEach(g => {
      const cat = g.category || "Sin categoría";
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    });
    return map;
  }, [myGroups]);

  function initEditsForGroups(groupIds) {
    const edits = {};
    groupIds.forEach(id => {
      if (groupEdits[id]) {
        edits[id] = groupEdits[id];
      } else {
        const group = myGroups.find(g => g.id === id);
        if (group) {
          edits[id] = {
            participants: (group.participants || []).map(p => ({
              name: p.name,
              birth_date: p.birth_date || "",
              included: true,
              isNew: false,
            })),
          };
        }
      }
    });
    return edits;
  }

  function handleProceedToEdit() {
    setGroupEdits(initEditsForGroups(selectedGroupIds));
    setStep(2);
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      for (const groupId of selectedGroupIds) {
        const group = myGroups.find(g => g.id === groupId);
        const edit = groupEdits[groupId];
        if (!group || !edit) continue;

        const finalParticipants = edit.participants.filter(p => p.included);
        const newParticipants = edit.participants.filter(p => p.isNew);

        // Save new participants to Group entity
        if (newParticipants.length > 0) {
          const existingNames = new Set((group.participants || []).map(p => p.name?.toLowerCase().trim()));
          const toAdd = newParticipants.filter(p => !existingNames.has(p.name?.toLowerCase().trim()));
          if (toAdd.length > 0) {
            const updatedParticipants = [
              ...(group.participants || []),
              ...toAdd.map(p => ({ name: p.name, birth_date: p.birth_date })),
            ];
            await base44.entities.Group.update(groupId, { participants: updatedParticipants });
          }
        }

        // Create Registration for this competition
        await base44.entities.Registration.create({
          competition_id: competition.id,
          competition_name: competition.name,
          group_id: groupId,
          group_name: group.name,
          school_name: group.school_name,
          category: group.category,
          coach_name: group.coach_name || "",
          status: "confirmed",
          payment_status: "pending",
          participants_count: finalParticipants.length,
          participants_snapshot: finalParticipants.map(p => ({ name: p.name, birth_date: p.birth_date })),
        });
      }
      onSuccess();
    } catch (err) {
      setError("Ha ocurrido un error al guardar. Por favor, inténtalo de nuevo.");
      setSubmitting(false);
    }
  }

  const selectedGroups = myGroups.filter(g => selectedGroupIds.includes(g.id));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Nueva inscripción</h1>
          <p className="text-sm text-muted-foreground">{schoolName}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-foreground text-background" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 0 — Select competition */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Selecciona la competición</h2>
          {competitions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay competiciones abiertas en este momento.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {competitions.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCompetition(c); setStep(1); }}
                  className="w-full text-left border-2 rounded-xl p-4 transition-all hover:border-primary border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.date && new Date(c.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                        {c.location && ` · ${c.location}`}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 1 — Select groups */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">Selecciona los grupos a inscribir</h2>
            <p className="text-sm text-muted-foreground mt-1">Competición: <span className="font-medium text-foreground">{competition?.name}</span></p>
          </div>
          {myGroups.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No hay grupos registrados para tu escuela.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupsByCategory).map(([cat, catGroups]) => (
                <Card key={cat}>
                  <CardHeader className="pb-2 pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat}</p>
                  </CardHeader>
                  <CardContent className="space-y-1 pt-0">
                    {catGroups.map(g => (
                      <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <Checkbox
                          checked={selectedGroupIds.includes(g.id)}
                          onCheckedChange={checked =>
                            setSelectedGroupIds(prev =>
                              checked ? [...prev, g.id] : prev.filter(id => id !== g.id)
                            )
                          }
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{g.participants?.length || 0} participantes registrados</p>
                        </div>
                      </label>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>Volver</Button>
            <Button onClick={handleProceedToEdit} disabled={selectedGroupIds.length === 0} className="flex-1">
              Continuar con {selectedGroupIds.length} grupo{selectedGroupIds.length !== 1 ? "s" : ""}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — Edit group participants */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">Revisa y ajusta los participantes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Puedes excluir o añadir participantes para esta competición. Los datos originales no se modifican.
            </p>
          </div>
          <div className="space-y-4">
            {selectedGroups.map(group => {
              const edit = groupEdits[group.id] || { participants: [] };
              const includedCount = edit.participants.filter(p => p.included).length;
              return (
                <Card key={group.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      {group.name}
                      <span className="text-sm font-normal text-muted-foreground">· {group.category}</span>
                      <Badge variant="secondary" className="ml-auto">{includedCount} participantes</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GroupEditor
                      group={group}
                      allSchoolParticipants={allSchoolParticipants}
                      edits={edit}
                      onChange={newEdit => setGroupEdits(prev => ({ ...prev, [group.id]: newEdit }))}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Volver</Button>
            <Button onClick={() => setStep(3)} className="flex-1">Ver resumen <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* STEP 3 — Summary & confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">Confirmación de inscripción</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Competición: <span className="font-medium text-foreground">{competition?.name}</span>
            </p>
          </div>
          <div className="space-y-4">
            {selectedGroups.map(group => {
              const edit = groupEdits[group.id] || { participants: [] };
              const included = edit.participants.filter(p => p.included);
              return (
                <Card key={group.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {group.name}
                      <span className="font-normal text-muted-foreground">· {group.category}</span>
                      <Badge variant="secondary" className="ml-auto">{included.length} participantes</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {included.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                        {included.map((p, i) => (
                          <p key={i} className="text-sm truncate flex items-center gap-1">
                            {p.name}
                            {p.isNew && <span className="text-xs text-primary font-medium">(nuevo)</span>}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin participantes incluidos</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>Volver a editar</Button>
            <Button onClick={handleConfirm} disabled={submitting} className="flex-1">
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
              ) : (
                <><Check className="w-4 h-4" />Confirmar inscripción</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}