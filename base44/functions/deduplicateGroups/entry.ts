import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function nd(str = "") {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Load all groups
  const allGroups = await base44.asServiceRole.entities.Group.list("name", 2000);
  console.log(`[INFO] Total groups loaded: ${allGroups.length}`);

  // Build dedup map: normalized key → list of groups
  const byKey = new Map();
  for (const g of allGroups) {
    const key = `${nd(g.name)}|${nd(g.school_name || "")}|${nd(g.category || "")}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(g);
  }

  const toDelete = [];
  let kept = 0;

  for (const [key, groups] of byKey.entries()) {
    if (groups.length === 1) {
      kept++;
      continue;
    }
    // Sort ascending by created_date — oldest first (keep it)
    groups.sort((a, b) => {
      const da = a.created_date ? new Date(a.created_date).getTime() : 0;
      const db = b.created_date ? new Date(b.created_date).getTime() : 0;
      return da - db;
    });
    kept++;
    for (let i = 1; i < groups.length; i++) {
      toDelete.push(groups[i]);
      console.log(`[DEDUP] Will delete: "${groups[i].name}" / "${groups[i].school_name}" / "${groups[i].category}" (id: ${groups[i].id}, created: ${groups[i].created_date})`);
    }
  }

  console.log(`[INFO] Groups to keep: ${kept}, to delete: ${toDelete.length}`);

  let deleted = 0;
  for (const g of toDelete) {
    await base44.asServiceRole.entities.Group.delete(g.id);
    deleted++;
    console.log(`[INFO] Deleted group id: ${g.id} ("${g.name}")`);
    await delay(350);
  }

  return Response.json({
    success: true,
    totalBefore: allGroups.length,
    deleted,
    totalAfter: allGroups.length - deleted,
  });
});
