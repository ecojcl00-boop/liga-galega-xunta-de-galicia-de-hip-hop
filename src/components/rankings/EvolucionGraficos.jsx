import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const JORNADA_LABELS = {
  1: "J1 Marín", 2: "J2 Fene", 3: "J3 Narón",
  4: "J4 Lugo", 5: "J5 Vigo"
};

// Palette of distinct colors
const COLORS = [
  "#e91e8c", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#ec4899",
  "#6366f1", "#14b8a6", "#eab308", "#a855f7", "#0ea5e9",
];

// ── Sparkline (SVG manual, sin librerías extra) ──────────────────────────────
function Sparkline({ puestos, jornadas, color = "#e91e8c" }) {
  const W = 80, H = 30, PAD = 3;
  const points = jornadas.map(j => puestos[j]).filter(p => p != null);
  if (points.length < 2) {
    return <span className="text-muted-foreground/30 text-xs">—</span>;
  }

  const minP = Math.min(...points);
  const maxP = Math.max(...points);
  const range = maxP - minP || 1;

  // Map position → Y (inverted: 1º arriba)
  const toY = p => PAD + ((p - minP) / range) * (H - PAD * 2);
  // Map index → X across the full jornada span
  const fullJornadas = jornadas;
  const toX = j => {
    const idx = fullJornadas.indexOf(j);
    return PAD + (idx / Math.max(fullJornadas.length - 1, 1)) * (W - PAD * 2);
  };

  const validPairs = jornadas
    .map(j => ({ j, p: puestos[j] }))
    .filter(({ p }) => p != null);

  const pathD = validPairs
    .map(({ j, p }, i) => `${i === 0 ? "M" : "L"} ${toX(j)} ${toY(p)}`)
    .join(" ");

  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {validPairs.map(({ j, p }) => (
        <circle key={j} cx={toX(j)} cy={toY(p)} r={2.5} fill={color} />
      ))}
    </svg>
  );
}

// ── Bump Chart ───────────────────────────────────────────────────────────────
function BumpChart({ ranking, jornadas }) {
  const maxPos = Math.max(...ranking.flatMap(g => Object.values(g.puestos).filter(Boolean)), ranking.length);

  // Build recharts data: one entry per jornada
  const data = jornadas.map(j => {
    const entry = { jornada: JORNADA_LABELS[j] || `J${j}` };
    ranking.forEach(g => {
      if (g.puestos[j] != null) {
        entry[g.nombre] = g.puestos[j];
      }
    });
    return entry;
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].sort((a, b) => a.value - b.value);
    return (
      <div className="bg-card border rounded-lg shadow-lg p-2 text-xs max-w-[200px]">
        <p className="font-semibold mb-1 text-foreground">{label}</p>
        {sorted.map(p => (
          <div key={p.dataKey} className="flex items-center gap-1.5 py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-foreground/80 truncate">{p.dataKey}</span>
            <span className="ml-auto font-bold text-foreground">{p.value}º</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-3">Evolución de posiciones</p>
      <ResponsiveContainer width="100%" height={Math.max(200, ranking.length * 30)}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="jornada"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[1, maxPos]}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            label={{ value: "Posición", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }}
          />
          <Tooltip content={<CustomTooltip />} />
          {ranking.map((g, i) => {
            const color = COLORS[i % COLORS.length];
            return (
              <React.Fragment key={g.nombre}>
                {/* Línea discontinua que conecta todos los puntos (incluye gaps) */}
                <Line
                  type="monotone"
                  dataKey={g.nombre}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={false}
                  connectNulls={true}
                  legendType="none"
                  tooltipType="none"
                  isAnimationActive={false}
                />
                {/* Línea sólida solo en tramos donde hay datos reales */}
                <Line
                  type="monotone"
                  dataKey={g.nombre}
                  stroke={color}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, value } = props;
                    if (value == null) return null;
                    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} strokeWidth={0} />;
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </React.Fragment>
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Leyenda manual */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {ranking.map((g, i) => (
          <div key={g.nombre} className="flex items-center gap-1.5 text-xs">
            <span className="w-5 h-0.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length], height: 3 }} />
            <span className="text-foreground/80 truncate max-w-[140px]">{g.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal exportado (solo BumpChart) ──────────────────────────
export default function EvolucionGraficos({ ranking, jornadas }) {
  const jornadasConDatos = useMemo(() =>
    jornadas.filter(j => ranking.some(g => g.puestos[j] != null)),
    [ranking, jornadas]
  );

  if (jornadasConDatos.length < 1 || ranking.length === 0) return null;

  return (
    <div className="pt-2">
      <BumpChart ranking={ranking} jornadas={jornadasConDatos} />
    </div>
  );
}

export { Sparkline, COLORS };