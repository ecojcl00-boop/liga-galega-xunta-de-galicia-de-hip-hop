import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { calcularRankingLiga } from "@/lib/calcularRankingLiga";
import { buildAliasMap } from "@/lib/normalizacion";

const CATEGORY_ORDER = [
  "Baby", "Mini Individual A", "Mini Individual B",
  "Mini Parejas A", "Mini Parejas B", "Parejas",
  "Infantil", "Individual", "Junior", "Youth", "Premium", "Absoluta", "Megacrew"
];

const GOLD = [255, 215, 0];
const MARGIN = 28;
const PAGE_W = 595;
const PAGE_H = 842;

// ── jsPDF loader ──────────────────────────────────────────────────────────────

async function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── logo loader ───────────────────────────────────────────────────────────────

async function loadLogoDataUrl() {
  let logoDataUrl = null;
  try {
    const resp = await fetch("/logo LG hip hop gradiente.png");
    console.log("[PDF] logo status:", resp.status, resp.ok);
    if (resp.ok) {
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = 512; c.height = 512;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, 512, 512);
          ctx.drawImage(img, 0, 0, 512, 512);
          logoDataUrl = c.toDataURL("image/jpeg", 0.92);
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(); };
        img.src = objectUrl;
      });
    }
  } catch (e) { console.warn("[PDF] logo error:", e); }
  console.log("[PDF] logo:", logoDataUrl ? "OK" : "FALLIDO");
  return logoDataUrl;
}

// ── download ──────────────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

function drawBlackBg(doc) {
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawFooter(doc, useGrime) {
  if (useGrime) doc.setFont("GrimeSlime", "normal");
  else doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "LIGA GALEGA XUNTA DE GALICIA DE HIP HOP · galiciandancetour.com",
    PAGE_W / 2, 828, { align: "center" }
  );
}

function drawWatermark(doc, cursorY, logoDataUrl) {
  if (!logoDataUrl) return;
  const spaceLeft = 800 - cursorY;
  if (spaceLeft < 140) return;
  const s = Math.min(spaceLeft - 30, 120);
  const wx = (PAGE_W - s) / 2;
  const wy = cursorY + (spaceLeft - s) / 2;
  doc.addImage(logoDataUrl, "JPEG", wx, wy, s, s);
  if (doc.saveGraphicsState) doc.saveGraphicsState();
  if (doc.setGState) doc.setGState(new doc.GState({ opacity: 0.76 }));
  doc.setFillColor(5, 5, 5);
  doc.rect(wx, wy, s, s, "F");
  if (doc.restoreGraphicsState) doc.restoreGraphicsState();
}

function drawBrickWall(doc, x, y, w, h) {
  doc.setFillColor(12, 6, 2);
  doc.rect(x, y, w, h, "F");
  const bH = 5.5, mH = 1.5, rowH = 7, bW = 20, mW = 1.5;
  let row = 0;
  for (let ry = y + mH; ry < y + h - bH; ry += rowH) {
    const offset = (row % 2 === 0) ? 0 : bW / 2;
    for (let bx = x - offset; bx < x + w; bx += bW + mW) {
      const rx = Math.max(x, bx);
      const rw = Math.min(bx + bW, x + w) - rx;
      if (rw > 0) {
        const v = 55 + (row * 7 + Math.floor(bx) * 3) % 22;
        doc.setFillColor(v + 8, v - 18, v - 28);
        doc.rect(rx, ry, rw, bH, "F");
      }
    }
    row++;
  }
}

