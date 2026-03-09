import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data } = body;

    if (!data) {
      return Response.json({ skipped: true, reason: "no data in payload" });
    }

    // Get all admin users to notify
    const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
    const adminEmails = admins.map(u => u.email).filter(e => e && e.includes("@"));

    if (adminEmails.length === 0) {
      return Response.json({ skipped: true, reason: "no admin users found" });
    }

    const body_text = [
      `Hola,`,
      ``,
      `Se ha recibido una nueva inscripción y está pendiente de revisión.`,
      ``,
      `📋 Grupo: ${data.group_name}`,
      `🏆 Competición: ${data.competition_name}`,
      `📁 Categoría: ${data.category || "—"}`,
      `🏫 Escuela: ${data.school_name}`,
      `👤 Entrenador: ${data.coach_name || "—"}`,
      `👥 Participantes: ${data.participants_count ?? (data.participants?.length ?? "—")}`,
      ``,
      `Accede al panel de administración para confirmar o gestionar esta inscripción.`,
      ``,
      `HipHop Galician Dance Tour`,
    ].join("\n");

    const results = [];
    for (const email of adminEmails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: "HipHop Galician Dance Tour",
        to: email,
        subject: `[HipHop GDT] Nueva inscripción: ${data.group_name} — ${data.school_name}`,
        body: body_text,
      });
      results.push(email);
    }

    return Response.json({ sent: true, to: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});