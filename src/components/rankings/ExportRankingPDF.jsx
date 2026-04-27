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

const POS_COLORS = {
  1: [255, 215, 0],
  2: [160, 160, 160],
  3: [160, 82, 45],
};

// ── helpers ──────────────────────────────────────────────────────────────────

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

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  doc.setTextColor(30, 30, 30);
  doc.text(
    "LIGA GALEGA XUNTA DE GALICIA DE HIP HOP · galiciandancetour.com",
    PAGE_W / 2, 828, { align: "center" }
  );
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

function drawCategory(doc, nombre, participantes, cursorY, useGrime) {
  const listaCount = Math.max(0, participantes.length - 3);
  const totalH = 14 + 68 + listaCount * 11 + 12;

  if (cursorY + totalH > 810) {
    doc.addPage();
    drawBlackBg(doc);
    drawFooter(doc, useGrime);
    cursorY = 20;
  }

  // A) Título
  doc.setFillColor(255, 107, 53);
  doc.rect(MARGIN, cursorY, 2.5, 9, "F");
  if (useGrime) doc.setFont("GrimeSlime", "normal");
  else doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 107, 53);
  doc.text(nombre.toUpperCase(), 35, cursorY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text(`${participantes.length} grupos`, PAGE_W - MARGIN, cursorY + 8, { align: "right" });
  cursorY += 14;

  // B) PODIO
  const baseY = cursorY + 68;
  const podiumDefs = [
    { rank: 2, colX: MARGIN,           colW: 160, wallH: 42, startOffset: 26 },
    { rank: 1, colX: MARGIN + 160,     colW: 219, wallH: 68, startOffset: 0  },
    { rank: 3, colX: MARGIN + 160+219, colW: 160, wallH: 32, startOffset: 36 },
  ];

  for (const { rank, colX, colW, wallH, startOffset } of podiumDefs) {
    const p = participantes[rank - 1];
    if (!p) continue;
    const col = POS_COLORS[rank];
    const wallTop = cursorY + startOffset;

    drawBrickWall(doc, colX, wallTop, colW, wallH);

    doc.setDrawColor(...col);
    doc.setLineWidth(2.5);
    doc.line(colX, wallTop, colX + colW, wallTop);

    const cx = colX + colW / 2;
    const circleY = wallTop - 8;
    doc.setFillColor(5, 5, 5);
    doc.circle(cx, circleY, 8, "F");
    doc.setDrawColor(...col);
    doc.setLineWidth(1);
    doc.circle(cx, circleY, 8, "S");
    if (useGrime) doc.setFont("GrimeSlime", "normal");
    else doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...col);
    doc.text(String(rank), cx, circleY + 3.5, { align: "center" });

    const textAreaTop = wallTop + 4;
    const textAreaH = wallH - 8;
    const midY = textAreaTop + textAreaH / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const nameLines = doc.splitTextToSize(p.grupo, colW - 8);
    const nameLinesShown = nameLines.slice(0, 2);
    const nameStartY = midY - (nameLinesShown.length * 4.5) - 5;
    doc.text(nameLinesShown, cx, nameStartY, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    const schoolLines = doc.splitTextToSize(p.escuela, colW - 8);
    doc.text(schoolLines.slice(0, 1), cx, nameStartY + nameLinesShown.length * 4.5 + 3, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...col);
    doc.text(`${p.puntos} pts`, cx, baseY - 5, { align: "center" });
  }

  cursorY += 68 + 4;

  // C) Lista 4+
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
    doc.setTextColor(70, 70, 70);
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

  // Test mínimo para confirmar que jsPDF y blob funcionan
  const handleTest = async () => {
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();
      doc.text("Test OK", 10, 10);
      downloadBlob(doc.output("blob"), "test.pdf");
    } catch (err) {
      console.error("Error test PDF:", err);
      alert("Error test: " + err.message);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      // ── PASO 0: validar props ──
      console.log("[PDF] Props recibidas:", {
        resultados: Array.isArray(resultados) ? resultados.length : typeof resultados,
        grupoAliases: Array.isArray(grupoAliases) ? grupoAliases.length : typeof grupoAliases,
        escuelasExcluidas: Array.isArray(escuelasExcluidas) ? escuelasExcluidas.length : typeof escuelasExcluidas,
        jornadas: jornadas,
      });

      if (!Array.isArray(resultados) || resultados.length === 0) {
        alert("Sin datos de resultados. Asegúrate de que hay datos cargados.");
        return;
      }

      // Muestra estructura del primer resultado para verificar campos
      console.log("[PDF] Primer resultado:", JSON.stringify(resultados[0]));

      // ── PASO 1: jsPDF ──
      console.log("[PDF] Cargando jsPDF...");
      const jsPDF = await loadJsPDF();
      console.log("[PDF] jsPDF OK");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      // ── PASO 2: fondo + texto simple — confirma que llega aquí ──
      doc.setFillColor(5, 5, 5);
      doc.rect(0, 0, PAGE_W, PAGE_H, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("Generando ranking...", 50, 50);

      // ── PASO 3: fuente GrimeSlime (opcional) ──
      let useGrime = false;
      try {
        const fontResp = await fetch("/GrimeSlime-Regular.ttf");
        if (fontResp.ok) {
          const fontBuf = await fontResp.arrayBuffer();
          // Conversión segura byte a byte para evitar stack overflow
          const bytes = new Uint8Array(fontBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const fontB64 = btoa(binary);
          doc.addFileToVFS("grimeslime-regular.ttf", fontB64);
          doc.addFont("grimeslime-regular.ttf", "GrimeSlime", "normal");
          useGrime = true;
          console.log("[PDF] GrimeSlime OK");
        }
      } catch (e) { console.warn("[PDF] Fuente no cargada:", e.message); }

      // ── PASO 4: logo via canvas→JPEG (compatible con jsPDF) ──
      let logoDataUrl = null;
      try {
        await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            logoDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            console.log("[PDF] Logo OK via canvas");
            resolve();
          };
          img.onerror = () => { console.warn("[PDF] Logo no cargado"); resolve(); };
          img.src = "/logo_LG_hip_hop_gradiente.png";
        });
      } catch (e) { console.warn("[PDF] Logo no cargado:", e.message); }

      // ── PASO 5: cabecera ──
      drawBlackBg(doc); // redibuja fondo limpio

      if (logoDataUrl) doc.addImage(logoDataUrl, "JPEG", (PAGE_W - 45) / 2, 28, 45, 45);

      if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "normal");
      doc.setFontSize(9); doc.setTextColor(180, 180, 180);
      doc.text("LIGA GALEGA DE", PAGE_W / 2, 80, { align: "center" });

      if (useGrime) doc.setFont("GrimeSlime", "normal"); else doc.setFont("helvetica", "bold");
      doc.setFontSize(26); doc.setTextColor(255, 107, 53);
      doc.text("HIP HOP", PAGE_W / 2, 92, { align: "center" });

      doc.setDrawColor(40, 40, 40); doc.setLineWidth(0.8);
      doc.line(MARGIN, 102, PAGE_W - MARGIN, 102);

      const maxJornada = jornadas.length > 0 ? Math.max(...jornadas) : 0;
      const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
      doc.text(`RANKING GLOBAL ACUMULADO · JORNADA ${maxJornada} · ${today}`, PAGE_W / 2, 110, { align: "center" });
      drawFooter(doc, useGrime);

      // ── PASO 6: categorías ──
      const aliasMap = buildAliasMap(grupoAliases || []);
      const escuelasExcluidasNames = (escuelasExcluidas || []).map(s => s.name || s);
      let cursorY = 122;
      let catCount = 0;

      for (const cat of CATEGORY_ORDER) {
        const ranking = calcularRankingLiga(resultados, cat, aliasMap, escuelasExcluidasNames);
        if (ranking.length === 0) continue;
        catCount++;
        console.log(`[PDF] ${cat}: ${ranking.length} grupos, primer item:`, JSON.stringify(ranking[0]));

        const participantes = ranking.map(g => ({
          posicion: g.posicion,
          grupo: g.nombre,
          escuela: g.school,
          puntos: g.total,
        }));

        cursorY = drawCategory(doc, cat, participantes, cursorY, useGrime);
      }

      console.log(`[PDF] Total categorías dibujadas: ${catCount}`);

      // ── PASO 7: descarga ──
      const todayFile = new Date().toISOString().slice(0, 10);
      const filename = `ranking-global-jornada-${maxJornada}-${todayFile}.pdf`;
      console.log("[PDF] Descargando:", filename);
      downloadBlob(doc.output("blob"), filename);
      console.log("[PDF] ✓ Descarga completada");

    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error generando PDF: " + err.message + "\n\nStack: " + err.stack?.slice(0, 300));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleTest}
        variant="outline"
        size="sm"
        className="text-xs px-3"
      >
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