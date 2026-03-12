import { base44 } from "@/api/base44Client";

/**
 * Downloads a file through the backend proxy to avoid Chrome Safe Browsing warnings.
 * The backend fetches the file and streams it directly.
 */
export async function downloadFile(url, filename = "archivo") {
  if (!url || typeof url !== "string" || url.trim() === "") {
    alert("Este archivo no tiene URL disponible. Es posible que no se subió correctamente.");
    return;
  }
  const res = await base44.functions.invoke('proxyDownload', { url, filename });
  
  // The proxy now returns the file directly as a blob in res.data
  const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });

  const localUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = localUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(localUrl);
}