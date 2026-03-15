import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normName(str) {
    return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

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

    // Agrupar por group_name normalizado
    const byGroupName = new Map();

    for (const reg of allRegs) {
        const key = normName(reg.group_name);
        if (!byGroupName.has(key)) {
            byGroupName.set(key, []);
        }
        byGroupName.get(key).push(reg);
    }

    const toDelete = [];
    const kept = [];

    for (const [key, regs] of byGroupName.entries()) {
        if (regs.length === 1) {
            kept.push({ id: regs[0].id, name: regs[0].group_name });
            continue;
        }
        // Ordenar: primero los que tienen group_id (más completos), luego por fecha desc
        regs.sort((a, b) => {
            // Prioridad 1: tener group_id
            const aHasId = a.group_id ? 1 : 0;
            const bHasId = b.group_id ? 1 : 0;
            if (bHasId !== aHasId) return bHasId - aHasId;
            // Prioridad 2: más reciente
            return new Date(b.created_date) - new Date(a.created_date);
        });
        // Mantener el primero (más completo/más reciente)
        kept.push({ id: regs[0].id, name: regs[0].group_name });
        for (let i = 1; i < regs.length; i++) {
            toDelete.push({ id: regs[i].id, name: regs[i].group_name, created_date: regs[i].created_date });
        }
    }

    console.log(`Únicos (a mantener): ${kept.length}`);
    console.log(`Duplicados (a eliminar): ${toDelete.length}`);

    // Siempre ejecutar la eliminación
    let deleted = 0;
    for (const item of toDelete) {
        await base44.asServiceRole.entities.Registration.delete(item.id);
        deleted++;
        console.log(`Deleted: ${item.name} (${item.id}) created ${item.created_date}`);
    }

    return Response.json({
        success: true,
        totalBefore: allRegs.length,
        uniqueGroups: kept.length,
        deleted,
        totalAfter: allRegs.length - deleted
    });
});