function drawCategory(doc, nombreCategoria, participantes, cursorY, useGrime, logoDataUrl) {
  // Calcular altura necesaria
  const listaCount = Math.max(0, participantes.length - 3);
  const totalH = 34 + 80 + listaCount * 11 + 12;

  if (cursorY + totalH > 810) {
    drawWatermark(doc, cursorY, logoDataUrl);
    doc.addPage();
    drawBlackBg(doc);
    drawFooter(doc, useGrime);
    cursorY = 20;
  }

  // ── Título categoría centrado con líneas laterales ──
  if (useGrime) doc.setFont("GrimeSlime", "normal");
  else doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 107, 53);
  const titleText = nombreCategoria.toUpperCase();
  const titleW = doc.getTextWidth(titleText);
  const titleX = PAGE_W / 2;
  const titleY = cursorY + 10;
  doc.text(titleText, titleX, titleY, { align: "center" });

  doc.setDrawColor(255, 107, 53);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, titleY - 3, (PAGE_W - titleW) / 2 - 6, titleY - 3);
  doc.line((PAGE_W + titleW) / 2 + 6, titleY - 3, PAGE_W - MARGIN, titleY - 3);

  // Número grupos
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`${participantes.length} GRUPOS`, PAGE_W - MARGIN, titleY, { align: "right" });

  cursorY = titleY + 24;

  // ── Podio ──
  const podiumBottom = cursorY + 72;
  const p1 = participantes[0];
  const p2 = participantes[1];
  const p3 = participantes[2];

  const cols = [
    p2 ? { pos: 2, nombre: p2.grupo, escuela: p2.escuela, puntos: p2.puntos, x: 28,  w: 160, wallH: 46 } : null,
    p1 ? { pos: 1, nombre: p1.grupo, escuela: p1.escuela, puntos: p1.puntos, x: 188, w: 219, wallH: 72 } : null,
    p3 ? { pos: 3, nombre: p3.grupo, escuela: p3.escuela, puntos: p3.puntos, x: 407, w: 160, wallH: 34 } : null,
  ].filter(Boolean);

  cols.forEach(({ pos, nombre, escuela, puntos, x, w, wallH }) => {
    const wallTop = podiumBottom - wallH;
    const circleR = pos === 1 ? 9 : 7;
    const circleX = x + w / 2;
    const circleY = wallTop - 4;

    drawBrickWall(doc, x, wallTop, w, wallH);

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(2);
    doc.line(x, wallTop, x + w, wallTop);

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.setFillColor(5, 5, 5);
    doc.circle(circleX, circleY, circleR, "FD");
    if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
    doc.setFontSize(pos === 1 ? 10 : 8);
    doc.setTextColor(...GOLD);
    doc.text(String(pos), circleX, circleY + (pos === 1 ? 3.5 : 2.8), { align: "center" });

    const midY = wallTop + wallH / 2;
    const lineH = 8;

    if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
    doc.setFontSize(pos === 1 ? 8.5 : 7);
    doc.setTextColor(255, 255, 255);
    doc.text(nombre, x + w / 2, midY - lineH, { align: "center", maxWidth: w - 8 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    doc.text(escuela, x + w / 2, midY, { align: "center", maxWidth: w - 8 });

    if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
    doc.setFontSize(pos === 1 ? 8.5 : 7);
    doc.setTextColor(...GOLD);
    doc.text(`${puntos} pts`, x + w / 2, midY + lineH, { align: "center" });
  });

  cursorY = podiumBottom + 8;

  // ── Lista posiciones 4+ ──
  for (let i = 3; i < participantes.length; i++) {
    const p = participantes[i];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 107, 53);
    doc.text(`${p.posicion}º`, MARGIN, cursorY);

    doc.setTextColor(220, 220, 220);
    doc.text(doc.splitTextToSize(p.grupo, 190)[0], 46, cursorY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(200, 200, 200);
    doc.text(doc.splitTextToSize(p.escuela, 190)[0], 240, cursorY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 45, 120);
    doc.text(String(p.puntos), PAGE_W - MARGIN, cursorY, { align: "right" });

    doc.setDrawColor(25, 25, 25);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, cursorY + 2, PAGE_W - MARGIN, cursorY + 2);
    cursorY += 11;
  }

  cursorY += 12;
  return cursorY;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportRankingPDF({ resultados, grupoAliases, escuelasExcluidas, jornadas }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      if (!Array.isArray(resultados) || resultados.length === 0) {
        alert("Sin datos de resultados.");
        return;
      }

      // ── 1. jsPDF ──
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      // ── 2. GrimeSlime (opcional) ──
      let useGrime = false;
      try {
        const fontResp = await fetch("/GrimeSlime-Regular.ttf");
        if (fontResp.ok) {
          const fontBuf = await fontResp.arrayBuffer();
          const bytes = new Uint8Array(fontBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          doc.addFileToVFS("grimeslime-regular.ttf", btoa(binary));
          doc.addFont("grimeslime-regular.ttf", "GrimeSlime", "normal");
          useGrime = true;
          console.log("[PDF] GrimeSlime OK");
        }
      } catch (e) { console.warn("[PDF] Fuente:", e.message); }

      // ── 3. Logo ──
      const logoDataUrl = await loadLogoDataUrl();

      // ── 4. Primera página: fondo + logo + cabecera ──
      drawBlackBg(doc);

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "JPEG", (PAGE_W - 90) / 2, 18, 90, 90);
      }

      // Título en una línea con GrimeSlime
      if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 107, 53);
      doc.text("LIGA GALEGA XUNTA DE GALICIA DE HIP HOP", PAGE_W / 2, 118, { align: "center" });

      const maxJornada = jornadas && jornadas.length > 0 ? Math.max(...jornadas) : 0;
      const fechaHoy = new Date().toLocaleDateString("es-ES");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `RANKING GLOBAL ACUMULADO · JORNADA ${maxJornada} · ${fechaHoy}`,
        PAGE_W / 2, 129, { align: "center" }
      );

      doc.setDrawColor(50, 50, 50);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, 135, PAGE_W - MARGIN, 135);

      drawFooter(doc, useGrime);

      let cursorY = 148;

      // ── 5. Categorías ──
      const aliasMap = buildAliasMap(grupoAliases || []);
      const escuelasExcluidasNames = (escuelasExcluidas || []).map(s => s.name || s);
      let catCount = 0;

      for (const cat of CATEGORY_ORDER) {
        const ranking = calcularRankingLiga(resultados, cat, aliasMap, escuelasExcluidasNames);
        if (ranking.length === 0) continue;
        catCount++;

        const participantes = ranking.map(g => ({
          posicion: g.posicion,
          grupo: g.nombre,
          escuela: g.school,
          puntos: g.total,
        }));

        cursorY = drawCategory(doc, cat, participantes, cursorY, useGrime, logoDataUrl);
      }

      console.log(`[PDF] Categorías: ${catCount}`);

      // Marca de agua última página
      drawWatermark(doc, cursorY, logoDataUrl);

      // ── 6. Descarga ──
      const todayFile = new Date().toISOString().slice(0, 10);
      const filename = `ranking-global-jornada-${maxJornada}-${todayFile}.pdf`;
      downloadBlob(doc.output("blob"), filename);
      console.log("[PDF] ✓ OK:", filename);

    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error: " + err.message + "\n\n" + err.stack?.slice(0, 400));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      className="gap-2 text-white font-semibold rounded-xl px-4 py-2 shadow-md shrink-0"
      style={{ background: "linear-gradient(90deg, #FF6B35, #FF2D78)", border: "none" }}
    >
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
        : <><FileDown className="w-4 h-4" />📄 Descargar PDF Ranking</>}
    </Button>
  );
}