import * as React from "react";
import { supabase } from "../lib/supabaseClient";
// CourtFinder v4 — 2026-05-08 21:15

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourtSlot {
  venue_name: string;
  venue_slug: string;
  platform: "better" | "clubspark" | "parks";
  court_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price_gbp: number | null;
  spaces: number;
  available: boolean;
  booking_link: string;
  venue_lat: number;
  venue_lng: number;
  venue_postcode: string;
  last_checked: string;
}

interface CourtData {
  generated_at: string;
  dates_checked: string[];
  venues_checked: number;
  total_slots: number;
  slots: CourtSlot[];
}

interface VenueSummary {
  name: string;
  slug: string;
  platform: string;
  postcode: string;
  lat: number;
  lng: number;
  totalSlots: number;
  slots: CourtSlot[];
  distance?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JSON_URL =
  "https://api.github.com/repos/jifones/booking_ppc/contents/data/court_availability.json";

const PLATFORM_LABELS: Record<string, string> = { better: "Better", clubspark: "ClubSpark", parks: "Parks", camden: "Camden" };
const PLATFORM_COLORS: Record<string, string> = { better: "bg-sky-100 text-sky-800", clubspark: "bg-amber-100 text-amber-800", parks: "bg-violet-100 text-violet-800", camden: "bg-rose-100 text-rose-800" };
const DAY_LABELS: Record<number, string> = { 0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };

const TIME_BLOCKS = [
  { label: "Todo", value: "all", hours: [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21] },
  { label: "Mañana (07:00-12:00)", value: "morning", hours: [7,8,9,10,11] },
  { label: "Tarde (12:00-18:00)", value: "afternoon", hours: [12,13,14,15,16,17] },
  { label: "Noche (18:00-22:00)", value: "evening", hours: [18,19,20,21] },
];

const ALL_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const NON_TENNIS_KEYWORDS = ["cricket", "netball", "football", "muga", "astro", "pitch"];

// All configured venues (always shown even with 0 availability)
const ALL_VENUES_STATIC: Array<{ name: string; slug: string; platform: string; postcode: string; lat: number; lng: number }> = [
  { name: "Highbury Fields", slug: "islington-tennis-centre", platform: "better", postcode: "N5 1AR", lat: 51.552, lng: -0.098 },
  { name: "Islington Tennis Centre (Outdoor)", slug: "islington-tennis-centre", platform: "better", postcode: "N7 9LN", lat: 51.555, lng: -0.113 },
  { name: "Islington Tennis Centre (Indoor)", slug: "islington-tennis-centre", platform: "better", postcode: "N7 9LN", lat: 51.555, lng: -0.113 },
  { name: "Tufnell Park", slug: "islington-tennis-centre", platform: "better", postcode: "N7 0PG", lat: 51.553, lng: -0.134 },
  { name: "Rosemary Gardens", slug: "islington-tennis-centre", platform: "better", postcode: "N1 2DT", lat: 51.540, lng: -0.095 },
  { name: "Kennington Park", slug: "kenningtonpark", platform: "clubspark", postcode: "SE11 4BE", lat: 51.480, lng: -0.106 },
  { name: "Archbishops Park", slug: "archbishopsparklambethnorth", platform: "clubspark", postcode: "SE1 7LE", lat: 51.498, lng: -0.115 },
  { name: "Burgess Park", slug: "BurgessParkSouthwark", platform: "clubspark", postcode: "SE5 0RJ", lat: 51.483, lng: -0.082 },
  { name: "Vauxhall Park", slug: "VauxhallPark", platform: "clubspark", postcode: "SW8 1LA", lat: 51.478, lng: -0.123 },
  { name: "Larkhall Park", slug: "LarkhallPark", platform: "clubspark", postcode: "SW8 1QQ", lat: 51.474, lng: -0.127 },
  { name: "Battersea Park", slug: "BatterseaParkTennisCourts", platform: "clubspark", postcode: "SW11 4NJ", lat: 51.478, lng: -0.157 },
  { name: "Clapham Common", slug: "ClaphamCommon", platform: "clubspark", postcode: "SW4 9DE", lat: 51.457, lng: -0.148 },
  { name: "Myatts Field Park", slug: "myattsfieldspark", platform: "clubspark", postcode: "SE5 9RA", lat: 51.472, lng: -0.098 },
  { name: "Parliament Hill", slug: "ParliamentHillFieldsTennisCourts", platform: "clubspark", postcode: "NW5 1QR", lat: 51.556, lng: -0.150 },
  { name: "Finsbury Park", slug: "FinsburyPark", platform: "clubspark", postcode: "N4 2NQ", lat: 51.566, lng: -0.103 },
  { name: "Queens Park", slug: "QueensParkTennisCourts", platform: "clubspark", postcode: "NW6 6SG", lat: 51.534, lng: -0.204 },
  { name: "Clissold Park", slug: "ClissoldParkHackney", platform: "clubspark", postcode: "N16 9HJ", lat: 51.561, lng: -0.080 },
  { name: "Hackney Downs", slug: "HackneyDowns", platform: "clubspark", postcode: "E5 8ND", lat: 51.553, lng: -0.057 },
  { name: "Millfields Park", slug: "MillfieldsParkMiddlesex", platform: "clubspark", postcode: "E5 0AR", lat: 51.556, lng: -0.046 },
  { name: "London Fields", slug: "LondonFieldsPark", platform: "clubspark", postcode: "E8 3EU", lat: 51.541, lng: -0.058 },
  { name: "Spring Hill", slug: "SpringHillParkTennis", platform: "clubspark", postcode: "E5 9BE", lat: 51.557, lng: -0.049 },
  { name: "Abbotts Park", slug: "abbotts_playtenniswalthamforest_com", platform: "clubspark", postcode: "E17 5PJ", lat: 51.583, lng: -0.020 },
  { name: "Lloyd & Aveling Park", slug: "lloyd_playtenniswalthamforest_com", platform: "clubspark", postcode: "E17 4PP", lat: 51.585, lng: -0.028 },
  { name: "Hyde Park", slug: "hyde-park-courts", platform: "parks", postcode: "W2 2UH", lat: 51.507, lng: -0.170 },
  { name: "Regent's Park", slug: "the-regents-park-courts", platform: "parks", postcode: "NW1 4NR", lat: 51.527, lng: -0.153 },
  { name: "Hackney Parks (Outdoor)", slug: "hackney-parks", platform: "better", postcode: "E9 5SF", lat: 51.543, lng: -0.046 },
  { name: "Gunnersbury Park", slug: "gunnersbury-park-sports-hub", platform: "better", postcode: "W3 8LQ", lat: 51.492, lng: -0.283 },
  { name: "Avondale Park", slug: "AvondalePark", platform: "clubspark", postcode: "W11 4EY", lat: 51.510, lng: -0.207 },
  { name: "Kensington Memorial Park", slug: "KensingtonMemorialPark", platform: "clubspark", postcode: "W11 4QP", lat: 51.509, lng: -0.213 },
  { name: "Chelmsford Square", slug: "ChelmsfordSquare", platform: "clubspark", postcode: "NW10 3AR", lat: 51.533, lng: -0.225 },
  { name: "Ravenscourt Park", slug: "RavenscourtPark", platform: "clubspark", postcode: "W6 0UL", lat: 51.494, lng: -0.236 },
  { name: "Kilburn Grange", slug: "kilburn-grange", platform: "camden", postcode: "NW6 2JH", lat: 51.543, lng: -0.198 },
  { name: "Waterlow Park", slug: "waterlow-park", platform: "camden", postcode: "N6 5HG", lat: 51.569, lng: -0.147 },
  { name: "Victoria Park", slug: "VictoriaPark11", platform: "clubspark", postcode: "E9 7DE", lat: 51.536, lng: -0.040 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()} ${d.toLocaleString("es-ES", { month: "short" })}`;
}
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
}
function isTennisCourt(courtName: string | null): boolean {
  if (!courtName) return true;
  return !NON_TENNIS_KEYWORDS.some(kw => courtName.toLowerCase().includes(kw));
}
function getHour(time: string): number { return parseInt(time.split(":")[0], 10); }
function timeInBlock(time: string, block: string): boolean {
  const hour = getHour(time);
  const tb = TIME_BLOCKS.find(t => t.value === block);
  return tb ? tb.hours.includes(hour) : true;
}
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// ─── Slot Row ─────────────────────────────────────────────────────────────────

function HourBlock({ time, courts, bookingLink }: { time: string; courts: CourtSlot[]; bookingLink: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-emerald-50 active:bg-emerald-50 transition group">
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono font-semibold text-gray-800 w-12">{time}</span>
        <span className="text-xs text-gray-500">{courts.length} cancha{courts.length > 1 ? "s" : ""}</span>
        {courts[0]?.price_gbp != null && <span className="text-xs font-medium text-gray-600">£{courts[0].price_gbp.toFixed(0)}</span>}
      </div>
      <a href={bookingLink} target="_blank" rel="noopener noreferrer"
        className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition sm:opacity-0 sm:group-hover:opacity-100">
        Reservar
      </a>
    </div>
  );
}

// ─── Watch Panel ──────────────────────────────────────────────────────────────

function WatchPanel({ venue, allDates, availableHoursByDate, watchlist, onSave, initialDate, initialTimeBlock }: {
  venue: VenueSummary;
  allDates: string[];
  availableHoursByDate: Map<string, Set<number>>; // date → set of available hours
  watchlist: Set<string>;
  onSave: (venueSlug: string, venueName: string, platform: string, alerts: {date: string; hour: string}[], notifyBy: string) => void;
  initialDate?: string;
  initialTimeBlock?: string;
}) {
  const [watchDate, setWatchDate] = React.useState(
    (initialDate && initialDate !== "all" && allDates.includes(initialDate)) ? initialDate : (allDates[0] || "")
  );
  const [selectedHours, setSelectedHours] = React.useState<Set<string>>(new Set());
  const [notifyBy, setNotifyBy] = React.useState<"app" | "email" | "both">("app");

  // Pre-populate with existing watches for this venue+date
  React.useEffect(() => {
    const existing = new Set<string>();
    for (const key of watchlist) {
      const [slug, date, tb] = key.split("|");
      if (slug === venue.slug && date === watchDate) existing.add(tb);
    }
    setSelectedHours(existing);
  }, [watchDate, venue.slug, watchlist]);

  const availableHours = availableHoursByDate.get(watchDate) || new Set();

  const toggleHour = (h: string) => {
    setSelectedHours(prev => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h); else next.add(h);
      return next;
    });
  };

  const handleSave = () => {
    const alerts = Array.from(selectedHours).map(h => ({ date: watchDate, hour: h }));
    onSave(venue.slug, venue.name, venue.platform, alerts, notifyBy);
  };

  // Determine which hours to show based on a quick block filter
  const [blockFilter, setBlockFilter] = React.useState(
    (initialTimeBlock && initialTimeBlock !== "all") ? initialTimeBlock : "all"
  );
  const visibleHours = blockFilter === "all"
    ? ALL_HOURS
    : (TIME_BLOCKS.find(t => t.value === blockFilter)?.hours || ALL_HOURS);

  return (
    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200" onClick={e => e.stopPropagation()}>
      <div className="text-xs font-semibold text-amber-800 mb-2">🔔 Avísame cuando se libere una cancha:</div>

      {/* Date selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
        {allDates.map(d => (
          <button key={d} onClick={() => setWatchDate(d)}
            className={`text-sm px-3 py-1.5 rounded-full border whitespace-nowrap transition font-medium ${
              watchDate === d ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
            }`}>
            {formatDateShort(d)}
          </button>
        ))}
      </div>

      {/* Block filter */}
      <div className="flex gap-1 mb-2">
        {TIME_BLOCKS.map(tb => (
          <button key={tb.value} onClick={() => setBlockFilter(tb.value)}
            className={`text-xs px-2 py-0.5 rounded border transition ${
              blockFilter === tb.value ? "bg-amber-200 text-amber-800 border-amber-300" : "bg-white text-gray-500 border-gray-200 hover:border-amber-300"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Hour grid */}
      <div className="flex flex-wrap gap-1 mb-3">
        {visibleHours.map(h => {
          const hourStr = `${h}:00`;
          const isAvailable = availableHours.has(h);
          const isSelected = selectedHours.has(hourStr);
          return (
            <button key={h} onClick={() => toggleHour(hourStr)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition font-mono ${
                isSelected
                  ? "bg-amber-600 text-white border-amber-600"
                  : isAvailable
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-amber-400"
                    : "bg-white text-gray-500 border-gray-200 hover:border-amber-400"
              }`}>
              {h}:00
              {isAvailable && !isSelected && <span className="ml-0.5 text-emerald-500">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Save button */}
      <div className="flex flex-col gap-2">
        {/* Notify method toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">Avisar por:</span>
          <div className="flex gap-1">
            {([["app", "📱 App"], ["email", "📧 Email"], ["both", "Ambos"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setNotifyBy(val)}
                className={`text-xs px-2.5 py-1 rounded-md border transition ${
                  notifyBy === val ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-500 border-gray-200 hover:border-amber-400"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={selectedHours.size === 0}
            className="text-xs font-semibold px-4 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition">
            🔔 Guardar alertas ({selectedHours.size})
          </button>
          {selectedHours.size > 0 && (
            <button onClick={() => setSelectedHours(new Set())} className="text-xs text-gray-500 hover:text-red-600">
              Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Venue Card ───────────────────────────────────────────────────────────────

function VenueCard({ venue, filterDate, filterTimeRange, allDates, watchlist, onSaveWatch }: {
  venue: VenueSummary;
  filterDate: string;
  filterTimeRange: [number, number];
  allDates: string[];
  watchlist: Set<string>;
  onSaveWatch: (venueSlug: string, venueName: string, platform: string, alerts: {date: string; hour: string}[], notifyBy: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const [showWatch, setShowWatch] = React.useState(false);
  // Selected hour per date: date → time string (e.g. "18:00")
  const [selectedHour, setSelectedHour] = React.useState<{ date: string; time: string } | null>(null);

  // Filter slots
  const filteredSlots = venue.slots.filter(s => {
    if (filterDate !== "all" && s.date !== filterDate) return false;
    const hour = getHour(s.start_time);
    if (hour < filterTimeRange[0] || hour >= filterTimeRange[1]) return false;
    return true;
  });

  // Group by date → hour
  const byDate = new Map<string, Map<string, CourtSlot[]>>();
  for (const slot of filteredSlots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, new Map());
    const hourMap = byDate.get(slot.date)!;
    if (!hourMap.has(slot.start_time)) hourMap.set(slot.start_time, []);
    hourMap.get(slot.start_time)!.push(slot);
  }

  // Available hours by date (for watch panel)
  const availableHoursByDate = React.useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const slot of venue.slots) {
      if (!map.has(slot.date)) map.set(slot.date, new Set());
      map.get(slot.date)!.add(getHour(slot.start_time));
    }
    return map;
  }, [venue.slots]);

  const activeWatchCount = Array.from(watchlist).filter(k => k.startsWith(venue.slug + "|")).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-gray-100 cursor-pointer"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{expanded ? "▼" : "▶"}</span>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{venue.name}</h3>
              {venue.distance != null && <span className="text-xs text-gray-400">{venue.distance.toFixed(1)} km</span>}
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowWatch(!showWatch)}
              className={`text-xs px-2.5 py-1 rounded-md border transition flex items-center gap-1 ${
                activeWatchCount > 0
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : showWatch
                    ? "border-amber-400 bg-amber-100 text-amber-700"
                    : "border-gray-300 hover:border-amber-400 hover:text-amber-700 text-gray-500"
              }`}>
              🔔 {activeWatchCount > 0 ? `${activeWatchCount} alerta${activeWatchCount > 1 ? "s" : ""}` : "Crear alerta"}
              <span className={`text-[10px] transition ${showWatch ? "rotate-180" : ""}`}>▼</span>
            </button>
            <a href={googleMapsUrl(venue.lat, venue.lng)} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:border-emerald-400 hover:text-emerald-700 transition">📍</a>
          </div>
        </div>

        {/* Watch panel */}
        {showWatch && (
          <WatchPanel
            venue={venue}
            allDates={allDates}
            availableHoursByDate={availableHoursByDate}
            watchlist={watchlist}
            onSave={onSaveWatch}
            initialDate={filterDate}
            initialTimeBlock="all"
          />
        )}
      </div>

      {/* Slots — grouped by date, hours shown as clickable pills */}
      {expanded && filteredSlots.length > 0 && (
        <div className="px-4 py-3 space-y-3">
          {Array.from(byDate.entries()).map(([date, hourMap]) => {
            const sortedHours = Array.from(hourMap.entries()).sort(([a],[b]) => a.localeCompare(b));
            const totalCourts = sortedHours.reduce((sum, [, courts]) => sum + courts.length, 0);
            // Get booking link for selected hour, or first slot as fallback
            const isSelected = selectedHour?.date === date;
            const selectedSlot = isSelected
              ? hourMap.get(selectedHour!.time)?.[0]
              : null;
            const bookingLink = selectedSlot?.booking_link || sortedHours[0]?.[1]?.[0]?.booking_link;

            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{formatDate(date)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{totalCourts} cancha{totalCourts !== 1 ? "s" : ""}</span>
                    {bookingLink && (
                      <a href={bookingLink} target="_blank" rel="noopener noreferrer"
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md transition active:scale-95 ${
                          isSelected
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-gray-200 text-gray-600 hover:bg-emerald-600 hover:text-white"
                        }`}>
                        Reservar{isSelected ? ` ${selectedHour!.time}` : ""}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sortedHours.map(([time, courts]) => {
                    const isThisSelected = selectedHour?.date === date && selectedHour?.time === time;
                    return (
                      <button key={time}
                        onClick={() => setSelectedHour(isThisSelected ? null : { date, time })}
                        className={`text-xs font-mono px-2.5 py-1.5 rounded-md border transition cursor-pointer active:scale-95 ${
                          isThisSelected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:text-emerald-700"
                        }`}>
                        {time} <span className={isThisSelected ? "text-emerald-100" : "text-gray-400"}>({courts.length})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {expanded && filteredSlots.length === 0 && (
        <div className="px-4 py-3 text-xs text-gray-400 italic">Sin disponibilidad — crea una alerta para que te avisemos</div>
      )}
    </div>
  );
}

// ─── Map ──────────────────────────────────────────────────────────────────────

function CourtMap({ venues, onVenueClick, selectedVenue, userLat, userLng, onBoundsChange, controlRef, savedMapCenter, savedMapZoom, onMapMove }: {
  venues: VenueSummary[];
  onVenueClick: (slug: string) => void;
  selectedVenue: string | null;
  userLat: number | null;
  userLng: number | null;
  onBoundsChange: (visibleSlugs: string[]) => void;
  controlRef: React.MutableRefObject<{ fitAll: () => void; panTo: (lat: number, lng: number) => void } | null>;
  savedMapCenter?: [number, number] | null;
  savedMapZoom?: number | null;
  onMapMove?: (center: [number, number], zoom: number) => void;
}) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const initializedRef = React.useRef(false);
  const allVenuesRef = React.useRef<VenueSummary[]>(venues);
  allVenuesRef.current = venues;

  const reportVisible = React.useCallback((map: any) => {
    if (!map) return;
    const bounds = map.getBounds();
    const visible = allVenuesRef.current.filter(v => bounds.contains([v.lat, v.lng])).map(v => v.name);
    onBoundsChange(visible);
  }, [onBoundsChange]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const loadLeaflet = () => new Promise<void>((resolve) => {
      if ((window as any).L) { resolve(); return; }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
    loadLeaflet().then(() => {
      const L = (window as any).L;
      if (!L || !mapRef.current) return;
      if (!mapInstanceRef.current) {
        const center: [number, number] = savedMapCenter || (userLat && userLng ? [userLat, userLng] : [51.50, -0.12]);
        const zoom = savedMapZoom || 13;
        const map = L.map(mapRef.current).setView(center, zoom);
        mapInstanceRef.current = map;
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>', maxZoom: 19,
        }).addTo(map);
        if (userLat && userLng) {
          L.circleMarker([userLat, userLng], { radius: 8, fillColor: "#3b82f6", fillOpacity: 0.8, color: "white", weight: 2 }).addTo(map).bindPopup("Tu ubicación");
        }
        // My location button
        const locBtn = L.control({ position: "bottomleft" });
        locBtn.onAdd = () => {
          const div = L.DomUtil.create("div", "leaflet-bar");
          div.innerHTML = '<a href="#" title="Mi ubicación" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:white;font-size:18px;text-decoration:none;">📍</a>';
          L.DomEvent.on(div, "click", (e: any) => { L.DomEvent.stop(e); if (userLat && userLng) map.setView([userLat, userLng], 13); });
          return div;
        };
        locBtn.addTo(map);
        map.on("moveend", () => {
          reportVisible(map);
          if (onMapMove) {
            const c = map.getCenter();
            onMapMove([c.lat, c.lng], map.getZoom());
          }
        });
        setTimeout(() => reportVisible(map), 200);
        // Expose control methods
        controlRef.current = {
          fitAll: () => {
            if (allVenuesRef.current.length > 0) {
              map.fitBounds(allVenuesRef.current.map((v: VenueSummary) => [v.lat, v.lng]), { padding: [30, 30], maxZoom: 13 });
            }
          },
          panTo: (lat: number, lng: number) => {
            map.setView([lat, lng], 14);
          }
        };
      }
      const map = mapInstanceRef.current;
      for (const m of markersRef.current) map.removeLayer(m);
      markersRef.current = [];
      for (const venue of venues) {
        const isSelected = venue.name === selectedVenue;
        const hasSlots = venue.totalSlots > 0;
        const icon = L.divIcon({
          className: "custom-marker",
          html: '<div style="background:' + (isSelected ? "#059669" : hasSlots ? "#374151" : "#d1d5db") + ';color:white;border-radius:50%;width:' + (isSelected ? "32px" : "26px") + ';height:' + (isSelected ? "32px" : "26px") + ';display:flex;align-items:center;justify-content:center;font-size:' + (isSelected ? "13px" : "11px") + ';font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">' + (hasSlots ? venue.totalSlots : "0") + '</div>',
          iconSize: [isSelected ? 32 : 26, isSelected ? 32 : 26],
          iconAnchor: [isSelected ? 16 : 13, isSelected ? 16 : 13],
        });
        const marker = L.marker([venue.lat, venue.lng], { icon }).addTo(map);
        marker.bindPopup('<strong>' + venue.name + '</strong><br/>' + venue.totalSlots + ' slots · ' + venue.postcode);
        marker.on("click", () => onVenueClick(venue.name));
        markersRef.current.push(marker);
      }
      if (!initializedRef.current && userLat && userLng && !savedMapCenter) {
        map.setView([userLat, userLng], 13);
        initializedRef.current = true;
      }
    });
  }, [venues, selectedVenue, userLat, userLng, reportVisible]);

  if (!userLat || !userLng) {
    return <div className="w-full h-80 sm:h-[420px] rounded-xl border border-gray-200 shadow-sm bg-gray-50 flex items-center justify-center text-sm text-gray-400">Cargando mapa...</div>;
  }
  return <div ref={mapRef} className="w-full h-80 sm:h-[420px] rounded-xl border border-gray-200 shadow-sm z-0" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CourtFinder({ onBack, currentUserId }: { onBack: () => void; currentUserId?: string | null }) {
  const [data, setData] = React.useState<CourtData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Restore state from sessionStorage
  const STORAGE_KEY = 'ppc_court_finder_state';
  const savedState = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Expire after 10 minutes
      if (Date.now() - (parsed.timestamp ?? 0) > 10 * 60 * 1000) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch { return null; }
  }, []);

  // Filters
  const [filterDate, setFilterDate] = React.useState<string>(savedState?.filterDate ?? "all");
  const [filterTimeRange, setFilterTimeRange] = React.useState<[number, number]>(savedState?.filterTimeRange ?? [7, 22]);
  const [filterVenues, setFilterVenues] = React.useState<Set<string>>(new Set(savedState?.filterVenues ?? []));
  const [filterPlatform, setFilterPlatform] = React.useState<string>(savedState?.filterPlatform ?? "all");

  // Location
  const [userLat, setUserLat] = React.useState<number | null>(savedState?.userLat ?? null);
  const [userLng, setUserLng] = React.useState<number | null>(savedState?.userLng ?? null);

  // Watchlist
  const [watchlist, setWatchlist] = React.useState<Set<string>>(new Set());

  // Show all mode
  const [showAll, setShowAll] = React.useState(savedState?.showAll ?? false);

  // Map position
  const [mapCenter, setMapCenter] = React.useState<[number, number] | null>(savedState?.mapCenter ?? null);
  const [mapZoom, setMapZoom] = React.useState<number | null>(savedState?.mapZoom ?? null);

  // Persist state to sessionStorage on changes
  React.useEffect(() => {
    const state = {
      filterDate,
      filterTimeRange,
      filterVenues: Array.from(filterVenues),
      filterPlatform,
      userLat,
      userLng,
      showAll,
      mapCenter,
      mapZoom,
      timestamp: Date.now(),
    };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [filterDate, filterTimeRange, filterVenues, filterPlatform, userLat, userLng, showAll, mapCenter, mapZoom]);

  // Toast notification
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 5000);
  };

  // Map viewport — venues visible in current map bounds
  const [visibleInMap, setVisibleInMap] = React.useState<string[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = React.useState("");

  // Ref to map for programmatic control
  const mapControlRef = React.useRef<{ fitAll: () => void; panTo: (lat: number, lng: number) => void } | null>(null);

  // Geolocation — only fetch if not restored from session
  React.useEffect(() => {
    if (userLat !== null && userLng !== null) return; // Already have location (from session or previous)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => { setUserLat(51.48); setUserLng(-0.11); }, // Default: Kennington area
        { timeout: 5000 }
      );
    } else { setUserLat(51.48); setUserLng(-0.11); }
  }, []);

  // Fetch data
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = import.meta.env.VITE_GITHUB_TOKEN;
        const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(JSON_URL, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // Load watchlist
  React.useEffect(() => {
    if (!currentUserId) return;
    supabase.from("court_watchlist").select("venue_slug, target_date, time_block")
      .eq("profile_id", currentUserId).eq("is_active", true)
      .then(({ data: w }) => {
        if (w) setWatchlist(new Set(w.map(x => `${x.venue_slug}|${x.target_date}|${x.time_block}`)));
      });
  }, [currentUserId]);

  // Save watches (batch)
  const saveWatches = async (venueSlug: string, venueName: string, platform: string, alerts: {date: string; hour: string}[], notifyBy: string = "app") => {
    if (!currentUserId) return;

    // Deactivate existing watches for this venue
    const existingKeys = Array.from(watchlist).filter(k => k.startsWith(venueSlug + "|"));
    if (existingKeys.length > 0) {
      await supabase.from("court_watchlist")
        .update({ is_active: false })
        .eq("profile_id", currentUserId)
        .eq("venue_slug", venueSlug)
        .eq("is_active", true);
    }

    // Insert new watches
    if (alerts.length > 0) {
      const rows = alerts.map(a => ({
        profile_id: currentUserId,
        venue_slug: venueSlug,
        venue_name: venueName,
        target_date: a.date,
        time_block: a.hour,
        platform,
        notify_by: notifyBy,
      }));
      await supabase.from("court_watchlist").insert(rows);
    }

    // Update local state
    const newSet = new Set(watchlist);
    for (const k of existingKeys) newSet.delete(k);
    for (const a of alerts) newSet.add(`${venueSlug}|${a.date}|${a.hour}`);
    setWatchlist(newSet);

    // Show confirmation toast
    if (alerts.length > 0) {
      const hours = alerts.map(a => a.hour).sort().join(", ");
      const dateStr = formatDate(alerts[0].date);
      showToast(`🔔 Te avisaremos cuando se libere · ${venueName} · ${dateStr} · ${hours}`);
    } else {
      showToast(`Alertas eliminadas para ${venueName}`);
    }
  };

  // Build venue summaries
  const venues: VenueSummary[] = React.useMemo(() => {
    if (!data) return [];
    const tennisSlots = data.slots.filter(s => isTennisCourt(s.court_name));
    const byVenue = new Map<string, CourtSlot[]>();
    for (const slot of tennisSlots) {
      if (!byVenue.has(slot.venue_name)) byVenue.set(slot.venue_name, []);
      byVenue.get(slot.venue_name)!.push(slot);
    }

    const summaries: VenueSummary[] = [];

    // Include ALL known venues (even those with 0 slots)
    for (const sv of ALL_VENUES_STATIC) {
      const slots = byVenue.get(sv.name) || [];
      const distance = (userLat && userLng) ? haversineKm(userLat, userLng, sv.lat, sv.lng) : undefined;
      const filtered = slots.filter(s => {
        if (filterDate !== "all" && s.date !== filterDate) return false;
        const hour = getHour(s.start_time);
        if (hour < filterTimeRange[0] || hour >= filterTimeRange[1]) return false;
        return true;
      });
      summaries.push({ name: sv.name, slug: sv.slug, platform: sv.platform, postcode: sv.postcode,
        lat: sv.lat, lng: sv.lng, totalSlots: filtered.length, slots, distance });
    }

    // Also add any venues from the JSON that aren't in the static list
    for (const [name, slots] of byVenue) {
      if (!ALL_VENUES_STATIC.some(sv => sv.name === name)) {
        const first = slots[0];
        const distance = (userLat && userLng) ? haversineKm(userLat, userLng, first.venue_lat, first.venue_lng) : undefined;
        const filtered = slots.filter(s => {
          if (filterDate !== "all" && s.date !== filterDate) return false;
          const hour = getHour(s.start_time);
          if (hour < filterTimeRange[0] || hour >= filterTimeRange[1]) return false;
          return true;
        });
        summaries.push({ name: first.venue_name, slug: first.venue_slug, platform: first.platform, postcode: first.venue_postcode,
          lat: first.venue_lat, lng: first.venue_lng, totalSlots: filtered.length, slots, distance });
      }
    }

    summaries.sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      return b.totalSlots - a.totalSlots;
    });

    return filterPlatform === "all" ? summaries : summaries.filter(v => v.platform === filterPlatform);
  }, [data, userLat, userLng, filterDate, filterTimeRange, filterPlatform]);

  const displayVenues = React.useMemo(() => {
    // If specific venues selected, show those first then the rest visible
    if (filterVenues.size > 0) {
      const selected = venues.filter(v => filterVenues.has(v.name));
      const rest = venues.filter(v => !filterVenues.has(v.name) && visibleInMap.includes(v.name));
      return [...selected, ...rest];
    }

    // Show all mode
    if (showAll) return venues;

    // Show venues visible in the map viewport, sorted: with slots first, then by distance
    if (visibleInMap.length > 0) {
      const visible = venues.filter(v => visibleInMap.includes(v.name));
      visible.sort((a, b) => {
        // Venues with slots first
        if (a.totalSlots > 0 && b.totalSlots === 0) return -1;
        if (a.totalSlots === 0 && b.totalSlots > 0) return 1;
        // Then by distance
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return b.totalSlots - a.totalSlots;
      });
      return visible;
    }

    // Fallback: within 5km
    return venues.filter(v => v.distance == null || v.distance <= 5).slice(0, 10);
  }, [venues, filterVenues, visibleInMap, showAll]);
  const availableDates = React.useMemo(() => data ? [...new Set(data.slots.map(s => s.date))].sort() : [], [data]);
  const totalFiltered = displayVenues.reduce((sum, v) => sum + v.totalSlots, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-100 pb-10">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-emerald-800 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 max-w-sm animate-bounce" style={{ animationIterationCount: 1, animationDuration: "0.4s" }}>
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-emerald-200 hover:text-white text-lg leading-none">&times;</button>
          </div>
        </div>
      )}
      <div className="w-full max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4">
          <button onClick={onBack} className="text-sm text-gray-600 hover:text-emerald-700 transition">← Volver</button>
          {data && <span className="text-xs text-gray-400">
            Actualizado: {new Date(data.generated_at).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
          </span>}
        </div>

        <h1 className="text-2xl font-bold text-emerald-800 mb-4">🎾 Canchas disponibles</h1>

        {loading && <div className="text-center py-12 text-gray-500">Cargando...</div>}
        {error && <div className="text-center py-12 text-red-600">Error: {error}</div>}

        {data && !loading && (<>
          {/* Date pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-hide">
            <button onClick={() => setFilterDate("all")}
              className={`text-sm px-4 py-2.5 rounded-full border whitespace-nowrap transition font-medium ${filterDate === "all" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
              Todos
            </button>
            {availableDates.map(d => (
              <button key={d} onClick={() => setFilterDate(d)}
                className={`text-sm px-4 py-2.5 rounded-full border whitespace-nowrap transition font-medium ${filterDate === d ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
                {formatDateShort(d)}
              </button>
            ))}
          </div>

          {/* Time range slider */}
          <div className="mb-5 px-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Horario</span>
            </div>
            {/* Bubble labels above slider */}
            <div className="relative flex justify-between mb-2 px-1">
              <div className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm border border-gray-200">
                {filterTimeRange[0]}:00
                <div className="absolute -bottom-1 left-5 w-2 h-2 bg-gray-100 border-b border-r border-gray-200 rotate-45" />
              </div>
              <div className="bg-gray-100 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm border border-gray-200">
                {filterTimeRange[1]}:00
                <div className="absolute -bottom-1 right-5 w-2 h-2 bg-gray-100 border-b border-r border-gray-200 rotate-45" />
              </div>
            </div>
            {/* Dual range sliders */}
            <div className="relative h-6 flex items-center">
              {/* Track background */}
              <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200" />
              {/* Active range highlight */}
              <div
                className="absolute h-2 rounded-full bg-emerald-600"
                style={{
                  left: `${((filterTimeRange[0] - 7) / 15) * 100}%`,
                  right: `${100 - ((filterTimeRange[1] - 7) / 15) * 100}%`,
                }}
              />
              {/* From slider */}
              <input
                type="range"
                min={7}
                max={21}
                value={filterTimeRange[0]}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setFilterTimeRange([Math.min(v, filterTimeRange[1] - 1), filterTimeRange[1]]);
                }}
                className="absolute inset-x-0 h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              />
              {/* To slider */}
              <input
                type="range"
                min={8}
                max={22}
                value={filterTimeRange[1]}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setFilterTimeRange([filterTimeRange[0], Math.max(v, filterTimeRange[0] + 1)]);
                }}
                className="absolute inset-x-0 h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </div>

          {/* Venue + Platform filters */}
          <div className="mb-5">
            {/* Search — autocomplete for venue names */}
            <div className="relative mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar cancha..."
                className="w-full text-sm rounded-lg border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 py-2 px-3"
              />
              {/* Dropdown results */}
              {searchQuery.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {venues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.postcode.toLowerCase().includes(searchQuery.toLowerCase())).map(v => (
                    <button key={v.name} onClick={() => {
                      setSearchQuery("");
                      setShowAll(false);
                      setFilterVenues(new Set([v.name]));
                      if (mapControlRef.current) mapControlRef.current.panTo(v.lat, v.lng);
                    }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition flex justify-between items-center">
                      <span>{v.name}</span>
                      <span className="text-xs text-gray-400">{v.postcode}</span>
                    </button>
                  ))}
                  {venues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.postcode.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No encontrado</div>
                  )}
                </div>
              )}
            </div>
            {/* Venue pills — only visible ones + "Todos" */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button onClick={() => {
                setShowAll(true);
                setFilterVenues(new Set());
                if (mapControlRef.current) mapControlRef.current.fitAll();
              }}
                className={`text-xs px-3 py-1 rounded-full border transition font-semibold ${
                  showAll ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                }`}>
                Todos ({venues.length})
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
                className="text-xs rounded-lg border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 py-1.5">
                <option value="all">Todas las plataformas</option>
                <option value="better">Better</option>
                <option value="clubspark">ClubSpark</option>
                <option value="parks">Parks</option>
                <option value="camden">Camden</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
            <span>
              {totalFiltered} slot{totalFiltered !== 1 ? "s" : ""} en {displayVenues.length} cancha{displayVenues.length !== 1 ? "s" : ""}
              {filterVenues.size === 0 && !showAll && <span className="text-xs text-gray-400 ml-1">(visibles en el mapa)</span>}
            </span>
            {filterVenues.size > 0 && (
              <button onClick={() => setFilterVenues(new Set())}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                ✕ Limpiar selección
              </button>
            )}
          </div>

          {/* Map */}
          <div className="mb-4">
            <CourtMap venues={venues} onVenueClick={(name) => {
              const venue = venues.find(v => v.name === name);
              if (venue && mapControlRef.current) {
                mapControlRef.current.panTo(venue.lat, venue.lng);
              }
              setFilterVenues(new Set([name]));
              setShowAll(false);
            }}
              selectedVenue={filterVenues.size === 1 ? Array.from(filterVenues)[0] : null}
              userLat={userLat} userLng={userLng}
              onBoundsChange={setVisibleInMap}
              controlRef={mapControlRef}
              savedMapCenter={mapCenter}
              savedMapZoom={mapZoom}
              onMapMove={(center, zoom) => { setMapCenter(center); setMapZoom(zoom); }}
            />
          </div>

          {/* Venue cards */}
          <div className="space-y-3">
            {displayVenues.map(venue => (
              <VenueCard key={venue.name} venue={venue} filterDate={filterDate} filterTimeRange={filterTimeRange}
                allDates={availableDates} watchlist={watchlist} onSaveWatch={saveWatches} />
            ))}
          </div>

          {filterVenues.size === 0 && !showAll && venues.length > displayVenues.length && (
            <div className="text-center mt-6 py-3 text-sm text-gray-500 bg-white/60 rounded-xl border border-gray-200">
              📍 Mueve el mapa para ver más canchas, o pulsa <button onClick={() => { setShowAll(true); setFilterVenues(new Set()); if (mapControlRef.current) mapControlRef.current.fitAll(); }} className="text-emerald-600 font-semibold hover:underline">"Todos"</button> para ver las {venues.length} canchas
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
