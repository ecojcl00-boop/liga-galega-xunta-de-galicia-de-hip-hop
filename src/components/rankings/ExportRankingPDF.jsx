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

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function addPageFooter(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Liga Galega Xunta de Galicia de Hip Hop · galiciandancetour.com",
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 6,
      { align: "center" }
    );
  }
}

function drawGradientHeader(doc) {
  // Simulate gradient with multiple rect strips
  const steps = 40;
  const startR = 255, startG = 107, startB = 53; // #FF6B35
  const endR = 255, endG = 45, endB = 120;       // #FF2D78
  const headerH = 32;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(startR + (endR - startR) * t);
    const g = Math.round(startG + (endG - startG) * t);
    const b = Math.round(startB + (endB - startB) * t);
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN + (CONTENT_WIDTH * i) / steps, 10, CONTENT_WIDTH / steps + 0.5, headerH, "F");
  }

  // HIP HOP title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("HIP HOP", PAGE_WIDTH / 2, 24, { align: "center" });

  // Subtitle
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("LIGA GALEGA DE HIP HOP", PAGE_WIDTH / 2, 34, { align: "center" });
}

function drawCategoryHeader(doc, y, categoria) {
  doc.setFillColor(...hexToRgb("#FFF0E8"));
  doc.rect(MARGIN, y, CONTENT_WIDTH, 8, "F");
  doc.setTextColor(...hexToRgb("#C94A00"));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(categoria.toUpperCase(), MARGIN + 3, y + 5.5);
  return y + 8;
}

function drawPodium(doc, y, ranking) {
  // Order: 2nd | 1st | 3rd
  const order = [
    ranking[1] ? { g: ranking[1], rank: 2 } : null,
    { g: ranking[0], rank: 1 },
    ranking[2] ? { g: ranking[2], rank: 3 } : null,
  ];

  const colW = CONTENT_WIDTH / 3;
  const colors = {
    1: { text: hexToRgb("#D4A017"), bg: hexToRgb("#FFFBEA"), border: hexToRgb("#D4A017") },
    2: { text: hexToRgb("#9E9E9E"), bg: hexToRgb("#F8F8F8"), border: hexToRgb("#CCCCCC") },
    3: { text: hexToRgb("#A0522D"), bg: hexToRgb("#FDF5F0"), border: hexToRgb("#A0522D") },
  };
  const medals = { 1: "1", 2: "2", 3: "3" };
  const blockH = 28;

  order.forEach((item, idx) => {
    if (!item) return;
    const { g, rank } = item;
    const x = MARGIN + colW * idx;
    const offsetY = rank === 1 ? 0 : rank === 2 ? 5 : 10;
    const col = colors[rank];
    const bh = rank === 1 ? blockH : blockH - 5;

    // Background
    doc.setFillColor(...col.bg);
    doc.roundedRect(x + 2, y + offsetY, colW - 4, bh, 2, 2, "F");

    // Border
    doc.setDrawColor(...col.border);
    doc.setLineWidth(rank === 1 ? 0.6 : 0.3);
    doc.roundedRect(x + 2, y + offsetY, colW - 4, bh, 2, 2, "S");

    const cx = x + colW / 2;
    let ty = y + offsetY + 6;

    // Position number
    doc.setFont("helvetica", "bold");
    doc.setFontSize(rank === 1 ? 16 : 13);
    doc.setTextColor(...col.text);
    doc.text(`${medals[rank]}º`, cx, ty, { align: "center" });
    ty += rank === 1 ? 6 : 5;

    // Group name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(rank === 1 ? 8 : 7);
    doc.setTextColor(30, 30, 30);
    const nameLines = doc.splitTextToSize(g.nombre, colW - 8);
    doc.text(nameLines.slice(0, 2), cx, ty, { align: "center" });
    ty += nameLines.slice(0, 2).length * (rank === 1 ? 4 : 3.5) + 1;

    // School
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const schoolLines = doc.splitTextToSize(g.school, colW - 8);
    doc.text(schoolLines.slice(0, 1), cx, ty, { align: "center" });
    ty += 4;

    // Points
    doc.setFont("helvetica", "bold");
    doc.setFontSize(rank === 1 ? 9 : 8);
    doc.setTextColor(...col.text);
    doc.text(`${g.total} pts`, cx, ty, { align: "center" });
  });

  return y + blockH + 6;
}

