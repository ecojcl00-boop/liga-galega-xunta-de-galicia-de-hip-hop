import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data, old_data } = body;

    if (!data) {
      return Response.json({ skipped: true, reason: "no data in payload" });
    }

    // Only act if status actually changed
    if (!old_data || old_data.status === data.status) {
      return Response.json({ skipped: true, reason: "no status change" });
    }

    // Look up group to get coach email
    let coachEmail = null;
    if (data.group_id) {
      const groups = await base44.asServiceRole.entities.Group.filter({ id: data.group_id });
      coachEmail = groups[0]?.coach_email;
    }

    if (!coachEmail || !coachEmail.includes("@")) {
      return Response.json({ skipped: true, reason: "no valid coach email found for group" });
    }

    const statusLabels = {
      pending:   "Pendiente de revisión ⏳",
      confirmed: "Confirmada ✅",
      complete:  "Completada 🏆",
      rejected:  "Rechazada ❌",
      cancelled: "Cancelada",
    };

    const newLabel = statusLabels[data.status] || data.status;
    const oldLabel = statusLabels[old_data.status] || old_data.status;

    const body_text = [
      `Hola,`,
      ``,
      `El estado de tu inscripción ha sido actualizado por el administrador.`,
      ``,
      `📋 Grupo: ${data.group_name}`,
      `🏆 Competición: ${data.competition_name}`,
      `📁 Categoría: ${data.category || "—"}`,
      `🏫 Escuela: ${data.school_name}`,
      ``,
      `Estado anterior: ${oldLabel}`,
      `Nuevo estado: ${newLabel}`,
      data.rejection_reason ? `\n⚠️ Motivo: ${data.rejection_reason}` : "",
      ``,
      `Si tienes alguna duda, contacta con el administrador de HipHop Galician Dance Tour.`,
      ``,
      `HipHop Galician Dance Tour`,
    ].filter(l => l !== undefined).join("\n");

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: "HipHop Galician Dance Tour",
      to: coachEmail,
      subject: `[HipHop GDT] Inscripción actualizada: ${data.group_name}`,
      body: body_text,
    });

    return Response.json({ sent: true, to: coachEmail, newStatus: data.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});