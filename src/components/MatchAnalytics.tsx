import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types";

// --- Types ---

interface PointLog {
  p: 1 | 2;
  t: number; // seconds since match start
  hr: number; // heart rate
}

interface SetResult {
  p1: number;
  p2: number;
}

interface MatchPointLog {
  id: string;
  profile_id: string;
  match_id: string | null;
  format: "standard" | "supertiebreak" | "nextgen";
  result: SetResult[];
  point_log: PointLog[];
  duration_secs: number;
  avg_hr: number;
  max_hr: number;
  calories: number;
  source: string;
  created_at: string;
  analysis_text?: string | null;
}

// --- Helpers ---

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatResult(result: SetResult[]): string {
  if (!result || result.length === 0) return "Incompleto";
  return result.map((s) => `${s.p1}-${s.p2}`).join(" ");
}

const FORMAT_LABELS: Record<string, string> = {
  standard: "STD",
  supertiebreak: "STB",
  nextgen: "NXG",
};

// --- SVG Chart Components ---

function HRChart({ points }: { points: PointLog[] }) {
  if (points.length < 2) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const minHR = Math.min(Math.min(...points.map((p) => p.hr)), 90) - 5;
  const maxHR = Math.max(Math.max(...points.map((p) => p.hr)), 180) + 5;

  const timeRange = maxT - minT || 1;
  const hrRange = maxHR - minHR || 1;

  const toX = (t: number) => padding.left + ((t - minT) / timeRange) * innerW;
  const toY = (hr: number) => padding.top + (1 - (hr - minHR) / hrRange) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.t).toFixed(1)} ${toY(p.hr).toFixed(1)}`)
    .join(" ");

  // HR reference zones for tennis — colored bands
  const zones = [
    { min: 0, max: 120, color: "rgba(96, 165, 250, 0.18)", label: "Descanso" },   // blue
    { min: 120, max: 150, color: "rgba(74, 222, 128, 0.18)", label: "Moderado" },  // green
    { min: 150, max: 170, color: "rgba(250, 204, 21, 0.16)", label: "Intenso" },   // yellow
    { min: 170, max: 999, color: "rgba(248, 113, 113, 0.18)", label: "Máximo" },   // red
  ];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Frecuencia cardíaca durante el partido"
    >
      <rect x={0} y={0} width={width} height={height} rx={8} className="fill-black/40" />

      {/* Zone backgrounds — colored bands */}
      {zones.map((zone, i) => {
        const yTop = Math.max(toY(Math.min(zone.max, maxHR)), padding.top);
        const yBot = Math.min(toY(Math.max(zone.min, minHR)), padding.top + innerH);
        if (yBot <= yTop) return null;
        return (
          <g key={i}>
            <rect x={padding.left} y={yTop} width={innerW} height={yBot - yTop} fill={zone.color} />
            <text x={width - padding.right - 4} y={yTop + 11} textAnchor="end" className="fill-white/50" fontSize={9} fontWeight="500">
              {zone.label}
            </text>
          </g>
        );
      })}

      {/* Zone boundary lines */}
      {[120, 150, 170].map(hr => {
        if (hr < minHR || hr > maxHR) return null;
        return (
          <g key={hr}>
            <line x1={padding.left} y1={toY(hr)} x2={width - padding.right} y2={toY(hr)}
              stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
            <text x={padding.left - 4} y={toY(hr) + 3} textAnchor="end" className="fill-white/40" fontSize={9}>
              {hr}
            </text>
          </g>
        );
      })}

      {/* Y-axis min/max */}
      <text x={padding.left - 4} y={toY(maxHR) + 4} textAnchor="end" className="fill-white/50" fontSize={9}>{maxHR}</text>
      <text x={padding.left - 4} y={toY(minHR) + 4} textAnchor="end" className="fill-white/50" fontSize={9}>{minHR}</text>

      {/* X-axis */}
      <text x={padding.left} y={height - 6} textAnchor="start" className="fill-white/50" fontSize={9}>0m</text>
      <text x={width - padding.right} y={height - 6} textAnchor="end" className="fill-white/50" fontSize={9}>
        {Math.round((maxT - minT) / 60)}m
      </text>

      {/* HR line */}
      <path d={pathD} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function RhythmChart({ points }: { points: PointLog[] }) {
  if (points.length < 3) return null;

  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    gaps.push(points[i].t - points[i - 1].t);
  }

  const width = 600;
  const height = 120;
  const padding = { top: 15, right: 10, bottom: 25, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxGap = Math.max(...gaps);
  const barW = Math.min(innerW / gaps.length, 8);
  const totalBarsW = barW * gaps.length;
  const startX = padding.left + (innerW - totalBarsW) / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Gráfico de ritmo entre puntos"
    >
      <rect x={0} y={0} width={width} height={height} rx={8} className="fill-black/40" />

      {/* Y label */}
      <text x={padding.left - 4} y={padding.top + 4} textAnchor="end" className="fill-white/50" fontSize={9}>
        {maxGap}s
      </text>
      <text x={padding.left - 4} y={height - padding.bottom + 4} textAnchor="end" className="fill-white/50" fontSize={9}>
        0s
      </text>

      {/* Bars */}
      {gaps.map((g, i) => {
        const barH = (g / (maxGap || 1)) * innerH;
        const x = startX + i * barW;
        const y = padding.top + innerH - barH;
        const color = g > 30 ? "#f87171" : g > 15 ? "#fbbf24" : "#34d399";
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={Math.max(barW - 1, 1)}
            height={barH}
            fill={color}
            rx={1}
            opacity={0.85}
          />
        );
      })}

      {/* X label */}
      <text x={width / 2} y={height - 4} textAnchor="middle" className="fill-white/40" fontSize={9}>
        puntos →
      </text>
    </svg>
  );
}

// --- Point Timeline ---

function PointTimeline({ points }: { points: PointLog[] }) {
  if (points.length === 0) return null;

  // Calculate game separators (every 4+ points where score resets)
  // Simple approach: group points into "games" of ~4-8 points each
  const gameSeparators: number[] = [];
  let p1Count = 0;
  let p2Count = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].p === 1) p1Count++;
    else p2Count++;
    // A game ends when someone reaches 4+ and leads by 2+, or tiebreak logic
    if ((p1Count >= 4 || p2Count >= 4) && Math.abs(p1Count - p2Count) >= 2) {
      gameSeparators.push(i);
      p1Count = 0;
      p2Count = 0;
    }
  }

  return (
    <div className="flex flex-wrap gap-0.5 items-center">
      {points.map((pt, i) => (
        <span key={i} className="inline-flex items-center">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              pt.p === 1 ? "bg-emerald-400" : "bg-red-400"
            }`}
            title={`Punto ${i + 1}: ${pt.p === 1 ? "Yo" : "Rival"} — HR: ${pt.hr} — ${Math.round(pt.t / 60)}m`}
          />
          {gameSeparators.includes(i) && (
            <span className="w-px h-4 bg-white/30 mx-1 inline-block" />
          )}
        </span>
      ))}
    </div>
  );
}

