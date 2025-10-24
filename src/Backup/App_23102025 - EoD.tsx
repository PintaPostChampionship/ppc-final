
import React, { useState, useEffect, useRef } from "react";
import { supabase } from './lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

// ---------- Onboarding storage helpers (sessionStorage + tamaño mínimo) ----------
const PENDING_KEY = 'pending_onboarding';

// Comprime availability a forma compacta: { Mon:["M","A"], Tue:["E"] ... }
function compressAvailability(av?: Record<string, string[]> | undefined): Record<string, string[]> | null {
  if (!av) return null;
  const map: Record<string, string[]> = {};
  Object.entries(av).forEach(([day, slots]) => {
    if (Array.isArray(slots) && slots.length) {
      // Usa inicial del bloque: M=Morning, A=Afternoon, E=Evening
      map[day] = slots.map(s => s.startsWith('Morning') ? 'M' : s.startsWith('Afternoon') ? 'A' : 'E');
    }
  });
  return Object.keys(map).length ? map : null;
}

function decompressAvailability(comp?: Record<string, string[]> | null) {
  if (!comp) return {};
  const decode = (c: string) => c === 'M' ? 'Morning (07:00-12:00)'
                          : c === 'A' ? 'Afternoon (12:00-18:00)'
                                      : 'Evening (18:00-22:00)';
  const out: Record<string, string[]> = {};
  Object.entries(comp).forEach(([day, codes]) => {
    out[day] = codes.map(decode);
  });
  return out;
}

type PendingOnboarding = {
  name?: string;
  email?: string;
  profilePic?: string;            // solo dataURL (preview) si ya lo usabas, si pesa mucho, preferible omitir
  locations?: string[];           // ["West","SE",...]
  availability_comp?: Record<string, string[]> | null; // comprimido
  tournament?: string | null;
  division?: string | null;
};

// Escribe en sessionStorage con try/catch
function savePending(p: PendingOnboarding) {
  try {
    const safe: PendingOnboarding = { ...p };
    // Comprimir availability si vino “larga”
    if ((p as any).availability) {
      // @ts-ignore
      safe.availability_comp = compressAvailability((p as any).availability);
      // @ts-ignore
      delete (safe as any).availability;
    }
    // 1) Sesión actual (permite recuperar avatar y availability completos)
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(safe));

    // 2) Copia “light” en localStorage para que la vea la pestaña de verificación (sin foto)
    const lite: PendingOnboarding = { ...safe };
    delete (lite as any).profilePic;      // << NO guardamos la foto en localStorage
    localStorage.setItem(PENDING_KEY, JSON.stringify(lite));
  } catch (e) {
    console.warn('Pending onboarding not persisted.', e);
  }
}



function loadPending(): PendingOnboarding | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingOnboarding;
    // reconstruye availability para tu UI si la usas
    // @ts-ignore
    if (!('availability' in p) && p.availability_comp) {
      // @ts-ignore
      p.availability = decompressAvailability(p.availability_comp);
    }
    return p;
  } catch {
    return null;
  }
}

function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}


// Migra (una sola vez) si todavía hay algo viejo en localStorage
function migrateLocalToSession() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      sessionStorage.setItem(PENDING_KEY, raw);
      localStorage.removeItem(PENDING_KEY);
    }
  } catch {}
}

// --- Canal para sincronizar sesión/estado entre pestañas ---
const authChannel = new BroadcastChannel('ppc-auth');


// Define TypeScript interfaces based on the database schema
interface Profile {
  id: string;
  name: string;
  role: string;
  created_at: string;
  email?: string;
  avatar_url?: string;
  postal_code?: string;
  nickname?: string | null;
}

interface Location {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface AvailabilitySlot {
  id: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_id?: string;
}

interface Tournament {
  id: string;
  name: string;
  season: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Division {
  id: string;
  tournament_id: string;
  name: string;
  color?: string;
}

interface Registration {
  id: string;
  tournament_id: string;
  division_id: string;
  profile_id: string;
  seed?: number;
  created_at: string;
}

interface Match {
  id: string;
  tournament_id: string;
  division_id: string;
  date: string;
  time?: string;
  location_id?: string;
  location_details?: string;
  status: string;
  home_player_id: string;
  away_player_id: string | null;
  player1_sets_won: number;
  player2_sets_won: number;
  player1_games_won: number;
  player2_games_won: number;
  player1_had_pint: boolean;
  player2_had_pint: boolean;
  player1_pints: number;
  player2_pints: number;
  created_by: string;
  created_at: string;
}

interface MatchSet {
  id: string;
  match_id: string;
  set_number: number;
  p1_games: number;
  p2_games: number;
}

interface Standings {
  profile_id: string;
  tournament_id: string;
  division_id: string;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  games_won: number;
  games_lost: number;
  set_diff: number;
  pints: number;
  points: number;
  name?: string;
}

// Helper function to convert data URI to Blob
const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], {type: mimeString});
};

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

async function resizeImage(dataUrl: string, maxWidth: number = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      // Si la imagen ya es más pequeña que el máximo, no la agrandamos.
      if (img.width <= maxWidth) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);
      } else {
        // Si la imagen es más grande, la reducimos.
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      // Convierte el canvas de vuelta a un Data URL de imagen JPG con calidad del 90%
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (error) => reject(error);
  });
}

function avatarSrc(p?: Profile | null) {
  if (!p) return '/default-avatar.png';
  const direct = (p.avatar_url || '').trim();
  if (direct) return direct;

  // Fallback: URL pública del bucket "avatars/<id>.jpg"
  const { data } = supabase.storage.from('avatars').getPublicUrl(`${p.id}.jpg`);
  return data?.publicUrl || '/default-avatar.png';
}

