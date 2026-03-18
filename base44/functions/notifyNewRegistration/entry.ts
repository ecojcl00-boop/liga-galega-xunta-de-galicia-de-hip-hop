import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  // DESACTIVADO: Esta función enviaba emails por cada grupo inscrito individualmente
  // Ahora los emails se envían solo al confirmar la inscripción completa desde el wizard
  return Response.json({ 
    skipped: true, 
    reason: "Email notifications disabled - emails now sent only on complete registration confirmation" 
  });
});