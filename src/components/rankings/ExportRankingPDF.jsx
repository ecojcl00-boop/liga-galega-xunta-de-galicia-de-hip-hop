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
const CONTENT_W = PAGE_W - MARGIN * 2; // 539

const POS_COLORS = {
  1: [255, 215, 0],   // oro
  2: [160, 160, 160], // plata
  3: [160, 82, 45],   // bronce
};

function drawBlackBg(doc) {
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawFooter(doc) {
  doc.setFont("GrimeSlime", "normal");
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

function drawCategory(doc, nombre, participantes, cursorY) {
  const listaCount = Math.max(0, participantes.length - 3);
  const totalH = 14 + 68 + listaCount * 11 + 12;

  if (cursorY + totalH > 810) {
    doc.addPage();
    drawBlackBg(doc);
    drawFooter(doc);
    cursorY = 20;
  }

  // A) Título
  doc.setFillColor(255, 107, 53);
  doc.rect(MARGIN, cursorY, 2.5, 9, "F");
  doc.setFont("GrimeSlime", "normal");
  doc.setFontSize(11);
  doc.setTextColor(255, 107, 53);
  doc.text(nombre.toUpperCase(), 35, cursorY + 8);

  // Group count
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text(`${participantes.length} grupos`, PAGE_W - MARGIN, cursorY + 8, { align: "right" });

  cursorY += 14;

  // B) PODIO
  const baseY = cursorY + 68; // línea base donde terminan todos los bloques
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

    // Brick wall
    drawBrickWall(doc, colX, wallTop, colW, wallH);

    // Top border
    doc.setDrawColor(...col);
    doc.setLineWidth(2.5);
    doc.line(colX, wallTop, colX + colW, wallTop);

    // Position circle above wall
    const cx = colX + colW / 2;
    const circleY = wallTop - 8;
    doc.setFillColor(5, 5, 5);
    doc.circle(cx, circleY, 8, "F");
    doc.setDrawColor(...col);
    doc.setLineWidth(1);
    doc.circle(cx, circleY, 8, "S");
    doc.setFont("GrimeSlime", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...col);
    doc.text(String(rank), cx, circleY + 3.5, { align: "center" });

    // Text inside wall
    const textAreaTop = wallTop + 4;
    const textAreaH = wallH - 8;
    const midY = textAreaTop + textAreaH / 2;

    // Group name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const nameLines = doc.splitTextToSize(p.grupo, colW - 8);
    const nameLinesShown = nameLines.slice(0, 2);
    const nameStartY = midY - (nameLinesShown.length * 4.5) - 5;
    doc.text(nameLinesShown, cx, nameStartY, { align: "center" });

    // School
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    const schoolLines = doc.splitTextToSize(p.escuela, colW - 8);
    doc.text(schoolLines.slice(0, 1), cx, nameStartY + nameLinesShown.length * 4.5 + 3, { align: "center" });

    // Points
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...col);
    doc.text(`${p.puntos} pts`, cx, baseY - 5, { align: "center" });
  }

  cursorY += 68 + 4;

  // C) Lista (4º en adelante)
  for (let i = 3; i < participantes.length; i++) {
    const p = participantes[i];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 107, 53);
    doc.text(`${p.posicion}º`, MARGIN, cursorY + 7.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    const gName = doc.splitTextToSize(p.grupo, 190)[0];
    doc.text(gName, 44, cursorY + 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    const sName = doc.splitTextToSize(p.escuela, 190)[0];
    doc.text(sName, 240, cursorY + 7.5);

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

export default function ExportRankingPDF({ resultados, grupoAliases, escuelasExcluidas, jornadas }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Load jsPDF
      if (!window.jspdf?.jsPDF) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      // Load custom font
      const fontResp = await fetch("/GrimeSlime-Regular.ttf");
      const fontBuf = await fontResp.arrayBuffer();
      const fontB64 = btoa(String.fromCharCode(...new Uint8Array(fontBuf)));
      doc.addFileToVFS("grimeslime-regular.ttf", fontB64);
      doc.addFont("grimeslime-regular.ttf", "GrimeSlime", "normal");

      // Load logo
      const logoResp = await fetch("/logo_LG_hip_hop_gradiente.png");
      const logoBuf = await logoResp.arrayBuffer();
      const logoB64 = btoa(String.fromCharCode(...new Uint8Array(logoBuf)));

      // First page background
      drawBlackBg(doc);

      // Logo
      const logoSize = 45;
      doc.addImage(logoB64, "PNG", (PAGE_W - logoSize) / 2, 28, logoSize, logoSize);

      // Header text
      doc.setFont("GrimeSlime", "normal");
      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text("LIGA GALEGA DE", PAGE_W / 2, 80, { align: "center" });

      doc.setFont("GrimeSlime", "normal");
      doc.setFontSize(26);
      doc.setTextColor(255, 107, 53);
      doc.text("HIP HOP", PAGE_W / 2, 92, { align: "center" });

      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, 102, PAGE_W - MARGIN, 102);

      const maxJornada = jornadas.length > 0 ? Math.max(...jornadas) : 0;
      const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text(
        `RANKING GLOBAL ACUMULADO · JORNADA ${maxJornada} · ${today}`,
        PAGE_W / 2, 110, { align: "center" }
      );

      drawFooter(doc);

      // Build rankings
      const aliasMap = buildAliasMap(grupoAliases);
      const escuelasExcluidasNames = (escuelasExcluidas || []).map(s => s.name || s);

      let cursorY = 122;

      for (const cat of CATEGORY_ORDER) {
        const ranking = calcularRankingLiga(resultados, cat, aliasMap, escuelasExcluidasNames);
        if (ranking.length === 0) continue;

        const participantes = ranking.map(g => ({
          posicion: g.posicion,
          grupo: g.nombre,
          escuela: g.school,
          puntos: g.total,
        }));

        cursorY = drawCategory(doc, cat, participantes, cursorY);
      }

      // Save
      const todayFile = new Date().toISOString().slice(0, 10);
      doc.save(`ranking-global-jornada-${maxJornada}-${todayFile}.pdf`);
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