// --- Stats Summary ---

function StatsSummary({ points, duration }: { points: PointLog[]; duration: number }) {
  const p1Points = points.filter((p) => p.p === 1).length;
  const p2Points = points.filter((p) => p.p === 2).length;
  const total = p1Points + p2Points;
  const p1Pct = total > 0 ? Math.round((p1Points / total) * 100) : 0;

  // Time between points
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    gaps.push(points[i].t - points[i - 1].t);
  }
  const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
  const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;

  // HR zones (approximate time in each zone)
  const zone1Points = points.filter((p) => p.hr < 120).length;
  const zone2Points = points.filter((p) => p.hr >= 120 && p.hr <= 150).length;
  const zone3Points = points.filter((p) => p.hr > 150).length;
  const zoneTotal = zone1Points + zone2Points + zone3Points || 1;
  const zone1Pct = Math.round((zone1Points / zoneTotal) * 100);
  const zone2Pct = Math.round((zone2Points / zoneTotal) * 100);
  const zone3Pct = Math.round((zone3Points / zoneTotal) * 100);

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {/* Points won */}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
        <p className="text-white/50 text-xs mb-1">Puntos ganados</p>
        <div className="flex items-end gap-2">
          <span className="text-emerald-400 font-bold text-lg">{p1Points}</span>
          <span className="text-white/40 text-xs">vs</span>
          <span className="text-red-400 font-bold text-lg">{p2Points}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
          <div className="bg-emerald-400 h-full" style={{ width: `${p1Pct}%` }} />
          <div className="bg-red-400 h-full" style={{ width: `${100 - p1Pct}%` }} />
        </div>
        <p className="text-white/40 text-xs mt-1">{p1Pct}% — {100 - p1Pct}%</p>
      </div>

      {/* Rhythm */}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
        <p className="text-white/50 text-xs mb-1">Ritmo</p>
        <p className="text-white font-semibold">{avgGap}s <span className="text-white/40 font-normal text-xs">prom. entre pts</span></p>
        <p className="text-white/60 text-xs mt-1">Máx descanso: {maxGap}s</p>
      </div>

      {/* HR Zones */}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10 col-span-2">
        <p className="text-white/50 text-xs mb-2">Zonas HR</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white/70 text-xs">&lt;120 bpm</span>
              <span className="text-white/40 text-xs ml-auto">{zone1Pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${zone1Pct}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-white/70 text-xs">120–150</span>
              <span className="text-white/40 text-xs ml-auto">{zone2Pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full" style={{ width: `${zone2Pct}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-white/70 text-xs">&gt;150</span>
              <span className="text-white/40 text-xs ml-auto">{zone3Pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="bg-red-400 h-full rounded-full" style={{ width: `${zone3Pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Contextual insights */}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10 col-span-2">
        <p className="text-white/50 text-xs mb-2">💡 Insights</p>
        <ul className="space-y-1.5 text-white/70 text-[11px]">
          {p1Pct >= 55 && <li>✅ Dominaste el partido ({p1Pct}% de puntos ganados)</li>}
          {p1Pct < 45 && <li>⚠️ Tu rival ganó más puntos ({100 - p1Pct}%). Revisa momentos de presión.</li>}
          {p1Pct >= 45 && p1Pct < 55 && <li>⚖️ Partido parejo — la diferencia estuvo en momentos clave.</li>}
          {zone3Pct > 50 && <li>🔥 Alta intensidad — más del {zone3Pct}% del partido sobre 150 bpm. Buen esfuerzo físico.</li>}
          {zone3Pct < 20 && zone1Pct > 40 && <li>😌 Partido de baja intensidad — la mayoría del tiempo bajo 120 bpm.</li>}
          {avgGap > 30 && <li>🐢 Ritmo lento ({avgGap}s entre puntos) — mucho descanso entre rallies.</li>}
          {avgGap < 15 && <li>⚡ Ritmo rápido ({avgGap}s entre puntos) — rallies cortos y puntos rápidos.</li>}
          {maxGap > 120 && <li>⏸️ Hubo una pausa larga ({Math.round(maxGap / 60)} min) — posible cambio de lado o descanso.</li>}
          {duration > 5400 && <li>🏋️ Partido largo ({Math.round(duration / 60)} min) — buena resistencia.</li>}
        </ul>
      </div>
    </div>
  );
}

// --- HR vs Win Rate (cross analysis) ---

function HRvsWinRate({ points }: { points: PointLog[] }) {
  const zones = [
    { label: "<120", min: 0, max: 120, color: "#34d399" },
    { label: "120-140", min: 120, max: 140, color: "#a3e635" },
    { label: "140-160", min: 140, max: 160, color: "#fbbf24" },
    { label: ">160", min: 160, max: 999, color: "#f87171" },
  ];

  const zoneStats = zones.map(zone => {
    const zonePoints = points.filter(p => p.hr >= zone.min && p.hr < zone.max && p.hr > 0);
    const won = zonePoints.filter(p => p.p === 1).length;
    const total = zonePoints.length;
    const winPct = total > 0 ? Math.round((won / total) * 100) : 0;
    return { ...zone, won, total, winPct };
  }).filter(z => z.total > 0);

  if (zoneStats.length < 2) return null;

  return (
    <div>
      <p className="text-white/90 text-sm font-medium mb-2">🎯 Win Rate by HR Zone</p>
      <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
        {zoneStats.map((z, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-white/50 text-[10px] w-14">{z.label}</span>
            <div className="flex-1 h-5 rounded-full bg-white/10 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${z.winPct}%`, backgroundColor: z.color }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold drop-shadow">
                {z.winPct}% ({z.won}/{z.total})
              </span>
            </div>
          </div>
        ))}
        <p className="text-white/30 text-[9px] mt-1">
          Do you perform better rested or under pressure?
        </p>
      </div>
    </div>
  );
}

