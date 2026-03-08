import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, Database } from "lucide-react";

// ─── Normalización de categorías ────────────────────────────────────────────
const VALID_CATEGORIES = [
  "Mini Individual A", "Mini Individual B", "Individual",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Baby", "Infantil", "Junior", "Youth", "Absoluta", "Premium",
  "Mega Crew",
];

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeCategory(raw) {
  if (!raw) return null;
  const clean = removeDiacritics(raw.trim()).toLowerCase().replace(/\s+/g, " ");
  const map = {
    "mini individual a": "Mini Individual A",
    "mini individual b": "Mini Individual B",
    "individual": "Individual",
    "mini parejas a": "Mini Parejas A",
    "mini parejas b": "Mini Parejas B",
    "parejas": "Parejas",
    "baby": "Baby",
    "infantil": "Infantil",
    "junior": "Junior",
    "youth": "Youth",
    "absoluta": "Absoluta",
    "premium": "Premium",
    "mega crew": "Mega Crew",
    "megacrew": "Mega Crew",
    "mega-crew": "Mega Crew",
  };
  return map[clean] || null;
}

// ─── Parser de Excel vía LLM ─────────────────────────────────────────────────
async function parseExcelWithLLM(fileUrl) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Analiza este archivo Excel de inscripciones de baile HipHop.
    
El archivo tiene una fila por inscripción con este formato HORIZONTAL:
- Columna 1: Fecha de inscripción
- Columna 2: Nombre del grupo / nombre artístico
- Columna 3: Nombre de la escuela
- Columna 4: Categoría
- Columna 5: Nombre del entrenador
- Columna 6: Email del entrenador
- Columna 7: Teléfono del entrenador
- Columnas 8 en adelante: participantes en pares [Nombre, Fecha de nacimiento], [Nombre2, FechaNacimiento2], etc. hasta el final de la fila

IMPORTANTE: el número de participantes es variable por fila. Itera de dos en dos desde la columna 8 hasta que no haya más datos en esa fila.

Devuelve un JSON con array "rows". Cada elemento tiene:
- registration_date: string (fecha como aparece)
- group_name: string
- school_name: string
- category: string (exactamente como aparece)
- coach_name: string
- coach_email: string
- coach_phone: string
- participants: array de objetos {name: string, birth_date: string} (pueden ser 1 o muchos)

