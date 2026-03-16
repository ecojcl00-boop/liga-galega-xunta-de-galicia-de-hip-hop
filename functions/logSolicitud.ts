import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data } = payload;

    if (event.type === 'create') {
      await base44.asServiceRole.entities.LogSolicitudes.create({
        email: data.email,
        status: data.status,
        school_name: data.school_name || '',
        created_at: new Date().toISOString()
      });
      
      console.log(`Logged InvitacionPendiente creation for ${data.email}`);
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: 'Invalid event type' }, { status: 400 });
  } catch (error) {
    console.error('Log error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});