// --- Momentum Chart: running win % over time ---

function MomentumChart({ points }: { points: PointLog[] }) {
  if (points.length < 10) return null;

  const width = 600;
  const height = 160;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Calculate rolling win % (window of 10 points)
  const windowSize = 8;
  const momentumData: Array<{t: number, pct: number, hr: number}> = [];
  
  for (let i = windowSize; i <= points.length; i++) {
    const window = points.slice(i - windowSize, i);
    const won = window.filter(p => p.p === 1).length;
    const pct = (won / windowSize) * 100;
    const avgHr = Math.round(window.reduce((s, p) => s + p.hr, 0) / windowSize);
    momentumData.push({ t: points[i-1].t, pct, hr: avgHr });
  }

  const minT = momentumData[0].t;
  const maxT = momentumData[momentumData.length - 1].t;
  const timeRange = maxT - minT || 1;

  const toX = (t: number) => padding.left + ((t - minT) / timeRange) * innerW;
  const toY = (pct: number) => padding.top + (1 - pct / 100) * innerH;

  // Momentum line
  const pathD = momentumData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.t).toFixed(1)} ${toY(d.pct).toFixed(1)}`)
    .join(" ");

  // HR line (scaled to same height)
  const minHR = Math.min(...momentumData.map(d => d.hr));
  const maxHR = Math.max(...momentumData.map(d => d.hr));
  const hrRange = maxHR - minHR || 1;
  const toYhr = (hr: number) => padding.top + (1 - (hr - minHR) / hrRange) * innerH;

  const hrPathD = momentumData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.t).toFixed(1)} ${toYhr(d.hr).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <p className="text-white/90 text-sm font-medium mb-2">📈 Momentum vs HR</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img">
        <rect x={0} y={0} width={width} height={height} rx={8} className="fill-black/40" />
        
        {/* 50% line (neutral) */}
        <line x1={padding.left} y1={toY(50)} x2={width - padding.right} y2={toY(50)}
          stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
        <text x={padding.left - 4} y={toY(50) + 3} textAnchor="end" className="fill-white/40" fontSize={9}>50%</text>
        <text x={padding.left - 4} y={toY(100) + 3} textAnchor="end" className="fill-white/40" fontSize={9}>100%</text>
        <text x={padding.left - 4} y={toY(0) + 3} textAnchor="end" className="fill-white/40" fontSize={9}>0%</text>

        {/* HR line (background, subtle) */}
        <path d={hrPathD} fill="none" stroke="rgba(248,113,113,0.3)" strokeWidth={1.5} strokeDasharray="3 3" />

        {/* Momentum line (main) */}
        <path d={pathD} fill="none" stroke="#34d399" strokeWidth={2.5} strokeLinejoin="round" />

        {/* Area fill under momentum */}
        <path d={`${pathD} L ${toX(maxT)} ${toY(0)} L ${toX(minT)} ${toY(0)} Z`}
          fill="url(#momentumGradient)" opacity={0.2} />
        <defs>
          <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Legend */}
        <line x1={width - 120} y1={12} x2={width - 105} y2={12} stroke="#34d399" strokeWidth={2} />
        <text x={width - 100} y={15} className="fill-white/60" fontSize={9}>Win %</text>
        <line x1={width - 60} y1={12} x2={width - 45} y2={12} stroke="rgba(248,113,113,0.5)" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={width - 40} y={15} className="fill-white/40" fontSize={9}>HR</text>

        {/* X axis */}
        <text x={padding.left} y={height - 4} className="fill-white/40" fontSize={9}>Start</text>
        <text x={width - padding.right} y={height - 4} textAnchor="end" className="fill-white/40" fontSize={9}>End</text>
      </svg>
      <p className="text-white/30 text-[9px] mt-1">Green line = your rolling win rate. Red dashed = HR trend. When they diverge, fatigue affects performance.</p>
    </div>
  );
}

// --- Point Intensity scatter: HR at each point, colored by outcome ---

function IntensityScatter({ points }: { points: PointLog[] }) {
  if (points.length < 5) return null;

  const width = 600;
  const height = 140;
  const padding = { top: 15, right: 15, bottom: 25, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const validPoints = points.filter(p => p.hr > 0);
  if (validPoints.length < 5) return null;

  const minT = validPoints[0].t;
  const maxT = validPoints[validPoints.length - 1].t;
  const minHR = Math.min(...validPoints.map(p => p.hr)) - 5;
  const maxHR = Math.max(...validPoints.map(p => p.hr)) + 5;
  const timeRange = maxT - minT || 1;
  const hrRange = maxHR - minHR || 1;

  const toX = (t: number) => padding.left + ((t - minT) / timeRange) * innerW;
  const toY = (hr: number) => padding.top + (1 - (hr - minHR) / hrRange) * innerH;

  return (
    <div>
      <p className="text-white/90 text-sm font-medium mb-2">💥 Point Intensity</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img">
        <rect x={0} y={0} width={width} height={height} rx={8} className="fill-black/40" />

        {/* Y axis labels */}
        <text x={padding.left - 4} y={toY(maxHR) + 3} textAnchor="end" className="fill-white/40" fontSize={9}>{maxHR}</text>
        <text x={padding.left - 4} y={toY(minHR) + 3} textAnchor="end" className="fill-white/40" fontSize={9}>{minHR}</text>

        {/* Points as dots: green=won, red=lost */}
        {validPoints.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.t)}
            cy={toY(p.hr)}
            r={3}
            fill={p.p === 1 ? "#34d399" : "#f87171"}
            opacity={0.7}
          />
        ))}

        {/* Legend */}
        <circle cx={width - 100} cy={12} r={3} fill="#34d399" />
        <text x={width - 93} y={15} className="fill-white/60" fontSize={9}>Won</text>
        <circle cx={width - 55} cy={12} r={3} fill="#f87171" />
        <text x={width - 48} y={15} className="fill-white/60" fontSize={9}>Lost</text>

        <text x={padding.left} y={height - 4} className="fill-white/40" fontSize={9}>Match start →</text>
        <text x={width - padding.right} y={height - 4} textAnchor="end" className="fill-white/40" fontSize={9}>End</text>
      </svg>
      <p className="text-white/30 text-[9px] mt-1">Each dot = one point. Y-axis = your HR. Green dots above red = you win more at high intensity.</p>
    </div>
  );
}

// --- Main Component ---

export default function MatchAnalytics({ currentUser }: { currentUser: Profile }) {
  const [sessions, setSessions] = useState<MatchPointLog[]>([]);
  const [rivalNames, setRivalNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"todos" | "oficial" | "amistoso">("todos");
  const [filterMonth, setFilterMonth] = useState<string>("todos");
  const [analysisLoading, setAnalysisLoading] = useState<string | null>(null);

  const hasGarmin = !!currentUser.garmin_paired_at;

  useEffect(() => {
    if (!hasGarmin) return;

    let cancelled = false;

    async function fetchSessions() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from("match_point_logs")
          .select("*")
          .eq("profile_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (fetchError) throw fetchError;
        if (!cancelled) {
          const sessionsData = (data as MatchPointLog[]) || [];
          setSessions(sessionsData);

          // Fetch rival names for official matches
          const matchIds = sessionsData.filter(s => s.match_id).map(s => s.match_id!);
          if (matchIds.length > 0) {
            const { data: matches } = await supabase
              .from("matches")
              .select("id, home_player_id, away_player_id")
              .in("id", matchIds);

            if (matches) {
              const rivalIds = (matches as any[]).map(m =>
                m.home_player_id === currentUser.id ? m.away_player_id : m.home_player_id
              ).filter(Boolean);

              const { data: profiles } = await supabase
                .from("profiles")
                .select("id, name, nickname")
                .in("id", [...new Set(rivalIds)]);

              const nameMap: Record<string, string> = {};
              if (profiles) {
                const profileMap: Record<string, string> = {};
                for (const p of profiles as any[]) {
                  profileMap[p.id] = p.nickname || p.name?.split(" ")[0] || "?";
                }
                for (const m of matches as any[]) {
                  const rivalId = m.home_player_id === currentUser.id ? m.away_player_id : m.home_player_id;
                  nameMap[m.id] = profileMap[rivalId] || "?";
                }
              }
              setRivalNames(nameMap);
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError("Error al cargar sesiones");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSessions();
    return () => { cancelled = true; };
  }, [hasGarmin, currentUser.id]);

  // Available months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    sessions.forEach(s => {
      const d = new Date(s.created_at);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(months).sort().reverse();
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (filterType === "oficial") result = result.filter(s => s.match_id != null);
    if (filterType === "amistoso") result = result.filter(s => s.match_id == null);
    if (filterMonth !== "todos") {
      result = result.filter(s => {
        const d = new Date(s.created_at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === filterMonth;
      });
    }
    return result;
  }, [sessions, filterType, filterMonth]);

  // Generate AI analysis for a match
  async function generateAnalysis(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    setAnalysisLoading(sessionId);
    try {
      const rival = session.match_id ? rivalNames[session.match_id] : "Rival";
      const points = session.point_log;
      const totalPoints = points.length;
      const pointsMe = points.filter(p => p.p === 1).length;
      const pointsRival = points.filter(p => p.p === 2).length;

      // --- Per-set stats ---
      // Split points into sets using cumulative game count from result
      const setStats: { me: number; rival: number; hrAvg: number }[] = [];
      const gamesPerSet = session.result || [];
      let pointIdx = 0;
      for (let s = 0; s < gamesPerSet.length; s++) {
        const totalGamesInSet = gamesPerSet[s].p1 + gamesPerSet[s].p2;
        // Approximate: distribute points proportionally per total games
        const pointsInSet = s < gamesPerSet.length - 1
          ? Math.round((totalGamesInSet / gamesPerSet.reduce((a, g) => a + g.p1 + g.p2, 0)) * totalPoints)
          : totalPoints - pointIdx;
        const setPoints = points.slice(pointIdx, pointIdx + pointsInSet);
        const setMe = setPoints.filter(p => p.p === 1).length;
        const setRival = setPoints.filter(p => p.p === 2).length;
        const setHrs = setPoints.filter(p => p.hr > 0).map(p => p.hr);
        const setHrAvg = setHrs.length > 0 ? Math.round(setHrs.reduce((a, b) => a + b, 0) / setHrs.length) : 0;
        setStats.push({ me: setMe, rival: setRival, hrAvg: setHrAvg });
        pointIdx += pointsInSet;
      }

      // --- Streaks ---
      let maxStreakMe = 0, maxStreakRival = 0, curMe = 0, curRival = 0;
      for (const p of points) {
        if (p.p === 1) { curMe++; curRival = 0; maxStreakMe = Math.max(maxStreakMe, curMe); }
        else { curRival++; curMe = 0; maxStreakRival = Math.max(maxStreakRival, curRival); }
      }

      // --- HR first half vs second half ---
      const halfIdx = Math.floor(points.length / 2);
      const firstHalfHr = points.slice(0, halfIdx).filter(p => p.hr > 0).map(p => p.hr);
      const secondHalfHr = points.slice(halfIdx).filter(p => p.hr > 0).map(p => p.hr);
      const hrFirstHalf = firstHalfHr.length > 0 ? Math.round(firstHalfHr.reduce((a, b) => a + b, 0) / firstHalfHr.length) : 0;
      const hrSecondHalf = secondHalfHr.length > 0 ? Math.round(secondHalfHr.reduce((a, b) => a + b, 0) / secondHalfHr.length) : 0;

      // --- Serve/return via scoring simulation ---
      // Replay game scoring to accurately track who is serving each point
      let servePointsMe = 0, serveTotal = 0, returnPointsMe = 0, returnTotal = 0;
      let srv = 1; // assume I served first
      let simP1pts = 0, simP2pts = 0;
      let simP1games = 0, simP2games = 0;
      let simInTB = false, simInSTB = false;

      for (const p of points) {
        // Track serve/return BEFORE simulating scoring
        if (srv === 1) { serveTotal++; if (p.p === 1) servePointsMe++; }
        else { returnTotal++; if (p.p === 1) returnPointsMe++; }

        if (simInTB || simInSTB) {
          // Tiebreak / Super tiebreak scoring
          if (p.p === 1) simP1pts++; else simP2pts++;
          const hi = Math.max(simP1pts, simP2pts);
          const lo = Math.min(simP1pts, simP2pts);
          const target = simInSTB ? 10 : 7;
          if (hi >= target && (hi - lo) >= 2) {
            // TB/STB won — new set
            simP1pts = 0; simP2pts = 0; simP1games = 0; simP2games = 0;
            simInTB = false; simInSTB = false;
            srv = srv === 1 ? 2 : 1;
          } else {
            // TB server: after 1st point, then every 2
            const tbTotal = simP1pts + simP2pts;
            if (tbTotal === 1 || (tbTotal > 1 && (tbTotal - 1) % 2 === 0)) {
              srv = srv === 1 ? 2 : 1;
            }
          }
        } else {
          // Standard tennis game scoring
          const scorerPts = p.p === 1 ? simP1pts : simP2pts;
          const otherPts = p.p === 1 ? simP2pts : simP1pts;
          let gameWon = false;

          if (scorerPts === 3 && otherPts === 3) {
            // Deuce → advantage
            if (p.p === 1) simP1pts = 4; else simP2pts = 4;
          } else if (scorerPts === 4 || otherPts === 4) {
            if (scorerPts === 4) { gameWon = true; }
            else { simP1pts = 3; simP2pts = 3; } // back to deuce
          } else if (scorerPts >= 3) {
            gameWon = true; // 40 vs <40
          } else {
            if (p.p === 1) simP1pts++; else simP2pts++;
          }

          if (gameWon) {
            if (p.p === 1) simP1games++; else simP2games++;
            simP1pts = 0; simP2pts = 0;

            // Check tiebreak at 6-6
            if (simP1games === 6 && simP2games === 6) {
              // Check if this is set 3 in supertiebreak format
              const completedSets = (session.result?.length || 1) - 1;
              if (session.format === 'supertiebreak' && completedSets >= 2) {
                simInSTB = true;
              } else {
                simInTB = true;
              }
            } else {
              const hiG = Math.max(simP1games, simP2games);
              const loG = Math.min(simP1games, simP2games);
              if (hiG >= 6 && (hiG - loG) >= 2) {
                simP1games = 0; simP2games = 0;
              }
            }
            srv = srv === 1 ? 2 : 1;
          }
        }
      }
      const servePct = serveTotal > 0 ? Math.round((servePointsMe / serveTotal) * 100) : 0;
      const returnPct = returnTotal > 0 ? Math.round((returnPointsMe / returnTotal) * 100) : 0;

      const payload = {
        session_id: sessionId,
        result: formatResult(session.result),
        format: session.format,
        duration_secs: session.duration_secs,
        avg_hr: session.avg_hr,
        max_hr: session.max_hr,
        calories: session.calories,
        total_points: totalPoints,
        points_won_me: pointsMe,
        points_won_rival: pointsRival,
        rival_name: rival || "Rival",
        date: session.created_at,
        // Enriched data
        set_stats: setStats.map((s, i) => `Set ${i + 1}: ${s.me}-${s.rival} puntos, HR prom ${s.hrAvg}`).join("; "),
        max_streak_me: maxStreakMe,
        max_streak_rival: maxStreakRival,
        hr_first_half: hrFirstHalf,
        hr_second_half: hrSecondHalf,
        serve_pct: servePct,
        return_pct: returnPct,
      };

      const res = await fetch("/api/live-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analysis", ...payload }),
      });

      if (!res.ok) throw new Error("Error generando análisis");

      const data = await res.json();
      const analysisText = data.analysis;

      // Save to DB
      await supabase
        .from("match_point_logs")
        .update({ analysis_text: analysisText })
        .eq("id", sessionId);

      // Update local state
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, analysis_text: analysisText } : s
      ));
    } catch (err) {
      console.error("Error generating analysis:", err);
      alert("No se pudo generar el análisis. Inténtalo más tarde.");
    } finally {
      setAnalysisLoading(null);
    }
  }

  // --- No Garmin paired CTA ---
  if (!hasGarmin) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⌚</span>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm mb-1">Conecta tu Garmin</h3>
            <p className="text-white/60 text-xs leading-relaxed mb-3">
              Conecta tu reloj Garmin para trackear frecuencia cardíaca, intensidad y estadísticas durante tus partidos.
            </p>
            <a
              href="https://apps.garmin.com/apps/54b355b9-097a-4192-a115-48107e4269c8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white text-emerald-700 font-semibold text-xs px-4 py-2 rounded-xl hover:bg-emerald-50 transition"
            >
              📥 Descargar app Garmin
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 text-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20" />
          <p className="text-white/50 text-sm">Cargando partidos...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5">
        <p className="text-red-300 text-sm text-center">{error}</p>
      </div>
    );
  }

  // --- Empty state ---
  if (sessions.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 text-center">
        <span className="text-3xl mb-2 block">📊</span>
        <p className="text-white/70 text-sm">No hay partidos registrados.</p>
        <p className="text-white/40 text-xs mt-1">Juega un partido con tu Garmin para ver tus estadísticas.</p>
      </div>
    );
  }

  // --- Session list with filters ---
  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <div className="flex gap-1">
          {(["todos", "oficial", "amistoso"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition capitalize ${
                filterType === f
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Month filter */}
        {availableMonths.length > 1 && (
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-2 py-1 rounded-lg text-[11px] bg-white/10 text-white/70 border border-white/10 outline-none"
          >
            <option value="todos">Todos los meses</option>
            {availableMonths.map(m => {
              const [y, mo] = m.split("-");
              const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
              return <option key={m} value={m}>{label}</option>;
            })}
          </select>
        )}
        <span className="text-white/60 text-[11px] ml-auto">{filteredSessions.length} partidos</span>
      </div>

      {/* Match selector — compact cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {filteredSessions.map((session) => {
          const isSelected = expandedId === session.id;
          const rival = session.match_id ? rivalNames[session.match_id] : null;
          return (
            <button
              key={session.id}
              onClick={() => setExpandedId(isSelected ? null : session.id)}
              className={`flex-shrink-0 p-3 rounded-xl border transition text-left min-w-[130px] ${
                isSelected
                  ? "bg-white/20 border-white/40 shadow-lg"
                  : "bg-white/8 border-white/15 hover:bg-white/15"
              }`}
            >
              <p className="text-white/70 text-[11px]">
                {new Date(session.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </p>
              {rival && <p className="text-white text-xs font-medium">vs {rival}</p>}
              <p className="text-white font-bold text-sm mt-0.5">{formatResult(session.result)}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {session.match_id ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Oficial" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" title="Amistoso" />
                )}
                <span className="text-white/60 text-[10px]">{formatDuration(session.duration_secs)}</span>
                {session.avg_hr > 0 && <span className="text-white/60 text-[10px]">❤️{session.avg_hr}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected match detail */}
      {expandedId && (() => {
        const session = filteredSessions.find(s => s.id === expandedId);
        if (!session || !session.point_log || session.point_log.length === 0) return null;
        const rival = session.match_id ? rivalNames[session.match_id] : null;

        return (
          <div className="space-y-4">
            {/* Match header */}
            <div className="bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {session.match_id ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">Oficial</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/60 border border-white/20">Amistoso</span>
                  )}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/60">
                    {FORMAT_LABELS[session.format] || session.format}
                  </span>
                </div>
                <span className="text-white/70 text-xs">{formatDate(session.created_at)}</span>
              </div>
              {rival && <p className="text-white/80 text-xs mb-1">vs {rival}</p>}
              <p className="text-white font-bold text-lg">{formatResult(session.result)}</p>
              <div className="flex items-center gap-4 mt-2 text-white/80 text-xs">
                <span>⏱ {formatDuration(session.duration_secs)}</span>
                {session.avg_hr > 0 && <span>❤️ {session.avg_hr} bpm prom</span>}
                {session.max_hr > 0 && <span>🔺 {session.max_hr} bpm máx</span>}
                {session.calories > 0 && <span>🔥 {session.calories} cal</span>}
                <span>🎯 {session.point_log.length} puntos</span>
              </div>
            </div>

            {/* Analysis text (if available) or generate button */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/90 text-sm font-medium">📝 Análisis</span>
                {!session.analysis_text && (
                  <button
                    onClick={() => generateAnalysis(session.id)}
                    disabled={analysisLoading === session.id}
                    className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-400/30 hover:bg-purple-500/30 transition disabled:opacity-50 disabled:cursor-wait"
                  >
                    {analysisLoading === session.id ? "Generando..." : "Generar analisis"}
                  </button>
                )}
              </div>
              {session.analysis_text ? (
                <div className="text-white/90 text-sm leading-relaxed space-y-3">
                  {session.analysis_text.split('\n\n').map((paragraph, i) => {
                    const colonIdx = paragraph.indexOf(':');
                    if (colonIdx > 0 && colonIdx < 25) {
                      const label = paragraph.slice(0, colonIdx);
                      const content = paragraph.slice(colonIdx + 1).trim();
                      return (
                        <p key={i}>
                          <span className="text-white font-semibold">{label}:</span> {content}
                        </p>
                      );
                    }
                    return <p key={i}>{paragraph}</p>;
                  })}
                </div>
              ) : (
                <p className="text-white/50 text-xs italic">
                  Genera un resumen del partido con puntos fuertes y areas de mejora.
                </p>
              )}
            </div>

            {/* Charts */}
            {session.point_log.length > 1 && (
              <div>
                <p className="text-white/90 text-sm font-medium mb-2">❤️ Frecuencia Cardíaca</p>
                <HRChart points={session.point_log} />
              </div>
            )}

            {session.point_log.length > 5 && (
              <HRvsWinRate points={session.point_log} />
            )}

            {session.point_log.length > 10 && (
              <MomentumChart points={session.point_log} />
            )}

            {session.point_log.length > 5 && (
              <IntensityScatter points={session.point_log} />
            )}

            {session.point_log.length > 2 && (
              <div>
                <p className="text-white/90 text-sm font-medium mb-2">⚡ Ritmo entre Puntos</p>
                <RhythmChart points={session.point_log} />
              </div>
            )}

            <StatsSummary points={session.point_log} duration={session.duration_secs} />

            <div>
              <p className="text-white/90 text-sm font-medium mb-2">🎾 Punto a Punto</p>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <PointTimeline points={session.point_log} />
                <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Yo</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Rival</span>
                  <span className="flex items-center gap-1"><span className="w-px h-3 bg-white/30 inline-block" /> Game</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