Extrae TODAS las filas con datos. No omitas ninguna fila. Si una celda está vacía, usa cadena vacía "".`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              registration_date: { type: "string" },
              group_name: { type: "string" },
              school_name: { type: "string" },
              category: { type: "string" },
              coach_name: { type: "string" },
              coach_email: { type: "string" },
              coach_phone: { type: "string" },
              participants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    birth_date: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    model: "claude_sonnet_4_6"
  });
  return res?.rows || [];
}

// ─── Lógica principal de importación ────────────────────────────────────────
async function runImport(rows, competitionName, competitionId) {
  const log = {
    schoolsCreated: 0, schoolsUpdated: 0,
    participantsCreated: 0, participantsExisting: 0,
    groupsCreated: 0, groupsUpdated: 0,
    registrationsCreated: 0,
    warnings: [], errors: [],
  };

  // Cargar datos existentes una sola vez
  const [existingSchools, existingGroups, existingRegistrations] = await Promise.all([
    base44.entities.School.list("name", 500),
    base44.entities.Group.list("name", 500),
    base44.entities.Registration.list("-created_date", 500),
  ]);

  // Mapas para búsqueda rápida (case-insensitive)
  const schoolMap = new Map(existingSchools.map(s => [removeDiacritics(s.name.toLowerCase()), s]));
  const groupMap = new Map(existingGroups.map(g => [
    `${removeDiacritics(g.name.toLowerCase())}|${removeDiacritics((g.school_name || "").toLowerCase())}|${removeDiacritics((g.category || "").toLowerCase())}`,
    g
  ]));
  const regMap = new Map(existingRegistrations.map(r => [
    `${r.group_id || ""}|${r.competition_id || ""}`,
    r
  ]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel rows start at 2

    // Validar nombre de grupo
    if (!row.group_name || row.group_name.trim() === "") {
      log.errors.push(`Fila ${rowNum}: Nombre de grupo vacío — fila omitida`);
      continue;
    }

    // Validar/normalizar categoría
    const category = normalizeCategory(row.category);
    if (!category) {
      log.errors.push(`Fila ${rowNum} (${row.group_name}): Categoría no reconocida "${row.category}" — fila omitida`);
      continue;
    }

    const schoolNameClean = (row.school_name || "").trim();
    const schoolKey = removeDiacritics(schoolNameClean.toLowerCase());

    // ── Paso 1: Escuela ──────────────────────────────────────────────────────
    let school = schoolMap.get(schoolKey);
    if (!school) {
      school = await base44.entities.School.create({
        name: schoolNameClean,
        email: row.coach_email || "",
        phone: row.coach_phone || "",
      });
      schoolMap.set(schoolKey, school);
      log.schoolsCreated++;
    } else {
      // Actualizar datos vacíos
      const updates = {};
      if (!school.email && row.coach_email) updates.email = row.coach_email;
      if (!school.phone && row.coach_phone) updates.phone = row.coach_phone;
      if (Object.keys(updates).length > 0) {
        await base44.entities.School.update(school.id, updates);
        Object.assign(school, updates);
        log.schoolsUpdated++;
      }
    }

    // ── Paso 2: Participantes ────────────────────────────────────────────────
    const participants = [];
    for (const p of (row.participants || [])) {
      const pName = (p.name || "").trim();
      if (!pName) continue;
      if (!p.birth_date) {
        log.warnings.push(`Fila ${rowNum} (${row.group_name}): Participante "${pName}" sin fecha de nacimiento`);
      }
      participants.push({ name: pName, birth_date: p.birth_date || "" });
      log.participantsCreated++;
    }

    // ── Paso 3: Grupo ────────────────────────────────────────────────────────
    const groupKey = `${removeDiacritics(row.group_name.trim().toLowerCase())}|${schoolKey}|${removeDiacritics(category.toLowerCase())}`;
    let group = groupMap.get(groupKey);

    if (!group) {
      group = await base44.entities.Group.create({
        name: row.group_name.trim(),
        school_name: schoolNameClean,
        school_id: school.id,
        category,
        coach_name: row.coach_name || "",
        coach_email: row.coach_email || "",
        coach_phone: row.coach_phone || "",
        participants,
      });
      groupMap.set(groupKey, group);
      log.groupsCreated++;
    } else {
      // Fusionar participantes sin duplicar por nombre
      const existingNames = new Set((group.participants || []).map(p => removeDiacritics(p.name.toLowerCase())));
      const newParticipants = participants.filter(p => !existingNames.has(removeDiacritics(p.name.toLowerCase())));
      const mergedParticipants = [...(group.participants || []), ...newParticipants];

      const updates = { participants: mergedParticipants };
      if (!group.coach_name && row.coach_name) updates.coach_name = row.coach_name;
      if (!group.coach_email && row.coach_email) updates.coach_email = row.coach_email;
      if (!group.coach_phone && row.coach_phone) updates.coach_phone = row.coach_phone;

      await base44.entities.Group.update(group.id, updates);
      Object.assign(group, updates);
      log.groupsUpdated++;
      if (newParticipants.length > 0) log.participantsCreated += newParticipants.length;
      if (participants.length - newParticipants.length > 0) log.participantsExisting += participants.length - newParticipants.length;
    }

    // ── Paso 4: Inscripción ──────────────────────────────────────────────────
    if (competitionId) {
      const regKey = `${group.id}|${competitionId}`;
      const existingReg = regMap.get(regKey);
      if (!existingReg) {
        const newReg = await base44.entities.Registration.create({
          competition_id: competitionId,
          competition_name: competitionName,
          group_id: group.id,
          group_name: group.name,
          school_name: schoolNameClean,
          category,
          coach_name: row.coach_name || "",
          status: "confirmed",
          payment_status: "pending",
          participants_count: participants.length,
        });
        regMap.set(regKey, newReg);
        log.registrationsCreated++;
      }
    }
  }

  return log;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function ImportInscripciones() {
  const [file, setFile] = useState(null);
  const [competitionName, setCompetitionName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const { data: competitions = [] } = React.useMemo(() => ({ data: [] }), []);
  const [competitions2, setCompetitions2] = React.useState([]);
  const [selectedCompId, setSelectedCompId] = React.useState("");

  React.useEffect(() => {
    base44.entities.Competition.list("-date", 50).then(setCompetitions2).catch(() => {});
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setProgress("Subiendo archivo...");

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setProgress("Extrayendo datos del Excel con IA (puede tardar unos segundos)...");
    const rows = await parseExcelWithLLM(file_url);

    if (!rows || rows.length === 0) {
      setResult({ error: "No se pudieron extraer filas del archivo. Verifica que el formato sea correcto." });
      setImporting(false);
      return;
    }

    setProgress(`Procesando ${rows.length} filas...`);
    const selectedComp = competitions2.find(c => c.id === selectedCompId);
    const log = await runImport(rows, selectedComp?.name || competitionName, selectedCompId || null);

    setResult({ log, totalRows: rows.length });
    setProgress("");
    setImporting(false);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" /> Importar Inscripciones desde Excel
        </h2>
        <p className="text-sm text-muted-foreground">
          Sube el Excel de inscripciones con formato horizontal. Se crearán/actualizarán automáticamente escuelas, grupos y participantes. Operación segura: nunca borra datos existentes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Competición (opcional)</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedCompId}
              onChange={e => setSelectedCompId(e.target.value)}
            >
              <option value="">Sin vincular a competición</option>
              {competitions2.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">O nombre de competición manual</label>
            <Input
              placeholder="Ej: Marín 2026"
              value={competitionName}
              onChange={e => setCompetitionName(e.target.value)}
              disabled={!!selectedCompId}
            />
          </div>
        </div>

        <div
          onClick={() => !importing && fileRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => setFile(e.target.files[0])}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-1">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">Haz clic para cambiar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Excel de inscripciones (.xlsx, .xls, .csv)</p>
              <p className="text-xs text-muted-foreground">Formato horizontal: grupo, escuela, categoría, entrenador, participantes...</p>
            </div>
          )}
        </div>

        <Button onClick={handleImport} disabled={!file || importing} className="w-full">
          {importing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || "Importando..."}</>
            : <><Database className="w-4 h-4 mr-2" />Importar Inscripciones</>}
        </Button>

        {importing && progress && (
          <div className="text-sm text-muted-foreground text-center animate-pulse">{progress}</div>
        )}

        {result?.error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{result.error}</span>
          </div>
        )}

        {result?.log && (
          <div className="space-y-3">
            <div className="font-semibold text-sm">Resumen de importación — {result.totalRows} filas procesadas</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Escuelas nuevas", value: result.log.schoolsCreated, icon: "✅" },
                { label: "Escuelas actualizadas", value: result.log.schoolsUpdated, icon: "🔄" },
                { label: "Grupos nuevos", value: result.log.groupsCreated, icon: "✅" },
                { label: "Grupos actualizados", value: result.log.groupsUpdated, icon: "🔄" },
                { label: "Participantes añadidos", value: result.log.participantsCreated, icon: "✅" },
                { label: "Participantes existentes", value: result.log.participantsExisting, icon: "🔄" },
                { label: "Inscripciones", value: result.log.registrationsCreated, icon: "✅" },
                { label: "Advertencias", value: result.log.warnings.length, icon: "⚠️" },
              ].map(item => (
                <div key={item.label} className="bg-muted/40 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold">{item.icon} {item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>

            {result.log.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
                <div className="font-medium text-xs text-yellow-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Advertencias ({result.log.warnings.length})
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {result.log.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-yellow-700">{w}</div>
                  ))}
                </div>
              </div>
            )}

            {result.log.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="font-medium text-xs text-red-800 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Errores ({result.log.errors.length})
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {result.log.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-700">{e}</div>
                  ))}
                </div>
              </div>
            )}

            {result.log.errors.length === 0 && result.log.warnings.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4" /> Importación completada sin errores
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}