const App = () => {
  // Initialize all state with proper types
  const [session, setSession] = useState<any>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null); 
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [divisionsByTournament, setDivisionsByTournament] = useState<Record<string, Division[]>>({});
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedPlayerAvailability, setSelectedPlayerAvailability] = useState<AvailabilitySlot[]>([]);  
  const [selectedPlayerAreas, setSelectedPlayerAreas] = useState<string[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchSets, setMatchSets] = useState<MatchSet[]>([]);
  const [standings, setStandings] = useState<Standings[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [selectedMatchForResult, setSelectedMatchForResult] = useState<Match | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loginView, setLoginView] = useState(true);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    profilePic: '', 
    locations: [] as string[], 
    availability: {} as Record<string, string[]>,
    tournaments: [] as string[],
    division: '',
    postal_code: '',
  });
  const [hasCommitted, setHasCommitted] = useState(false);

  const [newMatch, setNewMatch] = useState({ 
    player1: '', 
    player2: '', 
    sets: [{ score1: '', score2: '' }], 
    division: '', 
    tournament: '',
    hadPint: false, 
    pintsCount: 1, // Tipo número
    location: '',
    location_details: '', // Campo añadido
    date: '', 
    time: '' 
  });
  const [showMap, setShowMap] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newRegistration, setNewRegistration] = useState({ tournamentId: '', divisionId: '' }); 
  const [registrationStep, setRegistrationStep] = useState(1);
  const [pickedTournamentId, setPickedTournamentId] = useState<string>('');
  const [pickedDivisionId, setPickedDivisionId] = useState<string>('');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [editUser, setEditUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    profilePic: '',
    locations: [] as string[],
    availability: {} as Record<string, string[]>,
    postal_code: '',
    nickname: '', 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  type PPCNotif = { id: string; text: string; matchId?: string; at: number };
  const [notifs, setNotifs] = useState<PPCNotif[]>([]);
  const seenPendingIdsRef = useRef<Set<string>>(new Set())  
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editedMatchData, setEditedMatchData] = useState({
    sets: [{ score1: '', score2: '' }],
    hadPint: false,
    pintsCount: 1,
    anecdote : '',
  });
  const [editingSchedule, setEditingSchedule] = useState<Match | null>(null);
  const [editedSchedule, setEditedSchedule] = useState<{
    date: string;
    time: string;
    locationName: string;      // nombre legible de locations[]
    location_details: string;  // texto libre
  }>({ date: '', time: '', locationName: '', location_details: '' });

  type SocialEvent = {
    id: string;
    title: string;
    description: string | null;
    date: string;        // YYYY-MM-DD
    time: string | null; // "19:30", etc.
    venue: string | null;
    image_url: string | null;
    rsvp_url: string | null;
    is_active: boolean;
  };
  const [socialEvents, setSocialEvents] = useState<SocialEvent[]>([]);


  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = ['Morning (07:00-12:00)', 'Afternoon (12:00-18:00)', 'Evening (18:00-22:00)'];
  const locationsList = ['South', 'Southeast', 'Southwest', 'North', 'Northeast', 'Northwest', 'Central', 'West', 'East'];

  const abbreviateLocation = (location: string) => {
    const abbreviations: Record<string, string> = {
      'South': 'S',
      'Southeast': 'SE',
      'Southwest': 'SW',
      'North': 'N',
      'Northeast': 'NE',
      'Northwest': 'NW',
      'Central': 'C',
      'West': 'W',
      'East': 'E'
    };
    return abbreviations[location] || location;
  };

  // 1) Migrar cualquier dato viejo y precargar pending para esta pestaña
  useEffect(() => {
    migrateLocalToSession();

    // Si tenías lógica que re-hidrata newUser al abrir la página, úsala aquí:
    const p = loadPending();
    if (p) {
      // Solo setea lo que realmente uses en el formulario:
      setNewUser(n => ({
        ...n,
        name: p.name ?? n.name,
        email: p.email ?? n.email,
        // @ts-ignore si usas preview
        profilePic: p.profilePic ?? n.profilePic,
        locations: p.locations ?? n.locations,
        // @ts-ignore availability si la manejas en UI
        availability: (p as any).availability ?? n.availability,
        division: p.division ?? n.division,
        tournaments: p.tournament ? [p.tournament] : n.tournaments,
        postal_code: (p as any).postal_code ?? n.postal_code,
      }));
    }

    // 2) Sincronizar entre pestañas:
    const onStorage = (ev: StorageEvent) => {
      // a) si cambia el token de Supabase en otra pestaña, recarga sesión aquí
      if (ev.key && ev.key.startsWith('sb-') && ev.key.includes('auth-token')) {
        // fuerza una recarga suave de la sesión
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          if (session?.user) {
            loadInitialData(session.user.id);
          }
        });
      }
      // b) si otra pestaña limpió/actualizó el pending, refleja el cambio
      if (ev.key === PENDING_KEY) {
        const p2 = loadPending();
        if (!p2) {
          // otra pestaña completó el onboarding -> limpia aquí
          // (opcional) reset de newUser si quieres
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);


  useEffect(() => {
    const map: Record<string, Division[]> = {};
    divisions.forEach(d => {
      (map[d.tournament_id] ||= []).push(d);
    });
    setDivisionsByTournament(map);
  }, [divisions]);

  
  function slotToTimes(slot: string): { start: string; end: string } {
    if (slot.startsWith('Morning'))   return { start: '07:00', end: '12:00' };
    if (slot.startsWith('Afternoon')) return { start: '12:00', end: '18:00' };
    if (slot.startsWith('Evening'))   return { start: '18:00', end: '22:00' };
    return { start: '00:00', end: '23:59' };
  }

  const DAY_MAP: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  const SLOT_MAP: Record<string, { start: string; end: string }> = {
    'Morning (07:00-12:00)':  { start: '07:00', end: '12:00' },
    'Afternoon (12:00-18:00)':{ start: '12:00', end: '18:00' },
    'Evening (18:00-22:00)':  { start: '18:00', end: '22:00' },
  };


  function parseDateSafe(d: string | Date): Date {
    if (d instanceof Date) return d;
    const clean = String(d).split('|')[0].trim(); // por si llega “fecha | algo”
    const dt = new Date(clean);
    if (!isNaN(dt.getTime())) return dt;
    const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD
    return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : new Date();
  }

  function dateKey(val: string | Date) {
    const dt = typeof val === 'string' ? parseYMDLocal(val) : val;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // YYYY-MM-DD (local)
  }

  const formatDate = (dateString: string) => formatDateLocal(dateString);

  function hasActiveMatchWith(
    meId: string,
    oppId: string,
    tournamentId: string,
    divisionId: string
  ) {
    return matches.some(m =>
      m.tournament_id === tournamentId &&
      m.division_id === divisionId &&
      (m.status === 'scheduled' || m.status === 'pending') &&
      (
        (m.home_player_id === meId && m.away_player_id === oppId) ||
        (m.home_player_id === oppId && m.away_player_id === meId)
      )
    );
  }


  // Trata 'YYYY-MM-DD' como fecha LOCAL (sin zona)
  function parseYMDLocal(iso?: string | null) {
    if (!iso) return new Date(NaN);
    const [y, m, d] = String(iso).split('-').map(n => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function formatDateLocal(iso?: string | null) {
    const dt = parseYMDLocal(iso);
    return dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

 
  function setsLineFor(m: Match, perspectiveId?: string) {
    const sets = matchSets
      .filter(s => s.match_id === m.id)
      .sort((a, b) => a.set_number - b.set_number);

    // Si aún no hay detalle guardado, cae a totales de games
    if (sets.length === 0) return `${m.player1_games_won}-${m.player2_games_won}`;

    // Si paso un 'perspectiveId', muestro el marcador desde ese jugador
    const invert = perspectiveId && m.home_player_id !== perspectiveId;
    return sets
      .map(s => invert ? `${s.p2_games}-${s.p1_games}` : `${s.p1_games}-${s.p2_games}`)
      .join(' ');
    }

  function homeAwayBadge(match: Match, playerId: string) {
    const isHome = match.home_player_id === playerId;
    return {
      text: isHome ? 'Local' : 'Visita',
      cls: isHome ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
    };
  }

  function wins(s: any) { return Number(s.wins || s.w || 0); }
  function setRatio(s: any) {
    const sw = Number(s.sets_won || s.sw || 0);
    const sl = Number(s.sets_lost || s.sl || 0);
    const tot = sw + sl;
    return tot === 0 ? 0 : sw / tot;
  }
  function gameRatio(s: any) {
    const gw = Number(s.games_won || s.gw || 0);
    const gl = Number(s.games_lost || s.gl || 0);
    const tot = gw + gl;
    return tot === 0 ? 0 : gw / tot;
  }

  // ganador del partido usando sets del propio match (set1_home/away, set2_..., set3_...)
  function winnerOfMatchBySets(m: any) {
    const sets: Array<[number|null, number|null]> = [
      [m.set1_home ?? null, m.set1_away ?? null],
      [m.set2_home ?? null, m.set2_away ?? null],
      [m.set3_home ?? null, m.set3_away ?? null],
    ];
    let home = 0, away = 0;
    for (const [h, a] of sets) {
      if (h == null || a == null) continue;
      if (h > a) home++; else if (a > h) away++;
    }
    if (home > away) return m.home_player_id;
    if (away > home) return m.away_player_id;
    return null;
  }

  // head-to-head sólo cuando es un empate de 2 jugadores
  function headToHead(aId: string, bId: string, divisionId: string, tournamentId: string, matches: any[]) {
    const pair = matches.filter(m =>
      m.tournament_id === tournamentId &&
      m.division_id === divisionId &&
      ((m.home_player_id === aId && m.away_player_id === bId) ||
      (m.home_player_id === bId && m.away_player_id === aId))
    );
    let aWins = 0, bWins = 0;
    for (const m of pair) {
      const w = winnerOfMatchBySets(m);
      if (w === aId) aWins++;
      else if (w === bId) bWins++;
    }
    if (aWins > bWins) return -1; // a por delante
    if (bWins > aWins) return 1;  // b por delante
    return 0; // sin desempate
  }

  function compareStandings(a: any, b: any, divisionId: string, tournamentId: string, matches: any[]) {
    // 1) victorias
    const aw = wins(a), bw = wins(b);
    if (bw !== aw) return bw - aw;

    // 2) h2h si el empate es de 2 (este comparator se llama par a par)
    const h2h = headToHead(a.profile_id, b.profile_id, divisionId, tournamentId, matches);
    if (h2h !== 0) return h2h;

    // 3) ratio de sets
    const asr = setRatio(a), bsr = setRatio(b);
    if (bsr !== asr) return (bsr - asr) * 1000000; // evita flotantes casi iguales

    // 4) ratio de games
    const agr = gameRatio(a), bgr = gameRatio(b);
    if (bgr !== agr) return (bgr - agr) * 1000000;

    // 5) fallback: puntos y nombre
    const ap = Number(a.points || 0), bp = Number(b.points || 0);
    if (bp !== ap) return bp - ap;
    const an = (a.player_name || a.name || '').toString();
    const bn = (b.player_name || b.name || '').toString();
    return an.localeCompare(bn, 'es');
  }


  function canEditSchedule(m: Match) {
    if (!currentUser) return false;
    const isPlayer = currentUser.id === m.home_player_id || currentUser.id === (m.away_player_id ?? '');
    const isCreator = currentUser.id === m.created_by;
    const isAdmin = (currentUser as any).role === 'admin';
    const editable = m.status === 'pending' || m.status === 'scheduled';
    return editable && (isPlayer || isCreator || isAdmin);
  }

  // Determinístico: para un par (a,b) siempre decide quién es Home en esa división/torneo
  function computeHomeForPair(divisionId: string, tournamentId: string, a: string, b: string) {
    function hash(s: string) {
      let h = 0;
      for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
      return Math.abs(h);
    }
    const [x, y] = a < b ? [a, b] : [b, a];
    const h = hash(`${divisionId}|${tournamentId}|${x}|${y}`);
    // si h es par, el "menor" es home; si es impar, el "mayor" es home (balancea 50/50)
    return (h % 2 === 0) ? x : y;
  }


  // Esta es nuestra ÚNICA función para cargar todos los datos.
  const fetchData = async (userId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const promises = [
        supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
        supabase.from('divisions').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('matches').select('*'),
        supabase.from('v_standings').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('tournament_registrations').select('*'),
        supabase.from('match_sets').select('*'),
      ];
      if (userId) {
        promises.push(supabase.from('availability').select('*').eq('profile_id', userId));
      }

      const responses = await Promise.all(promises);
      for (const res of responses) if (res.error) throw res.error;

      setTournaments(responses[0].data || []);
      setDivisions(responses[1].data || []);
      setProfiles(responses[2].data || []);
      setMatches(responses[3].data || []);
      setStandings(responses[4].data || []);
      setLocations(responses[5].data || []);
      setRegistrations(responses[6].data || []);
      setMatchSets(responses[7].data || []);
      if (userId && responses[8]) {
        setAvailabilitySlots(responses[8].data || []);
      }
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
      // después de setMatchSets(...) y availability, dentro de fetchData
      const todayYMD = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const dd = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${dd}`; // LOCAL YYYY-MM-DD
      })();
      
      const { data: ev, error: evErr } = await supabase
        .from('social_events')
        .select('*')
        .eq('is_active', true) //cambiar a false para ocultar
        .gte('date', todayYMD)
        .order('date', { ascending: true })
        .limit(5);
      if (!evErr) setSocialEvents(ev || []);
    } finally {
      setLoading(false);
    }
  };
//RSVP: usa rsvp_url con un Google Form o similar. Solo pega el link al crear el evento.
//Ubicación: si quieres mostrar mapa o link, añade venue_url o maps_url (opcional) a la tabla.
//En Supabase: Sube la imagen (ideal: events/2025-11-social.jpg). Recomendado: ancho 1200px, JPG/WebP, <300KB.
//cont.. Copia el Public URL y guárdalo en social_events.image_url.

  // EFECTO 1: Maneja la sesión y el "onboarding"
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session ?? null);
      setSessionUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        // Completa el alta usando lo que haya (sessionStorage/localStorage/metadata)
        await ensurePendingOnboarding(session.user.id, session.user);
        // Limpia “pending” solo después de persistir
        clearPending();
      }

      if (event === 'SIGNED_OUT') {
        clearPending();
      }
    });
    return () => subscription.unsubscribe();
  }, []);



  // EFECTO 1.5: Hidrata sesión al cargar (útil en pestaña de verificación)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setSessionUser(data.session?.user ?? null);
    }).catch(() => {});
  }, []);

  // EFECTO 2: Sincroniza el currentUser con los datos cargados
  useEffect(() => {
    if (sessionUser && profiles.length > 0) {
      const userProfile = profiles.find(p => p.id === sessionUser.id);
      setCurrentUser(userProfile || null);
      setLoginView(false);
    } else if (!sessionUser) {
      setCurrentUser(null);
      setLoginView(true);
    }
  }, [sessionUser, profiles]);

  // EFECTO 3: Carga los datos cuando la sesión cambia o al inicio
  useEffect(() => {
    fetchData(session?.user.id);
  }, [session]); 

  useEffect(() => {
    if (!selectedDivision || !selectedTournament) return;

    // 1) Realtime: INSERT/UPDATE en 'matches' de esta división
    const channel = supabase
      .channel(`pending-matches-${selectedDivision.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `division_id=eq.${selectedDivision.id}`,
      }, (payload) => {
        const m = payload.new as Match;
        if (m.status === 'pending' && !seenPendingIdsRef.current.has(m.id)) {
          seenPendingIdsRef.current.add(m.id);
          pushNotif(formatPendingShare(m), m.id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `division_id=eq.${selectedDivision.id}`,
      }, (payload) => {
        const m = payload.new as Match;
        if (m.status === 'pending' && !seenPendingIdsRef.current.has(m.id)) {
          seenPendingIdsRef.current.add(m.id);
          pushNotif(formatPendingShare(m), m.id);
        }
      })
      .subscribe();

    // 2) Siembra inicial: pendings ya existentes en mi división/torneo
    const pendingNow = matches.filter(m =>
      m.tournament_id === selectedTournament.id &&
      m.division_id === selectedDivision.id &&
      m.status === 'pending'
    );
    pendingNow.forEach(m => {
      if (!seenPendingIdsRef.current.has(m.id)) {
        seenPendingIdsRef.current.add(m.id);
        pushNotif(formatPendingShare(m), m.id);
      }
    });

    return () => { supabase.removeChannel(channel); };
    // Nota: dependencias por id, no por objetos completos
  }, [selectedDivision?.id, selectedTournament?.id]);


  // Load all initial data from Supabase
  const loadInitialData = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all required data
      const [tournamentsRes, divisionsRes, locationsRes, profilesRes, 
        registrationsRes, matchesRes, standingsRes, matchSetsRes, availabilityRes] = 
        await Promise.all([
          supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
          supabase.from('divisions').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('profiles').select('*'),
          supabase.from('tournament_registrations').select('*'),
          supabase.from('matches').select('*'),
          supabase.from('v_standings').select('*'),
          supabase.from('match_sets').select('*'),
          supabase.from('availability').select('*').eq('profile_id', userId)
        ]);

      // Handle errors
      if (tournamentsRes.error) throw tournamentsRes.error;
      if (divisionsRes.error) throw divisionsRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (registrationsRes.error) throw registrationsRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (standingsRes.error) throw standingsRes.error;
      if (matchSetsRes.error) throw matchSetsRes.error;
      if (availabilityRes.error) throw availabilityRes.error;

      // Set state
      setTournaments(tournamentsRes.data as Tournament[]);
      setDivisions(divisionsRes.data as Division[]);
      setLocations(locationsRes.data as Location[]);
      setProfiles(profilesRes.data as Profile[]);
      setRegistrations(registrationsRes.data as Registration[]);
      setMatches(matchesRes.data as Match[]);
      setStandings(standingsRes.data as Standings[]);
      setMatchSets(matchSetsRes.data || []);
      setAvailabilitySlots(availabilityRes.data as AvailabilitySlot[]);
      
      // Set current user
      const user = profilesRes.data.find(p => p.id === userId);
      setCurrentUser(user || null);
      
      console.log('Data loaded successfully', {
        tournaments: tournamentsRes.data.length,
        divisions: divisionsRes.data.length,
        locations: locationsRes.data.length,
        profiles: profilesRes.data.length,
        currentUser: user?.name
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading ', err);
    } finally {
      setLoading(false);
    }
  };

  // Keep newMatch.division and newMatch.tournament in sync with current view
  useEffect(() => {
    if (selectedDivision) {
      setNewMatch(prev => ({ ...prev, division: selectedDivision.name }));
    }
    if (selectedTournament) {
      setNewMatch(prev => ({ ...prev, tournament: selectedTournament.name }));
    }
  }, [selectedDivision, selectedTournament]);

  useEffect(() => {
    if (!selectedPlayer) {
      setSelectedPlayerAvailability([]);
      setSelectedPlayerAreas([]);
      return;
    }

    (async () => {
      // Availability
      const { data: av, error: avErr } = await supabase
        .from('availability')
        .select('*')
        .eq('profile_id', selectedPlayer.id);
      if (!avErr) setSelectedPlayerAvailability(av || []);

      // Zonas preferidas (leer ids y resolver nombres con 'locations' que ya tienes en estado)
      const { data: pls, error: plsErr } = await supabase
        .from('profile_locations')
        .select('location_id')
        .eq('profile_id', selectedPlayer.id);

      if (!plsErr && pls) {
        const names = pls
          .map(pl => locations.find(l => l.id === pl.location_id)?.name)
          .filter((n): n is string => Boolean(n));
        setSelectedPlayerAreas(names);
      }
    })();
  }, [selectedPlayer?.id, locations]);

  useEffect(() => {
    let lastFetchTime = Date.now();

    const handleVisibilityChange = () => {
      // Si la pestaña vuelve a estar visible y ha pasado más de 5 minutos desde la última carga
      if (document.visibilityState === 'visible' && Date.now() - lastFetchTime > 300000) {
        console.log("Tab is visible after a while, refreshing data...");
        if (session?.user) {
          fetchData(session.user.id);
          lastFetchTime = Date.now(); // Actualizamos el tiempo de la última carga
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]); // Depende de la sesión para tener el ID de usuario disponible


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registrationStep === 1) {
      if (!newUser.name || !newUser.email) return alert('Please fill in name/email.');
      setRegistrationStep(2);
      return;
    }
    if (registrationStep === 2) {
      if (!newUser.profilePic) return alert('Please upload a profile picture.');
      setRegistrationStep(3);
      return;
    }

    if (registrationStep === 3) {
      setLoading(true);
      try {
        const { name, email, password, profilePic, locations, availability } = newUser;
        const tournamentId = pickedTournamentId;
        const divisionId = pickedDivisionId;

        if (!tournamentId || !divisionId || !password) {
          throw new Error('Please select a tournament, division, and enter a password.');
        }
        
        const onboardingData = {
          name: name.trim(),
          locations: locations || [],
          availability: availability || {},
          tournament_id: tournamentId,
          division_id: divisionId,
          profilePicDataUrl: profilePic 
        };

        savePending({
          name: newUser.name,
          email: newUser.email,
          profilePic: newUser.profilePic || undefined,
          locations: newUser.locations || [],
          // 🔑 IMPORTANTE: pasa availability para que el helper lo comprima (availability_comp)
          // @ts-ignore
          availability: newUser.availability || {},
          // 🔑 IMPORTANTE: guarda los IDs que espera ensurePendingOnboarding
          // (además de tus nombres si los quieres seguir mostrando en UI)
          // @ts-ignore
          tournament_id: pickedTournamentId,
          // @ts-ignore
          division_id: pickedDivisionId,
          postal_code: newUser.postal_code || undefined,
        });


        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              name: name.trim(),
              // 👇 nuevo: hint liviano que sí viaja con la sesión en la pestaña de verificación
              onboarding_hint: {
                tournament_id: tournamentId,
                division_id: divisionId,
                locations: (locations || []).slice(0, 9), // cortito
                has_pic: Boolean(profilePic),
                has_av: Object.keys(availability || {}).length > 0
              }
            }
          }
        });


        if (error) throw error;
        
        alert('Registration successful! Please check your email to verify your account, then log in.');
        setLoginView(true);
        setRegistrationStep(1);
        setNewUser({ name: '', email: '', password: '', profilePic: '', locations: [], availability: {}, tournaments: [], division: '', postal_code: '' });
        setPickedTournamentId('');
        setPickedDivisionId('');

      } catch (err: any) {
        console.error("Registration failed:", err);
        alert(`Registration failed: ${err.message}`);
        clearPending();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Limpiamos errores previos
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: newUser.email,
        password: newUser.password
      });
      
      if (error) throw error;
      
      // El useEffect [session, profiles] se encargará de ocultar la vista de login.
      // Ya no necesitamos setLoginView(false) aquí.
      
      // Limpiamos solo los campos de login del formulario.
      setNewUser(prev => ({ ...prev, email: '', password: '' }));

    } catch (err: any) {
      setError(`Login failed: ${err.message}`);
      alert('Invalid credentials. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0');
    timeOptions.push(`${hour}:00`);
    timeOptions.push(`${hour}:30`);
  }

  const handleAvatarSelectDuringSignup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const f = e.target.files?.[0];
    if (!f) return;

    setPendingAvatarFile(f);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingAvatarPreview(dataUrl);
      setNewUser(prev => ({ ...prev, profilePic: dataUrl })); // <-- asegura preview y validación
    };
    reader.readAsDataURL(f);
  };

  const handleEditToggleLocation = (location: string) => {
    setEditUser(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(loc => loc !== location)
        : [...prev.locations, location]
    }));
  };

  const handleEditToggleAvailability = (day: string, timeSlot: string) => {
    setEditUser(prev => {
      const newAvailability = { ...prev.availability };
      const daySlots = newAvailability[day] || [];
      if (daySlots.includes(timeSlot)) {
        newAvailability[day] = daySlots.filter(slot => slot !== timeSlot);
      } else {
        newAvailability[day] = [...daySlots, timeSlot];
      }
      return { ...prev, availability: newAvailability };
    });
  };

  const handleSaveEditedMatch = async () => {
    if (!editingMatch) return;
    setLoading(true);
    try {
      // 1) preparar sets para el RPC
      const setsForRPC = (editedMatchData?.sets || [])
        .filter(s => s.score1 !== '' && s.score2 !== '')
        .map((s, idx) => ({
          set_number: idx + 1,
          p1_games: parseInt(s.score1, 10),
          p2_games: parseInt(s.score2, 10),
        }));

      // 2) ejecutar tu RPC existente
      const { error: rpcErr } = await supabase.rpc('update_match_result', {
        p_match_id: editingMatch.id,
        p_sets: setsForRPC,
        p_had_pint: editedMatchData.hadPint,
        p_pints_count: editedMatchData.pintsCount,
      });
      if (rpcErr) throw rpcErr;

      // 3) forzar status = 'played' (clave para que salga de "agendados" y cuente puntos)
      const { error: upErr } = await supabase
        .from('matches')
        .update({ status: 'played', anecdote: editedMatchData.anecdote?.trim() || null, })
        .eq('id', editingMatch.id)
        .select('id')
        .single();
      if (upErr) throw upErr;

      // 4) refrescar todo
      await fetchData(session?.user?.id);
      setEditingMatch(null);
      alert('Resultado guardado.');
    } catch (err: any) {
      alert(`Error al guardar el resultado: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };


  function openEditSchedule(m: Match) {
    const locName = locations.find(l => l.id === m.location_id)?.name || '';
    setEditingSchedule(m);
    setEditedSchedule({
      date: (m.date || '').slice(0, 10),
      time: (m.time || '').slice(0, 5),
      locationName: locName,
      location_details: m.location_details || ''
    });
  }

  // ---- NOMBRES: visual solo ----
  const toTitleCase = (str: string) => {
    if (!str) return '';

    return str
      .normalize('NFC') // <-- AÑADE ESTA LÍNEA
      .toLowerCase()
      .replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase());
  };

  const uiName = (raw?: string | null) => toTitleCase((raw ?? '').trim());

  const displayNameForShare = (id: string) => {
    const p = profiles.find(pp => pp.id === id);
    const base = (p?.nickname && p.nickname.trim().length > 0) ? p.nickname! : (p?.name || '');
    return uiName(base);
  };

  async function handleSaveEditedSchedule() {
    if (!editingSchedule) return;

    const hour = parseInt((editedSchedule.time || '00:00').split(':')[0], 10);
    let timeBlock: 'Morning' | 'Afternoon' | 'Evening' | null = null;
    if (hour >= 7 && hour < 12) timeBlock = 'Morning';
    else if (hour >= 12 && hour < 18) timeBlock = 'Afternoon';
    else if (hour >= 18 && hour < 23) timeBlock = 'Evening';

    const newLocId = locations.find(l => l.name === editedSchedule.locationName)?.id ?? null;

    try {
      setLoading(true);

      // Control básico de concurrencia: solo si sigue pending/scheduled
      const { error, data } = await supabase
        .from('matches')
        .update({
          date: editedSchedule.date,
          time: editedSchedule.time,
          time_block: timeBlock,
          location_id: newLocId,
          location_details: editedSchedule.location_details
        })
        .eq('id', editingSchedule.id)
        .in('status', ['pending', 'scheduled'])
        .select('id'); // para saber si afectó fila

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('No se pudo guardar. Es posible que el partido haya cambiado de estado o fue editado por otra persona. Refresca la página.');
        return;
      }

      alert('Partido actualizado.');
      setEditingSchedule(null);
      await fetchData(session?.user.id);
    } catch (err: any) {
      alert(`Error guardando cambios: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteScheduledMatch(mArg?: Match) {
    // Si viene como parámetro, borramos ese; si no, usamos el que está abierto en el modal
    const m = mArg ?? editingSchedule;
    if (!m) return;

    // mismos permisos que para editar
    if (!canEditSchedule(m)) {
      alert('Solo el creador, alguno de los jugadores o un admin pueden borrar este partido.');
      return;
    }

    const ok = window.confirm('¿Estás seguro que quieres eliminar este partido?');
    if (!ok) return;

    setLoading(true);
    try {
      // 1) Borrar sets (por si existen)
      const { error: setsErr } = await supabase
        .from('match_sets')
        .delete()
        .eq('match_id', m.id);
      if (setsErr) throw setsErr;

      // 2) Borrar match solo si sigue pendiente/programado
      const { data, error: matchErr } = await supabase
        .from('matches')
        .delete()
        .eq('id', m.id)
        .in('status', ['pending', 'scheduled'])
        .select('id');

      if (matchErr) throw matchErr;
      if (!data || data.length === 0) {
        alert('No se pudo borrar: es posible que el partido ya haya cambiado de estado. Refresca la página.');
        return;
      }

      // 3) Cerrar modal si estaba abierto y refrescar
      if (editingSchedule?.id === m.id) setEditingSchedule(null);
      await fetchData(session?.user.id);
      alert('Partido borrado correctamente.');
    } catch (err: any) {
      alert(`No se pudo borrar el partido: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }



  const handleDeleteMatch = async () => {
    if (!editingMatch) return;

    // Permisos básicos: creador del match o admin (ajústalo si quieres permitir también a cualquiera de los dos jugadores)
  const canDelete =
    currentUser?.id === editingMatch.created_by ||
    currentUser?.id === editingMatch.home_player_id ||
    currentUser?.id === editingMatch.away_player_id ||
    currentUser?.role === 'admin';

    if (!canDelete) {
      alert('Solo el creador del partido o un admin pueden borrarlo.');
      return;
    }

    if (!window.confirm('¿Seguro que quieres borrar este partido y todos sus sets? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    try {
      // 1) Borrar sets (por si tu FK no es ON DELETE CASCADE)
      const { error: setErr } = await supabase
        .from('match_sets')
        .delete()
        .eq('match_id', editingMatch.id);
      if (setErr) throw setErr;

      // 2) Borrar partido
      const { error: matchErr } = await supabase
        .from('matches')
        .delete()
        .eq('id', editingMatch.id);
      if (matchErr) throw matchErr;

      // 3) Cerrar modal y refrescar
      setEditingMatch(null);
      await fetchData(session?.user.id);
      alert('Partido borrado correctamente.');
    } catch (err: any) {
      alert(`No se pudo borrar el partido: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };


  const updateEditedSetScore = (index: number, field: 'score1' | 'score2', value: string) => {
    const newSets = [...editedMatchData.sets];
    newSets[index][field] = value;
    setEditedMatchData(prev => ({ ...prev, sets: newSets }));
  };

  // --- helpers para el modal de edición de resultados ---
  const addEditedSet = () => {
    setEditedMatchData(prev => ({
      ...prev,
      sets: [...prev.sets, { score1: '', score2: '' }]
    }));
  };

  const removeEditedSet = (idx: number) => {
    setEditedMatchData(prev => ({
      ...prev,
      sets: prev.sets.length > 1 ? prev.sets.filter((_, i) => i !== idx) : prev.sets
    }));
  };


  const handlePasswordReset = async () => {
    // 1. Pedir al usuario su correo electrónico
    const email = prompt("Please enter your email address to reset your password:");
    
    // 2. Verificar si el usuario ingresó un correo
    if (!email) {
      return; // El usuario canceló o no escribió nada
    }

    setLoading(true);
    try {
      // 3. Llamar a la función de Supabase para enviar el correo de reseteo
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // URL a la que volverá el usuario después de cambiar la clave
      });

      if (error) throw error;

      // 4. Informar al usuario que revise su correo
      alert("Password reset link has been sent! Please check your email.");

    } catch (err: any) {
      alert(`Error: ${err.message}`);
      console.error("Password reset error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    if (!newRegistration.tournamentId || !newRegistration.divisionId) {
      return alert('Please select a tournament and a division.');
    }
    if (!currentUser) {
      return alert('Could not find current user. Please log in again.');
    }

    setLoading(true);
    try {
      // La política de seguridad que ya creamos ("Allow user to insert their own registration")
      // funcionará perfectamente para esta acción.
      const { error } = await supabase.from('tournament_registrations').insert({
        profile_id: currentUser.id,
        tournament_id: newRegistration.tournamentId,
        division_id: newRegistration.divisionId,
      });

      if (error) throw error;

      alert('Successfully registered for the new tournament!');
      setShowJoinModal(false);
      setNewRegistration({ tournamentId: '', divisionId: '' });
      // Opcional: Recargar los datos de registros para que la UI se actualice
      const { data } = await supabase.from('tournament_registrations').select('*');
      if (data) setRegistrations(data as Registration[]);

    } catch (err: any) {
      alert(`Error joining tournament: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const ensurePendingRegistration = async (userId: string) => {
    const raw = localStorage.getItem('pending_registration');
    if (!raw) return;

    const pending = JSON.parse(raw) as { tournament_id: string; division_id: string };
    if (!pending?.tournament_id || !pending?.division_id) {
      localStorage.removeItem('pending_registration');
      return;
    }

    // ¿Ya existe?
    const { data: exists } = await supabase
      .from('tournament_registrations')
      .select('id')
      .eq('profile_id', userId)
      .eq('tournament_id', pending.tournament_id)
      .eq('division_id', pending.division_id)
      .maybeSingle();

    if (!exists) {
      const { error: insErr } = await supabase.from('tournament_registrations').insert({
        profile_id: userId,
        tournament_id: pending.tournament_id,
        division_id: pending.division_id
      }).single();
      if (insErr) {
        console.error('Auto-registration insert failed:', insErr);
        return; // deja el localStorage para reintentar en el próximo login
      }
    }

    // Limpia y refresca UI
    localStorage.removeItem('pending_registration');
    const { data: regs } = await supabase.from('tournament_registrations').select('*');
    if (regs) setRegistrations(regs as Registration[]);
  };

  async function ensureLocationIdByName(areaName: string): Promise<string> {
    const { data: loc, error: selErr } = await supabase
      .from('locations')
      .select('id')
      .eq('name', areaName)
      .maybeSingle();
    if (selErr) throw selErr;
    if (loc?.id) return loc.id as string;

    const { data: created, error: insErr } = await supabase
      .from('locations')
      .insert({ name: areaName })
      .select('id')
      .single();
    if (insErr) throw insErr;

    return created.id as string;
  }


  // --- helpers de onboarding post-signup ---
  function buildAvailabilityRowsFromObject(
    availability: Record<string, string[]> | undefined,
    uid: string
  ) {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const out: any[] = [];
    days.forEach((day, idx) => {
      const slots = availability?.[day] || [];
      slots.forEach(label => {
        const { start, end } = slotToTimes(label); // tu helper existente
        out.push({ profile_id: uid, day_of_week: idx, start_time: start, end_time: end, location_id: null });
      });
    });
    return out;
  }


  // === Helper para cargar torneos y divisiones ===
  async function fetchTournamentsAndDivisions() {
    const { data: ts, error: tErr } = await supabase
      .from('tournaments')
      .select('id,name,season,start_date,end_date,status')
      .order('start_date', { ascending: false });
    if (tErr) throw tErr;

    const { data: ds, error: dErr } = await supabase
      .from('divisions')
      .select('id,tournament_id,name,color');
    if (dErr) throw dErr;

    setTournaments(ts || []);
    setDivisions(ds || []);

    const map: Record<string, Division[]> = {};
    (ds || []).forEach(d => {
      (map[d.tournament_id] ||= []).push(d);
    });
    setDivisionsByTournament(map);
  }


  async function persistOnboarding(uid: string, onboarding: {
    name: string;
    email: string;
    profilePic?: string;
    locations: string[];
    availability: Record<string,string[]>;
    tournament_id: string;
    division_id: string;
  }) {
    // 1) Perfil
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({ id: uid, name: onboarding.name, email: onboarding.email, role: 'player' }, { onConflict: 'id' });
    if (profErr) throw profErr;

    // 2) Avatar (si viene como dataURL)
    if (onboarding.profilePic) {
      const fileBlob = dataURItoBlob(onboarding.profilePic); // <— usa la que SÍ existe
      const path = `${uid}.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, fileBlob, { upsert: true });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: upd } = await supabase
        .from('profiles')
        .update({ avatar_url: pub.publicUrl })
        .eq('id', uid);
      if (upd) throw upd;
    }

    // 3) Registro en torneo/división (si no existe)
    const { data: exists } = await supabase
      .from('tournament_registrations')
      .select('id')
      .eq('profile_id', uid).eq('tournament_id', onboarding.tournament_id).eq('division_id', onboarding.division_id)
      .maybeSingle();
    if (!exists) {
      const { error: regErr } = await supabase.from('tournament_registrations').insert({
        profile_id: uid, tournament_id: onboarding.tournament_id, division_id: onboarding.division_id
      }).single();
      if (regErr) throw regErr;
    }

    // 4) Availability (evita ON CONFLICT: borramos y reinsertamos)
    const rows = buildAvailabilityRowsFromObject(onboarding.availability, uid);
    await supabase.from('availability').delete().eq('profile_id', uid);
    if (rows.length) {
      const { error: avErr } = await supabase.from('availability').insert(rows);
      if (avErr) throw avErr;
    }

    // 5) Zonas preferidas -> profile_locations (resolver id por nombre; crear si falta)
    await supabase.from('profile_locations').delete().eq('profile_id', uid);
    for (const areaName of onboarding.locations) {
      let { data: loc, error: selErr } = await supabase.from('locations').select('id').eq('name', areaName).maybeSingle();
      if (selErr) throw selErr;
      let locId = loc?.id as string | undefined;
      if (!locId) {
        const { data: created, error: insErr } = await supabase.from('locations').insert({ name: areaName }).select('id').single();
        if (insErr) throw insErr;
        locId = created.id;
      }
      const { error: plErr } = await supabase.from('profile_locations').insert({ profile_id: uid, location_id: locId! });
      if (plErr) throw plErr;
    }
  }

  async function ensurePendingOnboarding(userId: string, sessionUser: User) {
    // 1) Carga lo pendiente guardado en navegador
    const raw = sessionStorage.getItem(PENDING_KEY) ?? localStorage.getItem(PENDING_KEY);
    if (!raw) return;

    setLoading(true);
    try {
      const onboarding = JSON.parse(raw) || {};

      // --- A. PERFIL (upsert básico) ---
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        name: onboarding.name ?? sessionUser?.user_metadata?.name ?? '',
        email: onboarding.email ?? sessionUser?.email ?? '',
        role: 'player',
        postal_code: onboarding.postal_code ?? null,
      });
      if (profileErr) throw profileErr;

      // --- B. FOTO DE PERFIL (opcional si viene) ---
      const picDataUrl: string | undefined =
        onboarding.profilePicDataUrl || onboarding.profilePic;

      if (picDataUrl) {
        const file = dataURLtoFile(picDataUrl, `${userId}.jpg`);
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(`${userId}.jpg`, file, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(`${userId}.jpg`);
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
      }

      // --- C. TORNEO + DIVISIÓN ---
      // Preferimos RPC si existe:
      if (onboarding.tournament_id && onboarding.division_id) {
        // Opción RPC (dejar este bloque; si tu proyecto no tiene la función, se usa el fallback)
        const { error: rpcErr } = await supabase.rpc('register_player_for_tournament', {
          p_tournament_id: onboarding.tournament_id,
          p_division_id: onboarding.division_id,
        });
        if (rpcErr) {
          // Fallback directo a tabla intermedia si el RPC no existe en tu BBDD
          const { error: directErr } = await supabase
            .from('tournament_registrations')
            .upsert({
              tournament_id: onboarding.tournament_id,
              division_id: onboarding.division_id,
              profile_id: userId,
            }, { onConflict: 'tournament_id,profile_id' });
          if (directErr) throw directErr;
        }
      }

      // --- D. AVAILABILITY ---
      // Acepta objeto expandido o comprimido (availability_comp)
      let availabilityExpanded: Record<string, string[]> = {};
      if (onboarding.availability && typeof onboarding.availability === 'object') {
        availabilityExpanded = onboarding.availability;
      } else if (onboarding.availability_comp && typeof decompressAvailability === 'function') {
        availabilityExpanded = decompressAvailability(onboarding.availability_comp) || {};
      }

      // buildAvailabilityRowsFromObject DEBE aceptar undefined y usar ?.[day]
      const availabilityRows = buildAvailabilityRowsFromObject(availabilityExpanded, userId);

      await supabase.from('availability').delete().eq('profile_id', userId);
      if (availabilityRows.length > 0) {
        const { error: avErr } = await supabase.from('availability').insert(availabilityRows);
        if (avErr) throw avErr;
      }

      // --- E. PREFERRED LOCATIONS ---
      const locationsArr: string[] = Array.isArray(onboarding.locations) ? onboarding.locations : [];
      await supabase.from('profile_locations').delete().eq('profile_id', userId);
      if (locationsArr.length > 0) {
        for (const areaName of locationsArr) {
          const locId = await ensureLocationIdByName(areaName);
          const { error: linkErr } = await supabase
            .from('profile_locations')
            .insert({ profile_id: userId, location_id: locId });
          if (linkErr) throw linkErr;
        }
      }


      // --- F. Limpieza y recarga ---
      sessionStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(PENDING_KEY);
      await loadInitialData?.(userId);
      console.log('Onboarding completado correctamente.');
    } catch (err) {
      console.error('Error completando onboarding:', err);
      alert(`No pudimos finalizar la configuración de tu perfil. Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setLoginView(true);
    setSelectedDivision(null);
    setSelectedPlayer(null);
    setShowMap(false);
    setSelectedTournament(null);
    setEditProfile(false);
  };

  const openEditProfile = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Cargamos la disponibilidad y locaciones actuales del usuario
      const [availRes, locsRes] = await Promise.all([
        supabase.from('availability').select('*').eq('profile_id', currentUser.id),
        supabase.from('profile_locations').select('locations(name)').eq('profile_id', currentUser.id)
      ]);

      if (availRes.error) throw availRes.error;
      if (locsRes.error) throw locsRes.error;

      // Mapeamos los datos de disponibilidad (sin colisiones por includes)
      const availabilityMap = (availRes.data || []).reduce((acc, slot: any) => {
        const day = days[slot.day_of_week]; // Monday=0 ... Sunday=6
        const start = String(slot.start_time || '').slice(0, 5); // 'HH:MM'
        let timeSlotLabel: string | null = null;

        if (start === '07:00') timeSlotLabel = 'Morning (07:00-12:00)';
        else if (start === '12:00') timeSlotLabel = 'Afternoon (12:00-18:00)';
        else if (start === '18:00') timeSlotLabel = 'Evening (18:00-22:00)';

        if (day && timeSlotLabel) {
          (acc[day] ||= []).push(timeSlotLabel);
        }
        return acc;
      }, {} as Record<string, string[]>);


      // Le decimos a TypeScript que trate cada 'item' como 'any' para evitar el error de tipo.
      const locationNames = (locsRes.data || [])
        .map((item: any) => item.locations?.name)
        .filter(Boolean) as string[];

      // Llenamos el estado de edición con toda la información
      setEditUser({
        name: currentUser.name ?? '',
        email: session?.user?.email ?? currentUser.email ?? '',
        password: '',
        profilePic: currentUser.avatar_url || '',
        availability: availabilityMap,
        locations: locationNames,
        postal_code: currentUser.postal_code ?? '',
        nickname: currentUser.nickname ?? '',
      });

      setPendingAvatarFile(null);
      setEditProfile(true);

    } catch (err: any) {
      console.error("Error opening profile for edit:", err);
      alert(`Could not load profile data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);

    try {
      const uid = session?.user?.id;
      if (!uid) throw new Error('No active session.');

      // --- LÓGICA DE GUARDADO DE PREFERENCIAS AÑADIDA ---
      
      // 1. Guardar Availability
      const availabilityRows = buildAvailabilityRowsFromObject(editUser.availability, uid);
      await supabase.from('availability').delete().eq('profile_id', uid);
      if (availabilityRows.length > 0) {
        const { error: avErr } = await supabase.from('availability').insert(availabilityRows);
        if (avErr) throw avErr;
      }

      // 2. Guardar Locations (crea si falta)
      await supabase.from('profile_locations').delete().eq('profile_id', uid);
      if (editUser.locations.length > 0) {
        for (const areaName of editUser.locations) {
          const locId = await ensureLocationIdByName(areaName);
          const { error: linkErr } = await supabase
            .from('profile_locations')
            .insert({ profile_id: uid, location_id: locId });
          if (linkErr) throw linkErr;
        }
      }


      // 3. Subir avatar si se seleccionó un archivo nuevo
      let newAvatarUrl: string | undefined;
      if (pendingAvatarFile) {
        const path = `${uid}.jpg`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, pendingAvatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        newAvatarUrl = pub.publicUrl;
      }

      // 4. Actualizar perfil (nombre y avatar_url)
      const { error: upErr } = await supabase.from('profiles').update({
          name: editUser.name,
          avatar_url: newAvatarUrl ?? currentUser?.avatar_url ?? undefined,
          postal_code: editUser.postal_code || null,
          nickname: editUser.nickname?.trim() || null,
        }).eq('id', uid);
      if (upErr) throw upErr;

      // 5. Cambiar contraseña si se escribió una
      if (editUser.password.trim()) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: editUser.password });
        if (pwErr) throw pwErr;
      }

      // 6. Refrescar todos los datos y cerrar el modal
      await fetchData(uid);
      
      // Refrescar vista del perfil seleccionado si es el propio
      if (selectedPlayer?.id === uid) {
        const [{ data: av }, { data: pls }] = await Promise.all([
          supabase.from('availability').select('*').eq('profile_id', uid),
          supabase.from('profile_locations').select('location_id').eq('profile_id', uid),
        ]);

        setSelectedPlayerAvailability(av || []);
        if (pls && Array.isArray(pls)) {
          const names = pls
            .map(pl => locations.find(l => l.id === pl.location_id)?.name)
            .filter((n): n is string => Boolean(n));
          setSelectedPlayerAreas(names);
        }
      }

      setEditProfile(false);
      alert('Profile updated successfully!');

    } catch (err: any) {
      console.error('save profile error:', err);
      setProfileError(err?.message ?? 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };


  const copyToClipboardFallback = (text: string) => {
    if (typeof window !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Message is too long for WhatsApp sharing. It has been copied to your clipboard. Please paste it manually into WhatsApp.');
      } catch (err) {
        alert('Could not copy to clipboard. Please manually copy the message and paste into WhatsApp.');
      }
      document.body.removeChild(textArea);
    }
  };

  function safeShareOnWhatsApp(message: string) {
    const MAX_LENGTH = 4000; // Límite seguro para la mayoría de las plataformas

    // 1. Si el mensaje es muy largo, lo copiamos y avisamos al usuario.
    if (message.length > MAX_LENGTH) {
      navigator.clipboard.writeText(message).then(() => {
        alert('The match list is too long to share directly. It has been copied to your clipboard. Please paste it into WhatsApp.');
      }).catch(() => {
        alert('The match list is too long to share directly and could not be copied. Please try copying it manually.');
      });
      return;
    }

    // 2. Si el mensaje es corto, intentamos usar la API moderna para compartir.
    const shareData = {
      title: 'PPC Scheduled Matches',
      text: message
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      // Intentamos compartir los datos enriquecidos.
      navigator.share(shareData)
        .then(() => console.log('Successful share'))
        .catch((error) => {
          console.error('Web Share API failed:', error);
          // Si la Web Share API falla, abrimos el enlace de WhatsApp como respaldo.
          const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
          window.open(fallbackUrl, '_blank');
        });
    } else {
      // Si la Web Share API no existe (ej. en un PC), abrimos el enlace directamente.
      const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(fallbackUrl, '_blank');
    }
  }


  function divisionIcon(name: string) {
    const map: Record<string, string> = {
      'Diamante': '💎',
      'Oro': '🥇',
      'Plata': '🥈',
      'Bronce': '🥉',
      'Cobre': '⚜️',
      'Hierro': '⚙️',
      'Elite': '⭐',
    };
    return map[name] || '🎾';
  }

  function divisionLogoSrc(name: string) {
    const map: Record<string, string> = {
      'Bronce': '/ppc-bronce.png',
      'Oro': '/ppc-oro.png',
      'Plata': '/ppc-plata.png',
      'Cobre': '/ppc-cobre.png',
      'Hierro': '/ppc-hierro.png',
      'Diamante': '/ppc-diamante.png',
      'Élite': '/ppc-elite.png',
    };
    return map[name] || '/ppc-logo.png';
  }

  function formatPendingShare(m: Match) {
    const creator = profiles.find(p => p.id === m.created_by)?.name || 'Alguien';
    const divName = divisions.find(d => d.id === m.division_id)?.name || '';
    const tName = tournaments.find(t => t.id === m.tournament_id)?.name || '';
    const dayStr = tituloFechaEs(m.date);
    const timeStr = m.time || '';
    const loc = m.location_details || locations.find(l => l.id === m.location_id)?.name || '';
    return `🎾 *${tName} – ${divName}*\n${creator} busca rival.\n📅 ${dayStr}\n🕒 ${timeStr}\n📍 ${loc}\n\n¿Te apuntas?`;
  }

  function sharePendingMatch(m: Match) {
    let msg = formatPendingShare(m);
    const siteUrl = window.location.origin;
    msg = `${msg}\n\n${siteUrl}`;
    safeShareOnWhatsApp(msg);
  }

  async function joinPendingMatch(m: Match) {
    if (!currentUser) return alert('Please log in.');

    setLoading(true);
    try {
      // Evita unirse si ya existe un partido scheduled o played entre el creador y el que se quiere unir
      const hostId = m.home_player_id || m.created_by;  // en pendings, away es null
      if (currentUser && hasAnyMatchBetween(m.tournament_id, m.division_id, currentUser.id, hostId, ['scheduled','played'])) {
        alert('No puedes unirte: ya existe un partido agendado o jugado entre ustedes.');
        setLoading(false);
        return;
      }
      // Concurrencia segura: solo se agenda si sigue "pending" y sin away_player
      const { data, error } = await supabase
        .from('matches')
        .update({ away_player_id: currentUser.id, status: 'scheduled' })
        .eq('id', m.id)
        .is('away_player_id', null)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;
      await fetchData(session?.user.id);
      alert('¡Te uniste al partido!');
    } catch (e: any) {
      // Si otro se adelantó, este update no encuentra filas
      const msg = String(e.message || e);
      alert(msg.includes('0 rows') ? 'Lo siento, alguien ya se unió a ese partido.' : `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function pushNotif(text: string, matchId?: string) {
    setNotifs(prev => [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`, text, matchId, at: Date.now() },
      ...prev
    ].slice(0, 5)); // máximo 5
  }

  function renderNotifs() {
    return (
      <div className="fixed right-4 bottom-4 z-[9999] space-y-2">
        {notifs.map(n => {
          const m = matches.find(mm => mm.id === n.matchId);
          return (
            <div key={n.id} className="relative bg-white shadow-xl rounded-xl p-4 w-80 border">
              <button
                className="absolute top-2 right-2 text-gray-500"
                onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
                aria-label="Cerrar"
              >
                ✕
              </button>
              <div className="font-semibold mb-2">Nuevo partido “busco rival”</div>
              <div className="text-sm text-gray-700 whitespace-pre-line">{n.text}</div>
              {m && (
                <div className="mt-3 flex gap-2">
                  {/* Condición: no creador, mismo torneo/división, sigue pending y sin away */}
                  {(() => {
                    if (!m || !currentUser) return null;
                    const sameDivision = registrations.some(r =>
                      r.profile_id === currentUser.id &&
                      r.tournament_id === m.tournament_id &&
                      r.division_id === m.division_id
                    );
                    const canJoin = sameDivision &&
                                    currentUser.id !== m.created_by &&
                                    m.status === 'pending' &&
                                    !m.away_player_id;
                    return canJoin ? (
                      <button
                        onClick={() => joinPendingMatch(m)}
                        className="flex-1 bg-green-600 text-white py-1.5 rounded-lg hover:bg-green-700"
                      >
                        Unirme
                      </button>
                    ) : null;
                  })()}

                  {/* Compartir (icono WhatsApp solo) */}
                  <button
                    onClick={() => sharePendingMatch(m)}
                    className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    aria-label="Compartir por WhatsApp"
                    title="Compartir por WhatsApp"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.52 3.48A11.9 11.9 0 0012.06 0C5.5 0 .18 5.32.18 11.89c0 2.09.55 4.12 1.6 5.93L0 24l6.36-1.72a11.77 11.77 0 005.7 1.47h.01c6.56 0 11.88-5.32 11.88-11.89 0-3.17-1.24-6.15-3.43-8.38zM12.06 21.3h-.01a9.4 9.4 0 01-4.8-1.32l-.34-.2-3.77 1.02 1.01-3.67-.22-.38a9.42 9.42 0 01-1.44-5.05c0-5.2 4.23-9.42 9.45-9.42 2.52 0 4.88.98 6.66 2.75a9.34 9.34 0 012.77 6.65c0 5.2-4.23 9.42-9.45 9.42zm5.49-7.06c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.29-.78.96-1.18.93-1.18-.17-.3-.02-.46.13-.61.14-.14.29-.35.43-.52.14-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.63-.93-2.23-.25-.59-.5-.52-.69-.53-.18-.01-.38-.02-.58-.02-.2 0-.53.07-.8.39-.28.3-1.05 1.02-1.05 2.48 0 1.46 1.07 2.87 1.23 3.08.15.2 2.14 3.21 5.18 4.5.73.31 1.29.49 1.73.63.73.23 1.39.2 1.92.11.59-.09 1.78-.72 2.03-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/>
                    </svg>
                  </button>
                </div>

              )}
            </div>
          );
        })}
      </div>
    );
  }

 

  function tituloFechaEs(iso?: string | null) {
    if (!iso) return 'Fecha por definir';
    const str = iso.includes('T') ? iso : `${iso}T00:00:00`;
    const d = new Date(str);
    if (isNaN(d.getTime())) return 'Fecha por definir';
    const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.replace(/ de /g, ' ').replace(',', '').replace(/^\w/, c => c.toUpperCase());
  }

  // Devuelve true si 'YYYY-MM-DD' es hoy o futuro (en zona local)
  function isTodayOrFuture(iso?: string | null) {
    if (!iso) return false;
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(n => parseInt(n, 10));
    if (!y || !m || !d) return false;

    const today = new Date();
    const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const dateNum  = y * 10000 + m * 100 + d;
    return dateNum >= todayNum;
  }


  const shareAllScheduledMatches = () => {
    if (!selectedTournament) return;
      const all = matches
        .filter(m =>
          m.tournament_id === selectedTournament.id &&
          m.status === 'scheduled' &&
          isTodayOrFuture(m.date)
        )
        .sort((a, b) => parseYMDLocal(a.date).getTime() - parseYMDLocal(b.date).getTime());

    if (all.length === 0) return alert('No scheduled matches to share');

    let msg = `*Pinta Post Championship - Partidos Programados*\n\n`;
    
    const grouped = all.reduce((acc, match) => {
      const key = dateKey(match.date);
      (acc[key] ||= []).push(match);
      return acc;
    }, {} as Record<string, Match[]>);

    Object.keys(grouped).sort().forEach(date => {
      msg += `*${tituloFechaEs(date)}*\n`;
      grouped[date].forEach(m => {
        const p1 = displayNameForShare(m.home_player_id);
        const p2 = displayNameForShare(m.away_player_id ?? '');
        const divName = divisions.find(d => d.id === m.division_id)?.name || '';
        const icon = divisionIcon(divName);
        // MENSAJE SIMPLIFICADO
        msg += `• ${p1} vs ${p2} ${icon}\n`;
      });
      msg += '\n';
    });
    const siteUrl = window.location.origin; // o tu dominio fijo
    msg = msg.trimEnd() + `\n\n${siteUrl}`;

    safeShareOnWhatsApp(msg);
  };

  const copyTableToClipboard = () => {
    if (!selectedTournament) return alert('Primero elige un torneo');
      const allScheduled = matches
        .filter(m =>
          m.tournament_id === selectedTournament.id &&
          m.status === 'scheduled' &&
          isTodayOrFuture(m.date)
        )
        .sort((a, b) => parseYMDLocal(a.date).getTime() - parseYMDLocal(b.date).getTime());

    if (allScheduled.length === 0) return alert('No hay partidos programados para copiar');

    // FORMATO SIMPLIFICADO IGUAL A WHATSAPP
    let message = `*Pinta Post Championship - Partidos Programados*\n\n`;

    const grouped = allScheduled.reduce((acc, match) => {
      const key = dateKey(match.date);
      (acc[key] ||= []).push(match);
      return acc;
    }, {} as Record<string, Match[]>);

    Object.keys(grouped).sort().forEach(date => {
      message += `*${tituloFechaEs(date)}*\n`;
      grouped[date].forEach(m => {
        const p1 = displayNameForShare(m.home_player_id);
        const p2 = displayNameForShare(m.away_player_id!);
        const divName = divisions.find(d => d.id === m.division_id)?.name || '';
        const icon = divisionIcon(divName);
        // MENSAJE SIMPLIFICADO
        message += `• ${p1} vs ${p2} ${icon}\n`;
      });
      message += '\n';
    });

    navigator.clipboard.writeText(message.trim()).then(() => {
      alert('Lista de partidos copiada al portapapeles!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('No se pudo copiar la lista.');
    });
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Validación sets
    const validSets = newMatch.sets.filter(s =>
      s.score1 !== '' && s.score2 !== '' &&
      !isNaN(parseInt(s.score1)) && !isNaN(parseInt(s.score2))
    );
    if (validSets.length === 0) {
      alert('Please enter valid scores for at least one set');
      return;
    }

    // 2) Validación jugadores (IDs)
    const player1Id = newMatch.player1;
    const player2Id = newMatch.player2;
    if (!player1Id || !player2Id) {
      alert('Please select both players');
      return;
    }

    // Asegura que existan en la división actual
    const playersInDiv = getDivisionPlayers(selectedDivision!.id, selectedTournament!.id);
    const isValidP1 = playersInDiv.some(p => p.id === player1Id);
    const isValidP2 = playersInDiv.some(p => p.id === player2Id);
    if (!isValidP1 || !isValidP2) {
      alert('Selected players are not in this division/tournament');
      return;
    }

    // 3) IDs de torneo/división desde la vista actual (no por nombre)
    const tournamentId = selectedTournament!.id;
    const divisionId   = selectedDivision!.id;

    // 4) Location opcional
    let locationId: string | null = null;
    if (newMatch.location) {
      const loc = locations.find(l => l.name === newMatch.location);
      locationId = loc?.id || null;
    }

    // 5) Cálculos de sets y games
    let p1SetsWon = 0, p2SetsWon = 0, p1Games = 0, p2Games = 0;
    newMatch.sets.forEach(s => {
      const a = parseInt(s.score1), b = parseInt(s.score2);
      if (!isNaN(a) && !isNaN(b)) {
        if (a > b) p1SetsWon++; else if (b > a) p2SetsWon++;
        p1Games += a; p2Games += b;
      }
    });

    // 6) Pintas (usa string -> number)
    const pints = newMatch.hadPint ? Number(newMatch.pintsCount) : 0;

    setLoading(true);
    try {

      const dup = await alreadyPlayedBetween(tournamentId, divisionId, player1Id, player2Id);
      if (dup) {
        alert('Ya existe un resultado entre estos dos jugadores en esta división/torneo. Edita el existente en lugar de crear uno nuevo.');
        setLoading(false);
        return;
      }
      // 7) Insert del match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          tournament_id: tournamentId,
          division_id: divisionId,
          date: newMatch.date || new Date().toISOString().split('T')[0],
          time: newMatch.time,
          location_id: locationId,
          location_details: newMatch.location_details,
          status: 'played',
          home_player_id: player1Id,
          away_player_id: player2Id,
          player1_sets_won: p1SetsWon,
          player2_sets_won: p2SetsWon,
          player1_games_won: p1Games,
          player2_games_won: p2Games,
          player1_had_pint: newMatch.hadPint,
          player2_had_pint: newMatch.hadPint,
          player1_pints: pints,
          player2_pints: pints,
          created_by: session?.user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      if (matchError) throw matchError;

      // 8) Insert de sets
      for (let i = 0; i < newMatch.sets.length; i++) {
        const s = newMatch.sets[i];
        if (s.score1 !== '' && s.score2 !== '') {
          const { error: setErr } = await supabase.from('match_sets').insert({
            match_id: matchData.id,
            set_number: i + 1,
            p1_games: parseInt(s.score1),
            p2_games: parseInt(s.score2),
          });
          if (setErr) throw setErr;
        }
      }

      await loadInitialData(session?.user.id);
      await fetchTournamentsAndDivisions();
      setNewMatch(prev => ({
        ...prev,
        player1: '',
        player2: '',
        sets: [{ score1: '', score2: '' }],
        hadPint: false,
        pintsCount: 1,
        location: '',
        date: '',
        time: ''
      }));
      setSelectedMatchForResult(null);
      alert('Match result added successfully!');
    } catch (err: any) {
      setError(err.message);
      alert(`Error adding match: ${err.message}`);
      console.error('Match creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMatch.player1 || !newMatch.date) {
      return alert('Please fill all required fields.');
    }

    const locationId = locations.find(l => l.name === newMatch.location)?.id || null;
    // --- Lógica añadida para determinar el bloque horario ---
    const hour = parseInt(newMatch.time.split(':')[0], 10);
    let timeBlock = null;
    if (hour >= 7 && hour < 12) {
      timeBlock = 'Morning';
    } else if (hour >= 12 && hour < 18) {
      timeBlock = 'Afternoon';
    } else if (hour >= 18 && hour < 23) {
      timeBlock = 'Evening';
    }
    // --- Fin de la lógica añadida ---

    const status = newMatch.player2 ? 'scheduled' : 'pending';

    try {
      setLoading(true);
      const { error } = await supabase.from('matches').insert({
        tournament_id: selectedTournament!.id,
        division_id: selectedDivision!.id,
        date: newMatch.date,
        time: newMatch.time || null, // Guarda la hora manual (ej: "19:30")
        time_block: timeBlock, // Guarda el bloque calculado (ej: "Evening")
        location_id: locationId || null,
        location_details: newMatch.location_details || null,
        status,
        home_player_id: newMatch.player1,
        away_player_id: newMatch.player2 || null,
        created_by: session?.user.id,
      });
      if (error) throw error;

      await fetchData(session?.user.id);
      alert(status === 'scheduled' ? 'Match scheduled!' : 'Match published as pending!');
      
      setNewMatch(prev => ({ ...prev, player1: '', player2: '', location_details: '', date: '', time: '' }));
    } catch (err: any) {
      alert(`Error scheduling match: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  async function alreadyPlayedBetween(
    tournamentId: string,
    divisionId: string,
    p1: string,
    p2: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('division_id', divisionId)
      .eq('status', 'played')
      .or(
        `and(home_player_id.eq.${p1},away_player_id.eq.${p2}),and(home_player_id.eq.${p2},away_player_id.eq.${p1})`
      )
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  // ¿Existe ya partido entre dos jugadores en este torneo/división con alguno de estos estados?
  function hasAnyMatchBetween(
    tournamentId: string,
    divisionId: string,
    a: string,
    b: string,
    statuses: Array<Match['status']> = ['scheduled','played'] // bloqueamos "agendado" y "jugado"
  ) {
    return matches.some(m =>
      m.tournament_id === tournamentId &&
      m.division_id === divisionId &&
      statuses.includes(m.status) &&
      (
        (m.home_player_id === a && m.away_player_id === b) ||
        (m.home_player_id === b && m.away_player_id === a)
      )
    );
  }

  // Lista de rivales elegibles para "playerId" (oculta con quienes ya hay scheduled/played)
  function eligibleOpponentsFor(
    playerId: string,
    divisionId: string,
    tournamentId: string
  ): Profile[] {
    const players = getDivisionPlayers(divisionId, tournamentId);
    return players.filter(p =>
      p.id !== playerId &&
      !hasAnyMatchBetween(tournamentId, divisionId, playerId, p.id, ['scheduled','played'])
    );
  }


  const addSet = () => {
    setNewMatch(prev => ({
      ...prev,
      sets: [...prev.sets, { score1: '', score2: '' }]
    }));
  };

  const removeSet = (index: number) => {
    if (newMatch.sets.length > 1) {
      const newSets = newMatch.sets.filter((_, i) => i !== index);
      setNewMatch(prev => ({ ...prev, sets: newSets }));
    }
  };

  const updateSetScore = (index: number, field: 'score1' | 'score2', value: string) => {
    const newSets = [...newMatch.sets];
    newSets[index][field] = value;
    setNewMatch(prev => ({ ...prev, sets: newSets }));
  };

  const getDivisionPlayers = (divisionId: string, tournamentId: string) => {
    if (!divisionId || !tournamentId) return [];
    
    // Get all registrations for this division and tournament
    const divisionRegistrations = registrations.filter(r => 
      r.division_id === divisionId && r.tournament_id === tournamentId
    );
    
    // Map to profiles
    return divisionRegistrations
      .map(reg => profiles.find(p => p.id === reg.profile_id))
      .filter((p): p is Profile => p !== undefined);
  };

  const getDivisionMatches = (divisionId: string, tournamentId: string) => {
    if (!divisionId || !tournamentId) return [];
    
    return matches.filter(match => 
      match.division_id === divisionId && 
      match.tournament_id === tournamentId
    );
  };

  const getScheduledMatches = (divisionId: string, tournamentId: string) => {
    if (!divisionId || !tournamentId) return [];
    
    return matches.filter(match => 
      match.division_id === divisionId && 
      match.tournament_id === tournamentId &&
      match.status === 'scheduled' &&
      isTodayOrFuture(match.date)
    );
  };

  const getHeadToHeadResult = (divisionId: string, tournamentId: string, playerAId: string, playerBId: string) => {
    const divisionMatches = getDivisionMatches(divisionId, tournamentId);
    const h2hMatches = divisionMatches.filter(match => 
      (match.home_player_id === playerAId && match.away_player_id === playerBId) || // <-- CORREGIDO
      (match.home_player_id === playerBId && match.away_player_id === playerAId)    // <-- CORREGIDO
    );
    
    if (h2hMatches.length === 0) return null;
    
    let playerAWins = 0;
    let playerBWins = 0;
    
    h2hMatches.forEach(match => {
      // La lógica de victoria aquí ya usa player1_sets_won y player2_sets_won, lo cual es correcto
      // pero la asignación de quién es quién debe ser explícita
      if (match.home_player_id === playerAId) {
        if (match.player1_sets_won > match.player2_sets_won) playerAWins++; else playerBWins++;
      } else { // El jugador A es el away_player
        if (match.player2_sets_won > match.player1_sets_won) playerAWins++; else playerBWins++;
      }
    });
    
    return {
      winner: playerAWins > playerBWins ? playerAId : playerBId,
      playerAWins,
      playerBWins
    };
  };

  function compareByRules(
    a: { profile_id: string; points: number; sets_won: number; sets_lost: number; games_won: number; games_lost: number },
    b: { profile_id: string; points: number; sets_won: number; sets_lost: number; games_won: number; games_lost: number },
    divisionId: string,
    tournamentId: string
  ) {
    // 1) Puntos
    if (b.points !== a.points) return b.points - a.points;

    // 2) Head-to-Head (si hay al menos un partido entre ellos)
    const h2h = getHeadToHeadResult(divisionId, tournamentId, a.profile_id, b.profile_id);
    if (h2h && h2h.playerAWins !== h2h.playerBWins) {
      return h2h.winner === a.profile_id ? -1 : 1;
    }

    // 3) Ratio de sets
    const aSetsTotal = a.sets_won + a.sets_lost;
    const bSetsTotal = b.sets_won + b.sets_lost;
    const aSetRatio = aSetsTotal > 0 ? a.sets_won / aSetsTotal : 0;
    const bSetRatio = bSetsTotal > 0 ? b.sets_won / bSetsTotal : 0;
    if (bSetRatio !== aSetRatio) return bSetRatio - aSetRatio;

    // 4) Ratio de games
    const aGamesTotal = a.games_won + a.games_lost;
    const bGamesTotal = b.games_won + b.games_lost;
    const aGameRatio = aGamesTotal > 0 ? a.games_won / aGamesTotal : 0;
    const bGameRatio = bGamesTotal > 0 ? b.games_won / bGamesTotal : 0;
    if (bGameRatio !== aGameRatio) return bGameRatio - aGameRatio;

    // 5) Nombre (estable)
    const aName = profiles.find(p => p.id === a.profile_id)?.name || '';
    const bName = profiles.find(p => p.id === b.profile_id)?.name || '';
    return aName.localeCompare(bName);
  }

  const getPlayerMatches = (divisionId: string, tournamentId: string, playerId: string) => {
    if (!divisionId || !tournamentId || !playerId) {
      return { played: [] as Match[], scheduled: [] as Match[], upcoming: [] as Profile[] };
    }
    
    const divisionMatches = getDivisionMatches(divisionId, tournamentId);
    const scheduled = getScheduledMatches(divisionId, tournamentId);
    
    const playerMatches = {
      played: divisionMatches.filter(match => 
        (match.home_player_id === playerId || match.away_player_id === playerId) && // <-- CORREGIDO
        match.status === 'played'
      ),
      scheduled: scheduled.filter(match => 
        (match.home_player_id === playerId || match.away_player_id === playerId) && // <-- CORREGIDO
        match.status === 'scheduled'
      )
    };

    const players = getDivisionPlayers(divisionId, tournamentId);
    const opponents = players.filter(player => player.id !== playerId);

    const upcoming = opponents.filter(opponent => {
      return !playerMatches.played.some(match => 
        (match.home_player_id === playerId && match.away_player_id === opponent.id) || // <-- CORREGIDO
        (match.home_player_id === opponent.id && match.away_player_id === playerId)    // <-- CORREGIDO
      ) && !playerMatches.scheduled.some(match =>
        (match.home_player_id === playerId && match.away_player_id === opponent.id) || // <-- CORREGIDO
        (match.home_player_id === opponent.id && match.away_player_id === playerId)    // <-- CORREGIDO
      );
    });

    return { ...playerMatches, upcoming };
  };

  const getDivisionHighlights = (divisionName: string, tournamentName: string) => {
    // Different highlights for PPC Cup divisions
    if (tournamentName.includes('PPC Cup')) {
      const highlights: Record<string, string> = {
        'Elite': 'Top players competing for the PPC Cup championship title.',
        'Standard': 'Intermediate players looking to test their skills in the cup format.',
        'Beginner': 'New players getting their first taste of competitive play in the cup.'
      };
      return highlights[divisionName] || 'Exciting division with passionate players.';
    }
    
    const highlights: Record<string, string> = {
      'Oro': 'The elite players who dominate with powerful serves and aggressive baseline play.',
      'Plata': 'Highly skilled players with excellent all-around game and competitive spirit.',
      'Bronce': 'Solid players improving rapidly with strong fundamentals and consistency.',
      'Cobre': 'Developing players showing great potential and passion for the game.',
      'Hierro': 'Newcomers and enthusiasts learning the game with enthusiasm and dedication.'
    };
    return highlights[divisionName] || 'Exciting division with passionate players.';
  };

  const getNearbyCourts = () => {
    return [
      { id: 1, name: "Central Park Tennis Courts", distance: "0.5 miles", rating: 4.8, type: "Public" },
      { id: 2, name: "Riverside Sports Complex", distance: "1.2 miles", rating: 4.5, type: "Private" },
      { id: 3, name: "University Tennis Center", distance: "2.1 miles", rating: 4.7, type: "Semi-Private" },
      { id: 4, name: "Green Valley Racquet Club", distance: "3.0 miles", rating: 4.9, type: "Private" },
      { id: 5, name: "Community Sports Park", distance: "1.8 miles", rating: 4.3, type: "Public" }
    ];
  };

  const toggleLocation = (location: string) => {
    setNewUser(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(loc => loc !== location)
        : [...prev.locations, location]
    }));
  };

  const toggleAvailability = (day: string, timeSlot: string) => {
    setNewUser(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: prev.availability[day]?.includes(timeSlot)
          ? prev.availability[day].filter(slot => slot !== timeSlot)
          : [...(prev.availability[day] || []), timeSlot]
      }
    }));
  };

  const toggleTournament = (tournament: string) => {
    setNewUser(prev => ({
      ...prev,
      tournaments: prev.tournaments.includes(tournament)
        ? prev.tournaments.filter(t => t !== tournament)
        : [...prev.tournaments, tournament]
    }));
  };


  // FUNCIÓN PARA EL FORMULARIO DE REGISTRO
  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    if (!target || !target.files) return;
    const file = target.files[0];
    if (!file) return;

    try {
      // Redimensiona para reducir drásticamente el tamaño antes de guardar en storage
      const original = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const resized = await resizeImage(original, 400); // ~ancho 400px, muy liviano
      setPendingAvatarPreview(resized);
      setNewUser(prev => ({ ...prev, profilePic: resized }));
    } catch (err) {
      console.error('Image resize error:', err);
      alert('No se pudo procesar la imagen.');
    }
  };


  const handleEditAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    if (!target || !target.files) return;

    const file = target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        try {
          setLoading(true);
          const originalDataUrl = event.target.result as string;
          
          // Redimensionamos la imagen también aquí
          const resizedDataUrl = await resizeImage(originalDataUrl, 400);
          
          // Guardamos el archivo redimensionado para subirlo (necesitamos convertirlo de nuevo)
          setPendingAvatarFile(dataURLtoFile(resizedDataUrl, 'avatar.jpg'));
          
          // Actualizamos la vista previa en el modal
          setEditUser(prev => ({ ...prev, profilePic: resizedDataUrl }));

        } catch (err) {
          console.error("Error resizing image:", err);
          alert("There was an error processing the image.");
        } finally {
          setLoading(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };


  const saveProfileChanges = async () => {
    if (editUser.name) {
      try {
        setLoading(true);
        
        // Update profile name
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ name: editUser.name })
          .eq('id', currentUser?.id);
          
        if (profileError) throw profileError;
        
        // Refresh data
        loadInitialData(session?.user.id);
        
        setEditProfile(false);
      } catch (err: any) {
        setError(err.message);
        alert(`Error saving profile: ${err.message}`);
        console.error('Profile update error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      // Contenedor principal que centra todo en la pantalla
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700 flex items-center justify-center p-4">
        
        {/* Contenedor interno:
          - Se quita el fondo blanco ('bg-white') y la sombra para hacerlo transparente.
          - Se añade 'flex flex-col items-center' para centrar la imagen y el texto.
        */}
        <div className="w-full max-w-md text-center flex flex-col items-center">
          
          <img
            src="/loading-beer.gif" // Asegúrate que este sea el nombre de tu GIF en la carpeta 'public'
            alt="Cargando..."
            // Se aumenta el tamaño de la imagen. Puedes cambiar 'h-40 w-40' al tamaño que prefieras.
            className="h-40 w-40" 
          />
          
          {/* Se cambia el color del texto a blanco para que se vea sobre el fondo verde */}
          <p className="mt-4 text-white font-semibold text-lg">
            Cargando tu pinta...
          </p>

        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => { setError(null); if (session?.user) loadInitialData(session.user.id); }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loginView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Pinta Post Championship</h1>
            <p className="text-gray-600">Tennis League</p>
            {/* LOGO PPC: centrado, tamaño responsive */}
            <img
              src="/ppc-logo.png"
              alt="PPC Logo"
              className="mx-auto mt-4 h-24 w-auto md:h-32"
            />
          </div>

          {registrationStep === 1 ? (
            <>
              <div className="border-t pt-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Login</h2>
                <form onSubmit={handleLogin}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Login
                    </button>

                    <div className="text-center mt-4">
                      <button
                        type="button" // Importante que sea "button" para no enviar el formulario
                        onClick={handlePasswordReset}
                        className="text-sm text-gray-600 hover:text-gray-900 hover:underline focus:outline-none"
                      >
                        Forgot your password?
                      </button>
                    </div>

                  </div>
                </form>
                
                <div className="mt-4 text-sm text-center text-gray-600">
                </div>
              </div>

              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create Account</h2>
                <form onSubmit={handleRegister}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Continue
                    </button>
                    <p>Utiliza Nombre + Apellido, y correo personal</p>
                  </div>
                </form>
              </div>

            </>
          ) : registrationStep === 2 ? (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Complete Your Profile</h2>
              <form onSubmit={handleRegister}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      {(pendingAvatarPreview || editUser.profilePic) ? (
                        <img
                          src={pendingAvatarPreview || editUser.profilePic}
                          alt="Profile preview"
                          className="mx-auto h-24 w-24 rounded-full object-cover"
                        />
                      ) : (
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4 4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}

                      <div className="mt-4">
                        <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200">
                          Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleProfilePicUpload}
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">PNG/JPG hasta 5MB</p>
                    </div>

                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Locations</label>
                    <div className="grid grid-cols-2 gap-2">
                      {locationsList.map(location => (
                        <label key={location} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newUser.locations.includes(location)}
                            onChange={() => toggleLocation(location)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{location}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <div className="border rounded-lg overflow-hidden">
                      {/* Mobile responsive table with horizontal scrolling */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                              {timeSlots.map(slot => (
                                <th key={slot} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{slot}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {days.map(day => (
                              <tr key={day}>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{day}</td>
                                {timeSlots.map(slot => (
                                  <td key={slot} className="px-4 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={newUser.availability[day]?.includes(slot) || false}
                                      onChange={() => toggleAvailability(day, slot)}
                                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 text-center md:text-left">
                      * All time slots are visible on mobile with horizontal scrolling
                    </p>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setRegistrationStep(1)}
                      className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Join Tournament</h2>
              <form onSubmit={handleRegister}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament</label>
                    <select
                      value={pickedTournamentId}
                      onChange={(e) => {
                        setPickedTournamentId(e.target.value);
                        setPickedDivisionId(''); // reset división al cambiar torneo
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Tournament</option>
                      {(tournaments || []).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Division</label>
                    <select
                      value={pickedDivisionId}
                      onChange={(e) => setPickedDivisionId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                      disabled={!pickedTournamentId}
                    >
                      <option value="">Select Division</option>
                      {(divisions || [])
                        .filter(d => d.tournament_id === pickedTournamentId)
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                      <p>Utiliza una clave simple con más de 6 caracteres</p>
                    </div>

                  {/* Nueva casilla de verificación */}
                  <div className="flex items-start mt-4">
                      <div className="flex items-center h-5">
                      <input
                          id="commitment"
                          name="commitment"
                          type="checkbox"
                          checked={hasCommitted}
                          onChange={(e) => setHasCommitted(e.target.checked)}
                          className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                      />
                      </div>
                      <div className="ml-3 text-sm">
                      <label htmlFor="commitment" className="font-medium text-gray-700">
                          Me comprometo a jugar todos mis partidos e ir por una Pinta Post
                      </label>
                      </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex space-x-4 mt-6">
                      <button
                          type="button"
                          onClick={() => setRegistrationStep(2)}
                          className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-200"
                      >
                          Back
                      </button>
                      
                      {/* El botón de registro ahora solo aparece si la casilla está marcada */}
                      {hasCommitted && (
                      <button
                          type="submit"
                          className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                      >
                          Complete Registration
                      </button>
                      )}
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (editProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Edit Profile</h2>
            <button onClick={() => setEditProfile(false)} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={editUser.name}
                onChange={(e) => setEditUser(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <label className="block text-sm font-medium text-gray-700 mt-4">Preferred name (nickname)</label>
              <input
                value={editUser.nickname}
                onChange={e => setEditUser(v => ({ ...v, nickname: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                placeholder="Ej: Pato, Nico, Koke..."
              />
            </div>


            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={editUser.email ?? ''}   // importante: fallback a ''
                onChange={(e) => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Password (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password (optional)</label>
              <input
                type="password"
                value={editUser.password}
                onChange={(e) => setEditUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Leave blank to keep current"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {editUser.profilePic ? (
                  <img
                    src={editUser.profilePic}
                    alt="Preview"
                    className="mx-auto h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <p className="text-sm text-gray-500">No image selected</p>
                )}
                <div className="mt-4">
                  <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditAvatarSelect}  // <- usa el handler nuevo
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
            {/* Preferred Locations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Locations</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {locationsList.map(location => (
                  <label key={location} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editUser.locations.includes(location)}
                      onChange={() => handleEditToggleLocation(location)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{location}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Postcode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
              <input
                type="text"
                value={editUser.postal_code || ''}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase().trim();
                  setEditUser(prev => ({ ...prev, postal_code: v }));
                }}
                placeholder="SW1A 1AA"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Opcional. Ayuda a encontrar canchas cerca tuyo.</p>
            </div>
            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                      {timeSlots.map(slot => (
                        <th key={slot} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{slot}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {days.map(day => (
                      <tr key={day}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{day}</td>
                        {timeSlots.map(slot => (
                          <td key={slot} className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={editUser.availability[day]?.includes(slot) || false}
                              onChange={() => handleEditToggleAvailability(day, slot)}
                              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              {savingProfile ? 'Saving...' : 'Save'}
            </button>

            {/* Error */}
            {profileError && (
              <p className="text-red-600 text-sm mt-2">{profileError}</p>
            )}
          </form>

        </div>
      </div>
    );
  }

  if (editingSchedule) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Editar partido programado</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                lang="es-CL"
                value={editedSchedule.date}
                onChange={(e) => setEditedSchedule(s => ({ ...s, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <select
                value={editedSchedule.time}
                onChange={(e) => setEditedSchedule(s => ({ ...s, time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">Selecciona hora</option>
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (zona)</label>
              <select
                value={editedSchedule.locationName}
                onChange={(e) => setEditedSchedule(s => ({ ...s, locationName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">(sin zona)</option>
                {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lugar específico</label>
              <input
                type="text"
                placeholder="Ej: Clapham Common Court 4"
                value={editedSchedule.location_details}
                onChange={(e) => setEditedSchedule(s => ({ ...s, location_details: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
          </div>
          {/* Acciones */}
          <div className="flex items-center justify-between mt-8">
            {/* Izquierda: borrar */}
            <button
              onClick={() => handleDeleteScheduledMatch()} 
              className="px-5 py-2 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Borrar partido
            </button>

            {/* Derecha: cancelar / guardar */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingSchedule(null)}
                className="px-5 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditedSchedule}
                className="px-5 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (editingMatch) {
    // Nombres para etiquetar inputs
    const p1Name = profiles.find(p => p.id === editingMatch.home_player_id)?.name || 'Player 1';
    const p2Name = profiles.find(p => p.id === editingMatch.away_player_id)?.name || 'Player 2';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white w-full max-w-[92vw] sm:max-w-xl md:max-w-2xl rounded-2xl shadow-2xl ring-1 ring-black/5 p-4 sm:p-6 max-h-[80vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-4 sm:mb-6">Edit Match Result</h3>

          {/* Sets con nombres + agregar/quitar */}
          <div className="border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4 bg-white/60">
            {editedMatchData.sets.map((set, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700">Set {index + 1}</span>
                  {editedMatchData.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEditedSet(index)}
                      className="h-9 px-3 text-xs rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{p1Name}</div>
                    <input
                      type="number"
                      value={set.score1}
                      onChange={(e) => updateEditedSetScore(index, 'score1', e.target.value)}
                      className="w-full h-11 text-base px-3 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{p2Name}</div>
                    <input
                      type="number"
                      value={set.score2}
                      onChange={(e) => updateEditedSetScore(index, 'score2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <button
                type="button"
                onClick={addEditedSet}
                className="text-sm h-11 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                + Agregar set
              </button>
            </div>
          </div>

          {/* Pintas */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center">
              <input
                id="editHadPint"
                type="checkbox"
                checked={editedMatchData.hadPint}
                onChange={(e) => setEditedMatchData({ ...editedMatchData, hadPint: e.target.checked })}
                className="size-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor="editHadPint" className="ml-2 text-sm text-gray-700">
                ¿Se tomaron una Pinta post?
              </label>
            </div>

            {editedMatchData.hadPint && (
              <div className="ml-6">
                <label className="text-sm font-medium text-gray-700">¿Cuántas cada uno?</label>
                <input
                  type="number"
                  min="1"
                  value={editedMatchData.pintsCount}
                  onChange={(e) =>
                    setEditedMatchData({ ...editedMatchData, pintsCount: parseInt(e.target.value) || 1 })
                  }
                  className="w-24 h-11 text-base px-3 border border-gray-300 rounded-lg text-center ml-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Anécdota del partido */}
          <label className="block text-sm font-medium text-gray-700 mt-4">
            Anécdota (opcional, máx. 50 palabras)
          </label>
          <textarea
            value={editedMatchData.anecdote ?? ''}
            onChange={(e) => {
              let text = e.target.value ?? '';

              // Separar por espacios, contar palabras, pero sin eliminar los espacios del texto
              const words = text.trim().split(/\s+/);
              if (words.length > 50) {
                // Cortar al número 50, pero manteniendo el resto del texto con espacios normales
                text = words.slice(0, 50).join(' ');
              }

              setEditedMatchData(prev => ({ ...prev, anecdote: text }));
            }}
            rows={3}
            placeholder="Ej: se definió en tiebreak del 2° set..."
            className="mt-1 block w-full min-h-[96px] text-base rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            {((editedMatchData.anecdote || '').trim().split(/\s+/).filter(Boolean).length)} / 50 palabras
          </p>

          {/* Acciones */}
          <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4">
            {/* Izquierda: borrar partido */}
            <button
              onClick={handleDeleteMatch}
              className="w-full sm:w-auto inline-flex justify-center items-center h-11 px-5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
            >
              Borrar partido
            </button>

            {/* Derecha: cancelar / guardar */}
            <div className="flex gap-3">
              <button
                onClick={() => setEditingMatch(null)}
                className="w-full sm:w-auto inline-flex justify-center items-center h-11 px-5 rounded-lg bg-gray-100 text-gray-800 font-medium hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditedMatch}
                className="w-full sm:ml-auto sm:w-auto inline-flex justify-center items-center h-11 px-5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (showMap) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">Find Nearby Tennis Courts</p>
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Back to Tournament
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Nearby Tennis Courts</h2>
            
            <div className="mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">PPC Recommended Courts</h3>
                <p className="text-blue-700 text-sm">These are the most popular courts among PPC players, featuring excellent facilities and convenient booking options.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getNearbyCourts().map(court => (
                <div key={court.id} className="border rounded-lg p-6 hover:shadow-md transition duration-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{court.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">{court.distance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rating:</span>
                      <span className="font-medium text-yellow-600">{'★'.repeat(Math.floor(court.rating)) + '☆'.repeat(5 - Math.floor(court.rating))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{court.type}</span>
                    </div>
                  </div>
                  <button className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200">
                    Book Court
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="bg-gray-100 h-96 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="mt-4 text-gray-600">Interactive map would be displayed here</p>
                  <p className="text-sm text-gray-500">Showing tennis courts within 5 miles radius</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {renderNotifs()}
      </div>
    );
  }

  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/ppc-logo.png" alt="PPC Logo" className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain" />
                <div>
                  <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                  <p className="text-gray-600">Tennis League</p>
                </div>
              </div>
              {currentUser && (
                <div className="flex items-center justify-center flex-wrap gap-2 md:space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="text-sm text-gray-600">
                      {/* Muestra todos los torneos en los que está inscrito */}
                      {registrations
                        .filter(r => r.profile_id === currentUser.id)
                        .map(r => tournaments.find(t => t.id === r.tournament_id)?.name)
                        .filter(Boolean)
                        .join(', ') || 'No tournaments'}
                    </p>
                  </div>
                  <img
                    src={avatarSrc(currentUser)}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                  />
                  <button
                    onClick={openEditProfile}
                    className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    aria-label="Editar perfil"
                    title="Editar perfil"
                  >
                    <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="7" r="4" strokeWidth="2"/>
                      <path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-3 sm:p-2 rounded-full hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    aria-label="Cerrar sesión"
                    title="Cerrar sesión"
                  >
                    <svg className="w-7 h-7 sm:w-6 sm:h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 16l-4-4m0 0l4-4m-4 4h11"/>
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h4a2 2 0 002-2v-2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to the Pinta Post Championship</h2>
            <p className="text-white text-lg opacity-90">Select a tournament to view divisions and player details</p>
            
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 mt-4" // Añadimos un margen superior
            >
              Join a New Tournament
            </button>
          </div>

            {/* Tournament Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {tournaments.map(tournament => {
              // Get tournament registrations
              const tournamentRegistrations = registrations.filter(r => r.tournament_id === tournament.id);
              
              // Get tournament matches
              const tournamentMatches = matches.filter(m => m.tournament_id === tournament.id);
              
              // Calculate total pints for the tournament
              const totalPints = tournamentMatches.reduce((sum, match) => 
                sum + (match.player1_had_pint ? match.player1_pints : 0) + 
                (match.player2_had_pint ? match.player2_pints : 0), 0
              );
              
              // Get all scheduled matches for the tournament
              const allScheduled = tournamentMatches.filter(m => m.status === 'scheduled');
              
              return (
                <div 
                  key={tournament.id} 
                  className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300" 
                  onClick={() => setSelectedTournament(tournament)}
                >
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{tournament.name}</h3>
                    <p className="text-gray-600 mb-4">Compete in our premier tennis championship</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{tournamentRegistrations.length}</div>
                        <div className="text-sm text-gray-600">Players</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{tournamentMatches.length}</div>
                        <div className="text-sm text-gray-600">Matches</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                        <div className="text-sm text-gray-600">Total Pintas</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{allScheduled.length}</div>
                        <div className="text-sm text-gray-600">Upcoming Matches</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        {showJoinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Join a New Tournament</h2>
              <div className="space-y-4">
                {/* Selector de Torneo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament</label>
                  <select
                    value={newRegistration.tournamentId}
                    onChange={(e) => setNewRegistration({ tournamentId: e.target.value, divisionId: '' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    {tournaments.filter(t => t.status === 'active').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Selector de División */}
                {newRegistration.tournamentId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Division</label>
                    <select
                      value={newRegistration.divisionId}
                      onChange={(e) => setNewRegistration(prev => ({ ...prev, divisionId: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {divisions.filter(d => d.tournament_id === newRegistration.tournamentId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Botones de acción */}
                <div className="flex space-x-4 pt-4">
                  <button onClick={() => setShowJoinModal(false)} className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold">Cancel</button>
                  <button onClick={handleJoinTournament} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold">Join</button>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Set Match Button */}
          <div className="text-center mt-8">
            <button
              onClick={() => setShowMap(true)}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 text-lg"
            >
              Find Tennis Courts
            </button>
          </div>

          {/* Instagram footer */}
          <div className="mt-4 text-center text-sm text-gray-700">
            <span className="mr-2">Para más información, visita:</span>
            <a
              href="https://instagram.com/pintapostchampionship"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-pink-600 hover:text-pink-700"
            >
              {/* icono simple cámara/instagram */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3a5 5 0 110 10 5 5 0 010-10zm0 2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM17.5 6a1 1 0 110 2 1 1 0 010-2z"/>
              </svg>
              <span className="align-middle">@pintapostchampionship</span>
            </a>
          </div>

          {socialEvents.length > 0 && (
            <div className="mt-6 mx-auto max-w-2xl">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📣</span>
                  <div>
                    <div className="font-semibold text-gray-900">
                      Próximo evento: {socialEvents[0].title}
                    </div>
                    <div className="text-sm text-gray-700">
                      {tituloFechaEs(socialEvents[0].date)}
                      {socialEvents[0].time ? ` · ${socialEvents[0].time}` : ''} 
                      {socialEvents[0].venue ? ` · ${socialEvents[0].venue}` : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {socialEvents[0].rsvp_url && (
                    <a
                      href={socialEvents[0].rsvp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      Confirmar asistencia
                    </a>
                  )}
                  {socialEvents[0].image_url && (
                    <img src={socialEvents[0].image_url} alt="Evento" className="h-12 w-auto rounded" />
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
        {renderNotifs()}
      </div>
    );
  }

  if (selectedTournament && !selectedDivision) {
    // Tournament View with all divisions
    const tournamentDivisions = divisions.filter(d => d.tournament_id === selectedTournament.id);
    
    const divisionsData = tournamentDivisions.map(division => {
      const players = getDivisionPlayers(division.id, selectedTournament.id) || [];
      const totalPossibleMatches = players.length > 1 ? players.length - 1 : 0;

      const divisionStandings = standings.filter(
        s => s.division_id === division.id && s.tournament_id === selectedTournament.id
      );     

      // partidos jugados de ESTA división (para head-to-head)
      const playedInThisDiv = matches.filter(
        m => m.tournament_id === selectedTournament.id &&
            m.division_id === division.id &&
            m.status === 'played'
      );

      // Stats por jugador (incluye wins/sets/games para los desempates)
      const playerRows = players.map(player => {
        const s = divisionStandings.find(st => st.profile_id === player.id);
        const played = (s?.wins || 0) + (s?.losses || 0);
        const scheduled = matches.filter(m =>
          m.division_id === division.id &&
          (m.home_player_id === player.id || m.away_player_id === player.id) &&
          m.status === 'scheduled'
        ).length;

        return {
          id: player.id,
          name: player.name,
          gamesPlayed: played,
          gamesScheduled: scheduled,
          gamesNotScheduled: totalPossibleMatches - played - scheduled,
          pints: s?.pints || 0,
          points: s?.points || 0,
          sets_won: s?.sets_won || 0,
          sets_lost: s?.sets_lost || 0,
          games_won: s?.games_won || 0,
          games_lost: s?.games_lost || 0,
        };
      });

      const sortedForLeader = [...playerRows].sort((a, b) =>
        compareByRules(
          { profile_id: a.id, points: a.points, sets_won: a.sets_won, sets_lost: a.sets_lost, games_won: a.games_won, games_lost: a.games_lost },
          { profile_id: b.id, points: b.points, sets_won: b.sets_won, sets_lost: b.sets_lost, games_won: b.games_won, games_lost: b.games_lost },
          division.id,
          selectedTournament.id
        )
      );

      const sortedByPints = [...playerRows].sort((a, b) => b.pints - a.pints);

      return {
        division,
        players: players.length,
        gamesPlayed: matches.filter(m => m.division_id === division.id && m.status === 'played').length,
        totalPints: playerRows.reduce((sum, p) => sum + p.pints, 0),
        leader: sortedForLeader.length ? {
          id: sortedForLeader[0].id,
          name: sortedForLeader[0].name,
          gamesPlayed: sortedForLeader[0].gamesPlayed,
          gamesScheduled: sortedForLeader[0].gamesScheduled,
          gamesNotScheduled: sortedForLeader[0].gamesNotScheduled,
          pints: sortedForLeader[0].pints,
          points: sortedForLeader[0].points,
        } : null,
        topPintsPlayer: sortedByPints[0] || null,
        // Si quieres ver el panel “actividad” ordenado igual, deja 'sortedForLeader'; si no, usa 'playerRows'
        playerStats: sortedForLeader,
      };
    });


    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <button
                  onClick={() => setSelectedTournament(null)}
                  className="text-green-600 hover:text-green-800 font-semibold mb-2"
                >
                  ← Back to Tournaments
                </button>
                <div className="flex items-center gap-3 mt-1">
                  <img src="/ppc-logo.png" alt="PPC Logo" className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain" />
                  <div>
                    <h1 className="text-4xl font-bold text-gray-800">{selectedTournament.name}</h1>
                    <p className="text-gray-600">All divisions and player details</p>
                  </div>
                </div>
              </div>
              
              {currentUser && (
                <div className="flex items-center justify-center flex-wrap gap-2 md:space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="text-sm text-gray-600">
                      Division: {
                        registrations
                          .filter(r => r.profile_id === currentUser.id && r.tournament_id === selectedTournament.id)
                          .map(r => divisions.find(d => d.id === r.division_id)?.name)
                          .filter(Boolean) 
                          .join(', ') || 'N/A'
                      }
                    </p>
                  </div>
                  <img
                    src={avatarSrc(currentUser)}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                  />                  
                  <button
                    onClick={openEditProfile}
                    className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    aria-label="Editar perfil"
                    title="Editar perfil"
                  >
                    <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="7" r="4" strokeWidth="2"/>
                      <path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-3 sm:p-2 rounded-full hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    aria-label="Cerrar sesión"
                    title="Cerrar sesión"
                  >
                    <svg className="w-7 h-7 sm:w-6 sm:h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 16l-4-4m0 0l4-4m-4 4h11"/>
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h4a2 2 0 002-2v-2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tournament Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Tournament Summary</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{divisionsData.reduce((sum, d) => sum + d.players, 0)}</div>
                  <div className="text-sm text-gray-600">Total Players</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{divisionsData.reduce((sum, d) => sum + d.gamesPlayed, 0)}</div>
                  <div className="text-sm text-gray-600">Total Games Played</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{divisionsData.reduce((sum, d) => sum + d.totalPints, 0)}</div>
                  <div className="text-sm text-gray-600">Total Pintas Consumidas</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{divisionsData.length}</div>
                  <div className="text-sm text-gray-600">Divisions</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Division Winners</h3>
              <div className="space-y-4">
                {divisionsData.map(d => (
                  <div
                    key={d.division.id}
                    className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all" 
                    onClick={() => setSelectedDivision(d.division)} 
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">
                        {d.division.name}
                        <span className="ml-2 text-sm text-purple-700">
                          ({Number(d.totalPints || 0)} 🍺)
                        </span>
                      </span>
                      <span className="text-sm text-gray-600">
                        Líder: {d.leader ? uiName(d.leader.name) : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Division Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {divisionsData.map(({ division, players, gamesPlayed, totalPints, leader, topPintsPlayer }) => (
              <div 
                key={division.id} 
                className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300" 
                onClick={() => setSelectedDivision(division)}
              >
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">{division.name}</h3>
                  <p className="text-gray-600 mb-4">{getDivisionHighlights(division.name, selectedTournament.name)}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{players}</div>
                      <div className="text-sm text-gray-600">Players</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{gamesPlayed}</div>
                      <div className="text-sm text-gray-600">Matches</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                      <div className="text-sm text-gray-600">Total Pintas</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{topPintsPlayer ? Number(topPintsPlayer.pints) : 0}</div>
                      <div className="text-sm text-gray-600">Pintas Máximas</div>
                    </div>
                  </div>
                  {leader && (
                    <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                      <div className="text-sm text-yellow-800">Líder Actual</div>
                      <div className="font-semibold text-yellow-900">{leader.name}</div>
                      <div className="text-sm text-yellow-700">
                        {leader.points} puntos
                      </div>
                    </div>
                  )}
                  {topPintsPlayer && (
                    <div className="bg-blue-50 p-3 rounded-lg mb-4">
                      <div className="text-sm text-blue-800">Jugador con Más Pintas</div>
                      <div className="font-semibold text-blue-900">{uiName(topPintsPlayer.name)}</div>
                      <div className="text-sm text-blue-700">{Number(topPintsPlayer.pints)} pintas</div>
                    </div>
                  )}
                  
                  {/* Match Status Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold">Partidos</div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GP</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GS</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GN</th>
                        </tr>
                      </thead>
                        <tbody className="divide-y divide-gray-200">
                          {divisionsData
                            .find(d => d.division.id === division.id)
                            ?.playerStats // .slice(0, 3) - Mostramos solo el top 3
                            .map(stats => (
                              <tr key={stats.id} className="text-sm">
                                <td className="px-4 py-2 font-medium text-gray-900">{uiName(stats.name)}</td>
                                <td className="px-4 py-2 text-center">{stats.gamesPlayed}</td>
                                <td className="px-4 py-2 text-center">{stats.gamesScheduled}</td>
                                <td className="px-4 py-2 text-center">{stats.gamesNotScheduled}</td>
                              </tr>
                          ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Matches Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Partidos Programados - {selectedTournament.name}</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={copyTableToClipboard}
                  className="grid place-items-center w-11 h-11 rounded-xl bg-gray-600 text-white hover:bg-green-700 active:scale-[.98] transition"
                  aria-label="Copiar"
                  title="Copiar"
                >
                  <img src="/copy.svg" alt="" className="w-6 h-6" />
                </button>
                {/* WhatsApp (icono solo) */}
                <button
                  type="button"
                  onClick={shareAllScheduledMatches}
                  className="grid place-items-center w-11 h-11 rounded-xl bg-green-600 text-white hover:bg-green-700 active:scale-[.98] transition"
                  aria-label="Compartir por WhatsApp"
                  title="Compartir por WhatsApp"
                >
                  {/* Logo WhatsApp */}
                  <img src="/whatsapp.svg" alt="" className="w-6 h-6" /> 
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matches
                    .filter(match => 
                      match.tournament_id === selectedTournament.id && 
                      match.status === 'scheduled' &&
                      isTodayOrFuture(match.date)
                    )
                    .sort((a, b) => parseYMDLocal(a.date).getTime() - parseYMDLocal(b.date).getTime())
                    .map(match => {
                      const player1 = profiles.find(p => p.id === match.home_player_id);
                      const player2 = profiles.find(p => p.id === match.away_player_id);
                      const division = divisions.find(d => d.id === match.division_id)?.name || '';
                      const location = locations.find(l => l.id === match.location_id)?.name || '';
                      
                      return (
                        <tr key={match.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDateLocal(match.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{uiName(player1?.name)} vs {uiName(player2?.name)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.time && match.time.slice(0, 5)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{division}</td>
                          {/* Location */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-middle">
                            {
                              [
                                locations.find(l => l.id === match.location_id)?.name,
                                match.location_details
                              ].filter(Boolean).join(' - ') || 'TBD'
                            }
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm align-middle">
                            {canEditSchedule(match) && (
                              <div className="space-x-2">
                                <button
                                  onClick={() => openEditSchedule(match)}
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteScheduledMatch(match)}
                                  className="text-red-600 hover:text-red-800 underline"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Photo Gallery */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Tournament Highlights</h3>
            <p className="text-gray-600 text-center">No photos available yet. Start adding matches to create highlights!</p>
          </div>

          {/* Set Match Button */}
          <div className="text-center mt-8">
            <button
              onClick={() => setShowMap(true)}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 text-lg"
            >
              Find Tennis Courts
            </button>
          </div>
          {/* Instagram footer */}
          <div className="mt-4 text-center text-sm text-gray-700">
            <span className="mr-2">Para más información, visita:</span>
            <a
              href="https://instagram.com/pintapostchampionship"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-pink-600 hover:text-pink-700"
            >
              {/* icono simple cámara/instagram */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3a5 5 0 110 10 5 5 0 010-10zm0 2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM17.5 6a1 1 0 110 2 1 1 0 010-2z"/>
              </svg>
              <span className="align-middle">@pintapostchampionship</span>
            </a>
          </div>
          {socialEvents.length > 0 && (
            <div className="mt-6 mx-auto max-w-2xl">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📣</span>
                  <div>
                    <div className="font-semibold text-gray-900">
                      Próximo evento: {socialEvents[0].title}
                    </div>
                    <div className="text-sm text-gray-700">
                      {tituloFechaEs(socialEvents[0].date)}
                      {socialEvents[0].time ? ` · ${socialEvents[0].time}` : ''} 
                      {socialEvents[0].venue ? ` · ${socialEvents[0].venue}` : ''}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {socialEvents[0].rsvp_url && (
                    <a
                      href={socialEvents[0].rsvp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      Confirmar asistencia
                    </a>
                  )}
                  {socialEvents[0].image_url && (
                    <img src={socialEvents[0].image_url} alt="Evento" className="h-12 w-auto rounded" />
                  )}
                </div>
              </div>
            </div>
          )}


        </div>
        {renderNotifs()}
      </div>
    );
  }

  // Division View
  if (selectedTournament && selectedDivision) {
    const players = getDivisionPlayers(selectedDivision.id, selectedTournament.id) || [];

  // Oculta rivales con los que ya hubo scheduled o played
  const eligibleP2Options =
    !newMatch.player1
      ? players
      : players.filter(p =>
          p.id !== newMatch.player1 &&
          !hasAnyMatchBetween(
            selectedTournament.id,
            selectedDivision.id,
            newMatch.player1,
            p.id,
            ['scheduled','played']
          )
        );

  // Si primero eliges Jugador 2, hacemos lo mismo del otro lado:
  const eligibleP1Options =
    !newMatch.player2
      ? players
      : players.filter(p =>
          p.id !== newMatch.player2 &&
          !hasAnyMatchBetween(
            selectedTournament.id,
            selectedDivision.id,
            newMatch.player2,
            p.id,
            ['scheduled','played']
          )
        );


    // Stats solo de quienes tienen partidos (como antes)
    const divisionStats = standings
      .filter(s => s.division_id === selectedDivision.id && s.tournament_id === selectedTournament.id)
      .map(s => ({
        ...s,
        name: profiles.find(p => p.id === s.profile_id)?.name || ''
      }));

    // Mapa rápido por id para mezclar stats con el roster completo
    const statsById = new Map(divisionStats.map(s => [s.profile_id, s]));

    const playedMatchesThisDivision = matches.filter(
      m => m.tournament_id === selectedTournament.id &&
          m.division_id === selectedDivision.id &&
          m.status === 'played'
    );

    // Filas finales: TODOS los inscritos con stats (0 si no tienen partidos)
    const rosterRows = players.map(p => {
      const s = statsById.get(p.id);
      return {
        profile_id: p.id,
        name: p.name,
        points: s?.points ?? 0,
        wins: s?.wins ?? 0,
        losses: s?.losses ?? 0,
        sets_won: s?.sets_won ?? 0,
        sets_lost: s?.sets_lost ?? 0,
        games_won: s?.games_won ?? 0,
        games_lost: s?.games_lost ?? 0,
        set_diff: s?.set_diff ?? 0,
        pints: s?.pints ?? 0,
      };
    }).sort((a, b) => compareByRules(
      a, b,
      selectedDivision.id,
      selectedTournament.id
    ));


    // Usaremos el comparador único: victorias → H2H → ratio sets → ratio games
    const rosterSorted = [...rosterRows].sort((a, b) =>
      compareStandings(a, b, selectedDivision.id, selectedTournament.id, matches)
    );

    const divisionStandings = divisionStats;
    const divLeader = rosterRows[0] ?? null;
    const divTopPintsPlayer = rosterRows.reduce(
      (max, r) => (max == null || r.pints > max.pints ? r : max),
      null as null | typeof rosterRows[number]
    );
    const leader = rosterSorted[0] ?? null;
    const topPintsPlayer = rosterSorted.reduce(
      (max, r) => (max == null || r.pints > max.pints ? r : max),
      null as null | typeof rosterSorted[number]
    );


    // Get all scheduled matches for this division
  const pendingMatches = matches.filter(m =>
    m.division_id === selectedDivision.id &&
    m.tournament_id === selectedTournament.id &&
    m.status === 'pending'
  );

  const scheduledMatches = matches.filter(m =>
    m.division_id === selectedDivision.id &&
    m.tournament_id === selectedTournament.id &&
    m.status === 'scheduled'
  );

  const playedMatches = matches.filter(m =>
    m.division_id === selectedDivision.id &&
    m.tournament_id === selectedTournament.id &&
    m.status === 'played'
  );


    // Player Profile View
    if (selectedPlayer) {
      const player = players.find(p => p.id === selectedPlayer.id);
      const playerStats = (rosterRows.find(r => r.profile_id === selectedPlayer.id) ?? {
        profile_id: selectedPlayer.id,
        name: selectedPlayer.name,
        points: 0,
        wins: 0,
        losses: 0,
        sets_won: 0,
        sets_lost: 0,
        set_diff: 0,
        pints: 0,
      });
      
      const playerMatches = getPlayerMatches(selectedDivision.id, selectedTournament.id, selectedPlayer.id);
      
      // Calculate upcoming matches against all other players
      const divisionPlayers = getDivisionPlayers(selectedDivision.id, selectedTournament.id);
      const allOpponents = divisionPlayers.filter(p => p.id !== selectedPlayer.id);
      
      const upcomingMatches = allOpponents.filter(opponent => {
        return !playerMatches.played.some(match => 
          (match.home_player_id === selectedPlayer.id && match.away_player_id === opponent.id) ||
          (match.home_player_id === opponent.id && match.away_player_id === selectedPlayer.id)
        ) && !playerMatches.scheduled.some(match =>
          (match.home_player_id === selectedPlayer.id && match.away_player_id === opponent.id) ||
          (match.home_player_id === opponent.id && match.away_player_id === selectedPlayer.id)
        );
      });
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
          <header className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <button
                    onClick={() => {
                      setSelectedPlayer(null); 
                    }}
                    className="text-green-600 hover:text-green-800 font-semibold mb-2"
                  >
                    ← Back to {selectedDivision.name} Division
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                  <p className="text-gray-600">Division Details</p>
                </div>

                {currentUser && (
                  <div className="flex items-center justify-center flex-wrap gap-2 md:space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                      <p className="text-sm text-gray-600">
                        Division: {selectedDivision.name}
                      </p>
                    </div>
                    <img
                      src={avatarSrc(currentUser)}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                      alt="Profile"
                      className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                    />
                    <button
                      onClick={openEditProfile}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Editar perfil"
                      title="Editar perfil"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="7" r="4" strokeWidth="2"/>
                        <path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="p-3 sm:p-2 rounded-full hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Cerrar sesión"
                      title="Cerrar sesión"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 16l-4-4m0 0l4-4m-4 4h11"/>
                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h4a2 2 0 002-2v-2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Player Profile */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="text-center mb-6">
                    <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-green-100">
                      <img
                        src={avatarSrc(selectedPlayer)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mt-4">{uiName(selectedPlayer.name)}</h2>
                    <p className="text-gray-600">{selectedDivision.name} Division</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-800 mb-2">Availability</h3>
                      <div className="space-y-2">
                        {days.map(day => (
                          <div key={day} className="flex justify-between">
                            <span className="text-gray-700 font-medium">{day}:</span>
                            <div className="flex flex-wrap justify-end gap-1">
                              {selectedPlayerAvailability
                                .filter(slot => slot.day_of_week === days.indexOf(day))
                                .map(slot => {
                                  let timeSlot = '';
                                  // Usamos .startsWith() para que funcione tanto con '07:00' como con '07:00:00'
                                  if (slot.start_time.startsWith('07:00')) {
                                    timeSlot = 'Morning (07:00-12:00)';
                                  } else if (slot.start_time.startsWith('12:00')) {
                                    timeSlot = 'Afternoon (12:00-18:00)';
                                  } else if (slot.start_time.startsWith('18:00')) { // Hacemos explícito el caso de "Evening"
                                    timeSlot = 'Evening (18:00-22:00)';
                                  }
                                  
                                  if (!timeSlot) return null; // Ignoramos cualquier horario que no reconozcamos

                                  return (
                                    <span key={slot.id} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                      {timeSlot}
                                    </span>
                                  );
                                })}

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-2">Locations</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedPlayerAreas.length > 0 ? (
                          selectedPlayerAreas.map(name => (
                            <span key={name} className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">
                              {abbreviateLocation(name)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No preferred areas yet</span>
                        )}
                      </div>

                      {/* Postcode debajo de Locations */}
                      <div className="mt-3 text-sm text-gray-700">
                        <span className="font-medium">Postcode:</span>{' '}
                        {selectedPlayer?.postal_code ? (
                          <span>{selectedPlayer.postal_code}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-yellow-800 mb-2">Tournaments & Division</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-gray-700">Division:</span>
                          <span className="ml-1 font-medium">{selectedDivision.name}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Tournaments:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              {selectedTournament.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Stats */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Player Statistics</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{playerStats.points}</div>
                      <div className="text-sm text-gray-600">Points</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{playerStats.wins + playerStats.losses}</div>
                      <div className="text-sm text-gray-600">Matches Played</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{playerStats.pints}</div>
                      <div className="text-sm text-gray-600">Pintas</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{playerStats.sets_won}</div>
                      <div className="text-sm text-gray-600">Sets Won</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{playerStats.set_diff}</div>
                      <div className="text-sm text-gray-600">Sets Diff</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SW</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SD</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pintas</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {(() => {
                                const rankIndex = rosterRows.findIndex(r => r.profile_id === selectedPlayer.id);
                                const badgeCls =
                                  rankIndex === 0 ? 'bg-yellow-400 text-yellow-800' :
                                  rankIndex === 1 ? 'bg-gray-300 text-gray-800' :
                                  rankIndex === 2 ? 'bg-orange-300 text-orange-800' :
                                  'bg-gray-100 text-gray-800';
                                return (
                                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${badgeCls}`}>
                                    {rankIndex + 1}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                            {uiName(selectedPlayer.name)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{playerStats.points}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{playerStats.wins + playerStats.losses}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{playerStats.wins}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">0</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{playerStats.losses}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{playerStats.sets_won}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{playerStats.sets_lost}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{playerStats.set_diff}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-lg">🍻</span>
                              <span className="ml-1 text-sm font-medium">{playerStats.pints}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Match History */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Match History</h2>
                  
                  {playerMatches.played.length > 0 ? (
                    <div className="space-y-4">
                      {playerMatches.played.map((match, index) => {
                        const player1 = profiles.find(p => p.id === match.home_player_id);
                        const player2 = profiles.find(p => p.id === match.away_player_id);
                        const opponent = player1?.id === selectedPlayer.id ? player2 : player1;
                        
                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {uiName(opponent?.name)}
                                  {(() => {
                                    const b = homeAwayBadge(match, selectedPlayer.id);
                                    return (
                                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${b.cls}`}>
                                        {b.text}
                                      </span>
                                    );
                                  })()}
                                </h4>
                                <p className="text-sm text-gray-600">{selectedDivision.name} Division</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-blue-600">{formatDateLocal(match.date)}</div>
                                <div className="text-sm text-gray-600">{setsLineFor(match, selectedPlayer.id)}</div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Location: </span>
                              {/* Esta lógica prioriza el detalle y solo muestra TBD si ambos campos están vacíos */}
                              {match.location_details || locations.find(l => l.id === match.location_id)?.name || 'TBD'}
                            </div>
                            {(match.player1_had_pint || match.player2_had_pint) && (
                              <div className="mt-1 text-sm text-purple-600 flex items-center">
                                <span className="text-lg">🍻</span>
                                <span className="ml-1">Tomaron {match.player1_pints} pintas cada uno</span>
                              </div>
                            )}

                            {/* --- BOTÓN AÑADIDO AQUÍ --- */}
                            {(currentUser?.id === match.home_player_id || currentUser?.id === match.away_player_id) && (
                              <div className="mt-2 text-right">
                                <button
                                  onClick={() => {
                                    const currentSets = matchSets
                                      .filter(s => s.match_id === match.id)
                                      .sort((a, b) => a.set_number - b.set_number)
                                      .map(s => ({ score1: String(s.p1_games), score2: String(s.p2_games) }));

                                    setEditedMatchData({
                                      sets: currentSets.length > 0 ? currentSets : [{ score1: '', score2: '' }],
                                      hadPint: match.player1_had_pint,
                                      pintsCount: match.player1_pints || 1,
                                      anecdote: '',
                                    });
                                    setEditingMatch(match);
                                  }}
                                  className="text-sm font-medium text-blue-600 hover:underline focus:outline-none"
                                >
                                  Edit Result
                                </button>
                              </div>
                            )}
                            {(match as any).anecdote && (
                              <details className="mt-2 text-left">
                                <summary className="text-blue-600 hover:underline cursor-pointer select-none">
                                  Ver anécdota
                                </summary>
                                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                                  {(match as any).anecdote}
                                </p>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No match history available
                    </div>
                  )}
                </div>

                {playerMatches.scheduled.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Scheduled Matches</h2>
                    <div className="space-y-4">
                      {playerMatches.scheduled.map((match, idx) => {
                        const isHome = match.home_player_id === selectedPlayer.id;
                        const opponent = isHome
                          ? profiles.find(p => p.id === match.away_player_id)
                          : profiles.find(p => p.id === match.home_player_id);
                        const b = homeAwayBadge(match, selectedPlayer.id);
                        return (
                          <div key={idx} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {opponent?.name}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${b.cls}`}>
                                    {b.text}
                                  </span>
                                </h4>
                                <p className="text-sm text-gray-600">{selectedDivision.name} Division</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-blue-600">{formatDateLocal(match.date)}</div>
                                <div className="text-sm text-gray-600">{match.time && match.time.slice(0,5)}</div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Location:</span>{' '}
                              {match.location_details || locations.find(l => l.id === match.location_id)?.name || 'TBD'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


                {/* Upcoming Matches */}
                {upcomingMatches.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming Matches</h2>
                    <div className="space-y-4">
                      {upcomingMatches.map((opponent, index) => {
                        // 1) Calculamos Home/Visita de forma estable ANTES de agendar
                        const homeId = computeHomeForPair(selectedDivision.id, selectedTournament.id, selectedPlayer.id, opponent.id);
                        const isHome = homeId === selectedPlayer.id;

                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {opponent.name}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isHome ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {isHome ? 'Local' : 'Visita'}
                                  </span>
                                </h4>
                                <p className="text-sm text-gray-600">{selectedDivision.name} Division</p>
                              </div>
                              {(() => {
                                if (hasActiveMatchWith(
                                  selectedPlayer.id,
                                  opponent.id,
                                  selectedTournament.id,
                                  selectedDivision.id
                                )) {
                                  return (
                                    <button
                                      className="bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed"
                                      disabled
                                      title="Ya existe un partido agendado entre ustedes"
                                    >
                                      Ya está agendado
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
                                    onClick={() => {
                                      const awayId = (homeId === selectedPlayer.id) ? opponent.id : selectedPlayer.id;
                                      setNewMatch(prev => ({
                                        ...prev,
                                        player1: homeId,
                                        player2: awayId,
                                        location: '',
                                        location_details: '',
                                        date: '',
                                        time: '',
                                      }));
                                      setSelectedPlayer(null);
                                    }}
                                  >
                                    Agendar Partido
                                  </button>
                                );
                              })()}

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                
                {/* Head-to-Head Matches */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Head-to-Head Matches</h2>
                  
                  {divisionPlayers.length > 1 ? (
                    <div className="space-y-6">
                      {divisionPlayers.filter(p => p.id !== selectedPlayer.id).map(opponent => {
                        const h2hMatches = playerMatches.played.filter(match => 
                          (match.home_player_id === selectedPlayer.id && match.away_player_id === opponent.id) ||
                          (match.home_player_id === opponent.id && match.away_player_id === selectedPlayer.id)
                        );
                        
                        if (h2hMatches.length === 0) return null;
                        
                        // Calculate head-to-head stats
                        let wins = 0;
                        let losses = 0;
                        let totalSetsWon = 0;
                        let totalSetsLost = 0;
                        
                        h2hMatches.forEach(match => {
                          if (match.home_player_id === selectedPlayer.id) {
                            totalSetsWon += match.player1_sets_won;
                            totalSetsLost += match.player2_sets_won;
                            if (match.player1_sets_won > match.player2_sets_won) wins++;
                            else losses++;
                          } else {
                            totalSetsWon += match.player2_sets_won;
                            totalSetsLost += match.player1_sets_won;
                            if (match.player2_sets_won > match.player1_sets_won) wins++;
                            else losses++;
                          }
                        });
                        
                        return (
                          <div key={opponent.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="font-semibold text-gray-800 text-lg">{uiName(opponent.name)}</h3>
                              <div className="bg-gray-50 px-3 py-1 rounded-lg">
                                <span className="text-green-600 font-medium">{wins}W</span> - 
                                <span className="text-red-600 font-medium">{losses}L</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3 mb-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Sets:</span>
                                <span className="font-medium">{totalSetsWon}-{totalSetsLost}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              {h2hMatches.map((match, index) => {
                                const player1 = profiles.find(p => p.id === match.home_player_id);
                                const player2 = profiles.find(p => p.id === match.away_player_id);
                                
                                return (
                                  <div key={index} className="border-t pt-2">
                                    <div className="flex justify-between">
                                      <div>
                                        <p className="text-sm font-medium">{uiName(player1?.name)} vs {uiName(player2?.name)}</p>
                                        <p className="text-xs text-gray-500">{formatDate(match.date)} | {locations.find(l => l.id === match.location_id)?.name || ''}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-medium">
                                          {setsLineFor(match)}
                                        </p>
                                        {(match.player1_had_pint || match.player2_had_pint) && (
                                          <p className="text-xs text-purple-600 flex items-center justify-end">
                                            <span className="text-lg">🍻</span>
                                            <span className="ml-1">{match.player1_pints}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No head-to-head matches available
                    </div>
                  )}
                </div>
                {/* Partidos agendados (todos) */}
                {(() => {
                  if (!selectedPlayer || !selectedTournament || !selectedDivision) return null;

                  // Todos los partidos agendados del jugador (scheduled o pending), sin importar si son pasados o futuros
                  const myScheduled = matches
                    .filter(m =>
                      m.tournament_id === selectedTournament.id &&
                      m.division_id === selectedDivision.id &&
                      (m.status === 'scheduled' || m.status === 'pending') &&
                      (m.home_player_id === selectedPlayer.id || m.away_player_id === selectedPlayer.id || m.created_by === selectedPlayer.id)
                    )
                    .sort((a,b) =>
                      (a.date || '').localeCompare(b.date || '') ||
                      (a.time || '').localeCompare(b.time || '')
                    );

                  if (myScheduled.length === 0) return null;

                  const nameById = (id?: string | null) =>
                    (profiles.find(p => p.id === id)?.name || '').replace(/\b\w/g, c => c.toUpperCase());

                  const divName = (id?: string | null) => divisions.find(d => d.id === id)?.name || '';

                  return (
                    <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
                      <h2 className="text-2xl font-bold text-gray-800 mb-6">Partidos agendados</h2>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jugadores</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lugar</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase ">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {myScheduled.map(m => {
                              const loc =
                                [locations.find(l => l.id === m.location_id)?.name, m.location_details]
                                  .filter(Boolean).join(' - ') || 'Por definir';

                              return (
                                <tr key={m.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    {formatDate(m.date)} {m.time ? `· ${m.time.slice(0,5)}` : ''}
                                  </td>
                                  <td className="px-4 py-2">
                                    {uiName(nameById(m.home_player_id))} vs {uiName(nameById(m.away_player_id)) || '(busca rival)'}
                                  </td>
                                  <td className="px-4 py-2">{loc}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex gap-3">
                                      <button
                                        onClick={() => openEditSchedule(m)}   // reutiliza tu modal existente
                                        className="text-blue-600 hover:underline"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        className="text-green-600 hover:underline"
                                        onClick={() => {
                                          const currentSets = matchSets
                                            .filter(s => s.match_id === m.id)
                                            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
                                            .map(s => ({
                                              score1: String(s.p1_games ?? ''),
                                              score2: String(s.p2_games ?? ''),
                                            }));

                                          setEditedMatchData({
                                            sets: currentSets.length > 0 ? currentSets : [{ score1: '', score2: '' }],
                                            hadPint: false,
                                            pintsCount: 1,
                                            anecdote: '',
                                          });
                                          setEditingMatch(m);
                                        }}
                                      >
                                        Agregar resultados
                                      </button>
                                      <button
                                        onClick={() => handleDeleteScheduledMatch(m)} // reutiliza tu delete/cancel existente
                                        className="text-red-600 hover:underline"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500 mt-4">
                        *Aquí ves todos tus partidos agendados (pendientes o programados). Puedes editarlos o eliminarlos.
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          {renderNotifs()}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <button
                  onClick={() => {
                    setSelectedDivision(null);
                    setSelectedPlayer(null); 
                  }}
                  className="text-green-600 hover:text-green-800 font-semibold mb-2"
                >
                  ← Back to {selectedTournament.name}
                </button>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">Division Details</p>
              </div>

              {currentUser && (
                <div className="flex items-center justify-center flex-wrap gap-2 md:space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="text-sm text-gray-600">
                      Division: {selectedDivision.name} 
                    </p>
                  </div>
                  
                  <img
                    src={avatarSrc(currentUser)}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                  />
                  <button
                    onClick={openEditProfile}
                    className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    aria-label="Editar perfil"
                    title="Editar perfil"
                  >
                    <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="7" r="4" strokeWidth="2"/>
                      <path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-3 sm:p-2 rounded-full hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    aria-label="Cerrar sesión"
                    title="Cerrar sesión"
                  >
                    <svg className="w-7 h-7 sm:w-6 sm:h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 16l-4-4m0 0l4-4m-4 4h11"/>
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M13 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h4a2 2 0 002-2v-2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            {/* LOGO DE DIVISIÓN: centrado y responsive */}
            <img
              src={divisionLogoSrc(selectedDivision.name)}
              alt={`Logo ${selectedDivision.name}`}
              className="mx-auto mt-4 w-auto h-16 sm:h-20 md:h-24 lg:h-28 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/ppc-logo.png'; }}
            />
            <h2 className="text-3xl font-bold text-white mb-2">División {selectedDivision.name}</h2>
            <p className="text-white text-lg opacity-90">
              {getDivisionHighlights(selectedDivision.name, selectedTournament.name)}
            </p>
          </div>
          {/* Panel fijo “Buscando rival” */}
          {selectedDivision && selectedTournament && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="font-semibold mb-2">Partidos buscando rival</div>
              <div className="space-y-2">
                {matches
                  .filter(m =>
                    m.tournament_id === selectedTournament.id &&
                    m.division_id === selectedDivision.id &&
                    m.status === 'pending'
                  )
                  .map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>
                        {tituloFechaEs(m.date)} · {m.time} · {profiles.find(p => p.id === m.created_by)?.name || 'Alguien'} · {m.location_details || locations.find(l => l.id === m.location_id)?.name || ''}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => joinPendingMatch(m)} className="px-2 py-1 bg-green-600 text-white rounded">
                          Unirme
                        </button>
                        <button onClick={() => sharePendingMatch(m)} className="px-2 py-1 bg-blue-600 text-white rounded">
                          Compartir
                        </button>
                      </div>
                    </div>
                  ))}

                {matches.filter(m =>
                  m.tournament_id === selectedTournament.id &&
                  m.division_id === selectedDivision.id &&
                  m.status === 'pending'
                ).length === 0 && (
                  <div className="text-gray-600 text-sm">No quedan pendientes.</div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Division Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Resumen de la División</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Players:</span>
                    <span className="font-bold text-blue-600">{players.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Jugados:</span>
                    <span className="font-bold text-green-600">{playedMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Pendientes:</span>
                    <span className="font-bold text-yellow-600">{pendingMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Confirmados:</span>
                    <span className="font-bold text-green-600">{scheduledMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Pintas:</span>
                    <span className="font-bold text-purple-600">
                      {matches
                        .filter(m => m.division_id === selectedDivision.id)
                        .reduce((sum, match) => sum + match.player1_pints + match.player2_pints, 0)}
                    </span>
                  </div>
                </div>

                {divLeader && (
                  <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm text-yellow-800">Líder Actual</div>
                    <div className="font-semibold text-yellow-900">{divLeader.name}</div>
                    <div className="text-sm text-yellow-700">{divLeader.points} puntos</div>
                  </div>
                )}

                {divTopPintsPlayer && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-800">Jugador con Más Pintas</div>
                    <div className="font-semibold text-blue-900">{uiName(divTopPintsPlayer.name)}</div>
                    <div className="text-sm text-blue-700">{divTopPintsPlayer.pints} pintas</div>
                  </div>
                )}
              </div>
            </div>

            {/* Player Standings */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-800">Player Standings</h2>
                  <p className="text-gray-600">Click on a player's name to view their match history</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SW</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SD</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pintas</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rosterSorted.length > 0 ? (
                        rosterSorted.map((stats, index) => {
                          const player = profiles.find(p => p.id === stats.profile_id);
                          if (!player) return null;
                          return (
                            <tr 
                              key={stats.profile_id} 
                              className="hover:bg-gray-50 cursor-pointer" 
                              onClick={() => setSelectedPlayer(player)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-400 text-yellow-800' :
                                    index === 1 ? 'bg-gray-300 text-gray-800' :
                                    index === 2 ? 'bg-orange-300 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img 
                                      className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                                      src={player.avatar_url || '/default-avatar.png'} 
                                      alt="" 
                                    />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900 hover:text-green-700 cursor-pointer">
                                      {uiName(player.name)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{stats.points}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.wins + stats.losses}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{stats.wins}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">0</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{stats.losses}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sets_won}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sets_lost}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{stats.set_diff}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className="text-lg">🍻</span>
                                  <span className="ml-1 text-sm font-medium">{stats.pints}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                            No players in this division yet
                          </td>
                        </tr>
                      )}

                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Create Match Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Add Match Result */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Agregar Resultado del Partido</h3>
              <form onSubmit={handleAddMatch} className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 1</label>
                    <select
                      value={newMatch.player1} // Ahora guardará el ID del jugador
                      onChange={(e) => setNewMatch({...newMatch, player1: e.target.value, player2: ''})} // Reseteamos player2 al cambiar player1
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Player</option>
                      {players.map(player => (
                        <option key={player.id} value={player.id}>{uiName(player.name)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 2</label>
                    <select
                      value={newMatch.player2} // Ahora guardará el ID del jugador
                      onChange={(e) => setNewMatch({...newMatch, player2: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                      disabled={!newMatch.player1} // Se deshabilita si no se ha elegido Jugador 1
                    >
                      <option value="">Select Player</option>
                      {/* El filtro ahora compara por ID, que es más seguro y correcto */}
                      {players.filter(p => p.id !== newMatch.player1).map(player => (
                        <option key={player.id} value={player.id}>{uiName(player.name)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lugar (Parte de Londres)</label>
                  <select
                    value={newMatch.location}
                    onChange={(e) => setNewMatch({ ...newMatch, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Selecciona una zona</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Club/Lugar</label>
                  <input
                    type="text"
                    placeholder="E.g., Parliament Hill, Court 3"
                    value={newMatch.location_details || ''}
                    onChange={(e) => setNewMatch({ ...newMatch, location_details: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    required
                  />
                </div>               
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-800">Sets del Partido</h4>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={addSet}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Agregar Set
                      </button>
                    </div>
                  </div>
                  
                  {newMatch.sets.map((set, index) => (
                    <div key={index} className="flex items-center space-x-4 mb-3 last:mb-0">
                      <span className="text-sm font-medium text-gray-700 w-8">Set {index + 1}</span>
                      <input
                        type="number"
                        value={set.score1}
                        onChange={(e) => updateSetScore(index, 'score1', e.target.value)}
                        placeholder="0"
                        className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                        min="0"
                        required={index === 0}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        value={set.score2}
                        onChange={(e) => updateSetScore(index, 'score2', e.target.value)}
                        placeholder="0"
                        className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                        min="0"
                        required={index === 0}
                      />
                      {newMatch.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSet(index)}
                          className="text-red-600 hover:text-red-800 ml-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hadPint"
                      checked={newMatch.hadPint}
                      onChange={(e) => setNewMatch({...newMatch, hadPint: e.target.checked})}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label htmlFor="hadPint" className="ml-2 text-sm text-gray-700">
                      Se tomaron una Pinta post?
                    </label>
                  </div>
                  
                  {newMatch.hadPint && (
                    <div className="ml-6 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Cuántas se tomaron cada uno (en promedio)?
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={newMatch.pintsCount}
                          onChange={(e) => setNewMatch({...newMatch, pintsCount: parseInt(e.target.value)})}
                          className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                        />
                        <span className="ml-2 text-gray-600">pintas</span>
                      </div>
                      <p className="text-xs text-gray-500">Ingresa el número promedio de pintas que cada jugador tomó</p>
                    </div>
                  )}
                </div>
                
                {/* Anécdota del partido */}
                <label className="block text-sm font-medium text-gray-700 mt-4">
                  Anécdota (opcional, máx. 50 palabras)
                </label>
                <textarea
                  value={editedMatchData.anecdote ?? ''}
                  onChange={(e) => {
                    let text = e.target.value ?? '';

                    // Separar por espacios, contar palabras, pero sin eliminar los espacios del texto
                    const words = text.trim().split(/\s+/);
                    if (words.length > 50) {
                      // Cortar al número 50, pero manteniendo el resto del texto con espacios normales
                      text = words.slice(0, 50).join(' ');
                    }

                    setEditedMatchData(prev => ({ ...prev, anecdote: text }));
                  }}
                  rows={3}
                  placeholder="Ej: se definió en tiebreak del 2° set..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {((editedMatchData.anecdote || '').trim().split(/\s+/).filter(Boolean).length)} / 50 palabras
                </p>
                
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                >
                  Agregar Resultado del Partido
                </button>
              </form>
            </div>

            {/* Schedule Match */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Programar un Partido</h3>
              <form onSubmit={handleScheduleMatch} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 1</label>
                  {/* Jugador 1 */}
                  <select
                    value={newMatch.player1}
                    onChange={(e) => setNewMatch({ ...newMatch, player1: e.target.value, player2: '' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar jugador</option>
                    {eligibleP1Options.map((player) => (
                      <option key={player.id} value={player.id}>{uiName(player.name)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 2 (Opcional)</label>
                  {/* Jugador 2 (Opcional) */}
                  <select
                    value={newMatch.player2}
                    onChange={(e) => setNewMatch({ ...newMatch, player2: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    disabled={!newMatch.player1}
                  >
                    <option value="">Jugador Pendiente</option>
                    {eligibleP2Options.map((player) => (
                      <option key={player.id} value={player.id}>{uiName(player.name)}</option>
                    ))}
                  </select>
                </div>
                {/* Lugar (opcional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lugar</label>
                  <select
                    value={newMatch.location}
                    onChange={(e) => setNewMatch({ ...newMatch, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">(Opcional) Zona</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Club / Cancha (Opcional)</label>
                  <input
                    type="text"
                    placeholder="E.g., Parliament Hill, Court 3"
                    value={newMatch.location_details || ''}
                    onChange={(e) => setNewMatch({ ...newMatch, location_details: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>
                {/* Fecha (obligatoria) */}   
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
                    <input
                      type="date"
                      lang="es-CL"
                      value={newMatch.date}
                      onChange={(e) => setNewMatch({...newMatch, date: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    {/* Horario (opcional) */}
                    <label className="block text-sm font-medium text-gray-700 mb-2">Horario (Opcional)</label>
                    <select
                      value={newMatch.time}
                      onChange={(e) => setNewMatch({...newMatch, time: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    >
                      <option value="">Elegir</option>
                      {timeOptions.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                >
                  Programar
                </button>
              </form>
            </div>
          </div>

          {/* Pending Matches */}
          {pendingMatches.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Partidos Pendientes</h3>
              <p className="text-gray-600 mb-4">These matches are waiting for a second player to join. Click "Join Match" to participate.</p>
              
              <div className="space-y-4">
                {pendingMatches.map(match => {
                  const player1 = profiles.find(p => p.id === match.home_player_id);
                  
                  return (
                    <div key={match.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-800">{uiName(player1?.name)} is looking for a match</h4>
                          <p className="text-sm text-gray-600">{selectedDivision.name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-blue-600">
                            {formatDateLocal(match.date)}
                          </div>
                          <div className="text-sm text-gray-600">{match.time}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Location: </span> 
                        {
                          [
                            locations.find(l => l.id === match.location_id)?.name,
                            match.location_details
                          ].filter(Boolean).join(' - ') || 'TBD'
                        }
                      </div>
                      {currentUser?.id !== match.home_player_id && (
                        <button 
                          type="button"
                          className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200 text-sm"
                          onClick={async () => {
                            if (!currentUser?.id) {
                              alert('Debes iniciar sesión.');
                              return;
                            }
                            try {
                              setLoading(true);
                              const { data, error } = await supabase
                                .from('matches')
                                .update({
                                  away_player_id: currentUser.id,
                                  status: 'scheduled'
                                })
                                .eq('id', match.id)
                                .select()
                                .single();
                              if (error) throw error;

                              // refresca desde DB para que todos lo vean
                              await loadInitialData(session?.user.id);

                              alert(`You have joined ${uiName(player1?.name)}'s match! The match is now confirmed.`);
                            } catch (e:any) {
                              console.error('join match error', e);
                              alert(`Error joining match: ${e.message}`);
                            } finally {
                              setLoading(false);
                            }
                          }}

                        >
                          Unirse al Partido
                        </button>
                      )}
                      {/* Cancelar Partido */}
                      {currentUser?.id === match.created_by && (
                        <button 
                          type="button"
                          className="mt-2 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition duration-200 text-sm"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to cancel this pending match?')) {
                              try {
                                setLoading(true);
                                const { error } = await supabase
                                  .from('matches')
                                  .delete()
                                  .eq('id', match.id);
                                
                                if (error) throw error;
                                
                                // Recargamos los datos para que el partido eliminado desaparezca de la lista
                                await fetchData(session?.user.id);
                                alert('Pending match cancelled.');

                              } catch (e:any) {
                                alert(`Error cancelling match: ${e.message}`);
                              } finally {
                                setLoading(false);
                              }
                            }
                          }}
                        >
                          Cancel Match
                        </button>
                      )}                      
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Upcoming Matches Section - Now at the bottom of the page */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Todos los Partidos Programados</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={copyTableToClipboard}
                  className="grid place-items-center w-11 h-11 rounded-xl bg-gray-600 text-white hover:bg-green-700 active:scale-[.98] transition"
                  aria-label="Copiar"
                  title="Copiar"
                >
                  <img src="/copy.svg" alt="" className="w-6 h-6" />
                </button>
                {/* WhatsApp (icono solo) */}
                <button
                  type="button"
                  onClick={shareAllScheduledMatches}
                  className="grid place-items-center w-11 h-11 rounded-xl bg-green-600 text-white hover:bg-green-700 active:scale-[.98] transition"
                  aria-label="Compartir por WhatsApp"
                  title="Compartir por WhatsApp"
                >
                  {/* Logo WhatsApp */}
                  <img src="/whatsapp.svg" alt="" className="w-6 h-6" /> 
                </button>
              </div>
            </div>
            
            {/* Division-only table (same layout as “Todos los Partidos”) */}
            {scheduledMatches.filter(m => isTodayOrFuture(m.date)).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Players</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Division</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th> {/* <-- NUEVA */}
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {scheduledMatches
                      .filter(m => isTodayOrFuture(m.date))
                      .sort((a,b) => parseYMDLocal(a.date).getTime() - parseYMDLocal(b.date).getTime())
                      .map(m => {
                        const p1 = profiles.find(p => p.id === m.home_player_id);
                        const p2 = profiles.find(p => p.id === m.away_player_id);
                        const locationName = [
                          locations.find(l => l.id === m.location_id)?.name,
                          m.location_details
                        ].filter(Boolean).join(' - ') || 'TBD';
                        return (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(m.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{uiName(p1?.name)} vs {uiName(p2?.name)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{m.time && m.time.slice(0,5)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{selectedDivision.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{locationName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {canEditSchedule(m) && (
                                <div className="space-x-2">
                                  <button
                                    onClick={() => openEditSchedule(m)}
                                    className="text-blue-600 hover:text-blue-800 underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteScheduledMatch(m)}
                                    className="text-red-600 hover:text-red-800 underline"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}

                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No upcoming matches scheduled for this division</div>
            )}

          </div>
        </div>
        {renderNotifs()}
      </div>
    );
  }

  return null;
};
export default App;

