/**
 * Force-downloads a file using fetch + Blob.
 * Works even for cross-origin files that would otherwise open in a browser viewer
 * or redirect to an external security page.
 */
export async function downloadFile(url, filename = "archivo") {
  const response = await fetch(url);
  const blob = await response.blob();
  const localUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = localUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(localUrl);
}