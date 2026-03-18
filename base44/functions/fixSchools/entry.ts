import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Normalize to a stable key for deduplication: uppercase, no diacritics, trimmed, no trailing punctuation
function normalizeKey(name) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().trim()
    .replace(/[,.\-;:]+$/, "")
    .replace(/\s+/g, " ").trim();
}

// Normalize for loose comparison
function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function seqUpdates(entity, updates, delay = 380) {
  for (let i = 0; i < updates.length; i++) {
    await entity.update(updates[i].id, updates[i].data);
    if (i + 1 < updates.length) await sleep(delay);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const log = {
      schoolsOk: [],
      schoolsMerged: [],
      schoolsParticipantsUpdated: [],
      warnings: [],
      errors: [],
    };

    // ── Load all data in parallel ─────────────────────────────────────────────
    const [allSchools, allGroups, allRegs] = await Promise.all([
      base44.entities.School.list("name", 500),
      base44.entities.Group.list("name", 500),
      base44.entities.Registration.list("-created_date", 1000),
    ]);
    console.log(`[INFO] ${allSchools.length} schools, ${allGroups.length} groups, ${allRegs.length} regs`);

    // ── Phase 1: Identify duplicate schools ───────────────────────────────────
    const byNorm = new Map();
    for (const s of allSchools) {
      const key = normalizeKey(s.name);
      if (!byNorm.has(key)) byNorm.set(key, []);
      byNorm.get(key).push(s);
    }

    const nameToCanonical = new Map(); // nd(name) → canonical school object
    const canonicalSchools = [];
    const toDelete = [];

    for (const [, group] of byNorm.entries()) {
      if (group.length === 1) {
        canonicalSchools.push(group[0]);
        nameToCanonical.set(nd(group[0].name), group[0]);
        log.schoolsOk.push(group[0].name);
        continue;
      }

      // Pick canonical: most groups linked → then fewest trailing punct → then shortest name
      const counts = new Map(
        group.map(s => [s.id, allGroups.filter(g => nd(g.school_name || "") === nd(s.name)).length])
      );
      const sorted = [...group].sort((a, b) => {
        const diff = (counts.get(b.id) || 0) - (counts.get(a.id) || 0);
        if (diff !== 0) return diff;
        const aP = /[,.\-;:]$/.test(a.name.trim()) ? 1 : 0;
        const bP = /[,.\-;:]$/.test(b.name.trim()) ? 1 : 0;
        return aP - bP || a.name.length - b.name.length;
      });

      const canonical = sorted[0];
      const dups = sorted.slice(1);
      canonicalSchools.push(canonical);
      for (const s of group) nameToCanonical.set(nd(s.name), canonical);
      for (const d of dups) toDelete.push(d);

      log.schoolsMerged.push({
        canonical: canonical.name,
        discarded: dups.map(d => d.name),
        groupsFixed: 0,
        regsFixed: 0,
      });
    }

    // ── Phase 2: Reassign groups & registrations pointing to duplicate names ──
    const groupUpdates = [];
    const regUpdates = [];

    for (const dup of toDelete) {
      const canon = nameToCanonical.get(nd(dup.name));
      if (!canon) continue;
      const entry = log.schoolsMerged.find(m => m.discarded.includes(dup.name));

      const affectedGroups = allGroups.filter(g => nd(g.school_name || "") === nd(dup.name));
      for (const g of affectedGroups) {
        groupUpdates.push({ id: g.id, data: { school_name: canon.name, school_id: canon.id } });
        g.school_name = canon.name; g.school_id = canon.id; // mutate local for later phases
        if (entry) entry.groupsFixed++;
      }

      const affectedRegs = allRegs.filter(r => nd(r.school_name || "") === nd(dup.name));
      for (const r of affectedRegs) {
        regUpdates.push({ id: r.id, data: { school_name: canon.name } });
        r.school_name = canon.name;
        if (entry) entry.regsFixed++;
      }
    }

    console.log(`[INFO] Group reassignments: ${groupUpdates.length}, Reg reassignments: ${regUpdates.length}, Schools to delete: ${toDelete.length}`);

    if (groupUpdates.length > 0) {
      await seqUpdates(base44.entities.Group, groupUpdates, 400);
      await sleep(400);
    }
    if (regUpdates.length > 0) {
      await seqUpdates(base44.entities.Registration, regUpdates, 350);
      await sleep(400);
    }

    // Delete orphan duplicate school records
    for (const s of toDelete) {
      await base44.entities.School.delete(s.id);
      await sleep(200);
    }
    if (toDelete.length > 0) await sleep(300);

    // ── Phase 3: Count unique participants per canonical school ────────────────
    const schoolUpdates = [];
    const today = new Date().toISOString().split('T')[0];
    const snapshotData = [];

    for (const school of canonicalSchools) {
      const schoolGroups = allGroups.filter(g => nd(g.school_name || "") === nd(school.name));

      // Collect all participants across all groups of this school
      const allP = schoolGroups
        .flatMap(g => (g.participants || []))
        .map(p => ({ name: nd(p.name || ""), birth: String(p.birth_date || "").trim() }))
        .filter(p => p.name);

      // Warn: same normalized name but multiple different birth dates (both non-empty) → ambiguous
      const byName = new Map();
      for (const p of allP) {
        if (!byName.has(p.name)) byName.set(p.name, new Set());
        if (p.birth) byName.get(p.name).add(p.birth);
      }
      for (const [name, dates] of byName.entries()) {
        if (dates.size > 1) {
          log.warnings.push(`⚠️ CASO DUDOSO — ${school.name}: "${name}" aparece con ${dates.size} fechas distintas: ${[...dates].join(" / ")}`);
        }
      }

      // Deduplicate by (normalized_name, birth_date)
      const seen = new Set();
      let uniq = 0;
      for (const p of allP) {
        const key = `${p.name}|${p.birth}`;
        if (!seen.has(key)) { seen.add(key); uniq++; }
      }

      schoolUpdates.push({ id: school.id, data: { unique_participants: uniq } });
      log.schoolsParticipantsUpdated.push({
        school: school.name,
        groups: schoolGroups.length,
        totalEntries: allP.length,
        uniqueParticipants: uniq,
      });

      const mergeInfo = log.schoolsMerged.find(m => m.canonical === school.name);
      snapshotData.push({
        snapshot_date: today,
        school_name: school.name,
        groups_count: schoolGroups.length,
        unique_participants_count: uniq,
        schools_merged_from: mergeInfo?.discarded || [],
      });
    }

    // ── Phase 4: Persist unique_participants on each school ───────────────────
    if (schoolUpdates.length > 0) {
      await seqUpdates(base44.entities.School, schoolUpdates, 300);
      await sleep(300);
    }

    // ── Phase 5: Save snapshot ─────────────────────────────────────────────────
    if (snapshotData.length > 0) {
      await base44.entities.SnapshotEscuelas.bulkCreate(snapshotData);
    }

    console.log(`[INFO] Done — Ok: ${log.schoolsOk.length}, Merged: ${log.schoolsMerged.length}, Warnings: ${log.warnings.length}`);
    return Response.json({ success: true, log });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});