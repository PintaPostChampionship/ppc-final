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
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const minHR = Math.min(...points.map((p) => p.hr)) - 5;
  const maxHR = Math.max(...points.map((p) => p.hr)) + 5;

  const timeRange = maxT - minT || 1;
  const hrRange = maxHR - minHR || 1;

  const toX = (t: number) => padding.left + ((t - minT) / timeRange) * innerW;
  const toY = (hr: number) => padding.top + (1 - (hr - minHR) / hrRange) * innerH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.t).toFixed(1)} ${toY(p.hr).toFixed(1)}`)
    .join(" ");

  // HR zone lines
  const zones = [120, 150];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Gráfico de frecuencia cardíaca durante el partido"
    >
      <rect x={0} y={0} width={width} height={height} rx={8} className="fill-black/40" />

      {/* Grid lines for HR zones */}
      {zones.map((z) =>
        z >= minHR && z <= maxHR ? (
          <g key={z}>
            <line
              x1={padding.left}
              y1={toY(z)}
              x2={width - padding.right}
              y2={toY(z)}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 4}
              y={toY(z) + 4}
              textAnchor="end"
              className="fill-white/50"
              fontSize={10}
            >
              {z}
            </text>
          </g>
        ) : null,
      )}

      {/* Y-axis labels */}
      <text x={padding.left - 4} y={toY(maxHR) + 4} textAnchor="end" className="fill-white/50" fontSize={10}>
        {maxHR}
      </text>
      <text x={padding.left - 4} y={toY(minHR) + 4} textAnchor="end" className="fill-white/50" fontSize={10}>
        {minHR}
      </text>

      {/* X-axis labels */}
      <text x={padding.left} y={height - 6} textAnchor="start" className="fill-white/50" fontSize={10}>
        0m
      </text>
      <text x={width - padding.right} y={height - 6} textAnchor="end" className="fill-white/50" fontSize={10}>
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
    </div>
  );
}

// --- Main Component ---

export default function MatchAnalytics({ currentUser }: { currentUser: Profile }) {
  const [sessions, setSessions] = useState<MatchPointLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          .limit(20);

        if (fetchError) throw fetchError;
        if (!cancelled) setSessions((data as MatchPointLog[]) || []);
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

  // --- No Garmin paired CTA ---
  if (!hasGarmin) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⌚</span>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm mb-1">Conectá tu Garmin</h3>
            <p className="text-white/60 text-xs leading-relaxed mb-3">
              Conectá tu reloj Garmin para trackear frecuencia cardíaca, intensidad y estadísticas
              durante tus partidos.
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
          <p className="text-white/50 text-sm">Cargando sesiones...</p>
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
        <p className="text-white/70 text-sm">Aún no hay sesiones registradas.</p>
        <p className="text-white/40 text-xs mt-1">Jugá un partido con tu Garmin para ver tus analytics.</p>
      </div>
    );
  }

  // --- Session list ---
  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <span>📊</span> Match Analytics
        <span className="text-white/40 text-xs font-normal">({sessions.length})</span>
      </h3>

      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        const totalPoints = session.point_log?.length || 0;

        return (
          <div
            key={session.id}
            className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden transition-all"
          >
            {/* Session card header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="w-full p-4 text-left flex items-center gap-3 hover:bg-white/5 transition"
              aria-expanded={isExpanded}
              aria-controls={`session-detail-${session.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white/80 text-xs">{formatDate(session.created_at)}</span>
                  {/* Official/Friendly badge */}
                  {session.match_id ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Oficial
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/50 border border-white/10">
                      Amistoso
                    </span>
                  )}
                  {/* Format badge */}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/40">
                    {FORMAT_LABELS[session.format] || session.format}
                  </span>
                </div>

                {/* Result */}
                <p className="text-white font-bold text-sm">
                  {formatResult(session.result)}
                </p>

                {/* Quick stats */}
                <div className="flex items-center gap-3 mt-1 text-white/50 text-xs">
                  <span>⏱ {formatDuration(session.duration_secs)}</span>
                  <span>❤️ {session.avg_hr} bpm</span>
                  <span>🔥 {session.calories} cal</span>
                  <span>🎯 {totalPoints} pts</span>
                </div>
              </div>

              {/* Expand icon */}
              <span
                className={`text-white/40 text-sm transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                ▼
              </span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div
                id={`session-detail-${session.id}`}
                className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4"
              >
                {/* HR over time chart */}
                {session.point_log && session.point_log.length > 1 && (
                  <div>
                    <p className="text-white/60 text-xs font-medium mb-2">❤️ Frecuencia cardíaca</p>
                    <HRChart points={session.point_log} />
                  </div>
                )}

                {/* Rhythm chart */}
                {session.point_log && session.point_log.length > 2 && (
                  <div>
                    <p className="text-white/60 text-xs font-medium mb-2">⚡ Ritmo entre puntos</p>
                    <RhythmChart points={session.point_log} />
                  </div>
                )}

                {/* Stats summary */}
                {session.point_log && session.point_log.length > 0 && (
                  <StatsSummary points={session.point_log} duration={session.duration_secs} />
                )}

                {/* Point by point timeline */}
                {session.point_log && session.point_log.length > 0 && (
                  <div>
                    <p className="text-white/60 text-xs font-medium mb-2">🎾 Punto a punto</p>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <PointTimeline points={session.point_log} />
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Yo
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400" /> Rival
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-px h-3 bg-white/30 inline-block" /> Game
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
