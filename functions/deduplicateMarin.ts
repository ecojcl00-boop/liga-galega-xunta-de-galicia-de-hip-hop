import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cargar todos los registros de MARÍN 2026
    const allRegs = await base44.asServiceRole.entities.Registration.filter({
        competition_name: "MARÍN 2026"
    });

    console.log(`Total registros MARÍN 2026: ${allRegs.length}`);

    // Agrupar por group_id si existe, si no por group_name normalizado
    const byGroupId = new Map();

    for (const reg of allRegs) {
        const key = reg.group_id
            ? `id:${reg.group_id}`
            : `name:${String(reg.group_name || "").trim().toLowerCase()}`;
        if (!byGroupId.has(key)) {
            byGroupId.set(key, []);
        }
        byGroupId.get(key).push(reg);
    }

    const toDelete = [];
    const kept = [];

    for (const [key, regs] of byGroupId.entries()) {
        if (regs.length === 1) {
            kept.push(regs[0].id);
            continue;
        }
        // Ordenar por created_date ascendente → mantener el primero
        regs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        kept.push(regs[0].id);
        for (let i = 1; i < regs.length; i++) {
            toDelete.push(regs[i].id);
        }
    }

    console.log(`Únicos (a mantener): ${kept.length}`);
    console.log(`Duplicados (a eliminar): ${toDelete.length}`);

    if (req.method === 'GET') {
        // Solo preview, no eliminar
        return Response.json({
            total: allRegs.length,
            unique: kept.length,
            duplicates: toDelete.length,
            idsToDelete: toDelete
        });
    }

    // POST → eliminar duplicados
    let deleted = 0;
    for (const id of toDelete) {
        await base44.asServiceRole.entities.Registration.delete(id);
        deleted++;
    }

    return Response.json({
        success: true,
        totalBefore: allRegs.length,
        kept: kept.length,
        deleted
    });
});