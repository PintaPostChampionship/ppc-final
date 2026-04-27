import * as React from "react";
import { supabase } from "../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TennisSession {
  source: "flow" | "better" | "clubspark";
  title: string;
  start_datetime: string;
  duration_minutes: number;
  session_type: "drill" | "1x1";
  level: string;
  level_ntrp: number;
  price_gbp: number;
  availability: number;
  capacity: number;
  venue_name: string;
  venue_postcode: string;
  booking_link: string;
}

interface SessionsData {
  generated_at: string;
  total_sessions: number;
  sessions: TennisSession[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Para repos privados hay que usar la API de GitHub con el token,
// raw.githubusercontent.com no acepta autenticación PAT.
const JSON_URL =
  "https://api.github.com/repos/jifones/booking_ppc/contents/data/tennis_sessions.json";

const DAY_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

const SOURCE_LABELS: Record<string, string> = {
  flow: "Flow",
  better: "Better",
  clubspark: "ClubSpark",
};

const SOURCE_COLORS: Record<string, string> = {
  flow: "bg-violet-100 text-violet-800",
  better: "bg-sky-100 text-sky-800",
  clubspark: "bg-amber-100 text-amber-800",
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

const TYPE_COLORS: Record<string, string> = {
  drill: "bg-emerald-100 text-emerald-800",
  "1x1": "bg-rose-100 text-rose-800",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise any ISO datetime string to UTC ISO so keys match regardless of timezone offset */
function toUtcIso(isoString: string): string {
  return new Date(isoString).toISOString();
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDayFull(isoString: string): string {
  const d = new Date(isoString);
  const day = DAY_LABELS[d.getDay()];
  const date = d.getDate();
  const month = d.toLocaleString("es-ES", { month: "short" });
  return `${day} ${date} ${month}`;
}

function getDateKey(isoString: string): string {
  // Returns YYYY-MM-DD in the session's local date
  const d = new Date(isoString);
  return d.toLocaleDateString("sv-SE"); // gives YYYY-MM-DD
}

function groupByDay(sessions: TennisSession[]): Map<string, TennisSession[]> {
  const map = new Map<string, TennisSession[]>();
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.start_datetime).getTime() -
      new Date(b.start_datetime).getTime()
  );
  for (const s of sorted) {
    const key = getDateKey(s.start_datetime);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

function availabilityBadge(available: number, capacity: number) {
  const pct = capacity > 0 ? available / capacity : 0;
  if (available === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
        Completo
      </span>
    );
  if (pct <= 0.3)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
        🔥 {available} plaza{available > 1 ? "s" : ""}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
      ✓ {available} / {capacity}
    </span>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  watchlist,
  onWatchlistChange,
  currentUserId,
}: {
  session: TennisSession;
  watchlist: Set<string>;
  onWatchlistChange: (key: string, add: boolean) => void;
  currentUserId: string | null;
}) {
  const unavailable = session.availability === 0;
  const watchKey = `${session.booking_link}|${toUtcIso(session.start_datetime)}`;
  const isWatching = watchlist.has(watchKey);
  const [loadingWatch, setLoadingWatch] = React.useState(false);

  async function handleWatchToggle(e: React.MouseEvent) {
    e.preventDefault();
    if (!currentUserId || loadingWatch) return;
    setLoadingWatch(true);
    try {
      if (isWatching) {
        await supabase
          .from("session_watchlist")
          .delete()
          .eq("profile_id", currentUserId)
          .eq("booking_link", session.booking_link)
          .eq("start_datetime", toUtcIso(session.start_datetime));
        onWatchlistChange(watchKey, false);
      } else {
        await supabase.from("session_watchlist").upsert({
          profile_id: currentUserId,
          booking_link: session.booking_link,
          start_datetime: toUtcIso(session.start_datetime),
          title: session.title,
          venue_name: session.venue_name,
          venue_postcode: session.venue_postcode,
          price_gbp: session.price_gbp,
          session_type: session.session_type,
          level: session.level,
          source: session.source,
        }, { onConflict: "profile_id,booking_link,start_datetime" });
        onWatchlistChange(watchKey, true);
      }
    } finally {
      setLoadingWatch(false);
    }
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm p-4 flex flex-col gap-3 transition hover:shadow-md ${
        unavailable ? "opacity-60" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-gray-900 leading-tight">
            {session.title}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatTime(session.start_datetime)} · {session.duration_minutes} min
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              TYPE_COLORS[session.session_type] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {session.session_type === "1x1" ? "1×1" : "Drill"}
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              SOURCE_COLORS[session.source] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {SOURCE_LABELS[session.source] ?? session.source}
          </span>
        </div>
      </div>

      {/* Level + availability row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
            LEVEL_COLORS[session.level] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {session.level} {session.level_ntrp > 0 && `(NTRP ${session.level_ntrp})`}
        </span>
        {availabilityBadge(session.availability, session.capacity)}
      </div>

      {/* Venue + price */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span className="truncate max-w-[60%]">
          📍 {session.venue_name}
          {session.venue_postcode && (
            <span className="text-gray-400 ml-1">{session.venue_postcode}</span>
          )}
        </span>
        <span className="font-semibold text-gray-900 shrink-0">
          £{session.price_gbp.toFixed(0)}
        </span>
      </div>

      {/* Booking link + avísame */}
      <div className="mt-1 flex flex-col gap-2">
        <a
          href={session.booking_link}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            unavailable
              ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
              : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
          }`}
        >
          {unavailable ? "No disponible" : "Reservar →"}
        </a>

        {/* Botón Avísame — solo en sesiones completas */}
        {unavailable && currentUserId && (
          <button
            onClick={handleWatchToggle}
            disabled={loadingWatch}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition border ${
              isWatching
                ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700"
            } ${loadingWatch ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {loadingWatch ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : isWatching ? (
              "🔕 Cancelar aviso"
            ) : (
              "🔔 Avísame si se libera"
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BuscarClases({ onBack, currentUserId }: { onBack: () => void; currentUserId: string | null }) {
  const [data, setData] = React.useState<SessionsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = React.useState<"all" | "drill" | "1x1">("all");
  const [filterSource, setFilterSource] = React.useState<"all" | "flow" | "better" | "clubspark">("all");
  const [filterLevel, setFilterLevel] = React.useState<string>("all");

  // Watchlist — set de "booking_link|start_datetime"
  const [watchlist, setWatchlist] = React.useState<Set<string>>(new Set());

  // ── Fetch sessions ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = import.meta.env.VITE_GITHUB_TOKEN as string | undefined;
        const headers: HeadersInit = {
          Accept: "application/vnd.github.v3.raw",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(JSON_URL, { headers });
        if (!res.ok) {
          throw new Error(
            `Error al cargar las sesiones (HTTP ${res.status}). ${
              res.status === 401
                ? "Token inválido o sin permisos."
                : res.status === 404
                ? "Archivo no encontrado en el repo."
                : "Comprueba que VITE_GITHUB_TOKEN está configurado."
            }`
          );
        }
        const json: SessionsData = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // ── Fetch watchlist ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("session_watchlist")
      .select("booking_link, start_datetime")
      .eq("profile_id", currentUserId)
      .then(({ data: rows }) => {
        if (!rows) return;
        setWatchlist(
          new Set(rows.map((r) => `${r.booking_link}|${toUtcIso(r.start_datetime)}`))
        );
      });
  }, [currentUserId]);

  function handleWatchlistChange(key: string, add: boolean) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (add) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filteredSessions = React.useMemo(() => {
    if (!data) return [];
    return data.sessions.filter((s) => {
      if (filterType !== "all" && s.session_type !== filterType) return false;
      if (filterSource !== "all" && s.source !== filterSource) return false;
      if (filterLevel !== "all" && s.level !== filterLevel) return false;
      return true;
    });
  }, [data, filterType, filterSource, filterLevel]);

  const groupedByDay = React.useMemo(
    () => groupByDay(filteredSessions),
    [filteredSessions]
  );

  // Unique levels available
  const availableLevels = React.useMemo(() => {
    if (!data) return [];
    return [...new Set(data.sessions.map((s) => s.level))].sort();
  }, [data]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900 transition shrink-0"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Volver
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              🎾 Buscar clases
            </h1>
            {data && (
              <p className="text-xs text-gray-500">
                {filteredSessions.length} sesión
                {filteredSessions.length !== 1 ? "es" : ""} · Actualizado{" "}
                {new Date(data.generated_at).toLocaleString("es-ES", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── Filters ── */}
        {data && (
          <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Tipo
              </label>
              <div className="flex gap-1.5">
                {(["all", "drill", "1x1"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterType(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                      filterType === v
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400"
                    }`}
                  >
                    {v === "all" ? "Todos" : v === "1x1" ? "1×1" : "Drill"}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Plataforma
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "flow", "better", "clubspark"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFilterSource(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                      filterSource === v
                        ? "bg-sky-600 text-white border-sky-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-sky-400"
                    }`}
                  >
                    {v === "all" ? "Todas" : SOURCE_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Nivel
              </label>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterLevel("all")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                    filterLevel === "all"
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-violet-400"
                  }`}
                >
                  Todos
                </button>
                {availableLevels.map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setFilterLevel(lv)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border capitalize ${
                      filterLevel === lv
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-violet-400"
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {(filterType !== "all" || filterSource !== "all" || filterLevel !== "all") && (
              <button
                onClick={() => {
                  setFilterType("all");
                  setFilterSource("all");
                  setFilterLevel("all");
                }}
                className="ml-auto text-xs text-gray-500 hover:text-red-600 underline transition"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
            <p className="text-gray-600 text-sm">Cargando sesiones disponibles…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-700 font-medium mb-1">No se pudieron cargar las clases</p>
            <p className="text-red-500 text-sm">{error}</p>
            <p className="text-xs text-gray-500 mt-3">
              Asegúrate de que la variable{" "}
              <code className="bg-gray-100 px-1 rounded">VITE_GITHUB_TOKEN</code> está
              configurada en Vercel con permisos de lectura al repo privado.
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && filteredSessions.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-3xl mb-3">🎾</p>
            <p className="text-gray-700 font-medium">No hay sesiones disponibles</p>
            <p className="text-gray-500 text-sm mt-1">
              Prueba a cambiar los filtros o espera a la próxima actualización.
            </p>
          </div>
        )}

        {/* ── Weekly board ── */}
        {!loading && !error && groupedByDay.size > 0 && (
          <div className="space-y-8">
            {Array.from(groupedByDay.entries()).map(([dateKey, sessions]) => (
              <section key={dateKey}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <h2 className="text-sm font-bold text-gray-600 uppercase tracking-widest whitespace-nowrap">
                    {formatDayFull(sessions[0].start_datetime)}
                  </h2>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Session cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sessions.map((session, idx) => (
                    <SessionCard
                      key={`${dateKey}-${idx}`}
                      session={session}
                      watchlist={watchlist}
                      onWatchlistChange={handleWatchlistChange}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