function drawRestTable(doc, y, ranking) {
  const rest = ranking.slice(3);
  if (rest.length === 0) return y;

  const cols = {
    pos: { x: MARGIN, w: 12 },
    grupo: { x: MARGIN + 12, w: 80 },
    escuela: { x: MARGIN + 92, w: 80 },
    pts: { x: MARGIN + 172, w: CONTENT_WIDTH - 172 },
  };
  const rowH = 5;

  rest.forEach((g, i) => {
    // Alternate row bg
    if (i % 2 === 1) {
      doc.setFillColor(...hexToRgb("#F9F9F9"));
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowH, "F");
    }
    // Row separator
    doc.setDrawColor(...hexToRgb("#EEEEEE"));
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${g.posicion}º`, cols.pos.x + cols.pos.w - 2, y + 3.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const nombre = doc.splitTextToSize(g.nombre, cols.grupo.w - 2)[0];
    doc.text(nombre, cols.grupo.x, y + 3.5);

    doc.setTextColor(100, 100, 100);
    const school = doc.splitTextToSize(g.school, cols.escuela.w - 2)[0];
    doc.text(school, cols.escuela.x, y + 3.5);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRgb("#FF6B35"));
    doc.text(`${g.total}`, cols.pts.x + cols.pts.w, y + 3.5, { align: "right" });

    y += rowH;
  });

  return y + 3;
}

export default function ExportRankingPDF({ resultados, grupoAliases, escuelasExcluidas, jornadas }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Load jsPDF from CDN if not available
      let jsPDF;
      if (window.jspdf?.jsPDF) {
        jsPDF = window.jspdf.jsPDF;
      } else {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        jsPDF = window.jspdf.jsPDF;
      }

      const aliasMap = buildAliasMap(grupoAliases);
      const escuelasExcluidasNames = escuelasExcluidas.map(s => s.name || s);

      // Determine categories with data
      const categoriesWithData = CATEGORY_ORDER.filter(cat => {
        const ranking = calcularRankingLiga(resultados, cat, aliasMap, escuelasExcluidasNames);
        return ranking.length > 0;
      });

      const maxJornada = jornadas.length > 0 ? Math.max(...jornadas) : 0;
      const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
      const todayFile = new Date().toISOString().slice(0, 10);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // --- FIRST PAGE HEADER ---
      drawGradientHeader(doc);

      // Subtitle line below header
      let y = 48;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(
        `Ranking Global Acumulado · Jornada ${maxJornada} · ${today}`,
        PAGE_WIDTH / 2,
        y,
        { align: "center" }
      );
      y += 8;

      // --- CATEGORIES ---
      for (const cat of categoriesWithData) {
        const ranking = calcularRankingLiga(resultados, cat, aliasMap, escuelasExcluidasNames);

        // Estimate space needed: category header + podium + rest table
        const restRows = Math.max(0, ranking.length - 3);
        const neededH = 8 + 35 + restRows * 5 + 10;

        // Check if we need a new page
        if (y + neededH > PAGE_HEIGHT - 15) {
          doc.addPage();
          y = 12;
        }

        // Category header
        y = drawCategoryHeader(doc, y, cat);
        y += 3;

        // Podium
        y = drawPodium(doc, y, ranking);

        // Rest table (4th onwards)
        if (ranking.length > 3) {
          y = drawRestTable(doc, y, ranking);
        }

        // Category separator
        doc.setDrawColor(...hexToRgb("#EEEEEE"));
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
        y += 6;
      }

      // Footers on all pages
      addPageFooter(doc);

      // Save
      doc.save(`ranking-global-jornada-${maxJornada}-${todayFile}.pdf`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      className="gap-2 text-white font-semibold rounded-xl px-4 py-2 shadow-md"
      style={{ background: "linear-gradient(90deg, #FF6B35, #FF2D78)", border: "none" }}
    >
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" />Generando PDF...</>
        : <><FileDown className="w-4 h-4" />📄 Descargar PDF del Ranking</>
      }
    </Button>
  );
}