import { base44 } from "@/api/base44Client";

/**
 * Downloads a file through the backend proxy to avoid Chrome Safe Browsing warnings.
 * The backend fetches the file and returns it as base64; we decode to a local Blob URL.
 */
export async function downloadFile(url, filename = "archivo") {
  const res = await base44.functions.invoke('proxyDownload', { url, filename });
  const { data: base64, contentType } = res.data;

  // Decode base64 → Uint8Array → Blob
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType || 'application/octet-stream' });

  const localUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = localUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(localUrl);
}