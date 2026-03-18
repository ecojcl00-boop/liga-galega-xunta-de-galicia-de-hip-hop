import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  // DESACTIVADO: Notificaciones de cambio de estado eliminadas para reducir consumo de emails
  // Las escuelas pueden revisar el estado en su panel
  return Response.json({ 
    skipped: true, 
    reason: "Status change email notifications disabled to reduce email credits usage" 
  });
});