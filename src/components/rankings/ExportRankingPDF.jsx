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

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 28;
const GOLD = [255, 215, 0];

// ── helpers ───────────────────────────────────────────────────────────────────

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

async function loadLogoDataUrl() {
  let logoDataUrl = null;
  try {
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
        resolve();
      };
      img.onerror = resolve;
      img.src = "/logo_LG_hip_hop_gradiente.png?" + Date.now();
    });
  } catch (e) { /* silencioso */ }
  console.log("[PDF] logo:", logoDataUrl ? "OK " + logoDataUrl.length : "FALLIDO");
  return logoDataUrl;
}

// ── PDF drawing helpers ───────────────────────────────────────────────────────

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

function drawWatermark(doc, logoDataUrl, cursorY) {
  if (!logoDataUrl || cursorY >= 660) return;
  const s = 110;
  const wx = (PAGE_W - s) / 2;
  const wy = cursorY + ((800 - cursorY - s) / 2);
  doc.addImage(logoDataUrl, "JPEG", wx, wy, s, s);
  doc.setFillColor(5, 5, 5);
  if (doc.setGState) doc.setGState(new doc.GState({ opacity: 0.72 }));
  doc.rect(wx, wy, s, s, "F");
  if (doc.setGState) doc.setGState(new doc.GState({ opacity: 1 }));
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

function drawCategoryTitle(doc, nombre, participantes, cursorY, useGrime) {
  // Título centrado con líneas decorativas a los lados
  if (useGrime) doc.setFont("GrimeSlime", "normal");
  else doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 107, 53);
  doc.text(nombre.toUpperCase(), PAGE_W / 2, cursorY + 9, { align: "center" });

  const titleWidth = doc.getTextWidth(nombre.toUpperCase());
  const lineY = cursorY + 5;
  doc.setDrawColor(255, 107, 53);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, lineY, (PAGE_W - titleWidth) / 2 - 6, lineY);
  doc.line((PAGE_W + titleWidth) / 2 + 6, lineY, PAGE_W - MARGIN, lineY);

  // Contador grupos
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`${participantes.length} GRUPOS`, PAGE_W - MARGIN, cursorY + 9, { align: "right" });
}

function drawCategory(doc, nombre, participantes, cursorY, useGrime, logoDataUrl) {
  const listaCount = Math.max(0, participantes.length - 3);
  const totalH = 14 + 68 + listaCount * 11 + 12;

  if (cursorY + totalH > 810) {
    drawWatermark(doc, logoDataUrl, cursorY);
    doc.addPage();
    drawBlackBg(doc);
    drawFooter(doc, useGrime);
    cursorY = 20;
  }

  // A) Título
  drawCategoryTitle(doc, nombre, participantes, cursorY, useGrime);
  cursorY += 14;

  // B) PODIO
  const podiumDefs = [
    { rank: 2, colX: MARGIN,             colW: 160, wallH: 42, startOffset: 26 },
    { rank: 1, colX: MARGIN + 160,       colW: 219, wallH: 68, startOffset: 0  },
    { rank: 3, colX: MARGIN + 160 + 219, colW: 160, wallH: 32, startOffset: 36 },
  ];

  for (const { rank, colX, colW, wallH, startOffset } of podiumDefs) {
    const p = participantes[rank - 1];
    if (!p) continue;
    const wallTop = cursorY + startOffset;

    drawBrickWall(doc, colX, wallTop, colW, wallH);

    // Línea superior dorada para todos
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(2.5);
    doc.line(colX, wallTop, colX + colW, wallTop);

    // Círculo número posición — 1º más grande
    const cx = colX + colW / 2;
    const circleY = wallTop - 8;
    const circleR = rank === 1 ? 9 : 7;
    doc.setFillColor(5, 5, 5);
    doc.circle(cx, circleY, circleR, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.circle(cx, circleY, circleR, "S");
    if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text(String(rank), cx, circleY + 3.5, { align: "center" });

    // Texto centrado dentro de la pared
    const textAreaY = wallTop + (wallH / 2);
    const lineSpacing = 9;

    // Nombre grupo
    if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
    doc.setFontSize(colW > 180 ? 9 : 7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(p.grupo, cx, textAreaY - lineSpacing, { align: "center", maxWidth: colW - 8 });

    // Escuela
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(160, 160, 160);
    doc.text(p.escuela, cx, textAreaY, { align: "center", maxWidth: colW - 8 });

    // Puntos dorados para todos
    if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
    doc.setFontSize(colW > 180 ? 9 : 7.5);
    doc.setTextColor(...GOLD);
    doc.text(`${p.puntos} pts`, cx, textAreaY + lineSpacing, { align: "center" });
  }

  cursorY += 68 + 4;

  // C) Lista posiciones 4+
  for (let i = 3; i < participantes.length; i++) {
    const p = participantes[i];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 107, 53);
    doc.text(`${p.posicion}º`, MARGIN, cursorY + 7.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(doc.splitTextToSize(p.grupo, 190)[0], 44, cursorY + 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(200, 200, 200);
    doc.text(doc.splitTextToSize(p.escuela, 190)[0], 240, cursorY + 7.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 45, 120);
    doc.text(`${p.puntos}`, PAGE_W - MARGIN, cursorY + 7.5, { align: "right" });

    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, cursorY + 1, PAGE_W - MARGIN, cursorY + 1);
    cursorY += 11;
  }

  cursorY += 12;
  return cursorY;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportRankingPDF({ resultados, grupoAliases, escuelasExcluidas, jornadas }) {
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();
      doc.text("Test OK", 10, 10);
      downloadBlob(doc.output("blob"), "test.pdf");
    } catch (err) {
      alert("Error test: " + err.message);
    }
  };

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

      // ── 4. Primera página ──
      drawBlackBg(doc);

      // Logo o fallback naranja
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "JPEG", (PAGE_W - 50) / 2, 22, 50, 50);
      } else {
        doc.setFillColor(255, 107, 53);
        doc.rect((PAGE_W - 50) / 2, 22, 50, 50, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("GBD", PAGE_W / 2, 50, { align: "center" });
      }

      // Cabecera — FIX 5: coordenadas exactas sin solapamiento
      const maxJornada = jornadas && jornadas.length > 0 ? Math.max(...jornadas) : 0;
      const fechaHoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

      let y = 82;
      if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text("LIGA GALEGA DE", PAGE_W / 2, y, { align: "center" });

      y += 18;
      if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 107, 53);
      doc.text("HIP HOP", PAGE_W / 2, y, { align: "center" });

      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `RANKING GLOBAL ACUMULADO · JORNADA ${maxJornada} · ${fechaHoy}`,
        PAGE_W / 2, y, { align: "center" }
      );

      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y + 6, PAGE_W - MARGIN, y + 6);

      drawFooter(doc, useGrime);

      let cursorY = y + 18;

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
      drawWatermark(doc, logoDataUrl, cursorY);

      // ── 6. Descarga ──
      const todayFile = new Date().toISOString().slice(0, 10);
      downloadBlob(doc.output("blob"), `ranking-global-jornada-${maxJornada}-${todayFile}.pdf`);
      console.log("[PDF] ✓ OK");

    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error: " + err.message + "\n\n" + err.stack?.slice(0, 400));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleTest} variant="outline" size="sm" className="text-xs px-3">
        Test PDF
      </Button>
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
    </div>
  );
}