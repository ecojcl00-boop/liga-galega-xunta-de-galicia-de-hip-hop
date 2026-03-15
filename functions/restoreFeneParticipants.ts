import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Obtener todos los registros de FENE 2026
        const registrations = await base44.asServiceRole.entities.Registration.filter({
            competition_name: "FENE 2026"
        });

        console.log(`Found ${registrations.length} registrations for FENE 2026`);

        const results = {
            updated: [],
            notFound: [],
            errors: []
        };

        // Procesar cada registro con delay
        for (const reg of registrations) {
            try {
                const groupName = reg.group_name;
                const participants = reg.participants || [];

                // Buscar el grupo por group_id primero, si no existe por nombre
                let group = null;
                
                if (reg.group_id) {
                    try {
                        group = await base44.asServiceRole.entities.Group.get(reg.group_id);
                    } catch (e) {
                        // Si no existe por ID, buscar por nombre
                        const groups = await base44.asServiceRole.entities.Group.filter({ name: groupName });
                        if (groups.length > 0) {
                            group = groups[0];
                        }
                    }
                } else {
                    // Buscar por nombre
                    const groups = await base44.asServiceRole.entities.Group.filter({ name: groupName });
                    if (groups.length > 0) {
                        group = groups[0];
                    }
                }

                if (group) {
                    // Actualizar participantes
                    await base44.asServiceRole.entities.Group.update(group.id, {
                        participants: participants
                    });
                    
                    results.updated.push({
                        name: groupName,
                        id: group.id,
                        participantsCount: participants.length
                    });
                    
                    console.log(`✓ Updated ${groupName} with ${participants.length} participants`);
                } else {
                    results.notFound.push(groupName);
                    console.log(`✗ Group not found: ${groupName}`);
                }

                // Delay de 300ms entre cada actualización
                await delay(300);

            } catch (error) {
                results.errors.push({
                    name: reg.group_name,
                    error: error.message
                });
                console.error(`Error processing ${reg.group_name}:`, error.message);
            }
        }

        return Response.json({
            success: true,
            summary: {
                total: registrations.length,
                updated: results.updated.length,
                notFound: results.notFound.length,
                errors: results.errors.length
            },
            details: results
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});