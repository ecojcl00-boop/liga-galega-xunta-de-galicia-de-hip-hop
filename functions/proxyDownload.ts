import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function guessMimeType(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  const types = {
    pdf:   'application/pdf',
    doc:   'application/msword',
    docx:  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pages: 'application/x-iwork-pages-sffpages',
    mp3:   'audio/mpeg',
    wav:   'audio/wav',
    m4a:   'audio/mp4',
    aac:   'audio/aac',
    ogg:   'audio/ogg',
    mp4:   'video/mp4',
    xlsx:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:   'application/vnd.ms-excel',
    png:   'image/png',
    jpg:   'image/jpeg',
    jpeg:  'image/jpeg',
  };
  return types[ext] || 'application/octet-stream';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, filename } = await req.json();
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      return Response.json({ error: `Error al obtener el archivo: ${fileRes.status}` }, { status: 502 });
    }

    const contentType = fileRes.headers.get('content-type') || guessMimeType(filename || '');
    const buffer = await fileRes.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Convert to base64 in chunks (avoids call stack overflow on large files)
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    return Response.json({ data: base64, contentType, filename: filename || 'archivo' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});