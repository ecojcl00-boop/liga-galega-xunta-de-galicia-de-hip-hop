import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function deleteAll(entity, records) {
  for (const r of records) {
    await entity.delete(r.id);
    await sleep(80);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [regs, ligaResultados, ligaComps] = await Promise.all([
      base44.asServiceRole.entities.Registration.filter({ is_simulacro: true }, "-created_date", 1000),
      base44.asServiceRole.entities.LigaResultado.filter({ is_simulacro: true }, "-created_date", 2000),
      base44.asServiceRole.entities.LigaCompeticion.filter({ is_simulacro: true }, "-created_date", 100),
    ]);

    console.log(`[INFO] Cleanup simulacro: ${regs.length} regs, ${ligaResultados.length} resultados, ${ligaComps.length} comps`);

    await Promise.all([
      deleteAll(base44.asServiceRole.entities.Registration, regs),
      deleteAll(base44.asServiceRole.entities.LigaResultado, ligaResultados),
      deleteAll(base44.asServiceRole.entities.LigaCompeticion, ligaComps),
    ]);

    console.log(`[INFO] Cleanup done`);
    return Response.json({
      success: true,
      deleted: {
        registrations: regs.length,
        liga_resultados: ligaResultados.length,
        liga_competiciones: ligaComps.length,
      }
    });
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});