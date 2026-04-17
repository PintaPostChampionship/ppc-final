
import React, { useState, useEffect, useRef } from "react";
import { supabase } from './lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import FindTennisCourt from './components/FindTennisCourt';
import BuscarClases from './components/BuscarClases';

// Profile ID autorizado para ver "Buscar clases" — reemplaza con tu UUID de Supabase
const BUSCAR_CLASES_ALLOWED_ID = "fb045715-86c6-48fc-88dc-c784fa5ed2bc";


// 🔹 CARRUSEL DE FOTOS ANTERIORES (home)
const PHOTOS_BASE_PATH = '/fotos-anteriores';

const highlightPhotos = [
  // PPC 2 – Foto 1 a 3
  {
    src: `${PHOTOS_BASE_PATH}/PPC2-Foto1.jpeg`,
    alt: 'Final PPC versión 2',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC2-Foto2.jpeg`,
    alt: 'Final PPC versión 2',
    caption: '',
  },

  // PPC 3 – Foto 1 a 3
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto1.jpeg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto2.jpeg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto3.jpg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC3-Foto4.jpeg`,
    alt: 'Final PPC versión 3',
    caption: '',
  },

  // PPC 4 – Foto 1 a 3
  {
    src: `${PHOTOS_BASE_PATH}/PPC4-Foto1.jpeg`,
    alt: 'Final PPC versión 4',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC4-Foto2.jpeg`,
    alt: 'Final PPC versión 4',
    caption: '',
  },
  {
    src: `${PHOTOS_BASE_PATH}/PPC4-Foto3.jpeg`,
    alt: 'Final PPC versión 4',
    caption: '',
  },

];



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

function capitaliseFirst(value?: string | null) {
  if (!value) return '—';
  const trimmed = value.trim();
  if (!trimmed) return '—';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function getAgeFromBirthDate(birthDate?: string | null): number | null {
  if (!birthDate) return null;

  const dob = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) age -= 1;

  if (age < 0 || age > 120) return null;
  return age;
}

function formatISOToDDMMYYYY(iso?: string | null): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseDDMMYYYYToISO(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  if (year < 1900 || year > new Date().getFullYear()) return null;
  if (month < 1 || month > 12) return null;

  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!valid) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getLeagueRegistrationsForPlayer(
  profileId: string,
  registrations: Registration[],
  tournaments: Tournament[]
) {
  return registrations
    .filter(r => r.profile_id === profileId)
    .map(r => {
      const tournament = tournaments.find(t => t.id === r.tournament_id);
      return tournament ? { registration: r, tournament } : null;
    })
    .filter((x): x is { registration: Registration; tournament: Tournament } => Boolean(x))
    .filter(x => x.tournament.format === 'league')
    .filter(x => !isCalibrationTournamentByName(x.tournament.name));
}

function getLastLeagueEntryForPlayer(
  profileId: string,
  registrations: Registration[],
  tournaments: Tournament[]
) {
  const entries = getLeagueRegistrationsForPlayer(profileId, registrations, tournaments);

  if (entries.length === 0) return null;

  return [...entries].sort((a, b) => {
    const byEnd = (b.tournament.end_date || '').localeCompare(a.tournament.end_date || '');
    if (byEnd !== 0) return byEnd;

    const byStart = (b.tournament.start_date || '').localeCompare(a.tournament.start_date || '');
    if (byStart !== 0) return byStart;

    return (b.tournament.sort_order ?? 0) - (a.tournament.sort_order ?? 0);
  })[0];
}

function getFirstLeagueEntryForPlayer(
  profileId: string,
  registrations: Registration[],
  tournaments: Tournament[]
) {
  const entries = getLeagueRegistrationsForPlayer(profileId, registrations, tournaments);

  if (entries.length === 0) return null;

  return [...entries].sort((a, b) => {
    const byStart = (a.tournament.start_date || '').localeCompare(b.tournament.start_date || '');
    if (byStart !== 0) return byStart;

    const byEnd = (a.tournament.end_date || '').localeCompare(b.tournament.end_date || '');
    if (byEnd !== 0) return byEnd;

    return (a.tournament.sort_order ?? 0) - (b.tournament.sort_order ?? 0);
  })[0];
}

function getDivisionNameByIdLocal(divisionId: string, divisions: Division[]) {
  return divisions.find(d => d.id === divisionId)?.name || '—';
}

function getPrettyLeagueResultForPlayer(
  profileId: string,
  tournamentId: string,
  divisionId: string,
  matches: Match[],
  standings: Standings[],
  divisions: Division[]
) {
  const divisionName = getDivisionNameByIdLocal(divisionId, divisions);

  const finalsMainMatches = matches.filter(m =>
    m.tournament_id === tournamentId &&
    m.division_id === divisionId &&
    m.phase === 'finals_main' &&
    m.status === 'played' &&
    (
      m.home_player_id === profileId ||
      m.away_player_id === profileId
    )
  );

  const finalMatch = finalsMainMatches.find(m => m.knockout_round === 'F');
  if (finalMatch) {
    const winnerId =
      finalMatch.player1_sets_won > finalMatch.player2_sets_won
        ? finalMatch.home_player_id
        : finalMatch.player2_sets_won > finalMatch.player1_sets_won
        ? finalMatch.away_player_id
        : null;

    if (winnerId === profileId) {
      return `Ganador División ${divisionName}`;
    }
    return `Finalista División ${divisionName}`;
  }

  const semiMatch = finalsMainMatches.find(m => m.knockout_round === 'SF');
  if (semiMatch) {
    return `Semifinalista División ${divisionName}`;
  }

  const divisionStandings = standings
    .filter(s => s.tournament_id === tournamentId && s.division_id === divisionId)
    .slice()
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.set_diff !== a.set_diff) return b.set_diff - a.set_diff;

      const aGamesDiff = (a.games_won || 0) - (a.games_lost || 0);
      const bGamesDiff = (b.games_won || 0) - (b.games_lost || 0);
      if (bGamesDiff !== aGamesDiff) return bGamesDiff - aGamesDiff;

      return (a.name || '').localeCompare(b.name || '');
    });

  const pos = divisionStandings.findIndex(s => s.profile_id === profileId);
  if (pos >= 0) {
    return `${pos + 1}° lugar en ${divisionName}`;
  }

  return `Participó en ${divisionName}`;
}

function getPlayerStatsSummaryAll(
  profileId: string,
  registrations: Registration[],
  tournaments: Tournament[],
  standings: Standings[],
  matches: Match[]
) {
  const leagueRegs = registrations.filter(r => {
    if (r.profile_id !== profileId) return false;
    const t = tournaments.find(tt => tt.id === r.tournament_id);
    return t?.format === 'league' && !isCalibrationTournamentByName(t?.name);
  });

  const uniqueTournaments = new Set(leagueRegs.map(r => r.tournament_id));
  const uniqueDivisions = new Set(leagueRegs.map(r => r.division_id));

  const playedMatches = matches.filter(m =>
    isOfficialMatchByTournamentId(m, tournaments) &&
    m.status === 'played' &&
    (m.home_player_id === profileId || m.away_player_id === profileId)
  );

  const scheduledMatches = matches.filter(m =>
    isOfficialMatchByTournamentId(m, tournaments) &&
    (m.status === 'scheduled' || m.status === 'pending') &&
    (m.home_player_id === profileId || m.away_player_id === profileId)
  );

  let wins = 0;
  let losses = 0;
  let setsWon = 0;
  let setsLost = 0;
  let gamesWon = 0;
  let gamesLost = 0;

  playedMatches.forEach(m => {
    const isHome = m.home_player_id === profileId;

    const mySetsWon = isHome ? (m.player1_sets_won || 0) : (m.player2_sets_won || 0);
    const mySetsLost = isHome ? (m.player2_sets_won || 0) : (m.player1_sets_won || 0);
    const myGamesWon = isHome ? (m.player1_games_won || 0) : (m.player2_games_won || 0);
    const myGamesLost = isHome ? (m.player2_games_won || 0) : (m.player1_games_won || 0);

    setsWon += mySetsWon;
    setsLost += mySetsLost;
    gamesWon += myGamesWon;
    gamesLost += myGamesLost;

    if (mySetsWon > mySetsLost) wins += 1;
    else if (mySetsLost > mySetsWon) losses += 1;
  });

  // --- Pinta Post: solo desde Edición 4 en adelante ---
  const pintEligibleTournamentIds = new Set(
    tournaments
      .filter(t => t.format === 'league' && (t.season === 'PPC 4' || (t.name || '').includes('Edición 4')))
      .map(t => t.id)
  );

  const pintMatchesPlayed = matches.filter(m =>
    m.status === 'played' &&
    pintEligibleTournamentIds.has(m.tournament_id) &&
    (m.home_player_id === profileId || m.away_player_id === profileId)
  );

  let totalPints = 0;
  let pintMatches = 0;

  pintMatchesPlayed.forEach(m => {
    const isHome = m.home_player_id === profileId;
    const myPints = isHome ? (m.player1_pints || 0) : (m.player2_pints || 0);

    totalPints += myPints;
    if (myPints > 0) pintMatches += 1;
  });

  const latestStanding = standings
    .filter(s => s.profile_id === profileId)
    .slice()
    .sort((a, b) => {
      const ta = tournaments.find(t => t.id === a.tournament_id);
      const tb = tournaments.find(t => t.id === b.tournament_id);
      const da = ta?.end_date || '';
      const db = tb?.end_date || '';
      return db.localeCompare(da);
    })[0] || null;

  return {
    tournamentsPlayed: uniqueTournaments.size,
    divisionsPlayed: uniqueDivisions.size,
    matchesPlayed: playedMatches.length,
    scheduledMatches: scheduledMatches.length,
    wins,
    losses,
    winRate: playedMatches.length > 0 ? (wins / playedMatches.length) * 100 : 0,
    setsWon,
    setsLost,
    setDiff: setsWon - setsLost,
    gamesWon,
    gamesLost,
    gameDiff: gamesWon - gamesLost,
    totalPints,
    pintMatches,
    pintMatchesPlayed: pintMatchesPlayed.length,
    avgPintsPerMatch: pintMatchesPlayed.length > 0 ? totalPints / pintMatchesPlayed.length : 0,
    pintMatchRate: pintMatchesPlayed.length > 0 ? (pintMatches / pintMatchesPlayed.length) * 100 : 0,
    latestPoints: latestStanding?.points ?? 0,
  };
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

function isCalibrationTournamentByName(name?: string | null) {
  return /^Calibraciones/i.test((name || '').trim());
}

function isOfficialMatchByTournamentId(
  match: Match,
  tournaments: Tournament[]
) {
  const tournamentName = tournaments.find(t => t.id === match.tournament_id)?.name || '';
  return !isCalibrationTournamentByName(tournamentName);
}

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

interface PlayerCard {
  profile_id: string;
  nickname?: string | null;
  age?: number | null; // temporal (fallback)
  birth_date?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  nationality?: string | null;
  birth_place?: string | null;
  dominant_hand?: string | null;
  backhand_style?: string | null;
  ppc_objective?: string | null;
  favourite_shot?: string | null;
  favourite_surface?: string | null;
  favourite_player?: string | null;
  racket_brand?: string | null;
  racket_model?: string | null;
  tennis_start_year?: number | null;
  created_at?: string;
  updated_at?: string;
}

interface HistoricPlayer {
  id: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
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
  format?: 'league' | 'knockout';
  sort_order?: number;
}

interface Division {
  id: string;
  tournament_id: string;
  name: string;
  color?: string;
  direct_promotion_slots?: number;
  promotion_playoff_slots?: number;
  relegation_playoff_slots?: number;
  direct_relegation_slots?: number;
}

interface Registration {
  id: string;
  tournament_id: string;
  division_id: string;
  profile_id: string | null;
  historic_player_id?: string | null;
  seed?: number;
  created_at: string;
  status?: 'active' | 'retired' | null;
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
  home_historic_player_id?: string | null;
  away_historic_player_id?: string | null;
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
  knockout_round?: string | null;
  bracket_position?: number | null;
  phase?: string | null;
  group_code?: string | null;  
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

type BookingAdmin = {
  id: string;
  profile_id: string;
  created_at: string | null;
};

type BookingAccount = {
  id: string;
  label?: string | null;
  env_username_key: string;
  env_password_key: string;
  owner_profile_id: string;
  is_active?: boolean | null;
  created_at: string | null;
};

type CourtBookingRequest = {
  id: string;
  profile_id: string;
  better_account_id: string;
  venue_slug: string;
  activity_slug: string;
  target_date: string;              // 'YYYY-MM-DD'
  target_start_time: string;        // 'HH:MM:SS'
  target_end_time: string;          // 'HH:MM:SS'
  search_start_date: string | null;
  search_window_start_time: string | null;
  search_window_end_time: string | null;
  preferred_court_name_1: string | null;
  preferred_court_name_2: string | null;
  preferred_court_name_3: string | null;
  status: string;
  booked_court_name: string | null;
  booked_slot_start: string | null;
  booked_slot_end: string | null;
  last_run_at: string | null;
  attempt_count: number | null;
  last_error: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};


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

function hasExplicitAvatar(p?: Profile | null) {
  if (!p) return false;
  return !!(p.avatar_url || '').trim();
}

function PlayerShowcaseCard({
  player,
  avatarUrl,
  hasAvatar,
  playerCard,
  firstLeagueTournamentName,
  lastLeagueResult,
  currentDivisionName,
}: {
  player: Profile;
  avatarUrl: string;
  hasAvatar: boolean;
  playerCard: Partial<PlayerCard>;
  firstLeagueTournamentName: string;
  lastLeagueResult: string;
  currentDivisionName: string;
}) {
  const fullRacket = [playerCard.racket_brand, playerCard.racket_model]
    .filter(Boolean).join(' ').trim();

  const computedAge =
    getAgeFromBirthDate(playerCard.birth_date) ??
    playerCard.age ??
    null;

  const profileItems = [
    { label: 'Edad', value: computedAge != null ? `${computedAge} años` : '—', icon: '📅' },
    { label: 'Nacionalidad', value: capitaliseFirst(playerCard.nationality),                  icon: '🌍' },
    { label: 'Inicio PPC',   value: firstLeagueTournamentName || '—',                         icon: '🏁' },
    { label: 'Resultado',    value: lastLeagueResult || '—',                                  icon: '🏆' },
    { label: 'Juego',        value: capitaliseFirst(playerCard.dominant_hand),                icon: '🖐️' },
    { label: 'Revés',        value: capitaliseFirst(playerCard.backhand_style),               icon: '↔️' },
  ];

  const aboutItems = [
    { label: 'Objetivo PPC',        value: playerCard.ppc_objective || '—',                                                   icon: '🎯', bg: 'rgba(20,184,166,0.18)',  border: 'rgba(20,184,166,0.28)' },
    { label: 'Arma secreta',        value: playerCard.favourite_shot || '—',                                                   icon: '✨', bg: 'rgba(59,130,246,0.16)',  border: 'rgba(59,130,246,0.26)' },
    { label: 'Superficie favorita', value: capitaliseFirst(playerCard.favourite_surface),                                      icon: '🏟️', bg: 'rgba(16,185,129,0.16)',  border: 'rgba(16,185,129,0.26)' },
    { label: 'Ídolo',               value: playerCard.favourite_player || '—',                                                 icon: '⭐', bg: 'rgba(245,158,11,0.16)',  border: 'rgba(245,158,11,0.26)' },
    { label: 'Raqueta',             value: fullRacket || '—',                                                                  icon: '🎾', bg: 'rgba(34,197,94,0.16)',  border: 'rgba(34,197,94,0.26)' },
    { label: 'Inicio en tenis',     value: playerCard.tennis_start_year != null ? String(playerCard.tennis_start_year) : '—', icon: '📍', bg: 'rgba(6,182,212,0.16)',  border: 'rgba(6,182,212,0.26)' },
  ];

  const divisionLogo = currentDivisionName ? divisionLogoSrc(currentDivisionName) : '/ppc-logo.png';

  const balls = [
    { size: 56, top: '4%',  left: '-2%',   rotate: 12,  opacity: 0.50 },
    { size: 32, top: '28%', left: '0.5%',  rotate: -20, opacity: 0.80 },
    { size: 48, top: '70%', left: '-1.5%', rotate: 38,  opacity: 0.60 },
    { size: 36, top: '90%', left: '1%',    rotate: -8,  opacity: 0.90 },
    { size: 42, top: '60%', left: '93%',   rotate: 25,  opacity: 0.50 },
    { size: 30, top: '80%', left: '96%',   rotate: -30, opacity: 0.25 },
    { size: 50, top: '92%', left: '88%',   rotate: 48,  opacity: 0.60 },
  ];

  const AVATAR = 180;

  return (
    <div
      className="relative overflow-hidden rounded-[24px]"
      style={{
        background: 'linear-gradient(145deg, #21425d 0%, #28516d 35%, #2d6267 68%, #356a58 100%)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px] z-10"
        style={{ background: 'linear-gradient(90deg,#34d399,#10b981,#6ee7b7,#fbbf24)' }}
      />

      {balls.map((b, i) => (
        <div
          key={i}
          className="pointer-events-none absolute select-none"
          style={{
            top: b.top,
            left: b.left,
            opacity: b.opacity,
            transform: `rotate(${b.rotate}deg)`,
            zIndex: 0,
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
          }}
        >
          <svg width={b.size} height={b.size} viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" fill="#c8e830" stroke="#9bb820" strokeWidth="2"/>
            <path d="M10 22 Q30 14 50 22" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.6"/>
            <path d="M10 38 Q30 46 50 38" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>
      ))}

      {hasAvatar && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <img
            src={avatarUrl}
            alt=""
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: '45%',
              objectFit: 'cover',
              objectPosition: 'center top',
              opacity: 0.40,
              maskImage:
                'linear-gradient(to left, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 42%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to left, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 42%, transparent 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(23,50,74,0.60) 0%, rgba(23,50,74,0.40) 24%, rgba(23,50,74,0.20) 48%, rgba(23,50,74,0.10) 70%, rgba(23,50,74,0.02) 100%)',
            }}
          />
        </div>
      )}

      <div className="relative z-10 p-5 sm:p-6">
        <div className="psc-header mb-4 flex items-start justify-between gap-4">
          <div
            className="psc-name-block"
            style={{
              maxWidth: '52%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <h2
              className="text-white uppercase text-center"
              style={{
                fontFamily: "'Bebas Neue', 'Arial Black', Impact, sans-serif",
                fontSize: 'clamp(2.45rem, 6vw, 4.35rem)',
                fontWeight: 400,
                letterSpacing: '0.05em',
                lineHeight: 0.9,
                margin: 0,
                textShadow: '0 3px 14px rgba(0,0,0,0.65)',
              }}
            >
              {uiName(player.name)}
            </h2>

            {playerCard.nickname && (
              <p
                style={{
                  fontFamily: "'Great Vibes', 'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(1.7rem, 3.6vw, 2.45rem)',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  color: '#d8fff1',
                  letterSpacing: '0.01em',
                  lineHeight: 0.95,
                  marginTop: '0.1rem',
                  marginBottom: 0,
                  textAlign: 'center',
                  textShadow: '0 2px 10px rgba(0,0,0,0.28)',
                }}
              >
                &ldquo;{playerCard.nickname}&rdquo;
              </p>
            )}
          </div>

          <div className="psc-division-mark flex shrink-0 flex-col items-center gap-1">

              <img
                src={divisionLogo}
                alt={`División ${currentDivisionName || 'PPC'}`}
                style={{ width: 62, height: 62, objectFit: 'contain' }}
              />

            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.68)',
                textAlign: 'center',
              }}
            >
              División {currentDivisionName || '—'}
            </span>
          </div>
        </div>

        <div
          className="psc-profile-shell mb-3 rounded-xl p-3"
          style={{
            width: '64%',
            background: 'linear-gradient(90deg, rgba(15,35,52,0.12) 0%, rgba(15,35,52,0.06) 58%, rgba(15,35,52,0.00) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span style={{ fontSize: '1.3rem' }}>🎾</span>
            <span
              className="font-bold uppercase text-white"
              style={{ fontSize: '0.85rem', letterSpacing: '0.20em' }}
            >
              Perfil Tenístico
            </span>
            <div
              className="ml-2 h-px flex-1 rounded-full"
              style={{ background: 'linear-gradient(90deg,rgba(52,211,153,0.65),transparent)' }}
            />
          </div>

          <div className="psc-profile-body flex gap-4 items-center">
            <div
              className="psc-avatar-wrap shrink-0"
              style={{
                width: 'min(180px, 52vw)',
                height: 'min(180px, 52vw)',
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(52,211,153,0.24)',
                    filter: 'blur(14px)',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid rgba(110,231,183,0.62)',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
                  }}
                >
                  {hasAvatar ? (
                    <img
                      src={avatarUrl}
                      alt={player.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255,255,255,0.07)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.58rem',
                          color: 'rgba(255,255,255,0.50)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.10em'
                        }}
                      >
                        Sin foto
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="psc-profile-grid grid gap-2"
              style={{
                width: 'min(430px, 100%)',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gridAutoRows: '1fr',
              }}
            >
              {profileItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <span style={{ fontSize: '1.55rem', lineHeight: 1, flexShrink: 0 }}>
                    {item.icon}
                  </span>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="psc-item-label"
                      style={{
                        fontSize: '0.60rem',
                        fontWeight: 700,
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        color: 'rgba(220,255,245,0.78)',
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="psc-item-value"
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        lineHeight: 1.25,
                        color: item.label === 'Resultado' ? '#fcd34d' : '#ffffff',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(0,0,0,0.16)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span style={{ fontSize: '1.3rem' }}>😎</span>
            <span
              className="font-bold uppercase text-white"
              style={{ fontSize: '0.88rem', letterSpacing: '0.20em' }}
            >
              Conoce al Jugador
            </span>
            <div
              className="ml-2 h-px flex-1 rounded-full"
              style={{ background: 'linear-gradient(90deg,rgba(251,191,36,0.65),transparent)' }}
            />
          </div>

          <div
            className="psc-about-grid grid gap-2"
            style={{ gridTemplateColumns: 'repeat(3,1fr)', gridAutoRows: '1fr' }}
          >
            {aboutItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
                style={{ background: item.bg, border: `1px solid ${item.border}` }}
              >
                <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>
                  {item.icon}
                </span>

                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="psc-item-label"
                    style={{
                      fontSize: '0.54rem',
                      fontWeight: 700,
                      letterSpacing: '0.09em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.50)',
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="psc-item-value"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      lineHeight: 1.25,
                      color: '#ffffff',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!hasAvatar && (
          <div
            className="absolute right-4 top-4 z-20 rounded-full px-3 py-1"
            style={{
              border: '1px solid rgba(251,191,36,0.40)',
              background: 'rgba(251,191,36,0.14)',
              fontSize: '0.58rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(253,230,138,0.90)',
            }}
          >
            Foto pendiente
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .psc-profile-shell {
            width: 100% !important;
          }

          .psc-profile-grid {
            width: 100% !important;
          }
        }

        @media (max-width: 640px) {
          .psc-header {
            align-items: flex-start !important;
            gap: 12px !important;
          }

          .psc-name-block {
            max-width: 68% !important;
            align-items: flex-start !important;
          }

          .psc-name-block h2 {
            font-size: clamp(2rem, 9vw, 3rem) !important;
            text-align: left !important;
            line-height: 0.92 !important;
          }

          .psc-name-block p {
            font-size: clamp(1.35rem, 6vw, 2rem) !important;
            text-align: left !important;
            line-height: 0.95 !important;
            margin-top: 0.05rem !important;
          }

          .psc-division-mark img {
            width: 52px !important;
            height: 52px !important;
          }

          .psc-division-mark span {
            font-size: 0.50rem !important;
            letter-spacing: 0.10em !important;
          }

          .psc-profile-shell {
            width: 100% !important;
            padding: 0.9rem !important;
          }

          .psc-profile-body {
            flex-direction: column !important;
            align-items: center !important;
            gap: 14px !important;
          }

          .psc-avatar-wrap {
            align-self: center !important;
          }

          .psc-profile-grid {
            width: 100% !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .psc-about-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .psc-profile-grid > div .psc-item-value,
          .psc-about-grid > div .psc-item-value {
            font-size: 0.8rem !important;
            line-height: 1.12 !important;
          }

          .psc-profile-grid > div .psc-item-label,
          .psc-about-grid > div .psc-item-label {
            font-size: 0.38rem !important;
            letter-spacing: 0.045em !important;
            line-height: 1.02 !important;
          }
        }

        @media (max-width: 480px) {
          .psc-header {
            gap: 10px !important;
          }

          .psc-name-block {
            max-width: 66% !important;
          }

          .psc-name-block h2 {
            font-size: clamp(1.8rem, 8.2vw, 2.7rem) !important;
            letter-spacing: 0.03em !important;
          }

          .psc-name-block p {
            font-size: clamp(1.25rem, 5.8vw, 1.8rem) !important;
          }

          .psc-profile-shell {
            padding: 0.8rem !important;
          }

          .psc-profile-grid {
            gap: 0.7rem !important;
          }

          .psc-profile-grid > div {
            padding: 0.85rem 0.8rem !important;
            min-height: 84px !important;
            align-items: center !important;
          }

          .psc-profile-grid > div span:first-child {
            font-size: 1.3rem !important;
          }

          .psc-profile-grid > div > div {
            gap: 0.1rem !important;
          }

          .psc-about-grid {
            gap: 0.7rem !important;
          }

          .psc-about-grid > div {
            padding: 0.95rem 0.9rem !important;
            min-height: 104px !important;
            align-items: center !important;
          }

          .psc-about-grid > div span:first-child {
            font-size: 1.3rem !important;
          }

          .psc-about-grid > div > div {
            gap: 0.12rem !important;
          }

          .psc-profile-grid > div .psc-item-label,
          .psc-about-grid > div .psc-item-label {
            font-size: 0.36rem !important;
            letter-spacing: 0.03em !important;
            line-height: 1.00 !important;
          }
          .psc-profile-grid > div .psc-item-value,
          .psc-about-grid > div .psc-item-value {
            font-size: 1.20rem !important;
            line-height: 1.10 !important;
          }
        }

        @media (max-width: 460px) {
          .psc-profile-grid {
            grid-template-columns: 1fr !important;
          }

          .psc-about-grid {
            grid-template-columns: 1fr !important;
          }

          .psc-name-block {
            max-width: 64% !important;
          }

          .psc-division-mark img {
            width: 46px !important;
            height: 46px !important;
          }
        }
      `}</style>
    </div>
  );
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

function divisionLogoSrc(name: string) {
  const map: Record<string, string> = {
    'Bronce': '/ppc-bronce.png',
    'Oro': '/ppc-oro.png',
    'Plata': '/ppc-plata.png',
    'Cobre': '/ppc-cobre.png',
    'Hierro': '/ppc-hierro.png',
    'Diamante': '/ppc-diamante.png',
    'Élite': '/ppc-elite.png',
    'Anita Lizana': '/ppc-elite.png',
    'Serena Williams': '/ppc-elite.png',
  };
  return map[name] || '/ppc-logo.png';
}

// Colores por división: [gradiente barra top, ring avatar, sombra avatar, borde tarjeta]
function divisionColors(name: string): {
  barGradient: string;
  ringColor: string;
  avatarShadow: string;
  cardBorder: string;
  blurTop: string;
  blurBottom: string;
} {
  const n = (name || '').trim();
  switch (n) {
    case 'Élite':
    case 'Anita Lizana':
    case 'Serena Williams':
      return {
        barGradient: 'from-purple-500 via-violet-400 to-indigo-500',
        ringColor: 'ring-purple-200',
        avatarShadow: '0_12px_30px_rgba(139,92,246,0.25)',
        cardBorder: 'border-purple-100',
        blurTop: 'bg-purple-100/70',
        blurBottom: 'bg-indigo-100/70',
      };
    case 'Diamante':
      return {
        barGradient: 'from-cyan-400 via-sky-300 to-blue-400',
        ringColor: 'ring-cyan-200',
        avatarShadow: '0_12px_30px_rgba(34,211,238,0.25)',
        cardBorder: 'border-cyan-100',
        blurTop: 'bg-cyan-100/70',
        blurBottom: 'bg-sky-100/70',
      };
    case 'Oro':
      return {
        barGradient: 'from-yellow-400 via-amber-400 to-orange-400',
        ringColor: 'ring-yellow-200',
        avatarShadow: '0_12px_30px_rgba(251,191,36,0.30)',
        cardBorder: 'border-yellow-100',
        blurTop: 'bg-yellow-100/70',
        blurBottom: 'bg-amber-100/70',
      };
    case 'Plata':
      return {
        barGradient: 'from-slate-400 via-gray-300 to-slate-400',
        ringColor: 'ring-slate-200',
        avatarShadow: '0_12px_30px_rgba(148,163,184,0.30)',
        cardBorder: 'border-slate-200',
        blurTop: 'bg-slate-100/70',
        blurBottom: 'bg-gray-100/70',
      };
    case 'Bronce':
      return {
        barGradient: 'from-orange-400 via-amber-500 to-yellow-600',
        ringColor: 'ring-orange-200',
        avatarShadow: '0_12px_30px_rgba(249,115,22,0.25)',
        cardBorder: 'border-orange-100',
        blurTop: 'bg-orange-100/70',
        blurBottom: 'bg-amber-100/70',
      };
    case 'Cobre':
      return {
        barGradient: 'from-rose-400 via-red-400 to-orange-500',
        ringColor: 'ring-rose-200',
        avatarShadow: '0_12px_30px_rgba(251,113,133,0.25)',
        cardBorder: 'border-rose-100',
        blurTop: 'bg-rose-100/70',
        blurBottom: 'bg-orange-100/70',
      };
    case 'Hierro':
    default:
      return {
        barGradient: 'from-emerald-400 via-teal-400 to-green-500',
        ringColor: 'ring-emerald-200',
        avatarShadow: '0_12px_30px_rgba(16,185,129,0.20)',
        cardBorder: 'border-emerald-100',
        blurTop: 'bg-emerald-100/70',
        blurBottom: 'bg-teal-100/70',
      };
  }
}

function getNextMatchPosition(round: string | null | undefined, pos: number | null | undefined) {
  if (!round || !pos) return null;

  // R16 -> QF
  if (round === 'R16') {
    // 1-2 -> QF1, 3-4 -> QF2, 5-6 -> QF3, 7-8 -> QF4
    return {
      nextRound: 'QF',
      nextPos: Math.ceil(pos / 2),
    };
  }

  // QF -> SF
  if (round === 'QF') {
    return {
      nextRound: 'SF',
      nextPos: Math.ceil(pos / 2), // QF1,2 -> SF1 ; QF3,4 -> SF2
    };
  }

  // SF -> Final
  if (round === 'SF') {
    return {
      nextRound: 'F',
      nextPos: 1,
    };
  }

  return null;
}


async function advanceWinner(match: Match, supabase: any) {
  if (!match || match.status !== 'played') return;

  const { home_player_id, away_player_id } = match;
  const { player1_sets_won, player2_sets_won } = match;

  if (!home_player_id || !away_player_id) return;

  // Obtener ganador
  let winner: string | null = null;

  if (player1_sets_won > player2_sets_won) {
    winner = home_player_id;
  } else if (player2_sets_won > player1_sets_won) {
    winner = away_player_id;
  } else {
    return; // empate no avanza
  }

  // Calcular el partido siguiente
  const meta = getNextMatchPosition(match.knockout_round, match.bracket_position);
  if (!meta) return; // Final no tiene siguiente ronda

  const { nextRound, nextPos } = meta;

  // Buscar si ya existe el partido de la siguiente ronda
  const { data: existing, error: existingErr } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', match.tournament_id)
    .eq('knockout_round', nextRound)
    .eq('bracket_position', nextPos)
    .maybeSingle();

  // 1) Si NO existe → crear el partido
  if (!existing) {
    // Fechas por defecto según la ronda
    let defaultDate = new Date().toISOString().split('T')[0];

    if (nextRound === 'QF') {
      defaultDate = '2026-01-31';
    } else if (nextRound === 'SF') {
      defaultDate = '2026-02-28';
    } else if (nextRound === 'F') {
      defaultDate = '2026-03-31';
    }

    await supabase.from('matches').insert({
      tournament_id: match.tournament_id,
      division_id: match.division_id,
      knockout_round: nextRound,
      bracket_position: nextPos,
      home_player_id: winner,
      away_player_id: null,
      date: defaultDate,      // 👈 aquí usamos la fecha por defecto
      status: 'pending',
    });

    return;
  }

  // 2) Si existe → actualizamos home/away según disponibilidad
  const updatePayload: any = {};

  if (!existing.home_player_id) {
    updatePayload.home_player_id = winner;
  } else if (!existing.away_player_id) {
    updatePayload.away_player_id = winner;
  } else {
    return; // Ya tiene ambos jugadores, no hacemos nada
  }

  await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', existing.id);
}


// ---------------- Bracket (vista KO) ----------------

type BracketAnyPlayer = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
};

type BracketViewProps = {
  tournament: Tournament;
  matches: Match[];
  profiles: Profile[];
  historicPlayers: HistoricPlayer[];  
  matchSets: MatchSet[];
  onBack: () => void;
  onEditSchedule: (m: Match) => void;
  onEditResult: (m: Match) => void;
  canEditSchedule: (m: Match) => boolean;
};

type BracketPlayerSlotProps = {
  player?: BracketAnyPlayer | null;
  isWinner?: boolean;
  isLoser?: boolean;
};

function BracketPlayerSlot({ player, isWinner, isLoser }: BracketPlayerSlotProps) {
  const base =
    'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 min-w-[150px]';

  let cls =
    'bg-white border-slate-200 text-slate-800 shadow-sm';

  if (!player) {
    cls =
      'bg-slate-50 border-dashed border-slate-300 text-slate-400 italic';
  }

  if (isWinner) {
    cls =
      'bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-50 border-emerald-300 text-emerald-900 font-semibold shadow-md';
  } else if (isLoser) {
    cls =
      'bg-slate-100 border-slate-200 text-slate-500 opacity-80';
  }

  return (
    <div className={`${base} ${cls}`}>
      <div className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-white bg-slate-200 shadow-sm flex-shrink-0">
        {player?.avatar_url ? (
          <img
            src={player.avatar_url}
            alt={player?.name ?? 'Player'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs">
            🎾
          </div>
        )}
      </div>
      <div className="text-sm font-medium truncate">
        {player ? uiName(player.name) : '—'}
      </div>
    </div>
  );
}

type BracketMatchCardProps = {
  match: Match | null;
  player1?: BracketAnyPlayer | null;
  player2?: BracketAnyPlayer | null;
  header?: string;
  sets?: MatchSet[];
};

const BracketMatchCard: React.FC<BracketMatchCardProps> = ({
  match,
  player1,
  player2,
  header,
  sets = [],
}) => {
  let winnerId: string | null = null;
  let loserId: string | null = null;

  if (match && match.status === 'played') {
    if (match.player1_sets_won > match.player2_sets_won) {
      winnerId = match.home_player_id;
      loserId = match.away_player_id ?? null;
    } else if (match.player2_sets_won > match.player1_sets_won) {
      winnerId = match.away_player_id ?? null;
      loserId = match.home_player_id;
    }
  }

  const isWinner = (p?: BracketAnyPlayer | null) =>
    !!winnerId && p?.id === winnerId;
  const isLoser = (p?: BracketAnyPlayer | null) =>
    !!loserId && p?.id === loserId;

  const orderedSets = [...sets].sort(
    (a, b) => (a.set_number ?? 0) - (b.set_number ?? 0)
  );
  const scoreLine =
    orderedSets.length > 0
      ? orderedSets.map(s => `${s.p1_games}-${s.p2_games}`).join('  ')
      : '';

  return (
    <div className="flex flex-col gap-2">
      {header && (
        <div className="text-[11px] uppercase tracking-[0.20em] text-emerald-700 mb-1 text-center font-semibold">
          {header}
        </div>
      )}

      <div className="rounded-2xl border border-white/80 bg-white/95 p-3 text-slate-900 text-sm flex flex-col gap-2 min-h-[88px] shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <BracketPlayerSlot
          player={player1}
          isWinner={isWinner(player1)}
          isLoser={isLoser(player1)}
        />
        <BracketPlayerSlot
          player={player2}
          isWinner={isWinner(player2)}
          isLoser={isLoser(player2)}
        />

        {scoreLine && (
          <div className="mt-1 text-[11px] text-slate-600 text-center tracking-[0.14em] font-semibold">
            {scoreLine}
          </div>
        )}
      </div>
    </div>
  );
};




function BracketView({
  tournament,
  matches,
  profiles,
  historicPlayers,
  matchSets,
  onBack,
  onEditSchedule,
  onEditResult,
  canEditSchedule,
}: BracketViewProps) {

  const getPlayer = (id?: string | null): BracketAnyPlayer | null => {
    if (!id) return null;

    const p = profiles.find(x => x.id === id);
    if (p) return { id: p.id, name: p.name, avatar_url: p.avatar_url ?? null };

    const h = historicPlayers.find(x => x.id === id);
    if (h) return { id: h.id, name: h.name, avatar_url: h.avatar_url ?? null };

    return null;
  };

  const getProfile = (id?: string | null) =>
    id ? profiles.find(p => p.id === id) ?? null : null;

  const byRound = (
    round: 'R16' | 'QF' | 'SF' | 'F',
    pos: number
  ): Match | null =>
    matches.find(
      m =>
        m.knockout_round === round &&
        (m.bracket_position ?? 0) === pos
    ) || null;

  // Colocamos siempre los slots, aunque no haya partido en BD → se ve el “esqueleto” completo
  const r16Left = [1, 2, 3, 4].map(pos => byRound('R16', pos));
  const r16Right = [5, 6, 7, 8].map(pos => byRound('R16', pos));
  const qfLeft = [1, 2].map(pos => byRound('QF', pos));
  const qfRight = [3, 4].map(pos => byRound('QF', pos));
  const sf = [1, 2].map(pos => byRound('SF', pos));
  const finalMatch = byRound('F', 1);
  const getMatchHomeId = (m?: Match | null): string | null => {
    if (!m) return null;
    return (m as any).home_player_id ?? (m as any).home_historic_player_id ?? null;
  };

  const getMatchAwayId = (m?: Match | null): string | null => {
    if (!m) return null;
    return (m as any).away_player_id ?? (m as any).away_historic_player_id ?? null;
  };

  const championId = finalMatch
    ? finalMatch.player1_sets_won > finalMatch.player2_sets_won
      ? getMatchHomeId(finalMatch)
      : finalMatch.player2_sets_won > finalMatch.player1_sets_won
      ? getMatchAwayId(finalMatch)
      : null
    : null;

  const champion = championId ? getPlayer(championId) : null;  

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eefaf7] via-[#f7fffd] to-[#eef6ff] text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <span className="text-lg">←</span>
            <span>Volver a torneos</span>
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.10)] mb-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-blue-500" />
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-100/70 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-sky-100/70 blur-3xl" />

          <div className="relative flex flex-col items-center px-6 py-8 text-center">
            <img
              src="/ppc-cup-trophy.jpg"
              alt="PPC Cup Trophy"
              className="h-40 w-auto mb-4 object-contain drop-shadow-[0_10px_25px_rgba(16,185,129,0.18)]"
            />
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 mb-3">
              <span className="text-sm">🏆</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                PPC Cup
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wide text-slate-900">
              {tournament.name}
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Knockout · 16 jugadores
            </p>
          </div>
        </div>

        {/* Grid del bracket */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px] grid grid-cols-[1.1fr,1fr,1.2fr,1fr,1.1fr] gap-x-6">
          {/* R16 izquierda */}
          <div className="space-y-6">
            {r16Left.map((m, idx) => (
              <BracketMatchCard
                key={`r16-L-${idx}`}
                match={m}
                player1={getPlayer(getMatchHomeId(m))}
                player2={getPlayer(getMatchAwayId(m))}
                header={idx === 0 ? 'Ronda de 16' : undefined}
                sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
              />
            ))}
          </div>

          {/* QF izquierda */}
          <div className="space-y-12 mt-12">
            {qfLeft.map((m, idx) => {
              const hasOnlyOne = !!m?.home_player_id && !m?.away_player_id;

              // SOLO el QF de abajo (idx 1) debe mostrar el único jugador abajo
              const forceSingleBottom = idx === 1;

              const pTop = hasOnlyOne && forceSingleBottom ? null : getProfile(m?.home_player_id);
              const pBottom = hasOnlyOne && forceSingleBottom
                ? getProfile(m?.home_player_id)
                : getProfile(m?.away_player_id);

              return (
                <BracketMatchCard
                  key={`qf-L-${idx}`}
                  match={m}
                  player1={pTop}
                  player2={pBottom}
                  header={idx === 0 ? 'Cuartos de final' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                />
              );
            })}
          </div>

          {/* Centro: SF + Final */}
          <div className="flex flex-col items-center justify-between py-4">
            <div className="space-y-12">
              {sf.map((m, idx) => (
                <BracketMatchCard
                  key={`sf-${idx}`}
                  match={m}
                  player1={getProfile(getMatchHomeId(m))}
                  player2={getProfile(getMatchAwayId(m))}
                  header={idx === 0 ? 'Semifinales' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                />
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center">
              <div className="text-center mb-2 text-[11px] uppercase tracking-[0.2em] text-yellow-300">
                Final
              </div>
              <BracketMatchCard
                match={finalMatch}
                player1={getProfile(getMatchHomeId(finalMatch))}
                player2={getProfile(getMatchAwayId(finalMatch))}
                sets={finalMatch ? matchSets.filter(s => s.match_id === finalMatch.id) : []}
              />

              {champion && (
                <div className="mt-8 w-full max-w-md rounded-[26px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 p-6 text-center shadow-[0_18px_45px_rgba(16,185,129,0.16)]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-700 font-semibold mb-3">
                    Campeón
                  </p>

                  <div className="mx-auto mb-4 h-28 w-28 rounded-full overflow-hidden border-4 border-white shadow-[0_10px_28px_rgba(14,165,233,0.18)] bg-white ring-4 ring-emerald-100">
                    {champion.avatar_url ? (
                      <img
                        src={champion.avatar_url}
                        alt={champion.name ?? 'Champion'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-4xl">
                        🎾
                      </div>
                    )}
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                    {uiName(champion.name)}
                  </h2>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/90 border border-emerald-100 px-3 py-1 shadow-sm">
                    <span className="text-xs">🏆</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      PPC Cup Winner
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QF derecha */}
          <div className="space-y-12 mt-12">
            {qfRight.map((m, idx) => {
              const hasOnlyOne = !!m?.home_player_id && !m?.away_player_id;

              // SOLO el QF de arriba (idx 0) debe mostrar el único jugador abajo
              const forceSingleBottom = idx === 0;

              const pTop = hasOnlyOne && forceSingleBottom ? null : getProfile(m?.home_player_id);
              const pBottom = hasOnlyOne && forceSingleBottom
                ? getProfile(m?.home_player_id)
                : getProfile(m?.away_player_id);

              return (
                <BracketMatchCard
                  key={`qf-R-${idx}`}
                  match={m}
                  player1={pTop}
                  player2={pBottom}
                  header={idx === 0 ? 'Cuartos de final' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                />
              );
            })}
          </div>

          {/* R16 derecha */}
          <div className="space-y-6">
            {r16Right.map((m, idx) => (
              <BracketMatchCard
                key={`r16-R-${idx}`}
                match={m}
                player1={getProfile(getMatchHomeId(m))}
                player2={getProfile(getMatchAwayId(m))}
                header={idx === 0 ? 'Ronda de 16' : undefined}
                sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
              />
            ))}
          </div>
        </div>
        
        </div>
      </div>

      {/* Panel inferior: lista de partidos y acciones */}
      <div className="px-4 pb-8 mt-6">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 mb-3">
          Partidos y resultados
        </h2>

        <div className="bg-white/95 border border-slate-200 rounded-2xl overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-gradient-to-r from-emerald-50 via-cyan-50 to-sky-50 text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-3 py-2 text-left">Ronda</th>
                <th className="px-3 py-2 text-left">Partido</th>
                <th className="px-3 py-2 text-middle">Fecha</th>
                <th className="px-3 py-2 text-middle">Lugar</th>
                <th className="px-3 py-2 text-middle">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {["R16", "QF", "SF", "F"].map((round) => {
                const roundLabel =
                  round === "R16"
                    ? "Ronda de 16"
                    : round === "QF"
                    ? "Cuartos de final"
                    : round === "SF"
                    ? "Semifinales"
                    : "Final";

                const roundMatches = matches
                  .filter((m) => m.knockout_round === round)
                  .sort((a, b) => {
                    const da = a.date || "";
                    const db = b.date || "";
                    if (da !== db) return da.localeCompare(db);
                    const ta = a.time || "";
                    const tb = b.time || "";
                    return ta.localeCompare(tb);
                  });

                if (roundMatches.length === 0) return null;

                return roundMatches.map((m) => {
                  const p1 = profiles.find((p) => p.id === m.home_player_id) || null;
                  const p2 = m.away_player_id
                    ? profiles.find((p) => p.id === m.away_player_id) || null
                    : null;

                  const dateText = m.date ? m.date.slice(0, 10) : "Por definir";
                  const timeText = m.time ? m.time.slice(0, 5) : "";
                  const placeText = m.location_details || "Por definir";

                  return (
                    <tr key={m.id} className="hover:bg-emerald-50/50">
                      <td className="px-3 py-2 align-top text-slate-600">
                        {roundLabel}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span>
                            {p1?.name ?? "Por definir"}
                            {p2 ? ` vs ${p2.name}` : " vs —"}
                          </span>
                          {m.status === "played" && (
                            <span className="text-[15px] text-lime-300 font-semibold">
                              (jugado)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {dateText}
                        {timeText && (
                          <span className="ml-1 text-slate-400">· {timeText}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {placeText}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-2 justify-end">
                        {canEditSchedule(m) && (
                          <button
                            onClick={() => onEditSchedule(m)}
                            className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-[11px] sm:text-xs"
                          >
                            Editar horario
                          </button>
                        )}
                        {canEditSchedule(m) && (
                          <button
                            onClick={() => onEditResult(m)}
                            className="px-2.5 py-1 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] sm:text-xs"
                          >
                            Agregar resultados
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
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
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>([]);
  const [playerProfileTab, setPlayerProfileTab] = useState<'overview' | 'ficha' | 'stats'>('overview');
  const [editingPlayerCard, setEditingPlayerCard] = useState<boolean>(false);
  const [playerCardForm, setPlayerCardForm] = useState<Partial<PlayerCard>>({});
  const [savingPlayerCard, setSavingPlayerCard] = useState<boolean>(false);
  const [playerCardSaveMessage, setPlayerCardSaveMessage] = useState<string>('');
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
  const [showHistoricTournaments, setShowHistoricTournaments] = useState(false);
  const [historicTab, setHistoricTab] = useState<'men' | 'women' | 'calibrations' | 'other'>('men');
  const [showHallOfFameView, setShowHallOfFameView] = useState(false);
  const [hallOfFameTournamentFilter, setHallOfFameTournamentFilter] = useState('all');
  const [hallOfFameDivisionFilter, setHallOfFameDivisionFilter] = useState('all');
  const [historicPlayers, setHistoricPlayers] = useState<HistoricPlayer[]>([]);
  const [birthDateInput, setBirthDateInput] = useState('');
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
  const [showBuscarClases, setShowBuscarClases] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [cameFromHistoric, setCameFromHistoric] = useState(false);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newRegistration, setNewRegistration] = useState({ tournamentId: '', divisionId: '' }); 
  const [registrationStep, setRegistrationStep] = useState(1);
  const [pickedTournamentId, setPickedTournamentId] = useState<string>('');
  const [pickedDivisionId, setPickedDivisionId] = useState<string>('');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournamentTab, setTournamentTab] = useState<'overview' | 'playoffs'>('overview');
  const [playoffsDivisionFilter, setPlayoffsDivisionFilter] = useState<string>('all');
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
    pintsCount: '1',
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

  const BOOKING_VENUES = {
    highbury: {
      key: 'highbury',
      venue_slug: 'islington-tennis-centre',
      activity_slug: 'highbury-tennis',
      venue_label: 'Highbury Fields (Islington Tennis Centre)',
      activity_label: 'Highbury Tennis',
      courtOptions: Array.from({ length: 11 }, (_, i) => ({
        short: `Court ${i + 1}`,
        full: `Highbury Fields Tennis Court ${i + 1}`,
      })),
      defaultPreferences: ['Court 11', 'Court 10', 'Court 9'],
    },
    rosemary: {
      key: 'rosemary',
      venue_slug: 'islington-tennis-centre',
      activity_slug: 'rosemary-gardens-tennis',
      venue_label: 'Rosemary Gardens (Islington Tennis Centre)',
      activity_label: 'Rosemary Gardens Tennis',
      courtOptions: [
        { short: 'Court 1', full: 'Rosemary Gardens Tennis Court 1' },
        { short: 'Court 2', full: 'Rosemary Gardens Tennis Court 2' },
      ],
      defaultPreferences: ['Court 1', 'Court 2', ''],
    },
  } as const;

  type BookingVenueKey = keyof typeof BOOKING_VENUES;

  const getBookingVenueConfig = (activitySlug?: string | null) => {
    if (activitySlug === BOOKING_VENUES.rosemary.activity_slug) {
      return BOOKING_VENUES.rosemary;
    }
    return BOOKING_VENUES.highbury;
  };

  const [bookingAdmins, setBookingAdmins] = useState<BookingAdmin[]>([]);
  const [bookingAccounts, setBookingAccounts] = useState<BookingAccount[]>([]);
  const [courtRequests, setCourtRequests] = useState<CourtBookingRequest[]>([]);

  const [showBookingPanel, setShowBookingPanel] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [bookingHistoryLimit, setBookingHistoryLimit] = useState<'5' | '10' | '20' | 'all'>('10');
  const [bookingHistoryStatusFilter, setBookingHistoryStatusFilter] = useState<'all' | 'BOOKED' | 'CANCELLED' | 'EXPIRED' | 'CLOSED' | 'FAILED'>('all');

  const [newBooking, setNewBooking] = useState<{
    better_account_id: string;
    venue_slug: string;
    activity_slug: string;
    target_date: string;     // input date 'YYYY-MM-DD'
    start_time: string;      // 'HH:MM' (ej. '19:00')
    preferred_court_name_1: string;
    preferred_court_name_2: string,
    preferred_court_name_3: string,
  }>({
    better_account_id: '',
    venue_slug: BOOKING_VENUES.highbury.venue_slug,
    activity_slug: BOOKING_VENUES.highbury.activity_slug,
    target_date: '',
    start_time: '19:00',
    preferred_court_name_1: BOOKING_VENUES.highbury.defaultPreferences[0],
    preferred_court_name_2: BOOKING_VENUES.highbury.defaultPreferences[1],
    preferred_court_name_3: BOOKING_VENUES.highbury.defaultPreferences[2],
  });

  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const selectedBookingVenue = getBookingVenueConfig(newBooking.activity_slug);
  const courtNames = selectedBookingVenue.courtOptions.map(c => c.short);

  const handleBookingVenueChange = (venueKey: BookingVenueKey) => {
    const cfg = BOOKING_VENUES[venueKey];

    setNewBooking(prev => ({
      ...prev,
      venue_slug: cfg.venue_slug,
      activity_slug: cfg.activity_slug,
      preferred_court_name_1: cfg.defaultPreferences[0] || '',
      preferred_court_name_2: cfg.defaultPreferences[1] || '',
      preferred_court_name_3: cfg.defaultPreferences[2] || '',
    }));
  };  

  const [socialEvents, setSocialEvents] = useState<SocialEvent[]>([]);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Sub Fase de Grupos (Placement) – UI state (Edición 3)
  const [placementGroup, setPlacementGroup] = useState<'A' | 'B' | 'C' | 'D'>('A');
  // Switch de vistas para Edición 3 (escalable a futuras fases)
  const [e3View, setE3View] = useState<'main' | 'groups'>('main');

  useEffect(() => {
    setPlacementGroup('A');
    setE3View('main');
  }, [selectedTournament?.id]);

  const goToNextPhoto = () => {
    if (highlightPhotos.length === 0) return;
    setCurrentPhotoIndex((prev) => (prev + 1) % highlightPhotos.length);
  };

  const goToPrevPhoto = () => {
    if (highlightPhotos.length === 0) return;
    setCurrentPhotoIndex((prev) =>
      (prev - 1 + highlightPhotos.length) % highlightPhotos.length
    );
  };

  // -------- Helpers: resolve player from profiles OR historic_players --------

  type AnyPlayer = {
    id: string;
    name?: string | null;
    avatar_url?: string | null;
  };

  const getAnyPlayerById = (id?: string | null): AnyPlayer | null => {
    if (!id) return null;

    const p = profiles.find(x => x.id === id);
    if (p) return p as AnyPlayer;

    const h = historicPlayers.find(x => x.id === id);
    if (h) return h as AnyPlayer;

    return null;
  };

  const getAnyPlayerName = (id?: string | null): string => {
    return getAnyPlayerById(id)?.name ?? '—';
  };

  const getAnyPlayerAvatarUrl = (id?: string | null): string | null => {
    return getAnyPlayerById(id)?.avatar_url ?? null;
  };

  // ---------------- Playoffs helpers ----------------

  const isPlayoffsMatch = (m: Match) =>
    m.phase === 'finals_main' || m.phase === 'finals_repechage';

  const isDivisionLeagueMatch = (m: Match, divisionId: string) => {
    if (m.division_id !== divisionId) return false;
    if (isPlayoffsMatch(m)) return false; // 👈 clave
    return true;
  };

  const getPlayoffsMatchesForTournament = (tournamentId: string) =>
    matches.filter(m => m.tournament_id === tournamentId && isPlayoffsMatch(m));

  const winnerIdFromMatch = (m: Match): string | null => {
    // OJO: asumimos el mapping actual de tu app:
    // player1_* corresponde a home, player2_* corresponde a away.
    // Si algún día esto cambia, lo ajustamos aquí (solo UI).
    const a = m.player1_sets_won;
    const b = m.player2_sets_won;
    if (a == null || b == null) return null;
    if (a > b) return m.home_player_id ?? null;
    if (b > a) return m.away_player_id ?? null;
    return null;
  };

  const scoreLineForMatch = (m: Match) => {
    // 1) Prefer match_sets if present (set-by-set games)
    const sets = (matchSets || [])
      .filter(s => s.match_id === m.id)
      .slice()
      .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0));

    if (sets.length > 0) {
      return sets.map(s => `${s.p1_games}-${s.p2_games}`).join('  ');
    }

    // 2) Fallback: total games from matches row if you didn't insert match_sets
    if (typeof m.player1_games_won === 'number' && typeof m.player2_games_won === 'number') {
      return `${m.player1_games_won}-${m.player2_games_won}`;
    }

    // 3) Last fallback: sets only
    if (typeof m.player1_sets_won === 'number' && typeof m.player2_sets_won === 'number') {
      return `${m.player1_sets_won}-${m.player2_sets_won}`;
    }

    return '—';
  };


  type PlayoffsBlock = {
    sf1?: Match;
    sf2?: Match;
    final?: Match;
    championId?: string | null;
  };

  // Arma el bracket principal (finals_main) usando knockout_round + bracket_position
  const buildMainPlayoffsBlock = (tournamentId: string, divisionId: string): PlayoffsBlock => {
    const list = matches.filter(m =>
      m.tournament_id === tournamentId &&
      m.division_id === divisionId &&
      m.phase === 'finals_main'
    );

    const sf = list.filter(m => m.knockout_round === 'SF');
    const final = list.find(m => m.knockout_round === 'F' && (m.bracket_position ?? 1) === 1);

    const sf1 = sf.find(m => (m.bracket_position ?? 1) === 1);
    const sf2 = sf.find(m => (m.bracket_position ?? 2) === 2);

    const championId = final ? winnerIdFromMatch(final) : null;

    return { sf1, sf2, final, championId };
  };

  // Repechaje: lista (1 o varios)
  const buildRepechageMatches = (tournamentId: string, divisionId: string): Match[] => {
    return matches
      .filter(m =>
        m.tournament_id === tournamentId &&
        m.division_id === divisionId &&
        m.phase === 'finals_repechage'
      )
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      });
  };

  const playoffRoundRank = (m: Match) => {
    if (m.phase === 'finals_main' && m.knockout_round === 'SF') return 1;
    if (m.phase === 'finals_main' && m.knockout_round === 'F') return 2;
    if (m.phase === 'finals_repechage') return 3;
    return 99;
  };

  const playoffTypeLabel = (m: Match) => {
    if (m.phase === 'finals_repechage') return 'Repechaje';
    if (m.phase === 'finals_main' && m.knockout_round === 'SF') return 'Semifinal';
    if (m.phase === 'finals_main' && m.knockout_round === 'F') return 'Final';
    return 'Playoff';
  };

  const getMatchHomeId = (m: any) => m?.home_player_id ?? m?.home_historic_player_id ?? null;
  const getMatchAwayId = (m: any) => m?.away_player_id ?? m?.away_historic_player_id ?? null;



  // Para tournament_registrations: profile_id OR historic_player_id
  const getRegistrationName = (r: { profile_id?: string | null; historic_player_id?: string | null }): string => {
    if (r.profile_id) return getAnyPlayerName(r.profile_id);
    if (r.historic_player_id) return getAnyPlayerName(r.historic_player_id);
    return '—';
  };

  const getRegistrationAvatarUrl = (r: { profile_id?: string | null; historic_player_id?: string | null }): string | null => {
    if (r.profile_id) return getAnyPlayerAvatarUrl(r.profile_id);
    if (r.historic_player_id) return getAnyPlayerAvatarUrl(r.historic_player_id);
    return null;
  };

  // Auto-play del carrusel cada 5s
  useEffect(() => {
    if (highlightPhotos.length <= 1) return;

    const interval = setInterval(goToNextPhoto, 5000);
    return () => clearInterval(interval);
  }, []);

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

  function getAvailabilityLabel(startTime?: string | null) {
    const start = String(startTime || '').slice(0, 5);

    if (start === '07:00') return 'Morning';
    if (start === '12:00') return 'Afternoon';
    if (start === '18:00') return 'Evening';

    return null;
  }

  function getPlayerAvailabilityMap(slots: AvailabilitySlot[]) {
    const map: Record<string, Record<string, string[]>> = {};

    slots.forEach(slot => {
      const day = days[slot.day_of_week];
      const label = getAvailabilityLabel(slot.start_time);
      if (!day || !label) return;

      if (!map[slot.profile_id]) map[slot.profile_id] = {};
      if (!map[slot.profile_id][day]) map[slot.profile_id][day] = [];
      if (!map[slot.profile_id][day].includes(label)) {
        map[slot.profile_id][day].push(label);
      }
    });

    return map;
  }

  function divisionRank(name?: string | null) {
    const n = (name || '').trim().toLowerCase();

    if (n === 'oro') return 1;
    if (n === 'plata') return 2;
    if (n === 'bronce') return 3;
    if (n === 'cobre') return 4;
    if (n === 'hierro') return 5;
    if (n === 'diamante') return 6;

    return 99;
  }

  function getStandingZone(
    position: number,
    totalPlayers: number,
    division?: Division | null
  ): string {
    if (!division) return '';

    const directPromotion = division.direct_promotion_slots ?? 0;
    const promotionPlayoff = division.promotion_playoff_slots ?? 0;
    const relegationPlayoff = division.relegation_playoff_slots ?? 0;
    const directRelegation = division.direct_relegation_slots ?? 0;

    if (position <= directPromotion) {
      return 'bg-emerald-100 border-l-4 border-emerald-500';
    }

    if (position <= directPromotion + promotionPlayoff) {
      return 'bg-emerald-50 border-l-4 border-emerald-300';
    }

    const directRelegationStart = totalPlayers - directRelegation + 1;
    const relegationPlayoffStart = totalPlayers - directRelegation - relegationPlayoff + 1;

    if (
      relegationPlayoff > 0 &&
      position >= relegationPlayoffStart &&
      position < directRelegationStart
    ) {
      return 'bg-rose-50 border-l-4 border-rose-300';
    }

    if (directRelegation > 0 && position >= directRelegationStart) {
      return 'bg-rose-100 border-l-4 border-rose-500';
    }

    return '';
  }

  function hasDivisionZones(division?: Division | null): boolean {
    if (!division) return false;

    return (
      (division.direct_promotion_slots ?? 0) > 0 ||
      (division.promotion_playoff_slots ?? 0) > 0 ||
      (division.relegation_playoff_slots ?? 0) > 0 ||
      (division.direct_relegation_slots ?? 0) > 0
    );
  }

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

    Object.keys(map).forEach(tournamentId => {
      map[tournamentId] = map[tournamentId]
        .slice()
        .sort((a, b) => {
          const ra = divisionRank(a.name);
          const rb = divisionRank(b.name);

          if (ra !== rb) return ra - rb;
          return (a.name || '').localeCompare((b.name || ''), 'es');
        });
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

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const todayPlus2 = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 2);
    return d;
  })();
  const minDate = formatDate(todayPlus2);

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

  type GroupRow = {
    playerId: string;
    name: string;
    P: number;   // played
    W: number;
    L: number;
    Pts: number;
    SW: number;  // sets won
    SL: number;  // sets lost
    SD: number;  // set diff
    GW: number;  // games won
    GL: number;  // games lost
    GD: number;  // game diff
  };

  // Calcula sets ganados/perdidos del match DESDE LA PERSPECTIVA del playerId
  function setsForPlayer(match: Match, playerId: string) {
    const isHome = match.home_player_id === playerId;

    const sw = isHome ? (match.player1_sets_won ?? 0) : (match.player2_sets_won ?? 0);
    const sl = isHome ? (match.player2_sets_won ?? 0) : (match.player1_sets_won ?? 0);

    return { sw, sl };
  }

  // Suma games por match desde match_sets (p1_games/p2_games) y los adapta a playerId
  function gamesForPlayer(match: Match, playerId: string, matchSets: any[]) {
    const isHome = match.home_player_id === playerId;

    const sets = matchSets
      .filter(s => s.match_id === match.id)
      .sort((a, b) => a.set_number - b.set_number);

    let gw = 0;
    let gl = 0;

    sets.forEach(s => {
      const p1 = Number(s.p1_games ?? 0);
      const p2 = Number(s.p2_games ?? 0);

      if (isHome) {
        gw += p1;
        gl += p2;
      } else {
        gw += p2;
        gl += p1;
      }
    });

    return { gw, gl };
  }

  // Standings de un grupo usando partidos played
  function buildPlacementStandings(groupMatches: Match[], matchSets: any[]) {
    const played = groupMatches.filter(m => m.status === 'played' && getMatchHomeId(m) && getMatchAwayId(m));

    // set de jugadores del grupo (solo los que aparecen en matches)
    const playerIds = Array.from(
      new Set(
        played.flatMap(m => [getMatchHomeId(m), getMatchAwayId(m)].filter(Boolean) as string[])
      )
    );

    const rows: Record<string, GroupRow> = {};

    playerIds.forEach(pid => {
      const p = getAnyPlayerById(pid);
      rows[pid] = {
        playerId: pid,
        name: uiName(p?.name) || 'Unknown',
        P: 0, W: 0, L: 0, Pts: 0,
        SW: 0, SL: 0, SD: 0,
        GW: 0, GL: 0, GD: 0,
      };
    });

    played.forEach(m => {
      const p1 = getMatchHomeId(m)!;
      const p2 = getMatchAwayId(m)!;
      if (!rows[p1] || !rows[p2]) return;

      const p1Sets = setsForPlayer(m, p1);
      const p2Sets = setsForPlayer(m, p2);

      // winner por sets ganados (tu regla actual)
      const p1Win = p1Sets.sw > p1Sets.sl;
      const p2Win = p2Sets.sw > p2Sets.sl;

      rows[p1].P += 1;
      rows[p2].P += 1;

      if (p1Win) {
        rows[p1].W += 1; rows[p1].Pts += 3;
        rows[p2].L += 1;
      } else if (p2Win) {
        rows[p2].W += 1; rows[p2].Pts += 3;
        rows[p1].L += 1;
      } else {
        // en tenis no debería ocurrir, pero por seguridad:
        // rows[p1].Pts += 1; rows[p2].Pts += 1;
      }

      rows[p1].SW += p1Sets.sw;
      rows[p1].SL += p1Sets.sl;
      rows[p2].SW += p2Sets.sw;
      rows[p2].SL += p2Sets.sl;

      const p1Games = gamesForPlayer(m, p1, matchSets);
      const p2Games = gamesForPlayer(m, p2, matchSets);

      rows[p1].GW += p1Games.gw;
      rows[p1].GL += p1Games.gl;
      rows[p2].GW += p2Games.gw;
      rows[p2].GL += p2Games.gl;
    });

    Object.values(rows).forEach(r => {
      r.SD = r.SW - r.SL;
      r.GD = r.GW - r.GL;
    });

    // Orden: Pts desc, SD desc, GD desc, Name asc
    const sorted = Object.values(rows).sort((a, b) => {
      if (b.Pts !== a.Pts) return b.Pts - a.Pts;
      if (b.SD !== a.SD) return b.SD - a.SD;
      if (b.GD !== a.GD) return b.GD - a.GD;
      return a.name.localeCompare(b.name);
    });

    return sorted;
  }


  function scoreLine(m: Match, perspectiveId?: string) {
    // 1) Preferred: match_sets rows (new system)
    const sets = matchSets
      .filter(s => s.match_id === m.id)
      .sort((a, b) => a.set_number - b.set_number);

    // If showing from a player's perspective, invert when the player is not home
    const invert = Boolean(perspectiveId && m.home_player_id !== perspectiveId);

    if (sets.length > 0) {
      return sets
        .map(s => (invert ? `${s.p2_games}-${s.p1_games}` : `${s.p1_games}-${s.p2_games}`))
        .join('  ');
    }

    // 2) Fallback: legacy columns on matches table (old system)
    const legacySets: Array<[number | null, number | null]> = [
      [(m as any).set1_home ?? null, (m as any).set1_away ?? null],
      [(m as any).set2_home ?? null, (m as any).set2_away ?? null],
      [(m as any).set3_home ?? null, (m as any).set3_away ?? null],
    ];

    const legacyLine = legacySets
      .filter(([h, a]) => h !== null && a !== null)
      .map(([h, a]) => (invert ? `${a}-${h}` : `${h}-${a}`))
      .join('  ');

    if (legacyLine) return legacyLine;

    // 3) Last resort: show totals (but this should be rare)
    const g1 = Number((m as any).player1_games_won ?? 0);
    const g2 = Number((m as any).player2_games_won ?? 0);
    if (g1 || g2) return `${invert ? g2 : g1}-${invert ? g1 : g2}`;

    return '';
  }


  function homeAwayBadge(match: Match, playerId: string) {
    const isHome = getMatchHomeId(match) === playerId;
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

  function canEditSchedule(m: Match) {
    if (!currentUser) return false;

    const isPlayer =
      currentUser.id === m.home_player_id ||
      currentUser.id === (m.away_player_id ?? '');

    const isCreator = currentUser.id === m.created_by;
    const isAdmin = (currentUser as any).role === 'admin';

    const canEditUser = isPlayer || isCreator || isAdmin;
    if (!canEditUser) return false;

    // 👇 aquí permitimos también partidos ya jugados
    const editableStatus =
      m.status === 'pending' ||
      m.status === 'scheduled' ||
      m.status === 'played';

    return editableStatus;
  }


  // Determinístico: para un par (a,b) siempre decide quién es Home en esa división/torneo
  function computeHomeForPair(divisionId: string, tournamentId: string, a: string, b: string) {
    function hash(s: string) {
      let h = 0;
      for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    }

    if (!divisionId || !tournamentId || !a || !b) return a;

    const [x, y] = a < b ? [a, b] : [b, a];
    const seed = `${tournamentId}|${divisionId}|${x}|${y}`;
    const h = hash(seed);

    return h % 2 === 0 ? x : y;
  }

  async function fetchAllRows<T>(table: string, selectClause = '*', pageSize = 1000): Promise<T[]> {
    let all: T[] = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from(table)
        .select(selectClause)
        .range(from, to);

      if (error) throw error;

      const chunk = (data || []) as T[];
      all = all.concat(chunk);

      if (chunk.length < pageSize) break; // ya no quedan más filas
      from += pageSize;
    }

    return all;
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
        supabase.from('player_cards').select('*'),
        supabase.from('matches').select('*'),
        supabase.from('v_standings').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('tournament_registrations').select('*'),
        (async () => ({ data: await fetchAllRows<MatchSet>('match_sets'), error: null }))(),
        supabase.from('historic_players').select('*'),
      ];
      if (userId) {
        promises.push(supabase.from('availability').select('*'));
      }

      const responses = await Promise.all(promises);
      for (const res of responses) if (res.error) throw res.error;

      setTournaments(responses[0].data || []);
      setDivisions(responses[1].data || []);
      setProfiles(responses[2].data || []);
      setPlayerCards((responses[3].data || []) as PlayerCard[]);
      setMatches(responses[4].data || []);
      setStandings(responses[5].data || []);
      setLocations(responses[6].data || []);
      setRegistrations(responses[7].data || []);
      setMatchSets(responses[8].data || []);
      setHistoricPlayers((responses[9].data || []) as any);
      if (userId && responses[10]) {
        setAvailabilitySlots(responses[10].data || []);
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

  // --- Datos de reservas automáticas Better ---
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadBookingData = async () => {
      try {
        const [adminsRes, accountsRes, requestsRes] = await Promise.all([
          supabase.from('booking_admins').select('id, profile_id, created_at'),
          supabase
            .from('booking_accounts')
            .select('id,label,env_username_key,env_password_key,owner_profile_id,is_active,created_at')
            .order('label', { ascending: true }),
          supabase
            .from('court_booking_requests')
            .select('*')
            .order('target_date', { ascending: true })
            .order('target_start_time', { ascending: true }),
        ]);

        if (adminsRes.error) throw adminsRes.error;
        if (accountsRes.error) throw accountsRes.error;
        if (requestsRes.error) throw requestsRes.error;

        const adminsData = (adminsRes.data ?? []) as BookingAdmin[];
        const accountsData = (accountsRes.data ?? []) as BookingAccount[];
        const requestsData = (requestsRes.data ?? []) as CourtBookingRequest[];

        const currentUid = session?.user?.id ?? null;
        const currentIsAdmin =
          !!currentUid &&
          (
            currentUser?.role === 'admin' ||
            adminsData.some(a => String(a.profile_id) === String(currentUid))
          );

        const visibleAccounts = currentIsAdmin
          ? accountsData
          : accountsData.filter(
              acc => String(acc.owner_profile_id) === String(currentUid)
            );

        // IMPORTANTE: usa los *mismos* setters que ya tienes en el componente
        setBookingAdmins(adminsData);
        setBookingAccounts(visibleAccounts);
        setCourtRequests(requestsData);
      } catch (err) {
        console.error('loadBookingData error:', err);
      }
    };

    loadBookingData();
  console.log('admins:', bookingAdmins?.length, bookingAdmins?.slice?.(0,3));
  console.log('accounts:', bookingAccounts?.length, bookingAccounts?.slice?.(0,3));
  console.log('requests:', courtRequests?.length, courtRequests?.slice?.(0,3));
  console.log('isBookingAdmin?', isBookingAdmin, 'currentUser:', currentUser?.id);
  }, [session?.user?.id, currentUser?.id, currentUser?.role]);

  const uid: string | null = currentUser?.id ? String(currentUser.id) : null;
  const role: string = currentUser?.role ?? 'user';

  const isBookingAdmin: boolean =
    uid !== null && (
      role === 'admin' ||
      (bookingAdmins?.some?.(a => String(a.profile_id) === uid) === true)
    );

  const visibleBookingAccounts: BookingAccount[] = isBookingAdmin
    ? bookingAccounts
    : bookingAccounts.filter(
        acc => String(acc.owner_profile_id) === String(uid)
      );

  const betterTimeOptions = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
  ];

  const ACTIVE_STATES = ['PENDING','SEARCHING','QUEUED','CREATED'];

  const activeRequests = courtRequests.filter(
    (r) => r.is_active && r.status && ACTIVE_STATES.includes(r.status)
  );
  const historicalRequests = courtRequests.filter(
    (r) => !r.is_active || !r.status || !ACTIVE_STATES.includes(r.status)
  );

  const myActiveRequests = activeRequests.filter(r => r.profile_id === currentUser?.id);
  const myHistoricalRequests = historicalRequests.filter(r => r.profile_id === currentUser?.id);

  const visibleActiveRequests = isBookingAdmin ? activeRequests : myActiveRequests;
  const visibleHistoricalRequests = isBookingAdmin ? historicalRequests : myHistoricalRequests;

  const sortedHistoricalRequests = [...visibleHistoricalRequests].sort((a, b) => {
    const aDateTime = `${a.target_date || ''}T${a.target_start_time || '00:00:00'}`;
    const bDateTime = `${b.target_date || ''}T${b.target_start_time || '00:00:00'}`;

    if (bDateTime !== aDateTime) {
      return bDateTime.localeCompare(aDateTime);
    }

    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });

  const filteredHistoricalRequests = sortedHistoricalRequests.filter(req => {
    if (bookingHistoryStatusFilter === 'all') return true;
    return (req.status || '') === bookingHistoryStatusFilter;
  });

  const limitedHistoricalRequests =
    bookingHistoryLimit === 'all'
      ? filteredHistoricalRequests
      : filteredHistoricalRequests.slice(0, Number(bookingHistoryLimit));

  useEffect(() => {
    if (!newBooking.better_account_id) return;

    const stillVisible = visibleBookingAccounts.some(
      acc => acc.id === newBooking.better_account_id
    );

    if (!stillVisible) {
      setNewBooking(prev => ({
        ...prev,
        better_account_id: visibleBookingAccounts[0]?.id ?? '',
      }));
    }
  }, [visibleBookingAccounts, newBooking.better_account_id]);

  const formatTimeRange = (req: CourtBookingRequest) => {
    const start = req.target_start_time?.slice(0, 5) ?? '';
    const end = req.target_end_time?.slice(0, 5) ?? '';
    return `${start}–${end}`;
  };

  const shortCourt = (name?: string | null) => {
    if (!name) return null;
    const m = /(\d+)$/.exec(name);
    // Si quieres “Court 11” en vez de solo “11”, cambia el return a: `Court ${m ? m[1] : name}`
    return m ? m[1] : name;
  };

  const joinCourtsShort = (
    c1?: string | null,
    c2?: string | null,
    c3?: string | null
  ) => {
    const parts = [shortCourt(c1), shortCourt(c2), shortCourt(c3)].filter(Boolean) as string[];
    return parts.length ? parts.join(', ') : '—';
  };

  const shortStatus = (s?: string | null) => {
    switch (s) {
      case 'SEARCHING': return 'Searching';
      case 'PENDING':   return 'Pending';
      case 'CREATED':   return 'Created';
      case 'BOOKED':    return 'Reservado';
      case 'CANCELLED': return 'Cancelado';
      case 'EXPIRED':   return 'Expirado';
      case 'CLOSED':    return 'Cerrado';
      default:          return s || '—';
    }
  }; 

  async function reloadCourtRequests() {
    const { data, error } = await supabase
      .from('court_booking_requests')
      .select('*')
      .order('target_date', { ascending: true })
      .order('target_start_time', { ascending: true });
    if (error) {
      console.error('Error reloading court_booking_requests', error);
      return;
    }
    setCourtRequests((data as CourtBookingRequest[]) || []);
  }

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookingError(null);

    if (!currentUser) {
      setBookingError('Debes iniciar sesión para crear una reserva automática.');
      return;
    }
    if (!isBookingAdmin && visibleBookingAccounts.length === 0) {
      setBookingError('No tienes una cuenta Better disponible para crear reservas automáticas.');
      return;
    }

    const selectedBookingAccount = visibleBookingAccounts.find(
      acc => acc.id === newBooking.better_account_id
    );

    if (!isBookingAdmin && !selectedBookingAccount) {
      setBookingError('La cuenta Better seleccionada no te pertenece.');
      return;
    }
    if (!newBooking.better_account_id) {
      setBookingError('Selecciona una cuenta Better.');
      return;
    }
    if (!newBooking.target_date) {
      setBookingError('Selecciona la fecha en que quieres jugar.');
      return;
    }

    try {
      setSavingBooking(true);

      // target_date 'YYYY-MM-DD'
      const targetDateStr = newBooking.target_date;
      const startHHMM = newBooking.start_time; // '19:00'
      const [hStr, mStr] = startHHMM.split(':');
      const h = parseInt(hStr, 10);
      const endH = h + 1;
      const endHHMM = `${endH.toString().padStart(2, '0')}:${mStr}`;

      // target_start_time / end_time en formato 'HH:MM:SS'
      const target_start_time = `${startHHMM}:00`;
      const target_end_time = `${endHHMM}:00`;

      // search_start_date = target_date - 7 días (en fecha local, sin UTC para evitar desfase BST)
      const [yy, mm, dd] = targetDateStr.split('-').map(n => parseInt(n, 10));
      const baseDate = new Date(yy, mm - 1, dd);
      baseDate.setDate(baseDate.getDate() - 7);

      const search_start_date = [
        baseDate.getFullYear(),
        String(baseDate.getMonth() + 1).padStart(2, '0'),
        String(baseDate.getDate()).padStart(2, '0'),
      ].join('-');

      const bookingVenueCfg = getBookingVenueConfig(newBooking.activity_slug);

      const normCourt = (s?: string | null) => {
        if (!s) return null;

        const t = s.trim();
        if (!t) return null;

        const match = t.match(/^Court\s*(\d+)$/i);
        if (match) {
          const courtNum = match[1];
          const found = bookingVenueCfg.courtOptions.find(
            c => c.short.toLowerCase() === `court ${courtNum}`.toLowerCase()
          );
          return found?.full ?? t;
        }

        return t;
      };

      const insertPayload = {
        profile_id: currentUser.id,
        better_account_id:
          newBooking.better_account_id && newBooking.better_account_id.trim() !== ''
            ? newBooking.better_account_id
            : null,
        venue_slug: newBooking.venue_slug,
        activity_slug: newBooking.activity_slug,
        target_date: targetDateStr,
        target_start_time,
        target_end_time,
        search_start_date,
        search_window_start_time: '21:00:00',
        search_window_end_time: '23:00:00',
        preferred_court_name_1: normCourt(newBooking.preferred_court_name_1),
        preferred_court_name_2: normCourt(newBooking.preferred_court_name_2),
        preferred_court_name_3: normCourt(newBooking.preferred_court_name_3),
        status: 'PENDING',
        booked_court_name: null,
        booked_slot_start: null,
        booked_slot_end: null,
        last_run_at: null,
        attempt_count: 0,
        last_error: null,
        is_active: true,
      };

      const { error } = await supabase
        .from('court_booking_requests')
        .insert(insertPayload)
        .single();

      if (error) {
        console.error('Error inserting court_booking_request', error);
        setBookingError(error.message || 'Error creando la reserva.');
        return;
      }

      // refrescamos lista
      await reloadCourtRequests();

      // reseteamos el formulario (dejamos misma cuenta/venue/actividad)
      setNewBooking((prev) => ({
        ...prev,
        target_date: '',
        start_time: '19:00',
      }));

      alert('Reserva automática creada correctamente.');
    } catch (err: any) {
      console.error(err);
      setBookingError(err.message || String(err));
    } finally {
      setSavingBooking(false);
    }
  }

  async function handleCancelBooking(req: CourtBookingRequest) {
    if (!isBookingAdmin && currentUser?.id !== req.profile_id) {
      alert('Solo el creador o un admin puede cancelar esta reserva.');
      return;
    }
    if (!window.confirm('¿Seguro que quieres cancelar esta reserva automática?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('court_booking_requests')
        .update({ is_active: false, status: 'CANCELLED' })
        .eq('id', req.id);
      if (error) {
        console.error('Error cancelling court_booking_request', error);
        alert(error.message || 'No se pudo cancelar la reserva.');
        return;
      }

      await reloadCourtRequests();
      alert('Reserva cancelada.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || String(err));
    }
  }


  // Load all initial data from Supabase
  const loadInitialData = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all required data
      const [tournamentsRes, divisionsRes, locationsRes, profilesRes, playerCardsRes,
        registrationsRes, matchesRes, standingsRes, matchSetsRes, historicPlayersRes, availabilityRes] =
        await Promise.all([
          supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
          supabase.from('divisions').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('profiles').select('*'),
          supabase.from('player_cards').select('*'),
          supabase.from('tournament_registrations').select('*'),
          supabase.from('matches').select('*'),
          supabase.from('v_standings').select('*'),
          (async () => ({ data: await fetchAllRows<MatchSet>('match_sets'), error: null }))(),
          supabase.from('historic_players').select('*'),
          supabase.from('availability').select('*')
        ]);

      // Handle errors
      if (tournamentsRes.error) throw tournamentsRes.error;
      if (divisionsRes.error) throw divisionsRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (playerCardsRes.error) throw playerCardsRes.error;
      if (registrationsRes.error) throw registrationsRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (standingsRes.error) throw standingsRes.error;
      if (matchSetsRes.error) throw matchSetsRes.error;
      if (historicPlayersRes.error) throw historicPlayersRes.error;
      if (availabilityRes.error) throw availabilityRes.error;

      // Set state
      setTournaments(tournamentsRes.data as Tournament[]);
      setDivisions(divisionsRes.data as Division[]);
      setLocations(locationsRes.data as Location[]);
      setProfiles(profilesRes.data as Profile[]);
      setPlayerCards((playerCardsRes.data || []) as PlayerCard[]);
      setRegistrations(registrationsRes.data as Registration[]);
      setMatches(matchesRes.data as Match[]);
      setStandings(standingsRes.data as Standings[]);
      setMatchSets(matchSetsRes.data || []);
      setHistoricPlayers((historicPlayersRes.data || []) as any);
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
    setPlayerProfileTab('overview');
    setEditingPlayerCard(false);
    setPlayerCardSaveMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' }); //cambiar a window.scrollTo(0, 0); para quitar animación
  }, [selectedPlayer?.id]);

  useEffect(() => {
    if (!selectedPlayer) {
      setSelectedPlayerAvailability([]);
      setSelectedPlayerAreas([]);
      return;
    }

    (async () => {
      const { data: av, error: avErr } = await supabase
        .from('availability')
        .select('*')
        .eq('profile_id', selectedPlayer.id);

      if (!avErr) {
        setSelectedPlayerAvailability((av || []) as AvailabilitySlot[]);
      }

      const { data: pls, error: plsErr } = await supabase
        .from('profile_locations')
        .select('location_id')
        .eq('profile_id', selectedPlayer.id);

      if (!plsErr && pls) {
        const names = pls
          .map((pl: any) => locations.find(l => l.id === pl.location_id)?.name)
          .filter((n): n is string => Boolean(n));

        setSelectedPlayerAreas(names);
      } else {
        setSelectedPlayerAreas([]);
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
      if (!newUser.name || !newUser.email) return alert('Por favor completa nombre y email.');
      setRegistrationStep(2);
      return;
    }
    if (registrationStep === 2) {
      if (!newUser.profilePic) return alert('Por favor sube una foto de perfil.');
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
          throw new Error('Por favor selecciona un torneo, división e ingresa una contraseña.');
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
      // 1) preparar sets para el RPC y contar sets ganados
      let p1SetsWon = 0;
      let p2SetsWon = 0;

      const setsForRPC = (editedMatchData?.sets || [])
        .filter(s => s.score1 !== '' && s.score2 !== '')
        .map((s, idx) => {
          const p1 = parseInt(s.score1, 10);
          const p2 = parseInt(s.score2, 10);

          if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
            if (p1 > p2) p1SetsWon += 1;
            else if (p2 > p1) p2SetsWon += 1;
          }

          return {
            set_number: idx + 1,
            p1_games: p1,
            p2_games: p2,
          };
        });

      // 2) ejecutar tu RPC existente
      const { error: rpcErr } = await supabase.rpc('update_match_result', {
        p_match_id: editingMatch.id,
        p_sets: setsForRPC,
        p_had_pint: editedMatchData.hadPint,
        p_pints_count: editedMatchData.pintsCount,
      });
      if (rpcErr) throw rpcErr;

      // 3) forzar status = 'played'
      const { error: upErr } = await supabase
        .from('matches')
        .update({
          status: 'played',
          anecdote: editedMatchData.anecdote?.trim() || null,
        })
        .eq('id', editingMatch.id)
        .select('id')
        .single();
      if (upErr) throw upErr;

      // 🔹 SOLO PARA KO: avanzar ganador ANTES del fetchData
      if (selectedTournament?.format === 'knockout') {
        await advanceWinner(
          {
            ...editingMatch,
            status: 'played',
            player1_sets_won: p1SetsWon,
            player2_sets_won: p2SetsWon,
          } as Match,
          supabase
        );
      }

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

    function openEditResult(m: Match) {
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
      pintsCount: '1',
      anecdote: '',
    });

    setEditingMatch(m);
  }


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
      alert("¡Se envió el enlace para restablecer contraseña! Por favor revisa tu email.");

    } catch (err: any) {
      alert(`Error: ${err.message}`);
      console.error("Password reset error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    if (!newRegistration.tournamentId || !newRegistration.divisionId) {
      return alert('Por favor selecciona un torneo y una división.');
    }
    if (!currentUser) {
      return alert('No se pudo encontrar el usuario actual. Por favor inicia sesión de nuevo.');
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

      alert('¡Te registraste exitosamente en el nuevo torneo!');
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
      .select('id,name,season,start_date,end_date,status,format,sort_order')
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: false });

    if (tErr) throw tErr;

    const { data: ds, error: dErr } = await supabase
      .from('divisions')
      .select('*');
    if (dErr) throw dErr;

    setTournaments(ts || []);
    setDivisions(ds || []);

    const map: Record<string, Division[]> = {};
    (ds || []).forEach(d => {
      (map[d.tournament_id] ||= []).push(d);
    });

    Object.keys(map).forEach(tournamentId => {
      map[tournamentId] = map[tournamentId]
        .slice()
        .sort((a, b) => {
          const ra = divisionRank(a.name);
          const rb = divisionRank(b.name);

          if (ra !== rb) return ra - rb;
          return (a.name || '').localeCompare((b.name || ''), 'es');
        });
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
    setShowBuscarClases(false);
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

  const goToMyPlayerProfile = () => {
    if (!currentUser) return;

    const latestTournament = getLatestTournamentForUser(currentUser.id);
    if (!latestTournament) {
      alert('No se encontraron torneos para este jugador aún.');
      return;
    }
    
    const reg = registrations.find(
      r =>
        r.profile_id === currentUser.id &&
        r.tournament_id === latestTournament.id
    );

    if (!reg) {
      alert('No se encontró división para este jugador aún.');
      return;
    }

    const division = divisions.find(d => d.id === reg.division_id);
    if (!division) {
      alert('División no encontrada.');
      return;
    }

    setSelectedTournament(latestTournament);
    setSelectedDivision(division);
    setSelectedPlayer(currentUser);
    setPlayerProfileTab('overview');
    setEditingPlayerCard(false);
    setPlayerCardSaveMessage('');
    window.scrollTo(0, 0);
  };

  // Navigate to the current user's active division (latest tournament)
  const goToMyDivision = () => {
    if (!currentUser) return;
    const latestTournament = getLatestTournamentForUser(currentUser.id);
    if (!latestTournament) return;
    const reg = registrations.find(
      r => r.profile_id === currentUser.id && r.tournament_id === latestTournament.id
    );
    if (!reg) return;
    const division = divisions.find(d => d.id === reg.division_id);
    if (!division) return;
    setSelectedTournament(latestTournament);
    setSelectedDivision(division);
    setSelectedPlayer(null);
    setShowNavMenu(false);
    window.scrollTo(0, 0);
  };

  // ── Nav Menu ──────────────────────────────────────────────────────────────
  const renderNavMenu = () => {
    if (!currentUser || !showNavMenu) return null;

    const hasActiveDivision = (() => {
      const t = getLatestTournamentForUser(currentUser.id);
      if (!t) return false;
      return registrations.some(r => r.profile_id === currentUser.id && r.tournament_id === t.id);
    })();

    const menuItem = (
      icon: React.ReactNode,
      label: string,
      onClick: () => void,
      className = ''
    ) => (
      <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all hover:bg-white/10 active:scale-[0.98] ${className}`}
      >
        <span className="w-6 h-6 flex items-center justify-center shrink-0 opacity-80">{icon}</span>
        <span>{label}</span>
      </button>
    );

    const divider = () => <div className="my-1 h-px bg-white/10 mx-2" />;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNavMenu(false)}
          aria-hidden="true"
        />

        {/* Drawer panel */}
        <div className="fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] flex flex-col bg-gradient-to-b from-green-800 via-emerald-800 to-green-900 shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img
                src={avatarSrc(currentUser)}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                alt="avatar"
                className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30"
              />
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{uiName(currentUser.name)}</p>
                <p className="text-white/60 text-xs truncate">{currentUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNavMenu(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu items */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 text-white">

            {/* Primary */}
            {menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="7" r="4"/><path d="M6 21c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round"/></svg>,
              'Mi Perfil',
              () => { openEditProfile(); setShowNavMenu(false); }
            )}

            {hasActiveDivision && menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" opacity="0.4"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
              'Ir a mi División',
              goToMyDivision
            )}

            {divider()}

            {/* Back to home */}
            {menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V10"/></svg>,
              'Menú principal',
              () => {
                setSelectedTournament(null);
                setSelectedDivision(null);
                setSelectedPlayer(null);
                setShowHallOfFameView(false);
                setShowHistoricTournaments(false);
                setShowMap(false);
                setShowBuscarClases(false);
                setShowBookingPanel(false);
                setCameFromHistoric(false);
                setShowNavMenu(false);
                window.scrollTo(0, 0);
              }
            )}

            {divider()}

            {/* Tournaments */}
            {menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
              'Torneos Históricos',
              () => { setShowHistoricTournaments(true); setShowNavMenu(false); }
            )}

            {menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z"/></svg>,
              'Salón de la Fama',
              () => { setShowHallOfFameView(true); setHallOfFameTournamentFilter('all'); setHallOfFameDivisionFilter('all'); setShowNavMenu(false); }
            )}

            {divider()}

            {/* Tools */}
            {menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>,
              'Encontrar Cancha',
              () => { setShowMap(true); setShowNavMenu(false); }
            )}

            {currentUser.id === BUSCAR_CLASES_ALLOWED_ID && menuItem(
              <span className="text-base">🎾</span>,
              'Buscar Clases',
              () => { setShowBuscarClases(true); setShowNavMenu(false); }
            )}

            {(isBookingAdmin || visibleBookingAccounts.length > 0) && menuItem(
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>,
              'Reservas automáticas',
              () => { setShowBookingPanel(true); setShowMap(false); setSelectedTournament(null); setSelectedDivision(null); setSelectedPlayer(null); setShowNavMenu(false); }
            )}

            {divider()}

            {/* Secondary */}
            {menuItem(
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 3a5 5 0 110 10 5 5 0 010-10zm0 2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM17.5 6a1 1 0 110 2 1 1 0 010-2z"/></svg>,
              '@pintapostchampionship',
              () => { window.open('https://instagram.com/pintapostchampionship', '_blank', 'noopener,noreferrer'); setShowNavMenu(false); }
            )}

          </nav>

          {/* Join at bottom — above logout divider */}
          <div className="px-3 pt-2 pb-1">
            <button
              type="button"
              onClick={() => { setShowJoinModal(true); setShowNavMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              <span>Unirse a un Torneo</span>
            </button>
          </div>

          {/* Logout */}
          <div className="px-3 pb-5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 16l-4-4m0 0l4-4m-4 4h11"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h4a2 2 0 002-2v-2"/>
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>

        {/* Logout confirmation modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 16l-4-4m0 0l4-4m-4 4h11"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h4a2 2 0 002-2v-2"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">¿Cerrar sesión?</p>
                  <p className="text-sm text-gray-500">Tendrás que volver a iniciar sesión.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLogoutConfirm(false); setShowNavMenu(false); handleLogout(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
                >
                  Sí, salir
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
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
      alert('¡Perfil actualizado exitosamente!');

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
        alert('El mensaje es demasiado largo para compartir por WhatsApp. Se copió al portapapeles. Por favor pégalo manualmente en WhatsApp.');
      } catch (err) {
        alert('No se pudo copiar al portapapeles. Por favor copia manualmente el mensaje y pégalo en WhatsApp.');
      }
      document.body.removeChild(textArea);
    }
  };

  function safeShareOnWhatsApp(message: string) {
    const MAX_LENGTH = 4000; // Límite seguro para la mayoría de las plataformas

    // 1. Si el mensaje es muy largo, lo copiamos y avisamos al usuario.
    if (message.length > MAX_LENGTH) {
      navigator.clipboard.writeText(message).then(() => {
        alert('La lista de partidos es demasiado larga para compartir directamente. Se copió al portapapeles. Por favor pégala en WhatsApp.');
      }).catch(() => {
        alert('La lista de partidos es demasiado larga para compartir directamente y no se pudo copiar. Por favor intenta copiarla manualmente.');
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
      'Anita Lizana': '⭐',
      'Serena Williams': '⭐',
      };

    if (name.includes('Calibración')) return '🔥';

    return map[name] || '🏆';
  }

  function tournamentLogoSrc(name: string) {
    if (/^PPC Winter/i.test(name)) return '/ppc-logo.png';            // PPC Winter 2025/2026
    if (/^WPPC Winter/i.test(name)) return '/wppc-logo-transparente.png';          // WPPC Winter 2025/2026
    if (/PPC Cup/i.test(name)) return '/ppc-cup-trophy-transparente.png';          // PPC Cup 2025
    return '/ppc-logo.png';
  }

  function isCupTournament(t: Tournament) {
    return t.format === 'knockout' || /cup/i.test(t.name);
  }

  function getLatestTournamentForUser(profileId: string) {
    const userTournaments = registrations
      .filter(r => r.profile_id === profileId)
      .map(r => tournaments.find(t => t.id === r.tournament_id))
      .filter(Boolean) as Tournament[];

    // Excluir Cups (PPC Cup, etc.)
    const nonCup = userTournaments.filter(t => !isCupTournament(t));

    // Preferir activos
    const activeNonCup = nonCup.filter(t => t.status === 'active');

    const candidates = activeNonCup.length
      ? activeNonCup
      : (nonCup.length ? nonCup : userTournaments);

    if (candidates.length === 0) return null;

    // Orden: activos primero (por si acaso), luego start_date desc, luego sort_order desc
    const sorted = [...candidates].sort((a, b) => {
      const aActive = a.status === 'active' ? 1 : 0;
      const bActive = b.status === 'active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      const byStart = (b.start_date || '').localeCompare(a.start_date || '');
      if (byStart !== 0) return byStart;

      return (b.sort_order ?? 0) - (a.sort_order ?? 0);
    });

    return sorted[0];
  }

  const currentUserLatestTournamentName = currentUser
    ? (getLatestTournamentForUser(currentUser.id)?.name || 'No tournaments')
    : 'No tournaments';

  const getChampionProfileById = (playerId?: string | null) => {
    if (!playerId) return null;
    return profiles.find(p => p.id === playerId)
      || historicPlayers.find(p => p.id === playerId)
      || null;
  };

  const getHallOfFameWinnerForDivision = (tournamentId: string, divisionId: string) => {
    const finalsMainMatches = matches.filter(m =>
      m.tournament_id === tournamentId &&
      m.division_id === divisionId &&
      m.phase === 'finals_main' &&
      m.knockout_round === 'F' &&
      m.status === 'played'
    );

    const finalMatch = finalsMainMatches[0];

    if (finalMatch) {
      const winnerId =
        finalMatch.player1_sets_won > finalMatch.player2_sets_won
          ? getMatchHomeId(finalMatch)
          : finalMatch.player2_sets_won > finalMatch.player1_sets_won
          ? getMatchAwayId(finalMatch)
          : null;

      if (winnerId) {
        const winner = getChampionProfileById(winnerId);
        if (winner) return winner;
      }
    }

    const divisionStandings = standings
      .filter(s => s.tournament_id === tournamentId && s.division_id === divisionId)
      .slice()
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.set_diff !== a.set_diff) return b.set_diff - a.set_diff;

        const aGamesDiff = (a.games_won || 0) - (a.games_lost || 0);
        const bGamesDiff = (b.games_won || 0) - (b.games_lost || 0);
        if (bGamesDiff !== aGamesDiff) return bGamesDiff - aGamesDiff;

        return (a.name || '').localeCompare(b.name || '');
      });

    const firstPlace = divisionStandings[0];
    if (!firstPlace?.profile_id) return null;

    return getChampionProfileById(firstPlace.profile_id);
  };

  const getHallOfFameDivisionSortRank = (name?: string | null) => {
    const n = (name || '').trim().toLowerCase();

    if (n === 'oro') return 1;
    if (n === 'plata') return 2;
    if (n === 'bronce') return 3;
    if (n === 'cobre') return 4;
    if (n === 'hierro') return 5;
    if (n === 'diamante') return 6;

    if (n === 'anita lizana') return 20;
    if (n === 'serena williams') return 21;
    if (n === 'élite') return 22;
    if (n === 'élite 1') return 23;
    if (n === 'élite 2') return 24;

    return 99;
  };

  const hallOfFameEntries = tournaments
    .filter(t => t.status === 'closed' || t.status === 'completed' || t.status === 'finished')
    .filter(t => !isCalibrationTournamentByName(t.name))
    .flatMap(tournament => {
      const tournamentDivisions = divisions
        .filter(d => d.tournament_id === tournament.id)
        .slice()
        .sort((a, b) => {
          const rankA = getHallOfFameDivisionSortRank(a.name);
          const rankB = getHallOfFameDivisionSortRank(b.name);
          if (rankA !== rankB) return rankA - rankB;
          return (a.name || '').localeCompare(b.name || '', 'es');
        });

      return tournamentDivisions
        .map(division => {
          const winner = getHallOfFameWinnerForDivision(tournament.id, division.id);
          if (!winner) return null;

          return {
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            tournamentEndDate: tournament.end_date || tournament.start_date || '',
            divisionId: division.id,
            divisionName: division.name,
            winnerId: winner.id,
            winnerName: winner.name || '—',
            winnerAvatar: ('avatar_url' in winner ? winner.avatar_url : null) || null,
          };
        })
        .filter(Boolean) as Array<{
          tournamentId: string;
          tournamentName: string;
          tournamentEndDate: string;
          divisionId: string;
          divisionName: string;
          winnerId: string;
          winnerName: string;
          winnerAvatar: string | null;
        }>;
    })
    .filter(entry =>
      hallOfFameTournamentFilter === 'all' || entry.tournamentId === hallOfFameTournamentFilter
    )
    .filter(entry =>
      hallOfFameDivisionFilter === 'all' ||
      entry.divisionName.trim().toLowerCase() === hallOfFameDivisionFilter
    )
    .sort((a, b) => {
      const byDate = (b.tournamentEndDate || '').localeCompare(a.tournamentEndDate || '');
      if (byDate !== 0) return byDate;

      const byTournament = a.tournamentName.localeCompare(b.tournamentName, 'es');
      if (byTournament !== 0) return byTournament;

      return getHallOfFameDivisionSortRank(a.divisionName) - getHallOfFameDivisionSortRank(b.divisionName);
    });

  const hallOfFameTournamentOptions = tournaments
    .filter(t => t.status === 'closed' || t.status === 'completed' || t.status === 'finished')
    .filter(t => !isCalibrationTournamentByName(t.name))
    .slice()
    .sort((a, b) => (b.end_date || b.start_date || '').localeCompare(a.end_date || a.start_date || ''));

  const hallOfFameDivisionOptions = Array.from(
    new Map(
      divisions
        .filter(d => {
          const tournament = tournaments.find(t => t.id === d.tournament_id);
          return tournament && !isCalibrationTournamentByName(tournament.name);
        })
        .map(d => [(d.name || '').trim().toLowerCase(), { id: (d.name || '').trim().toLowerCase(), name: d.name }])
    ).values()
  ).sort((a, b) => {
    const ra = getHallOfFameDivisionSortRank(a.name);
    const rb = getHallOfFameDivisionSortRank(b.name);
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '', 'es');
  });


  if (showHallOfFameView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-100 text-slate-900">

        {/* ── Header ── */}
        <header className="bg-white shadow-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/ppc-logo.png" alt="PPC Logo" className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain" />
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHallOfFameView(false);
                      setSelectedTournament(null);
                      setSelectedDivision(null);
                      setSelectedPlayer(null);
                    }}
                    className="text-amber-600 hover:text-amber-800 font-semibold text-sm mb-0.5 flex items-center gap-1"
                  >
                    ← Volver al menú principal
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">🏆 Salón de la Fama</h1>
                  <p className="text-gray-600">Pinta Post Championship</p>
                </div>
              </div>
              {currentUser && (
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="truncate text-sm text-gray-600">{currentUserLatestTournamentName}</p>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      aria-label="Ir a mi perfil"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {renderNavMenu()}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* ── Filters ── */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <select
              value={hallOfFameTournamentFilter}
              onChange={(e) => setHallOfFameTournamentFilter(e.target.value)}
              className="w-full sm:w-auto min-w-[240px] px-4 py-2.5 rounded-xl bg-white text-slate-900 border border-amber-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="all">Todos los torneos</option>
              {hallOfFameTournamentOptions.map(tournament => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>

            <select
              value={hallOfFameDivisionFilter}
              onChange={(e) => setHallOfFameDivisionFilter(e.target.value)}
              className="w-full sm:w-auto min-w-[220px] px-4 py-2.5 rounded-xl bg-white text-slate-900 border border-emerald-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="all">Todas las divisiones</option>
              {hallOfFameDivisionOptions.map(division => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
          </div>

          {/* ── Grid / empty state ── */}
          {hallOfFameEntries.length === 0 ? (
            <div className="rounded-2xl border border-amber-100 bg-white/90 p-10 text-center shadow-sm">
              <p className="text-3xl mb-3">🏆</p>
              <p className="text-slate-700 font-medium">No se encontraron campeones</p>
              <p className="text-slate-500 text-sm mt-1">Prueba a cambiar los filtros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {hallOfFameEntries.map(entry => {
                const dc = divisionColors(entry.divisionName);
                return (
                <div
                  key={`${entry.tournamentId}-${entry.divisionId}`}
                  className={`group relative overflow-hidden rounded-[26px] border bg-white shadow-[0_16px_45px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1 ${dc.cardBorder}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${dc.barGradient}`} />
                  <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl ${dc.blurTop}`} />
                  <div className={`absolute -bottom-10 -left-10 w-36 h-36 rounded-full blur-2xl ${dc.blurBottom}`} />

                  <div className="relative p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                        <img
                          src={divisionLogoSrc(entry.divisionName)}
                          alt={`${entry.divisionName} logo`}
                          className="max-h-[42px] max-w-[42px] object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 mb-1">
                          Campeón
                        </p>
                        <h3 className="text-xl font-bold text-slate-900 leading-tight">
                          {entry.tournamentName}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          División {entry.divisionName}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <div className={`relative w-28 h-28 rounded-full overflow-hidden border-4 border-white mb-4 bg-slate-100 shadow-[${dc.avatarShadow}]`}>
                        <div className={`absolute inset-0 rounded-full ring-4 ${dc.ringColor}`} />
                        <img
                          src={entry.winnerAvatar || '/default-avatar.png'}
                          alt={entry.winnerName}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <h4 className="text-lg font-bold text-slate-900">
                        {uiName(entry.winnerName)}
                      </h4>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        {renderNotifs()}
      </div>
    );
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
    if (!session?.user) {
      alert('Debes iniciar sesión.');
      return;
    }
    const uid = session.user.id;

    // 1) No puedes unirte a tu propio pendiente
    if (m.home_player_id === uid) {
      alert('No puedes unirte a tu propio aviso de partido.');
      return;
    }

    // 2) Debe seguir pendiente y sin rival asignado
    if (m.status !== 'pending') {
      alert('Este partido ya no está pendiente.');
      return;
    }
    if (m.away_player_id) {
      alert('Este partido ya tiene rival asignado.');
      return;
    }

    // 3) Bloquear si ya existe scheduled/played entre creador y quien intenta unirse
    const yaHayPartido = hasAnyMatchBetween(
      m.tournament_id,
      m.division_id,
      m.home_player_id!, // creador del pending
      uid,
      ['scheduled', 'played']
    );
    if (yaHayPartido) {
      alert('Ya existe un partido agendado o jugado entre ustedes en esta división/torneo.');
      return;
    }

    // 4) Asignar rival y pasar a scheduled
    const { error } = await supabase
      .from('matches')
      .update({
        away_player_id: uid,
        status: 'scheduled',
      })
      .eq('id', m.id);

    if (error) {
      console.error(error);
      alert('No fue posible unirse al partido. Intenta de nuevo.');
      return;
    }

    await fetchData(session.user.id);
    alert('Te uniste al partido. ¡Suerte!');
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

  // ✅ Head-to-head global (ALL tournaments) desde la perspectiva de playerA
  function h2hWL(playerAId: string, playerBId: string) {
    if (!playerAId || !playerBId) return { w: 0, l: 0 };

    const playedBetween = matches.filter(m =>
      isOfficialMatchByTournamentId(m, tournaments) &&
      m.status === 'played' &&
      (
        (m.home_player_id === playerAId && m.away_player_id === playerBId) ||
        (m.home_player_id === playerBId && m.away_player_id === playerAId)
      )
    );

    let w = 0;
    let l = 0;

    playedBetween.forEach(m => {
      const homeWins = (m.player1_sets_won ?? 0) > (m.player2_sets_won ?? 0);
      const awayWins = (m.player2_sets_won ?? 0) > (m.player1_sets_won ?? 0);

      if (!homeWins && !awayWins) return;

      const aIsHome = m.home_player_id === playerAId;

      if (aIsHome) {
        if (homeWins) w++;
        else l++;
      } else {
        if (awayWins) w++;
        else l++;
      }
    });

    return { w, l };
  }


  const shareAllScheduledMatches = () => {
    // 1) Torneos activos
    const active = tournaments.filter(t => t.status === 'active');

    // 2) Orden WPPC → PPC → PPC Cup (por nombre)
    const orderTournament = (t: Tournament) => {
      const n = (t.name || '').toLowerCase();
      if (n.includes('wppc')) return 0;
      if (n.includes('ppc cup')) return 2;
      return 1; // PPC (hombres) por defecto
    };

    const ordered = [...active].sort((a, b) => orderTournament(a) - orderTournament(b));

    // 3) Partido agendado desde hoy en adelante, agrupado por torneo
    const blocks: string[] = [];

    ordered.forEach(t => {
      const all = matches
        .filter(m =>
          m.tournament_id === t.id &&
          m.status === 'scheduled' &&
          isTodayOrFuture(m.date)
        )
        .sort((a, b) => parseYMDLocal(a.date).getTime() - parseYMDLocal(b.date).getTime());

      if (all.length === 0) return; // no mostramos torneo sin partidos

      // Agrupar por fecha (misma lógica tuya)
      const grouped = all.reduce((acc, match) => {
        const key = dateKey(match.date);
        (acc[key] ||= []).push(match);
        return acc;
      }, {} as Record<string, Match[]>);

      // Construir bloque del torneo
      let msg = `*${t.name}*\n\n`;

      Object.keys(grouped).sort().forEach(date => {
        msg += `*${tituloFechaEs(date)}*\n`;
        grouped[date].forEach(m => {
          const p1 = displayNameForShare(m.home_player_id);
          const p2 = displayNameForShare(m.away_player_id ?? '');

          const divName = divisions.find(d => d.id === m.division_id)?.name || '';
          const icon = divisionIcon(divName);

          const { w, l } = h2hWL(m.home_player_id, m.away_player_id ?? '');
          msg += `• ${p1} vs ${p2} (${w}-${l}) ${icon}\n`;
        });
        msg += '\n';
      });

      blocks.push(msg.trimEnd());
    });

    if (blocks.length === 0) return alert('No hay partidos programados para compartir');

    const siteUrl = window.location.origin;
    const finalMsg = blocks.join('\n\n') + `\n\n${siteUrl}`;

    safeShareOnWhatsApp(finalMsg);
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
      alert('Porfavor ingresa al menos un set con puntajes válidos.');
      return;
    }

    // 2) Validación jugadores (IDs)
    const player1Id = newMatch.player1;
    const player2Id = newMatch.player2;
    if (!player1Id) {
      alert('Selecciona el Jugador 1');
      return;
    }

    // Asegura que existan en la división actual
    const playersInDiv = getDivisionPlayers(selectedDivision!.id, selectedTournament!.id);
    const isValidP1 = playersInDiv.some(p => p.id === player1Id);
    const isValidP2 = playersInDiv.some(p => p.id === player2Id);
    if (!isValidP1 || !isValidP2) {
      alert('Jugadores no se encuentran dentro de la división/torneo seleccionados.');
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
      /** Buscar un match SCHEDULED o PENDING entre estos jugadores (independiente del orden) */
      const existing = matches.find(m =>
        m.tournament_id === tournamentId &&
        m.division_id === divisionId &&
        (m.status === 'scheduled' || m.status === 'pending') &&
        (
          (m.home_player_id === player1Id && m.away_player_id === player2Id) ||
          (m.home_player_id === player2Id && m.away_player_id === player1Id)
        )
      );

      let matchId: string;

      if (existing) {
        // Mapear los totales de sets/games a "home/away" del match existente
        const p1IsHome = existing.home_player_id === player1Id;

        const homeSetsWon = p1IsHome ? p1SetsWon : p2SetsWon;
        const awaySetsWon = p1IsHome ? p2SetsWon : p1SetsWon;
        const homeGames   = p1IsHome ? p1Games   : p2Games;
        const awayGames   = p1IsHome ? p2Games   : p1Games;

        // 7-a) UPDATE del match existente -> played + totales + pintas
        const { data: updated, error: upErr } = await supabase
          .from('matches')
          .update({
            status: 'played',
            // totales orientados a home/away del match existente
            player1_sets_won: homeSetsWon,
            player2_sets_won: awaySetsWon,
            player1_games_won: homeGames,
            player2_games_won: awayGames,
            // pintas (si marcaste hadPint lo aplicamos simétrico como venías haciendo)
            player1_had_pint: newMatch.hadPint,
            player2_had_pint: newMatch.hadPint,
            player1_pints: newMatch.hadPint ? Number(newMatch.pintsCount) : 0,
            player2_pints: newMatch.hadPint ? Number(newMatch.pintsCount) : 0,
            // opcional: guarda location_details si lo llenaron aquí
            location_id: locationId,
            location_details: newMatch.location_details || existing.location_details,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (upErr) throw upErr;
        matchId = updated.id;

        // 8-a) Borrar sets previos y reinsertar según los nuevos scores
        const { error: delErr } = await supabase.from('match_sets').delete().eq('match_id', matchId);
        if (delErr) throw delErr;

        for (let i = 0; i < newMatch.sets.length; i++) {
          const s = newMatch.sets[i];
          if (s.score1 !== '' && s.score2 !== '') {
            const a = parseInt(s.score1, 10);
            const b = parseInt(s.score2, 10);
            // Orientamos los juegos del set a home/away del match EXISTENTE
            const homeGamesSet = p1IsHome ? a : b;
            const awayGamesSet = p1IsHome ? b : a;

            const { error: setErr } = await supabase.from('match_sets').insert({
              match_id: matchId,
              set_number: i + 1,
              p1_games: homeGamesSet,
              p2_games: awayGamesSet,
            });
            if (setErr) throw setErr;
          }
        }
      } else {
        // === Flujo original: no existe scheduled/pending -> crear match PLAYED nuevo ===
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
            player1_pints: newMatch.hadPint ? Number(newMatch.pintsCount) : 0,
            player2_pints: newMatch.hadPint ? Number(newMatch.pintsCount) : 0,
            created_by: session?.user.id,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        if (matchError) throw matchError;

        matchId = matchData.id;

        for (let i = 0; i < newMatch.sets.length; i++) {
          const s = newMatch.sets[i];
          if (s.score1 !== '' && s.score2 !== '') {
            const { error: setErr } = await supabase.from('match_sets').insert({
              match_id: matchId,
              set_number: i + 1,
              p1_games: parseInt(s.score1, 10),
              p2_games: parseInt(s.score2, 10),
            });
            if (setErr) throw setErr;
          }
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
      return alert('Por favor completa todos los campos requeridos.');
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
    if (!a || !b) return false;
    return matches.some(m => {
      const h = getMatchHomeId(m);
      const aw = getMatchAwayId(m);

      return (
        m.tournament_id === tournamentId &&
        m.division_id === divisionId &&
        statuses.includes(m.status as any) &&
        h != null &&
        aw != null &&
        ((h === a && aw === b) || (h === b && aw === a))
      );
    });
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

  const getDivisionPlayers = (divisionId: string, tournamentId: string): Profile[] => {
    if (!divisionId || !tournamentId) return [];

    const divisionRegistrations = registrations.filter(r =>
      r.division_id === divisionId && r.tournament_id === tournamentId
    );

    const players: Profile[] = [];

    divisionRegistrations.forEach(reg => {
      // 1) Jugador real (profiles)
      if (reg.profile_id) {
        const p = profiles.find(x => x.id === reg.profile_id);
        if (p) players.push(p);
        return;
      }

      // 2) Jugador histórico (historic_players)
      if (reg.historic_player_id) {
        const h = historicPlayers.find(x => x.id === reg.historic_player_id);
        if (!h) return;

        // “Disfrazamos” historic como Profile mínimo para no romper la UI
        players.push({
          id: h.id,
          name: h.name,
          role: 'historic',
          created_at: h.created_at,
          email: h.email ?? undefined,
          avatar_url: h.avatar_url ?? undefined,
        });
      }
    });

    // Evitar duplicados por seguridad
    const unique = new Map<string, Profile>();
    players.forEach(p => unique.set(p.id, p));
    return Array.from(unique.values());
  };

    const getRegistrationForPlayer = (
      tournamentId: string,
      divisionId: string,
      playerId: string
    ) => {
      return registrations.find(r =>
        r.tournament_id === tournamentId &&
        r.division_id === divisionId &&
        (
          r.profile_id === playerId ||
          r.historic_player_id === playerId
        )
      );
    };

    const isPlayerActiveInDivision = (
      tournamentId: string,
      divisionId: string,
      profileId: string
    ) => {
      return (getRegistrationForPlayer(tournamentId, divisionId, profileId)?.status ?? 'active') === 'active';
    };

    const getActiveDivisionPlayers = (divisionId: string, tournamentId: string): Profile[] => {
      return getDivisionPlayers(divisionId, tournamentId).filter(p =>
        isPlayerActiveInDivision(tournamentId, divisionId, p.id)
      );
    };

    const isMatchBetweenActivePlayers = (
      m: Match,
      tournamentId: string,
      divisionId: string
    ) => {
      const h = getMatchHomeId(m);
      const a = getMatchAwayId(m);
      if (!h || !a) return false;

      return (
        isPlayerActiveInDivision(tournamentId, divisionId, h) &&
        isPlayerActiveInDivision(tournamentId, divisionId, a)
      );
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
    const divisionMatches = getDivisionMatches(divisionId, tournamentId)
      .filter(m => isOfficialMatchByTournamentId(m, tournaments));

    const h2hMatches = divisionMatches.filter(match => {
      const h = getMatchHomeId(match);
      const aw = getMatchAwayId(match);
      return (
        h != null &&
        aw != null &&
        ((h === playerAId && aw === playerBId) || (h === playerBId && aw === playerAId))
      );
    });

    if (h2hMatches.length === 0) return null;

    let playerAWins = 0;
    let playerBWins = 0;

    h2hMatches.forEach(match => {
      if (getMatchHomeId(match) === playerAId) {
        if (match.player1_sets_won > match.player2_sets_won) playerAWins++;
        else playerBWins++;
      } else {
        if (match.player2_sets_won > match.player1_sets_won) playerAWins++;
        else playerBWins++;
      }
    });

    return {
      winner: playerAWins > playerBWins ? playerAId : playerBId,
      playerAWins,
      playerBWins
    };
  };

  function computeStandingsFromPlayedMatches(
    played: Match[],
    tournamentId: string,
    divisionId: string
  ): Standings[] {
    const map = new Map<string, Standings>();

    const ensure = (id: string) => {
      if (!map.has(id)) {
        map.set(id, {
          profile_id: id, // usamos el mismo campo, aunque sea historic
          tournament_id: tournamentId,
          division_id: divisionId,
          wins: 0,
          losses: 0,
          sets_won: 0,
          sets_lost: 0,
          games_won: 0,
          games_lost: 0,
          set_diff: 0,
          pints: 0,
          points: 0,
        });
      }
      return map.get(id)!;
    };

    for (const m of played) {
      const h = getMatchHomeId(m);
      const aw = getMatchAwayId(m);
      if (!h || !aw) continue;

      const home = ensure(h);
      const away = ensure(aw);

      // sets/games (home = player1, away = player2)
      home.sets_won += m.player1_sets_won || 0;
      home.sets_lost += m.player2_sets_won || 0;
      home.games_won += m.player1_games_won || 0;
      home.games_lost += m.player2_games_won || 0;

      away.sets_won += m.player2_sets_won || 0;
      away.sets_lost += m.player1_sets_won || 0;
      away.games_won += m.player2_games_won || 0;
      away.games_lost += m.player1_games_won || 0;

      // pintas
      home.pints += m.player1_pints || 0;
      away.pints += m.player2_pints || 0;

      // W/L + points (sin empates en tenis)
      if (m.player1_sets_won > m.player2_sets_won) {
        home.wins += 1;
        away.losses += 1;
        home.points += 3;
      } else {
        away.wins += 1;
        home.losses += 1;
        away.points += 3;
      }
    }

    // set diff
    for (const s of map.values()) {
      s.set_diff = (s.sets_won || 0) - (s.sets_lost || 0);
    }

    return Array.from(map.values());
  }


  function compareByRules(
    a: { profile_id: string; points: number; sets_won: number; sets_lost: number; games_won: number; games_lost: number },
    b: { profile_id: string; points: number; sets_won: number; sets_lost: number; games_won: number; games_lost: number },
    divisionId: string,
    tournamentId: string
  ) {
    // 1) Puntos
    if (b.points !== a.points) return b.points - a.points;

    // 3) Ratio de sets
    const aSetsTotal = a.sets_won + a.sets_lost;
    const bSetsTotal = b.sets_won + b.sets_lost;
    const aSetRatio = aSetsTotal > 0 ? a.sets_won / aSetsTotal : 0;
    const bSetRatio = bSetsTotal > 0 ? b.sets_won / bSetsTotal : 0;
    if (bSetRatio !== aSetRatio) return bSetRatio - aSetRatio;

    // 4) Ratio de games
    //const aGamesTotal = a.games_won + a.games_lost;
    //const bGamesTotal = b.games_won + b.games_lost;
    //const aGameRatio = aGamesTotal > 0 ? a.games_won / aGamesTotal : 0;
    //const bGameRatio = bGamesTotal > 0 ? b.games_won / bGamesTotal : 0;
    //if (bGameRatio !== aGameRatio) return bGameRatio - aGameRatio;

    // 2) Head-to-Head (si hay al menos un partido entre ellos)
    const h2h = getHeadToHeadResult(divisionId, tournamentId, a.profile_id, b.profile_id);
    if (h2h && h2h.playerAWins !== h2h.playerBWins) {
      return h2h.winner === a.profile_id ? -1 : 1;
    }

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

    const isPlayerInMatch = (match: Match, pid: string) => {
      const h = getMatchHomeId(match);
      const a = getMatchAwayId(match);
      return h === pid || a === pid;
    };

    const didPlayOpponent = (match: Match, pid: string, oppId: string) => {
      const h = getMatchHomeId(match);
      const a = getMatchAwayId(match);
      return (h === pid && a === oppId) || (h === oppId && a === pid);
    };

    const playerMatches = {
      played: divisionMatches.filter(match =>
        isPlayerInMatch(match, playerId) &&
        match.status === 'played'
      ),
      scheduled: scheduled.filter(match =>
        isPlayerInMatch(match, playerId) &&
        match.status === 'scheduled'
      )
    };

    const players = getDivisionPlayers(divisionId, tournamentId);
    const opponents = players.filter(player => player.id !== playerId);

    const upcoming = opponents.filter(opponent => {
      return !playerMatches.played.some(match => didPlayOpponent(match, playerId, opponent.id))
        && !playerMatches.scheduled.some(match => didPlayOpponent(match, playerId, opponent.id));
    });

    return { ...playerMatches, upcoming };
  };

  // ✅ Global (ALL tournaments/divisions) matches for a player
  const getPlayerMatchesAll = (playerId: string) => {
    if (!playerId) {
      return { played: [] as Match[], scheduled: [] as Match[] };
    }

    const played = matches
      .filter(m =>
        isOfficialMatchByTournamentId(m, tournaments) &&
        m.status === 'played' &&
        (m.home_player_id === playerId || m.away_player_id === playerId)
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

    const scheduled = matches
      .filter(m =>
        isOfficialMatchByTournamentId(m, tournaments) &&
        (m.status === 'scheduled' || m.status === 'pending') &&
        (m.home_player_id === playerId || m.away_player_id === playerId || m.created_by === playerId)
      )
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

    return { played, scheduled };
  };

  // ✅ Names for tournament/division from IDs (used in history + H2H rows)
  const getTournamentNameById = (id?: string | null) =>
    tournaments.find(t => t.id === id)?.name ?? '—';

  const getDivisionNameById = (id?: string | null) =>
    divisions.find(d => d.id === id)?.name ?? '';

  const getDivisionHighlights = (divisionName: string, tournamentName: string) => {
    if (tournamentName.includes('PPC Cup')) {
      const highlights: Record<string, string> = {
        'Elite': 'Los mejores jugadores compitiendo por el título de la PPC Cup.',
        'Standard': 'Jugadores intermedios poniendo a prueba sus habilidades en formato copa.',
        'Beginner': 'Nuevos jugadores viviendo su primera experiencia competitiva en la copa.'
      };
      return highlights[divisionName] || 'División emocionante con jugadores apasionados.';
    }
    
    const highlights: Record<string, string> = {
      'Oro': 'Los mejores jugadores del torneo, con saques potentes y juego agresivo desde el fondo.',
      'Plata': 'Jugadores de alto nivel con un juego completo y gran espíritu competitivo.',
      'Bronce': 'Jugadores sólidos que mejoran rápidamente con buenos fundamentos y consistencia.',
      'Cobre': 'Jugadores en desarrollo con gran potencial y pasión por el tenis.',
      'Hierro': 'Nuevos jugadores y entusiastas aprendiendo el juego con dedicación y energía.'
    };
    return highlights[divisionName] || 'División emocionante con jugadores apasionados.';
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

  const visibleTournaments = [...tournaments]
    // 🔹 mostrar solo torneos vivos (por ahora: activos o próximos)
    .filter(t => t.status === 'active' || t.status === 'upcoming')
    .sort((a, b) => {
      // 0 arriba, 999 abajo (Calibraciones queda último)
      const soA = a.sort_order ?? 0;
      const soB = b.sort_order ?? 0;
      if (soA !== soB) return soA - soB;

      // 🔹 primero ligas, luego KO, luego cualquier otro formato
      const order = (fmt?: string) => {
        if (fmt === 'league') return 0;
        if (fmt === 'knockout') return 1;
        return 2;
      };

      const diff = order(a.format) - order(b.format);
      if (diff !== 0) return diff;

      // dentro del mismo tipo, más nuevo primero (start_date descendente)
      return (b.start_date || '').localeCompare(a.start_date || '');
    });

  const historicTournaments = [...tournaments]
    .filter(t => t.status === 'closed' || t.status === 'completed' || t.status === 'finished')
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

  const menHistoricTournaments = historicTournaments.filter(t =>
    /^PPC Edición/i.test((t.name || '').trim())
  );

  const womenHistoricTournaments = historicTournaments.filter(t =>
    /^WPPC Edición/i.test((t.name || '').trim())
  );

  const calibrationHistoricTournaments = historicTournaments.filter(t =>
    /^Calibraciones/i.test((t.name || '').trim())
  );

  const otherHistoricTournaments = historicTournaments.filter(t => {
    const name = (t.name || '').trim();

    const isMen = /^PPC Edición/i.test(name);
    const isWomen = /^WPPC Edición/i.test(name);
    const isCalibration = /^Calibraciones/i.test(name);

    return !isMen && !isWomen && !isCalibration;
  });

  const activeHistoricTournaments =
    historicTab === 'men'
      ? menHistoricTournaments
      : historicTab === 'women'
      ? womenHistoricTournaments
      : historicTab === 'calibrations'
      ? calibrationHistoricTournaments
      : otherHistoricTournaments;

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
          alert("Hubo un error al procesar la imagen.");
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Torneo</label>
                    <select
                      value={pickedTournamentId}
                      onChange={(e) => {
                        setPickedTournamentId(e.target.value);
                        setPickedDivisionId(''); // reset división al cambiar torneo
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar Torneo</option>
                      {(tournaments || []).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar División</label>
                    <select
                      value={pickedDivisionId}
                      onChange={(e) => setPickedDivisionId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                      disabled={!pickedTournamentId}
                    >
                      <option value="">Seleccionar División</option>
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
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-8 overflow-y-auto">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Edit Profile</h2>
            <button onClick={() => setEditProfile(false)} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-6">
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
                      onChange={handleEditAvatarSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

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
                value={editUser.email ?? ''}
                onChange={(e) => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
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

            {/* Password (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password (optional)</label>
              <input
                type="password"
                value={editUser.password}
                onChange={(e) => setEditUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Deja en blanco para mantener la actual"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
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

            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                      {timeSlots.map(slot => (
                        <th
                          key={slot}
                          className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                        >
                          {slot.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {days.map(day => (
                      <tr key={day}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{day}</td>
                        {timeSlots.map(slot => (
                          <td key={slot} className="px-4 py-3 text-center">
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

            {profileError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {profileError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditProfile(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                disabled={savingProfile}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-60"
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
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
                    setEditedMatchData({ ...editedMatchData, pintsCount: e.target.value})
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

  if (showBookingPanel && (isBookingAdmin || visibleBookingAccounts.length > 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/ppc-logo.png"
                  alt="PPC Logo"
                  className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain"
                />
                <div>
                  <button
                    onClick={() => {
                      setShowBookingPanel(false); //ACA QUIERO VOLVER
                      setSelectedTournament(null);
                      setSelectedDivision(null);
                      setSelectedPlayer(null);
                    }}
                    className="text-green-600 hover:text-green-800 font-semibold mb-2"
                  >
                    ← Volver a torneos
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">
                    Pinta Post Championship
                  </h1>
                  <p className="text-gray-600">Reservas automáticas Better</p>
                </div>
              </div>
                      
              {currentUser && (
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">
                      {uiName(currentUser.name)}
                    </p>
                    <p className="truncate text-sm text-gray-600">
                      {currentUserLatestTournamentName}
                    </p>
                  </button>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Ir a mi perfil de jugador"
                      title="Ir a mi perfil de jugador"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                      title="Menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </header>
        {renderNavMenu()}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <section className="bg-white/90 rounded-2xl shadow-lg p-6 border border-green-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Reservas automáticas Better
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Programa que el bot reserve automáticamente una cancha en Highbury o Rosemary,
                  usando el crédito de tu cuenta Better. <strong className="font-bold text-gray-900">Se recomienda hacerlo 7 días antes.  </strong>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Por ahora solo soporta Highbury Fields y Rosemary Gardens (Islington Tennis Centre) y
                  reservas de hasta 2 horas.
                </p>
              </div>
              <div className="hidden sm:flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-700 text-2xl">
                🎾
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* FORMULARIO IZQUIERDA */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Crear nueva reserva
                </h3>

                {bookingError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {bookingError}
                  </div>
                )}

                <form onSubmit={handleCreateBooking} className="space-y-4">
                  {/* Cuenta Better */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuenta Better
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={newBooking.better_account_id || ''}  // UI en string
                      onChange={(e) => setNewBooking({ ...newBooking, better_account_id: e.target.value })}
                      required
                    >
                      <option value="">Selecciona una cuenta</option>
                      {visibleBookingAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.label?.trim?.()
                            || acc.env_username_key?.trim?.()
                            || `Cuenta ${acc.id.slice(0,8)}…`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sede / Venue / Actividad */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sede
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={selectedBookingVenue.key}
                        onChange={(e) => handleBookingVenueChange(e.target.value as BookingVenueKey)}
                      >
                        <option value="highbury">Highbury Fields</option>
                        <option value="rosemary">Rosemary Gardens</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lugar / Venue
                      </label>
                      <input
                        type="text"
                        value={selectedBookingVenue.venue_label}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actividad
                      </label>
                      <input
                        type="text"
                        value={selectedBookingVenue.activity_label}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                      />
                    </div>
                  </div>

                  {/* Fecha y hora */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de juego
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min={minDate}
                        value={newBooking.target_date || minDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          // Si eligen antes de t+7, forzamos t+7
                          setNewBooking({
                            ...newBooking,
                            target_date: v && v >= minDate ? v : minDate,
                          });
                        }}
                      />
                      <p className="mt-1 text-xs text-amber-700">
                        Solo se permiten reservas a partir de {minDate} (t+2).
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hora de inicio
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newBooking.start_time}
                        onChange={(e) =>
                          setNewBooking((prev) => ({
                            ...prev,
                            start_time: e.target.value,
                          }))
                        }
                        required
                      >
                        {betterTimeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        La reserva será siempre de 1 hora.
                      </p>
                    </div>
                  </div>

                  {/* Cancha preferida */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Canchas preferidas
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newBooking.preferred_court_name_1}
                        onChange={(e) => setNewBooking({
                          ...newBooking,
                          preferred_court_name_1: e.target.value,
                        })}
                      >
                        {courtNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>

                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newBooking.preferred_court_name_2}
                        onChange={(e) => setNewBooking({
                          ...newBooking,
                          preferred_court_name_2: e.target.value,
                        })}
                      >
                        <option value="">—</option>
                        {courtNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>

                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newBooking.preferred_court_name_3}
                        onChange={(e) => setNewBooking({
                          ...newBooking,
                          preferred_court_name_3: e.target.value,
                        })}
                      >
                        <option value="">—</option>
                        {courtNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Primero intenta la 1ª, luego 2ª y 3ª. Si no hay, el bot elige la mejor alternativa disponible.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingBooking}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60"
                    >
                      {savingBooking ? 'Guardando…' : 'Crear reserva automática'}
                    </button>
                  </div>
                </form>
              </div>

              {/* LISTAS DERECHA */}
              <div className="space-y-4">
                <div className="border border-green-200 rounded-xl p-4 bg-green-50/50">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Bookings activos
                  </h3>
                  {visibleActiveRequests.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      No hay reservas automáticas activas.
                    </p>
                  ) : (
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                      <table className="min-w-[640px] w-full text-sm">
                        <thead className="bg-green-50 text-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left">Fecha</th>
                            <th className="px-3 py-2 text-left">Hora</th>
                            <th className="px-3 py-2 text-left">Cuenta</th>
                            <th className="px-3 py-2 text-left">Canchas</th>
                            <th className="px-3 py-2 text-left">Estado</th>
                            <th className="px-3 py-2 text-left">Detalles</th>
                            <th className="px-3 py-2 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {visibleActiveRequests.map((req) => {
                            const account = bookingAccounts.find(a => a.id === req.better_account_id);
                            const courts = [req.preferred_court_name_1, req.preferred_court_name_2, req.preferred_court_name_3]
                              .filter(Boolean)
                              .join(' · ') || '—';
                            return (
                              <tr key={req.id} className="bg-white">
                                <td className="px-3 py-2 whitespace-nowrap">{tituloFechaEs(req.target_date)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{formatTimeRange(req)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{account?.label ?? '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {joinCourtsShort(req.preferred_court_name_1, req.preferred_court_name_2, req.preferred_court_name_3)}
                                </td>

                                <td className="px-3 py-2 whitespace-nowrap">
                                  {shortStatus(req.status)}
                                </td>

                                <td className="px-3 py-2">
                                  <details>
                                    <summary className="cursor-pointer select-none text-xs text-gray-600">ver</summary>
                                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                                      {req.last_error && <div>Último: {req.last_error}</div>}
                                      {req.booked_court_name && <div>Reservado: {req.booked_court_name}</div>}
                                      {req.booked_slot_start && <div>Inicio: {req.booked_slot_start}</div>}
                                      {req.booked_slot_end && <div>Fin: {req.booked_slot_end}</div>}
                                      <div>Preferidas: {[req.preferred_court_name_1, req.preferred_court_name_2, req.preferred_court_name_3]
                                        .filter(Boolean).join(' · ') || '—'}
                                      </div>
                                    </div>
                                  </details>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                  <div className="inline-flex gap-2">
                                    {/* Si ya tienes botón Modificar en otra parte, pon aquí tu handler de edición */}
                                    {/* <button onClick={() => TU_HANDLER_DE_EDITAR(req)} className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50">Modificar</button> */}
                                    <button
                                      onClick={() => handleCancelBooking(req)}
                                      className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <h3 className="font-semibold text-gray-800">
                  Historial de bookings
                </h3>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={bookingHistoryStatusFilter}
                    onChange={(e) =>
                      setBookingHistoryStatusFilter(
                        e.target.value as 'all' | 'BOOKED' | 'CANCELLED' | 'EXPIRED' | 'CLOSED' | 'FAILED'
                      )
                    }
                  >
                    <option value="all">Todos los estados</option>
                    <option value="BOOKED">Reservado</option>
                    <option value="CANCELLED">Cancelado</option>
                    <option value="EXPIRED">Expirado</option>
                    <option value="CLOSED">Cerrado</option>
                    <option value="FAILED">Fallido</option>
                  </select>

                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={bookingHistoryLimit}
                    onChange={(e) =>
                      setBookingHistoryLimit(
                        e.target.value as '5' | '10' | '20' | 'all'
                      )
                    }
                  >
                    <option value="5">Últimos 5</option>
                    <option value="10">Últimos 10</option>
                    <option value="20">Últimos 20</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>
              {limitedHistoricalRequests.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Aún no hay historial de reservas.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Hora</th>
                        <th className="px-3 py-2 text-left">Cuenta</th>
                        <th className="px-3 py-2 text-left">Cancha</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                        <th className="px-3 py-2 text-left">Detalles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {limitedHistoricalRequests.map((req) => {
                        const account = bookingAccounts.find(a => a.id === req.better_account_id);
                        return (
                          <tr key={req.id} className="bg-white">
                            <td className="px-3 py-2 whitespace-nowrap">{tituloFechaEs(req.target_date)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{formatTimeRange(req)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{account?.label ?? '—'}</td>

                            {/* Cancha (número corto) */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              {shortCourt(req.booked_court_name || req.preferred_court_name_1) || '—'}
                            </td>

                            {/* Estado corto */}
                            <td className="px-3 py-2 whitespace-nowrap">
                              {shortStatus(req.status)}
                            </td>

                            {/* Detalles expandibles */}
                            <td className="px-3 py-2">
                              <details>
                                <summary className="cursor-pointer select-none text-xs text-gray-600">ver</summary>
                                <div className="mt-2 text-xs text-gray-600 space-y-1">
                                  {req.last_error && <div>Último: {req.last_error}</div>}
                                  {req.booked_court_name && <div>Reservado: {req.booked_court_name}</div>}
                                  {req.booked_slot_start && <div>Inicio: {req.booked_slot_start}</div>}
                                  {req.booked_slot_end && <div>Fin: {req.booked_slot_end}</div>}
                                  <div>
                                    Preferidas: {[req.preferred_court_name_1, req.preferred_court_name_2, req.preferred_court_name_3]
                                      .filter(Boolean)
                                      .join(' · ') || '—'}
                                  </div>
                                </div>
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        {renderNotifs()}
      </div>
    );
  }

  if (showBuscarClases && currentUser?.id === BUSCAR_CLASES_ALLOWED_ID) {
    return (
      <div className="p-4 sm:p-6">
        <BuscarClases onBack={() => setShowBuscarClases(false)} />
      </div>
    );
  }

  if (showMap) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/ppc-logo.png" alt="PPC Logo" className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain" />
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMap(false)}
                    className="text-green-600 hover:text-green-800 font-semibold text-sm mb-0.5 flex items-center gap-1"
                  >
                    ← Volver al menú principal
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">Encontrar Cancha</h1>
                  <p className="text-gray-600">Pinta Post Championship</p>
                </div>
              </div>
              {currentUser && (
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="truncate text-sm text-gray-600">{currentUserLatestTournamentName}</p>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Ir a mi perfil"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {renderNavMenu()}
        <FindTennisCourt onBack={() => setShowMap(false)} />
      </div>
    );
  }

  if (showHistoricTournaments) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        {/* ── Sticky header ── */}
        <header className="bg-white shadow-lg sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/ppc-logo.png" alt="PPC Logo" className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain" />
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHistoricTournaments(false)}
                    className="text-green-600 hover:text-green-800 font-semibold text-sm mb-0.5 flex items-center gap-1"
                  >
                    ← Volver al menú principal
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">Torneos Históricos</h1>
                  <p className="text-gray-600">Pinta Post Championship</p>
                </div>
              </div>
              {currentUser && (
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="truncate text-sm text-gray-600">{currentUserLatestTournamentName}</p>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Ir a mi perfil"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        {renderNavMenu()}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Tabs ── */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {([
              { key: 'men',          label: 'Hombres' },
              { key: 'women',        label: 'Mujeres' },
              { key: 'other',        label: 'Otros Formatos' },
              { key: 'calibrations', label: 'Calibraciones' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setHistoricTab(tab.key)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition ${
                  historicTab === tab.key
                    ? 'bg-white text-slate-900 shadow'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Grid ── */}
          {activeHistoricTournaments.length === 0 ? (
            <div className="rounded-2xl bg-white/10 border border-white/20 p-10 text-center">
              <p className="text-white/80 text-sm">No hay torneos en esta categoría todavía.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeHistoricTournaments.map(tournament => {
                const tournamentRegistrations = registrations.filter(r => r.tournament_id === tournament.id);
                const tournamentMatches = matches.filter(m => m.tournament_id === tournament.id);
                const allScheduled = tournamentMatches.filter(m => m.status === 'scheduled' && isTodayOrFuture(m.date));
                const totalPints = tournamentMatches.reduce((sum, m) => sum + Number(m.player1_pints ?? 0) + Number(m.player2_pints ?? 0), 0);

                return (
                  <div
                    key={tournament.id}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300"
                    onClick={() => { setSelectedTournament(tournament); setShowHistoricTournaments(false); setCameFromHistoric(true); }}
                  >
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 flex items-center justify-center shrink-0">
                          <img
                            src={tournamentLogoSrc(tournament.name)}
                            alt={`${tournament.name} logo`}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-800 leading-tight">{tournament.name}</h3>
                          <p className="text-gray-500 text-sm mt-0.5">
                            {tournament.start_date ? new Date(tournament.start_date).getFullYear() : ''}
                            {tournament.end_date && tournament.start_date !== tournament.end_date
                              ? ` – ${new Date(tournament.end_date).getFullYear()}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{tournamentRegistrations.length}</div>
                          <div className="text-sm text-gray-600">Jugadores</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{tournamentMatches.length}</div>
                          <div className="text-sm text-gray-600">Partidos</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                          <div className="text-sm text-gray-600">Pintas</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">{allScheduled.length}</div>
                          <div className="text-sm text-gray-600">Próximos</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="truncate text-sm text-gray-600">
                      {currentUserLatestTournamentName}
                    </p>
                  </button>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Ir a mi perfil de jugador"
                      title="Ir a mi perfil de jugador"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>

                    {/* Hamburger — opens nav drawer */}
                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                      title="Menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </header>
        {renderNavMenu()}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Bienvenidos a la Pinta Post Championship</h2>
            <p className="text-white text-lg opacity-90">Selecciona un torneo para ver divisiones y detalles de jugadores</p>
          </div>

            {/* Tournament Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {visibleTournaments.map(tournament => {
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
                    <div className="flex items-center gap-3 mb-4">
                      {/* Contenedor cuadrado: asegura tamaño idéntico en todos los logos */}
                      <div className="shrink-0 flex items-center justify-center
                                      h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16
                                      rounded">
                        <img
                          src={tournamentLogoSrc(tournament.name)}
                          alt={`${tournament.name} logo`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      {/* Título arriba, descripción abajo */}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 leading-tight">{tournament.name}</h3>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{tournamentRegistrations.length}</div>
                        <div className="text-sm text-gray-600">Jugadores</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{tournamentMatches.length}</div>
                        <div className="text-sm text-gray-600">Partidos</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                        <div className="text-sm text-gray-600">Total de Pintas</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{allScheduled.length}</div>
                        <div className="text-sm text-gray-600">Próximos Partidos</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          

          {/* Carrusel de fotos de torneos anteriores */}
          {highlightPhotos.length > 0 && (
            <div className="mb-10">
              <h3 className="text-2xl font-bold text-white mb-4 text-center">
                Fotos de torneos anteriores
              </h3>

              <div className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black/40">
                {/* Slides */}
                <div className="relative w-full aspect-[16/9]">
                  {highlightPhotos.map((photo, index) => (
                    <div
                      key={photo.src}
                      className={`
                        absolute inset-0
                        transition-transform duration-700 ease-out
                        ${index === 0 ? '' : ''}
                      `}
                      style={{
                        transform: `translateX(${(index - currentPhotoIndex) * 100}%)`,
                      }}
                    >
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        className="w-full h-full object-cover"
                      />
                      {/* Degradado para texto */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      {/* Texto sobre la foto */}
                      <div className="absolute bottom-4 left-4 right-4 md:left-6 md:bottom-6">
                        <p className="text-sm md:text-base text-gray-100 font-medium drop-shadow">
                          {photo.caption}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flechas de navegación */}
                {highlightPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goToPrevPhoto}
                      className="absolute inset-y-0 left-0 flex items-center px-3 md:px-4
                                 text-white/80 hover:text-white focus:outline-none"
                      aria-label="Foto anterior"
                    >
                      <span className="text-2xl md:text-3xl">‹</span>
                    </button>
                    <button
                      type="button"
                      onClick={goToNextPhoto}
                      className="absolute inset-y-0 right-0 flex items-center px-3 md:px-4
                                 text-white/80 hover:text-white focus:outline-none"
                      aria-label="Foto siguiente"
                    >
                      <span className="text-2xl md:text-3xl">›</span>
                    </button>
                  </>
                )}

                {/* Dots inferiores */}
                {highlightPhotos.length > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {highlightPhotos.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={`
                          h-2.5 w-2.5 rounded-full border border-white/70
                          transition-all duration-200
                          ${index === currentPhotoIndex ? 'bg-white scale-110' : 'bg-white/20'}
                        `}
                        aria-label={`Ir a la foto ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


        {showJoinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Join a New Tournament</h2>
              <div className="space-y-4">
                {/* Selector de Torneo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Torneo</label>
                  <select
                    value={newRegistration.tournamentId}
                    onChange={(e) => setNewRegistration({ tournamentId: e.target.value, divisionId: '' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleccionar...</option>
                    {tournaments.filter(t => t.status === 'active').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Selector de División */}
                {newRegistration.tournamentId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar División</label>
                    <select
                      value={newRegistration.divisionId}
                      onChange={(e) => setNewRegistration(prev => ({ ...prev, divisionId: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    >
                      <option value="">Seleccionar...</option>
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


  if (selectedTournament && selectedTournament.format === 'knockout' && !selectedDivision) {
    const tournamentMatches = matches.filter(m => m.tournament_id === selectedTournament.id    );

    return (
      <div className="flex flex-col gap-4">
        <BracketView
          tournament={selectedTournament}
          matches={tournamentMatches}
          profiles={profiles}
          historicPlayers={historicPlayers}
          matchSets={matchSets}
          onBack={() => {
            setSelectedTournament(null);
            setSelectedDivision(null);
            setSelectedPlayer(null);
          }}
          onEditSchedule={openEditSchedule}
          onEditResult={openEditResult}
          canEditSchedule={canEditSchedule}
        />

        {/* Botón de compartir tabla de partidos de este torneo */}
        <div className="px-4 pb-6 flex justify-end">
          <button
            onClick={shareAllScheduledMatches}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 text-slate-900 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 hover:bg-emerald-400 shadow-md"
          >
            {/* Icono estilo WhatsApp */}
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.52 3.48A11.9 11.9 0 0012.06 0C5.67 0 .48 5.19.48 11.58c0 2.04.53 4.04 1.54 5.8L0 24l6.8-1.96a11.57 11.57 0 005.26 1.33h.01c6.39 0 11.58-5.19 11.58-11.58 0-3.09-1.2-6-3.4-8.21zM12.06 21.1h-.01a9.5 9.5 0 01-4.84-1.33l-.35-.2-4.03 1.16 1.15-3.93-.23-.4a9.55 9.55 0 01-1.45-5.08c0-5.26 4.28-9.54 9.55-9.54 2.55 0 4.95.99 6.76 2.8a9.49 9.49 0 012.79 6.75c0 5.27-4.28 9.55-9.54 9.55zm5.23-7.16c-.28-.14-1.66-.82-1.92-.91-.26-.1-.45-.14-.64.14-.19.29-.74.91-.91 1.09-.17.19-.34.21-.62.07-.28-.14-1.18-.44-2.25-1.4-.83-.74-1.39-1.66-1.55-1.94-.16-.28-.02-.43.12-.57.12-.12.28-.31.42-.46.14-.16.18-.26.28-.44.1-.19.05-.35-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.47-.64-.48h-.55c-.19 0-.5.07-.76.35s-1 1-1 2.43 1.02 2.82 1.16 3.02c.14.19 2.01 3.07 4.86 4.3.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.12.55-.08 1.66-.68 1.9-1.33.23-.65.23-1.21.16-1.33-.07-.12-.26-.19-.54-.33z" />
            </svg>
            <span>Compartir partidos</span>
          </button>
        </div>
      </div>
    );
  }



  if (selectedTournament && !selectedDivision) {
    // Tournament View with all divisions
    const tournamentDivisions = (divisionsByTournament[selectedTournament.id] || [])
      .slice()
      .sort((a, b) => {
        const ra = divisionRank(a.name);
        const rb = divisionRank(b.name);
        if (ra !== rb) return ra - rb;
        return (a.name || '').localeCompare((b.name || ''), 'es');
      });
    
    const divisionsData = tournamentDivisions.map(division => {
      const players = getDivisionPlayers(division.id, selectedTournament.id) || [];
      const activePlayers = getActiveDivisionPlayers(division.id, selectedTournament.id) || [];

      const perOpp =
        selectedTournament.id === '3c57c9af-57b8-476c-9923-54d36d4f7b8a' && division.name === 'Diamante'
          ? 2
          : 1;

      const totalPossibleMatches = activePlayers.length > 1 ? (activePlayers.length - 1) * perOpp : 0;

      // partidos jugados de ESTA división (solo entre jugadores activos)
      const playedInThisDiv = matches.filter(
        m => m.tournament_id === selectedTournament.id &&
            m.division_id === division.id &&
            m.status === 'played' &&
            !isPlayoffsMatch(m) &&
            isMatchBetweenActivePlayers(m, selectedTournament.id, division.id)
      );

      const divisionStandings = computeStandingsFromPlayedMatches(
        playedInThisDiv,
        selectedTournament.id,
        division.id
      );

      const playerRows = players.map(player => {
        const isActive = isPlayerActiveInDivision(selectedTournament.id, division.id, player.id);
        const s = isActive ? divisionStandings.find(st => st.profile_id === player.id) : undefined;

        const played = !isActive ? 0 : matches.filter(m => {
          const h = getMatchHomeId(m);
          const a = getMatchAwayId(m);
          return (
            m.tournament_id === selectedTournament.id &&
            m.division_id === division.id &&
            m.status === 'played' &&
            !isPlayoffsMatch(m) &&
            isMatchBetweenActivePlayers(m, selectedTournament.id, division.id) &&
            (h === player.id || a === player.id)
          );
        }).length;

        const scheduled = !isActive ? 0 : matches.filter(m => {
          const h = getMatchHomeId(m);
          const a = getMatchAwayId(m);
          return (
            m.division_id === division.id &&
            m.tournament_id === selectedTournament.id &&
            m.status === 'scheduled' &&
            !isPlayoffsMatch(m) &&
            isMatchBetweenActivePlayers(m, selectedTournament.id, division.id) &&
            (h === player.id || a === player.id)
          );
        }).length;

        return {
          id: player.id,
          name: player.name,
          isRetired: !isActive,
          gamesPlayed: played,
          gamesScheduled: scheduled,
          gamesNotScheduled: !isActive ? 0 : Math.max(totalPossibleMatches - played - scheduled, 0),
          pints: isActive ? (s?.pints || 0) : 0,
          points: isActive ? (s?.points || 0) : 0,
          sets_won: isActive ? (s?.sets_won || 0) : 0,
          sets_lost: isActive ? (s?.sets_lost || 0) : 0,
          games_won: isActive ? (s?.games_won || 0) : 0,
          games_lost: isActive ? (s?.games_lost || 0) : 0,
        };
      });

      const sortedForLeader = [...playerRows].sort((a, b) => {
        if (a.isRetired !== b.isRetired) return a.isRetired ? 1 : -1;

        return compareByRules(
          { profile_id: a.id, points: a.points, sets_won: a.sets_won, sets_lost: a.sets_lost, games_won: a.games_won, games_lost: a.games_lost },
          { profile_id: b.id, points: b.points, sets_won: b.sets_won, sets_lost: b.sets_lost, games_won: b.games_won, games_lost: b.games_lost },
          division.id,
          selectedTournament.id
        );
      });

      const sortedByPints = [...playerRows].sort((a, b) => b.pints - a.pints);

      return {
        division,
        players: players.length,
        gamesPlayed: matches.filter(m =>
          m.division_id === division.id &&
          m.tournament_id === selectedTournament.id &&
          m.status === 'played' &&
          !isPlayoffsMatch(m) &&
          isMatchBetweenActivePlayers(m, selectedTournament.id, division.id)
        ).length,
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

    // ---- Sub Fase de Grupos (Placement) dentro de Edición 3 ----
    const EDICION_3_ID = '3c57c9af-57b8-476c-9923-54d36d4f7b8a';
    const isEdicion3 = selectedTournament.id === EDICION_3_ID;

    const placementMatchesAll = isEdicion3
      ? matches.filter(m => m.tournament_id === EDICION_3_ID && (m as any).phase === 'group_stage_pre')
      : [];

    const placementGroupCodes = Array.from(
      new Set(
        placementMatchesAll
          .map(m => ((m as any).group_code as string | null) || null)
          .filter(Boolean) as string[]
      )
    ).sort();

    // Si el tab actual no existe (ej. no hay Grupo A), cae al primero disponible
    const effectivePlacementGroup = placementGroupCodes.includes(placementGroup)
      ? placementGroup
      : (placementGroupCodes[0] as any) || placementGroup;

    const placementMatchesForGroup = placementMatchesAll
      .filter(m => (((m as any).group_code as string | null) || '') === effectivePlacementGroup)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

    const placementStandings = buildPlacementStandings(placementMatchesForGroup, matchSets);

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <button
                  onClick={() => {
                    if (cameFromHistoric) {
                      setSelectedTournament(null);
                      setShowHistoricTournaments(true);
                      setCameFromHistoric(false);
                    } else {
                      setSelectedTournament(null);
                    }
                  }}
                  className="text-green-600 hover:text-green-800 font-semibold mb-2"
                >
                  {cameFromHistoric ? '← Volver a Torneos Históricos' : '← Volver a torneos'}
                </button>
                <div className="flex items-center gap-3 mt-1">
                  <img src="/ppc-logo.png" alt="PPC Logo" className="w-auto h-10 sm:h-12 md:h-14 lg:h-16 object-contain" />
                  <div>
                    <h1 className="text-4xl font-bold text-gray-800">{selectedTournament.name}</h1>
                    <p className="text-gray-600">Detalles de divisiones y jugadores</p>
                  </div>
                </div>
              </div>
              
              {currentUser && (
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="truncate text-sm text-gray-600">
                      {currentUserLatestTournamentName}
                    </p>
                  </button>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Ir a mi perfil de jugador"
                      title="Ir a mi perfil de jugador"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                      title="Menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </header>
        {renderNavMenu()}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Tournament tabs */}
        <div className="bg-white rounded-xl shadow-lg p-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => setTournamentTab('overview')}
              className={
                `px-4 py-2 rounded-lg text-sm font-semibold border transition ` +
                (tournamentTab === 'overview'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
              }
            >
              Overview
            </button>

            <button
              type="button"
              onClick={() => setTournamentTab('playoffs')}
              className={
                `px-4 py-2 rounded-lg text-sm font-semibold border transition ` +
                (tournamentTab === 'playoffs'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
              }
            >
              Playoffs
            </button>
          </div>
        </div>
        

        {/* Switch de vistas (solo Edición 3 y solo si existe Sub Fase) */}
        {isEdicion3 && placementMatchesAll.length > 0 && (
          <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg p-3 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setE3View('main')}
                className={
                  `px-4 py-2 rounded-lg text-sm font-semibold border transition ` +
                  (e3View === 'main'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                }
              >
                Liga principal
              </button>

              <button
                type="button"
                onClick={() => setE3View('groups')}
                className={
                  `px-4 py-2 rounded-lg text-sm font-semibold border transition ` +
                  (e3View === 'groups'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                }
              >
                Sub Fase de Grupos
              </button>
            </div>
          </div>
        )}

          {(!isEdicion3 || e3View === 'main') && (
            <>
              {tournamentTab === 'overview' && (
                <>
                  {/* Resumen del Torneo */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-2xl font-bold text-gray-800 mb-6">Resumen del Torneo</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-3xl font-bold text-blue-600">
                            {divisionsData.reduce((sum, d) => sum + d.players, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Total Jugadores</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-3xl font-bold text-green-600">
                            {divisionsData.reduce((sum, d) => sum + d.gamesPlayed, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Partidos Jugados</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-3xl font-bold text-purple-600">
                            {divisionsData.reduce((sum, d) => sum + d.totalPints, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Total Pintas Consumidas</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className="text-3xl font-bold text-orange-600">{divisionsData.length}</div>
                          <div className="text-sm text-gray-600">Divisiones</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-2xl font-bold text-gray-800 mb-6">Líderes por División</h3>
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
                              <div className="text-sm text-gray-600">Jugadores</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-green-600">{gamesPlayed}</div>
                              <div className="text-sm text-gray-600">Partidos</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                              <div className="text-sm text-gray-600">Total de Pintas</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-orange-600">
                                {topPintsPlayer ? Number(topPintsPlayer.pints) : 0}
                              </div>
                              <div className="text-sm text-gray-600">Pintas Máximas</div>
                            </div>
                          </div>

                          {leader && (
                            <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                              <div className="text-sm text-yellow-800">Líder Actual</div>
                              <div className="font-semibold text-yellow-900">{leader.name}</div>
                              <div className="text-sm text-yellow-700">{leader.points} puntos</div>
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
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jugador</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GP</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GS</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GN</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">%Av</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {divisionsData
                                  .find(d => d.division.id === division.id)
                                  ?.playerStats
                                  .slice()
                                  .sort((a, b) => {
                                    const totalA = (a.gamesPlayed ?? 0) + (a.gamesScheduled ?? 0) + (a.gamesNotScheduled ?? 0);
                                    const totalB = (b.gamesPlayed ?? 0) + (b.gamesScheduled ?? 0) + (b.gamesNotScheduled ?? 0);
                                    const pctA = totalA > 0 ? ((a.gamesPlayed + a.gamesScheduled) / totalA) * 100 : 0;
                                    const pctB = totalB > 0 ? ((b.gamesPlayed + b.gamesScheduled) / totalB) * 100 : 0;
                                    return pctB - pctA;
                                  })
                                  .map(stats => (
                                    <tr key={stats.id} className="text-[13px]">
                                      <td className="px-2 py-2 text-sm text-gray-900">
                                        <div className="flex flex-col leading-tight">
                                          <span className="text-sm">{uiName(stats.name)}</span>

                                          <span className="text-[9px] text-gray-500 h-[14px] flex items-center">
                                            {stats.isRetired ? (
                                              <span className="bg-gray-200 text-gray-600 px-1 py-[1px] rounded">Ret</span>
                                            ) : (
                                              <span className="opacity-0">Ret</span>
                                            )}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 text-center">{stats.gamesPlayed}</td>
                                      <td className="px-4 py-2 text-center">{stats.gamesScheduled}</td>
                                      <td className="px-4 py-2 text-center">{stats.gamesNotScheduled}</td>
                                      <td className="px-4 py-2 text-center">
                                        {(() => {
                                          const total =
                                            stats.gamesPlayed + stats.gamesScheduled + stats.gamesNotScheduled;

                                          if (total === 0) return 'NA';

                                          return `${(((stats.gamesPlayed + stats.gamesScheduled) / total) * 100).toFixed(0)}%`;
                                        })()}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tournamentTab === 'playoffs' && (() => {
            const tId = selectedTournament.id;

            const divisionRank = (name?: string | null) => {
              const n = (name || '').trim().toLowerCase();
              if (n === 'oro') return 1;
              if (n === 'plata') return 2;
              if (n === 'bronce') return 3;
              if (n === 'cobre') return 4;
              if (n === 'hierro') return 5;
              if (n === 'diamante') return 6;
              return 99;
            };

            const tournamentDivisions = (divisionsByTournament[tId] || [])
              .slice()
              .sort((a, b) => {
                const ra = divisionRank(a.name);
                const rb = divisionRank(b.name);
                if (ra !== rb) return ra - rb;
                return (a.name || '').localeCompare((b.name || ''), 'es');
              });

            const filteredDivisions =
              playoffsDivisionFilter === 'all'
                ? tournamentDivisions
                : tournamentDivisions.filter(d => d.id === playoffsDivisionFilter);

            const totalPlayoffs = getPlayoffsMatchesForTournament(tId);

            return (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">Playoffs</h3>
                      <p className="text-gray-600">
                        Semifinales + Final por división (cuadro principal) y repechajes como lista.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700">División:</label>
                      <select
                        value={playoffsDivisionFilter}
                        onChange={(e) => setPlayoffsDivisionFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="all">Todas</option>
                        {tournamentDivisions.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {totalPlayoffs.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-lg p-10 text-center text-gray-600">
                    Aún no hay partidos cargados para playoffs en este torneo.
                    <div className="mt-2 text-sm text-gray-500">
                      Cuando los subas, usa <span className="font-mono">phase='finals_main'</span> para cuadro principal y <span className="font-mono">phase='finals_repechage'</span> para repechaje.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {filteredDivisions.map(div => {
                      const main = buildMainPlayoffsBlock(tId, div.id);
                      const rep = buildRepechageMatches(tId, div.id);

                      const hasAnything = Boolean(main.sf1 || main.sf2 || main.final || rep.length);
                      if (!hasAnything) return null;

                      const isGold = (div.name || '').toLowerCase() === 'oro';
                      const champ = main.championId ? getAnyPlayerById(main.championId) : null;

                      const cardRing = isGold ? 'ring-2 ring-yellow-300' : 'ring-1 ring-gray-200';

                      const MatchCard = ({ m, title }: { m?: Match; title: string }) => {
                        if (!m) {
                          return (
                            <div className="border border-dashed rounded-xl p-4 bg-gray-50 text-gray-500">
                              <div className="text-xs font-semibold uppercase tracking-wider mb-1">{title}</div>
                              <div className="text-sm">No definido</div>
                            </div>
                          );
                        }

                        const homeId = m.home_player_id ?? (m as any).home_historic_player_id ?? null;
                        const awayId = m.away_player_id ?? (m as any).away_historic_player_id ?? null;

                        const p1 = getAnyPlayerById(homeId);
                        const p2 = getAnyPlayerById(awayId);

                        const wId = winnerIdFromMatch(m);
                        const p1IsWinner = !!wId && wId === m.home_player_id;
                        const p2IsWinner = !!wId && wId === m.away_player_id;

                        const score = scoreLineForMatch(m);

                        const rowClass = (isWinner: boolean) =>
                          `flex items-center justify-between gap-3 rounded-lg px-3 py-2 ` +
                          (isWinner
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-50 text-slate-700');

                        return (
                          <div className="border rounded-xl p-4 bg-white">
                            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                              {title}
                            </div>

                            <div className="space-y-1">
                              <div className={rowClass(p1IsWinner)}>
                                <div className={`text-sm truncate ${p1IsWinner ? 'font-bold' : 'font-medium'}`}>
                                  {uiName(p1?.name)}
                                </div>
                              </div>

                              <div className={rowClass(p2IsWinner)}>
                                <div className={`text-sm truncate ${p2IsWinner ? 'font-bold' : 'font-medium'}`}>
                                  {uiName(p2?.name)}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-xs text-gray-500">{m.status}</div>
                              <div className="text-sm font-semibold text-slate-700 tracking-wide">{score}</div>
                            </div>
                          </div>
                        );
                      };


                      return (
                        <div key={div.id} className={`bg-white rounded-xl shadow-lg p-6 ${cardRing}`}>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-bold text-gray-800">{div.name}</h4>
                            {isGold && (
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                División principal
                              </span>
                            )}
                          </div>

                          {/* Main bracket */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                            <div className="space-y-4">
                              <MatchCard m={main.sf1} title="Semifinal 1" />
                              <MatchCard m={main.sf2} title="Semifinal 2" />
                            </div>

                            <div className="flex">
                              <div className="w-full self-center">
                                <MatchCard m={main.final} title="Final" />
                              </div>
                            </div>

                            <div className={`rounded-xl p-5 bg-white border ${isGold ? 'ring-2 ring-yellow-300' : 'ring-1 ring-emerald-100'}`}>
                              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Ganador</div>
                              {champ ? (
                                <div className="flex flex-col items-center text-center gap-3">
                                  <div className="text-2xl">🏆</div>

                                  <img
                                    src={champ.avatar_url || '/default-avatar.png'}
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                                    alt="Winner"
                                    className={`rounded-full object-cover ${isGold ? 'w-24 h-24' : 'w-20 h-20'} ring-2 ${isGold ? 'ring-yellow-300' : 'ring-emerald-200'}`}
                                  />

                                  <div className={`font-extrabold text-gray-900 ${isGold ? 'text-lg' : 'text-base'} truncate max-w-[220px]`}>
                                    {uiName(champ.name)}
                                  </div>

                                  <div className="text-xs text-gray-600">
                                    Campeón
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-500">Sin definir</div>
                              )}
                            </div>
                          </div>

                          {/* Repechage */}
                          {rep.length > 0 && (
                            <div className="mt-6">
                              <div className="text-sm font-semibold text-gray-800 mb-2">Repechaje</div>
                              <div className="space-y-3">
                                {rep.map(m => {
                                  const p1 = getAnyPlayerById(m.home_player_id);
                                  const p2 = getAnyPlayerById(m.away_player_id);
                                  return (
                                    <div key={m.id} className="border rounded-xl p-4 bg-white">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="font-semibold text-gray-800 truncate">{uiName(p1?.name)} vs {uiName(p2?.name)}</div>
                                          <div className="text-xs text-gray-500">
                                            {m.date ? formatDateLocal(m.date) : '—'} {m.time ? `• ${m.time.slice(0,5)}` : ''}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-semibold text-slate-700 tracking-wide">{scoreLineForMatch(m)}</div>
                                          <div className="text-xs text-gray-500">{m.status}</div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">Partidos de Playoff</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugadores</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">División</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {matches
                          .filter(match =>
                            match.tournament_id === selectedTournament.id &&
                            isPlayoffsMatch(match)
                          )
                          .sort((a, b) => {
                            const roundDiff = playoffRoundRank(a) - playoffRoundRank(b);
                            if (roundDiff !== 0) return roundDiff;

                            const dateDiff = parseYMDLocal(a.date).getTime() - parseYMDLocal(b.date).getTime();
                            if (dateDiff !== 0) return dateDiff;

                            return (a.bracket_position ?? 99) - (b.bracket_position ?? 99);
                          })
                          .map(match => {
                            const homeId = getMatchHomeId(match);
                            const awayId = getMatchAwayId(match);

                            const player1 = getAnyPlayerById(homeId);
                            const player2 = getAnyPlayerById(awayId);

                            const division = divisions.find(d => d.id === match.division_id)?.name || '';

                            const canEditResult =
                              currentUser?.id === match.home_player_id ||
                              currentUser?.id === match.away_player_id ||
                              (currentUser as any)?.role === 'admin';

                            return (
                              <tr key={match.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {match.date ? formatDateLocal(match.date) : '—'}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {uiName(player1?.name)} vs {uiName(player2?.name)}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {division}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {playoffTypeLabel(match)}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm align-middle">
                                  <div className="space-x-3">
                                    {canEditSchedule(match) && (
                                      <button
                                        onClick={() => openEditSchedule(match)}
                                        className="text-blue-600 hover:text-blue-800 underline"
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {canEditResult && (
                                      <button
                                        onClick={() => openEditResult(match)}
                                        className="text-green-600 hover:text-green-800 underline"
                                      >
                                        {match.status === 'played' ? 'Edit Result' : 'Add Result'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}


          {/* Sub Fase de Grupos (Placement) – solo Edición 3 */}
          {isEdicion3 && placementMatchesAll.length > 0 && e3View === 'groups' && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Sub Fase de Grupos</h3>
                  <p className="text-sm text-gray-600">
                    Fase previa dentro de {selectedTournament.name}
                  </p>
                </div>

                {/* Tabs grupos */}
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                  {placementGroupCodes.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPlacementGroup(code as any)}
                      className={
                        `w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-semibold border transition ` +
                        (effectivePlacementGroup === code
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                      }
                    >
                      Grupo {code}
                    </button>
                  ))}
                </div>
              </div>

            {/* Standings del grupo */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pts</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">P</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">W</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">L</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">SW</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">SL</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">SD</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {placementStandings.map((r, idx) => (
                    <tr key={r.playerId} className={idx === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{r.name}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right font-semibold">{r.Pts}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right">{r.P}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right">{r.W}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right">{r.L}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right">{r.SW}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right">{r.SL}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 text-right font-semibold">{r.SD}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


              {/* Tabla de partidos del grupo */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugadores</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {placementMatchesForGroup.map(match => {
                      const homeId = getMatchHomeId(match);
                      const awayId = getMatchAwayId(match);

                      const p1 = getAnyPlayerById(homeId);
                      const p2 = getAnyPlayerById(awayId);

                      const loc = [
                        locations.find(l => l.id === match.location_id)?.name,
                        match.location_details
                      ].filter(Boolean).join(' - ') || 'TBD';

                      const result = match.status === 'played'
                        ? scoreLine(match)
                        : '—';

                      return (
                        <tr key={match.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {match.date ? formatDateLocal(match.date) : '—'}
                            {match.time ? ` ${match.time.slice(0, 5)}` : ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {uiName(p1?.name)} vs {uiName(p2?.name)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {result}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm align-middle">
                            {match.status === 'played' ? (
                              (currentUser?.id === match.home_player_id ||
                                currentUser?.id === match.away_player_id ||
                                (currentUser as any)?.role === 'admin') && (
                                <button
                                  onClick={() => openEditResult(match)}
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  Edit Result
                                </button>
                              )
                            ) : (
                              canEditSchedule(match) && (
                                <button
                                  onClick={() => openEditSchedule(match)}
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  Edit Schedule
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* Upcoming Matches Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mt-12 mb-8">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugadores</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">División</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
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
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Momentos del Torneo</h3>
            <p className="text-gray-600 text-center">Aún no hay fotos disponibles. ¡Empieza a cargar partidos para crear momentos!</p>
          </div>

          {/* Find Tennis Courts */}
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

  // Knockout tournament view (sin divisiones)
  if (
    selectedTournament &&
    (selectedTournament as any).format === 'knockout' &&
    !selectedDivision
  ) {
    const tournamentMatches = matches.filter(
      m => m.tournament_id === selectedTournament.id
    );

    return (
      <BracketView
        tournament={selectedTournament}
        matches={tournamentMatches}
        profiles={profiles}
        historicPlayers={historicPlayers}
        matchSets={matchSets}         
        onBack={() => {
          setSelectedTournament(null);
          setSelectedDivision(null);
          setSelectedPlayer(null);
        }}
        onEditSchedule={openEditSchedule}
        onEditResult={openEditResult}
        canEditSchedule={canEditSchedule}
      />
    );
  }


  // Division View
  if (selectedTournament && selectedDivision) {
    const players = getDivisionPlayers(selectedDivision.id, selectedTournament.id) || [];
    const activePlayers = getActiveDivisionPlayers(selectedDivision.id, selectedTournament.id) || [];
    const divisionAvailabilityMap = getPlayerAvailabilityMap(availabilitySlots);

    const PENDING_ID = '__PENDING_OPPONENT__';
  // Oculta rivales con los que ya hubo scheduled o played
  const eligibleP2Options =
    !newMatch.player1
      ? activePlayers
      : activePlayers.filter(p =>
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
      ? activePlayers
      : activePlayers.filter(p =>
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
    
    const playedMatchesThisDivision = matches.filter(
      m =>
        m.tournament_id === selectedTournament.id &&
        m.division_id === selectedDivision.id &&
        m.status === 'played' &&
        !isPlayoffsMatch(m) &&
        isMatchBetweenActivePlayers(m, selectedTournament.id, selectedDivision.id)
    );

    const divisionStatsBase = computeStandingsFromPlayedMatches(
      playedMatchesThisDivision,
      selectedTournament.id,
      selectedDivision.id
    );

    // Añadimos name desde profiles/historicPlayers usando tu resolver existente (si ya lo tienes),
    // y si no, caemos al roster `players`.
    const divisionStats = divisionStatsBase.map(s => ({
      ...s,
      name: players.find(p => p.id === s.profile_id)?.name || ''
    }));
    const statsById = new Map(divisionStats.map(s => [s.profile_id, s]));


    // Filas finales: TODOS los inscritos con stats (0 si no tienen partidos)
    const rosterRows = players.map(p => {
      const isActive = isPlayerActiveInDivision(selectedTournament.id, selectedDivision.id, p.id);
      const s = isActive ? statsById.get(p.id) : undefined;

      return {
        profile_id: p.id,
        name: p.name,
        isRetired: !isActive,
        points: isActive ? (s?.points ?? 0) : 0,
        wins: isActive ? (s?.wins ?? 0) : 0,
        losses: isActive ? (s?.losses ?? 0) : 0,
        sets_won: isActive ? (s?.sets_won ?? 0) : 0,
        sets_lost: isActive ? (s?.sets_lost ?? 0) : 0,
        games_won: isActive ? (s?.games_won ?? 0) : 0,
        games_lost: isActive ? (s?.games_lost ?? 0) : 0,
        set_diff: isActive ? (s?.set_diff ?? 0) : 0,
        pints: isActive ? (s?.pints ?? 0) : 0,
      };
    }).sort((a, b) => {
      if (a.isRetired !== b.isRetired) return a.isRetired ? 1 : -1;

      return compareByRules(
        a, b,
        selectedDivision.id,
        selectedTournament.id
      );
    });


    // Usaremos el comparador único: victorias → H2H → ratio sets → ratio games
    const rosterSorted = rosterRows;

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
    m.status === 'pending' &&
    isMatchBetweenActivePlayers(m, selectedTournament.id, selectedDivision.id)
  );

  const scheduledMatches = matches.filter(m =>
    m.division_id === selectedDivision.id &&
    m.tournament_id === selectedTournament.id &&
    m.status === 'scheduled' &&
    isMatchBetweenActivePlayers(m, selectedTournament.id, selectedDivision.id)
  );

  const playedMatches = matches.filter(m =>
    m.division_id === selectedDivision.id &&
    m.tournament_id === selectedTournament.id &&
    m.status === 'played' &&
    !isPlayoffsMatch(m) &&
    isMatchBetweenActivePlayers(m, selectedTournament.id, selectedDivision.id)
  );


    // Player Profile View
    if (selectedPlayer) {
      const player = players.find(p => p.id === selectedPlayer.id);
      const selectedPlayerCard = playerCards.find((pc: PlayerCard) => pc.profile_id === selectedPlayer.id) || null;
      const playerCardView: Partial<PlayerCard> = editingPlayerCard
        ? playerCardForm
        : (selectedPlayerCard ?? {});
      const canEditPlayerCard =
        currentUser?.id === selectedPlayer.id ||
        currentUser?.role === 'admin';

      const selectedPlayerAvatar = avatarSrc(selectedPlayer);
      const selectedPlayerHasAvatar = hasExplicitAvatar(selectedPlayer);
      const currentDivisionName = selectedDivision?.name || '—';

      const firstLeagueEntry = getFirstLeagueEntryForPlayer(
        selectedPlayer.id,
        registrations,
        tournaments
      );

      const firstLeagueTournamentName = firstLeagueEntry?.tournament.name || '—';

      const lastLeagueEntry = getLastLeagueEntryForPlayer(
        selectedPlayer.id,
        registrations,
        tournaments
      );

      const lastLeagueTournamentName = lastLeagueEntry?.tournament.name || '—';
      const lastLeagueDivisionName = lastLeagueEntry
        ? getDivisionNameByIdLocal(lastLeagueEntry.registration.division_id, divisions)
        : '—';

      const lastLeagueResult = lastLeagueEntry
        ? getPrettyLeagueResultForPlayer(
            selectedPlayer.id,
            lastLeagueEntry.registration.tournament_id,
            lastLeagueEntry.registration.division_id,
            matches,
            standings,
            divisions
          )
        : 'Sin torneos de liga';

      const playerStatsSummary = getPlayerStatsSummaryAll(
        selectedPlayer.id,
        registrations,
        tournaments,
        standings,
        matches
      );

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

      const playerMatchesAll = getPlayerMatchesAll(selectedPlayer.id);

      // Calculate upcoming matches against all other players
      const divisionPlayers = getActiveDivisionPlayers(selectedDivision.id, selectedTournament.id);
      const allOpponents = divisionPlayers.filter(p => p.id !== selectedPlayer.id);
      
      const upcomingMatches = allOpponents.filter(opponent => {
        return !playerMatches.played.some(match => {
          const h = getMatchHomeId(match);
          const a = getMatchAwayId(match);
          return (
            (h === selectedPlayer.id && a === opponent.id) ||
            (h === opponent.id && a === selectedPlayer.id)
          );
        }) && !playerMatches.scheduled.some(match => {
          const h = getMatchHomeId(match);
          const a = getMatchAwayId(match);
          return (
            (h === selectedPlayer.id && a === opponent.id) ||
            (h === opponent.id && a === selectedPlayer.id)
          );
        });
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
                    ← Volver a {selectedDivision.name}
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                  <p className="text-gray-600">Detalles de la División</p>
                </div>

                {currentUser && (
                  <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                    >
                      <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                      <p className="truncate text-sm text-gray-600">
                        {currentUserLatestTournamentName}
                      </p>
                    </button>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={goToMyPlayerProfile}
                        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                        aria-label="Ir a mi perfil de jugador"
                        title="Ir a mi perfil de jugador"
                      >
                        <img
                          src={avatarSrc(currentUser)}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                          alt="Profile"
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNavMenu(v => !v)}
                        className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                        aria-label="Abrir menú"
                        title="Menú"
                      >
                        <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </header>
          {renderNavMenu()}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full sm:min-w-0 items-center gap-2 rounded-[22px] border border-emerald-100 bg-white/90 p-2 shadow-[0_10px_30px_rgba(16,24,40,0.08)] backdrop-blur">
                  <button
                    onClick={() => {
                      setPlayerProfileTab('overview');
                      setEditingPlayerCard(false);
                      setPlayerCardSaveMessage('');
                    }}
                    className={`flex-1 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      playerProfileTab === 'overview'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Overview
                  </button>

                  <button
                    onClick={() => setPlayerProfileTab('ficha')}
                    className={`flex-1 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      playerProfileTab === 'ficha'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Ficha Personal
                  </button>

                  <button
                    onClick={() => {
                      setPlayerProfileTab('stats');
                      setEditingPlayerCard(false);
                      setPlayerCardSaveMessage('');
                    }}
                    className={`flex-1 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      playerProfileTab === 'stats'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Estadísticas
                  </button>
                </div>
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-8 ${playerProfileTab === 'ficha' ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
              
              {/* Player Profile */}
              {playerProfileTab !== 'ficha' && (
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
                      <h3 className="font-semibold text-blue-800 mb-2">Disponibilidad</h3>
                      <p className="text-sm text-blue-700">
                        La disponibilidad de este jugador ahora se revisa desde la división.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-2">Locaciones</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedPlayerAreas.length > 0 ? (
                          selectedPlayerAreas.map(name => (
                            <span key={name} className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">
                              {abbreviateLocation(name)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">Sin preferencias</span>
                        )}
                      </div>

                      {/* Postcode debajo de Locations */}
                      <div className="mt-3 text-sm text-gray-700">
                        <span className="font-medium">Código Postal:</span>{' '}
                        {selectedPlayer?.postal_code ? (
                          <span>{selectedPlayer.postal_code}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-yellow-800 mb-2">Torneos y Divisiones</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="font-medium text-gray-700">Divisiones:</span>
                          <span className="ml-1 font-medium">{selectedDivision.name}</span>
                        </div>

                        <div>
                          <span className="font-medium text-gray-700">Torneos:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              {selectedTournament.name}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-yellow-200">
                          <div className="text-xs uppercase tracking-wide text-gray-500">Último torneo</div>
                          <div className="text-sm font-semibold text-gray-800">{lastLeagueTournamentName}</div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-gray-500">Última división</div>
                          <div className="text-sm font-semibold text-gray-800">{lastLeagueDivisionName}</div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-gray-500">Resultado</div>
                          <div className="text-sm font-semibold text-green-700">{lastLeagueResult}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Player Content */}
              <div className={playerProfileTab === 'ficha' ? 'lg:col-span-1' : 'lg:col-span-2'}>

                {playerProfileTab === 'overview' && (
                  <>
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Estadísticas del Jugador - Torneo Actual</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{playerStats.points}</div>
                      <div className="text-sm text-gray-600">Puntos</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{playerStats.wins + playerStats.losses}</div>
                      <div className="text-sm text-gray-600">Partidos Jugados</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{playerStats.pints}</div>
                      <div className="text-sm text-gray-600">Pintas</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{playerStats.sets_won}</div>
                      <div className="text-sm text-gray-600">Sets Ganados</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{playerStats.set_diff}</div>
                      <div className="text-sm text-gray-600">Diferencial de Sets</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posición</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Jugador</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Puntos</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PJ</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">G</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SG</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SP</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DS</th>
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
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Historial de Partidos</h2>
                  
                  {playerMatches.played.length > 0 ? (
                    <div className="space-y-4">
                      {playerMatches.played.map((match, index) => {
                        const selectedIsHome = getMatchHomeId(match) === selectedPlayer.id;
                        const opponent = selectedIsHome
                          ? getAnyPlayerById(getMatchAwayId(match))
                          : getAnyPlayerById(getMatchHomeId(match));

                        const selectedBadgeCls = selectedIsHome
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800';

                        const opponentBadgeCls = selectedIsHome
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800';

                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {uiName(opponent?.name)}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${opponentBadgeCls}`}>
                                    {selectedIsHome ? 'Visita' : 'Local'}
                                  </span>
                                </h4>

                                <div className="mt-1 text-xs text-gray-500">
                                  {uiName(selectedPlayer.name)}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] ${selectedBadgeCls}`}>
                                    {selectedIsHome ? 'Local' : 'Visita'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-semibold text-blue-600">{formatDateLocal(match.date)}</div>
                                <div className="text-sm text-gray-600">{scoreLine(match, selectedPlayer.id)}</div>
                              </div>
                            </div>

                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Location: </span>
                              {match.location_details || locations.find(l => l.id === match.location_id)?.name || 'TBD'}
                            </div>

                            {(match.player1_had_pint || match.player2_had_pint) && (
                              <div className="mt-1 text-sm text-purple-600 flex items-center">
                                <span className="text-lg">🍻</span>
                                <span className="ml-1">Tomaron {match.player1_pints} pintas cada uno</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500">Sin historial de partidos todavía.</p>
                  )}
                </div>

                {playerMatches.scheduled.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Agendar Partido</h2>
                    <div className="space-y-4">
                      {playerMatches.scheduled.map((match, idx) => {
                        const selectedIsHome = getMatchHomeId(match) === selectedPlayer.id;
                        const opponent = selectedIsHome
                          ? getAnyPlayerById(getMatchAwayId(match))
                          : getAnyPlayerById(getMatchHomeId(match));

                        const selectedBadgeCls = selectedIsHome
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800';

                        const opponentBadgeCls = selectedIsHome
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800';

                        return (
                          <div key={idx} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {uiName(opponent?.name)}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${opponentBadgeCls}`}>
                                    {selectedIsHome ? 'Visita' : 'Local'}
                                  </span>
                                </h4>

                                <div className="mt-1 text-xs text-gray-500">
                                  {uiName(selectedPlayer.name)}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] ${selectedBadgeCls}`}>
                                    {selectedIsHome ? 'Local' : 'Visita'}
                                  </span>
                                </div>
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
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Próximos Partidos</h2>
                    <div className="space-y-4">
                      {upcomingMatches.map((opponent, index) => {
                        const homeId = computeHomeForPair(
                          selectedDivision.id,
                          selectedTournament.id,
                          selectedPlayer.id,
                          opponent.id
                        );

                        const selectedIsHome = homeId === selectedPlayer.id;

                        const selectedBadgeCls = selectedIsHome
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800';

                        const opponentBadgeCls = selectedIsHome
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800';

                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {uiName(opponent.name)}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${opponentBadgeCls}`}>
                                    {selectedIsHome ? 'Visita' : 'Local'}
                                  </span>
                                </h4>

                                <div className="mt-1 text-xs text-gray-500">
                                  {uiName(selectedPlayer.name)}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] ${selectedBadgeCls}`}>
                                    {selectedIsHome ? 'Local' : 'Visita'}
                                  </span>
                                </div>
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
                                      const awayId = selectedIsHome ? opponent.id : selectedPlayer.id;

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

                
                {/* Cara a Cara */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Partidos Cara a Cara</h2>

                  {playerMatchesAll.played.length > 0 ? (
                    <div className="space-y-6">
                      {(() => {
                        // Build opponent list from ALL played matches (across tournaments)
                        const oppIds = new Set<string>();

                        playerMatchesAll.played.forEach(m => {
                          const a = getMatchHomeId(m);
                          const b = getMatchAwayId(m);
                          if (!a || !b) return;

                          if (a === selectedPlayer.id) oppIds.add(b);
                          else if (b === selectedPlayer.id) oppIds.add(a);
                        });

                        const opponents = Array.from(oppIds)
                          .map(id => getAnyPlayerById(id))
                          .filter(Boolean) as { id: string; name?: string | null; avatar_url?: string | null }[];

                        // Sort by most recent match vs that opponent (optional but nice)
                        opponents.sort((o1, o2) => {
                          const last1 = playerMatchesAll.played
                            .filter(m =>
                              (getMatchHomeId(m) === selectedPlayer.id && getMatchAwayId(m) === o1.id) ||
                              (getMatchHomeId(m) === o1.id && getMatchAwayId(m) === selectedPlayer.id)
                            )
                            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date ?? '';
                          const last2 = playerMatchesAll.played
                            .filter(m =>
                              (getMatchHomeId(m) === selectedPlayer.id && getMatchAwayId(m) === o2.id) ||
                              (getMatchHomeId(m) === o2.id && getMatchAwayId(m) === selectedPlayer.id)
                            )
                            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date ?? '';
                          return (last2 || '').localeCompare(last1 || '');
                        });

                        return opponents.map(opponent => {
                          const h2hMatches = playerMatchesAll.played
                            .filter(match =>
                              (getMatchHomeId(match) === selectedPlayer.id && getMatchAwayId(match) === opponent.id) ||
                              (getMatchHomeId(match) === opponent.id && getMatchAwayId(match) === selectedPlayer.id)
                            )
                            .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

                          if (h2hMatches.length === 0) return null;

                          // Calculate global head-to-head stats
                          let wins = 0;
                          let losses = 0;
                          let totalSetsWon = 0;
                          let totalSetsLost = 0;

                          h2hMatches.forEach(match => {
                            if (getMatchHomeId(match) === selectedPlayer.id) {
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
                                <h3 className="font-semibold text-gray-800 text-lg">
                                  {uiName(opponent.name)}
                                </h3>
                                <div className="bg-gray-50 px-3 py-1 rounded-lg">
                                  <span className="text-green-600 font-medium">{wins}W</span> -{' '}
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
                                {h2hMatches.map((match, index) => (
                                  <div key={index} className="border-t pt-2">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        {/* ✅ Tournament (and division) instead of repeating names */}
                                        <p className="text-sm font-medium text-gray-800">
                                          {getTournamentNameById(match.tournament_id)}
                                          {getDivisionNameById(match.division_id) ? ` · ${getDivisionNameById(match.division_id)}` : ''}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {formatDate(new Date(match.date))}
                                          {(() => {
                                            const loc = match.location_details || locations.find(l => l.id === match.location_id)?.name;
                                            return loc ? ` | ${loc}` : '';
                                          })()}
                                        </p>
                                      </div>

                                      <div className="text-right">
                                        {/* ✅ Result on the right */}
                                        <p className="text-sm font-medium">
                                          {scoreLine(match, selectedPlayer.id)}
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
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Sin partidos cara a cara disponibles
                    </div>
                  )}
                </div>
                  </>
                )}

                {playerProfileTab === 'ficha' && (
                  <div className="space-y-8 mb-8">

                    {canEditPlayerCard && editingPlayerCard && (
                      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
                        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-slate-900">Editar ficha</h3>
                            <p className="text-sm text-slate-500">
                              Estos datos solo se muestran en modo edición para el jugador o admin.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Nickname</div>
                              <input
                                type="text"
                                value={playerCardForm.nickname || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, nickname: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Fecha de nacimiento</div>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                value={birthDateInput}
                                onChange={(e) => {
                                  let value = e.target.value.replace(/[^\d/]/g, '');

                                  if (value.length === 2 && !value.includes('/')) value += '/';
                                  if (value.length === 5 && value.split('/').length === 2) value += '/';
                                  if (value.length > 10) value = value.slice(0, 10);

                                  setBirthDateInput(value);
                                }}
                                onBlur={() => {
                                  if (!birthDateInput.trim()) {
                                    setPlayerCardForm({
                                      ...playerCardForm,
                                      birth_date: null,
                                    });
                                    return;
                                  }

                                  const iso = parseDDMMYYYYToISO(birthDateInput);

                                  if (!iso) {
                                    alert('La fecha debe ser válida y estar en formato dd/mm/yyyy');
                                    return;
                                  }

                                  setPlayerCardForm({
                                    ...playerCardForm,
                                    birth_date: iso,
                                  });
                                }}
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Peso (kg)</div>
                              <input
                                type="number"
                                min="0"
                                value={playerCardForm.weight_kg ?? ''}
                                onChange={(e) =>
                                  setPlayerCardForm({
                                    ...playerCardForm,
                                    weight_kg: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Altura (cm)</div>
                              <input
                                type="number"
                                min="0"
                                value={playerCardForm.height_cm ?? ''}
                                onChange={(e) =>
                                  setPlayerCardForm({
                                    ...playerCardForm,
                                    height_cm: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Nacionalidad</div>
                              <input
                                type="text"
                                value={playerCardForm.nationality || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, nationality: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Lugar de nacimiento</div>
                              <input
                                type="text"
                                value={playerCardForm.birth_place || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, birth_place: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Mano hábil</div>
                              <input
                                type="text"
                                value={playerCardForm.dominant_hand || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, dominant_hand: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Revés</div>
                              <input
                                type="text"
                                value={playerCardForm.backhand_style || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, backhand_style: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 md:col-span-2">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Objetivo PPC</div>
                              <input
                                type="text"
                                value={playerCardForm.ppc_objective || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, ppc_objective: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Golpe favorito</div>
                              <input
                                type="text"
                                value={playerCardForm.favourite_shot || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, favourite_shot: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Superficie favorita</div>
                              <input
                                type="text"
                                value={playerCardForm.favourite_surface || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, favourite_surface: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Jugador favorito</div>
                              <input
                                type="text"
                                value={playerCardForm.favourite_player || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, favourite_player: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Marca raqueta</div>
                              <input
                                type="text"
                                value={playerCardForm.racket_brand || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, racket_brand: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Modelo raqueta</div>
                              <input
                                type="text"
                                value={playerCardForm.racket_model || ''}
                                onChange={(e) =>
                                  setPlayerCardForm({ ...playerCardForm, racket_model: e.target.value })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Inicio en tenis</div>
                              <input
                                type="number"
                                min="1900"
                                max="2100"
                                value={playerCardForm.tennis_start_year ?? ''}
                                onChange={(e) =>
                                  setPlayerCardForm({
                                    ...playerCardForm,
                                    tennis_start_year: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                                className="w-full border rounded-lg px-3 py-2"
                              />
                            </div>
                          </div>

                          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                              onClick={() => {
                                setEditingPlayerCard(false);
                                setPlayerCardForm({});
                                setBirthDateInput('');
                                setPlayerCardSaveMessage('');
                              }}
                              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Cancelar
                            </button>

                            <button
                              onClick={async () => {
                                try {
                                  setSavingPlayerCard(true);

                                  if (birthDateInput.trim()) {
                                    const iso = parseDDMMYYYYToISO(birthDateInput);
                                    if (!iso) {
                                      alert('La fecha de nacimiento debe ser válida y estar en formato dd/mm/yyyy');
                                      return;
                                    }
                                    playerCardForm.birth_date = iso;
                                  }

                                  const { age, ...rest } = playerCardForm;

                                  const payload = {
                                    profile_id: selectedPlayer.id,
                                    ...rest,
                                  };

                                  const { data, error } = await supabase
                                    .from('player_cards')
                                    .upsert(payload, { onConflict: 'profile_id' })
                                    .select()
                                    .single();

                                  if (error) throw error;

                                  if (data) {
                                    setPlayerCards((prev) => {
                                      const filtered = prev.filter(
                                        (pc) => pc.profile_id !== selectedPlayer.id
                                      );
                                      return [...filtered, data as PlayerCard];
                                    });
                                  }

                                  setEditingPlayerCard(false);
                                  setPlayerCardForm({});
                                  setPlayerCardSaveMessage('Ficha guardada correctamente.');

                                  setTimeout(() => {
                                    setPlayerCardSaveMessage('');
                                  }, 3000);
                                } catch (err) {
                                  console.error(err);
                                  alert('Error guardando ficha');
                                } finally {
                                  setSavingPlayerCard(false);
                                }
                              }}
                              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 font-semibold text-white shadow hover:opacity-95"
                            >
                              {savingPlayerCard ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/50 p-4 sm:p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                      <div className="space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                          <div className="px-1">
                            <h2 className="text-2xl font-bold text-slate-900">Ficha Personal</h2>
                            <p className="text-sm text-slate-500 mt-1">
                              Perfil visual del jugador dentro de PPC
                            </p>
                          </div>

                          {canEditPlayerCard && !editingPlayerCard && (
                            <button
                              onClick={() => {
                                const initialCard =
                                  selectedPlayerCard || {
                                    profile_id: selectedPlayer.id,
                                    nickname: '',
                                    age: null,
                                    birth_date: null,
                                    weight_kg: null,
                                    height_cm: null,
                                    nationality: '',
                                    birth_place: '',
                                    dominant_hand: '',
                                    backhand_style: '',
                                    ppc_objective: '',
                                    favourite_shot: '',
                                    favourite_surface: '',
                                    favourite_player: '',
                                    racket_brand: '',
                                    racket_model: '',
                                    tennis_start_year: null,
                                  };

                                setPlayerCardForm(initialCard);
                                setBirthDateInput(formatISOToDDMMYYYY(initialCard.birth_date));
                                
                                setPlayerCardSaveMessage('');
                                setEditingPlayerCard(true);
                              }}
                              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-95 transition"
                            >
                              {selectedPlayerCard ? 'Editar ficha' : 'Crear ficha'}
                            </button>
                          )}
                        </div>

                        {playerCardSaveMessage && (
                          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {playerCardSaveMessage}
                          </div>
                        )}

                        <PlayerShowcaseCard
                          player={selectedPlayer}
                          avatarUrl={selectedPlayerAvatar}
                          hasAvatar={selectedPlayerHasAvatar}
                          playerCard={playerCardView}
                          firstLeagueTournamentName={firstLeagueTournamentName}
                          lastLeagueResult={lastLeagueResult}
                          currentDivisionName={currentDivisionName}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {playerProfileTab === 'stats' && (
                  <div className="space-y-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Estadísticas</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Resumen general del rendimiento del jugador en PPC
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-blue-600">{playerStatsSummary.tournamentsPlayed}</div>
                          <div className="text-sm text-gray-600">Torneos jugados</div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-indigo-600">{playerStatsSummary.divisionsPlayed}</div>
                          <div className="text-sm text-gray-600">Divisiones jugadas</div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-green-600">{playerStatsSummary.matchesPlayed}</div>
                          <div className="text-sm text-gray-600">Partidos jugados</div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-emerald-600">{playerStatsSummary.winRate.toFixed(1)}%</div>
                          <div className="text-sm text-gray-600">% Victorias</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Rendimiento</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-green-700">{playerStatsSummary.wins}</div>
                          <div className="text-sm text-gray-600">Ganados</div>
                        </div>

                        <div className="bg-red-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-red-600">{playerStatsSummary.losses}</div>
                          <div className="text-sm text-gray-600">Perdidos</div>
                        </div>

                        <div className="bg-orange-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-orange-600">{playerStatsSummary.setDiff}</div>
                          <div className="text-sm text-gray-600">Dif. sets</div>
                        </div>

                        <div className="bg-yellow-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-yellow-700">{playerStatsSummary.gameDiff}</div>
                          <div className="text-sm text-gray-600">Dif. juegos</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Pinta Post</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Estadísticas disponibles desde Edición 4 en adelante
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-purple-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-purple-600">{playerStatsSummary.totalPints}</div>
                          <div className="text-sm text-gray-600">Pintas totales</div>
                        </div>

                        <div className="bg-pink-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-pink-600">{playerStatsSummary.pintMatches}</div>
                          <div className="text-sm text-gray-600">Partidos con pinta</div>
                        </div>

                        <div className="bg-fuchsia-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-fuchsia-600">{playerStatsSummary.avgPintsPerMatch.toFixed(1)}</div>
                          <div className="text-sm text-gray-600">Promedio por partido</div>
                        </div>

                        <div className="bg-violet-50 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-violet-600">{playerStatsSummary.pintMatchRate.toFixed(1)}%</div>
                          <div className="text-sm text-gray-600">% de partidos con pint</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Partidos agendados (todos) */}
                {(() => {
                  if (!selectedPlayer || !selectedTournament || !selectedDivision) return null;

                  // Todos los partidos agendados del jugador (scheduled o pending), sin importar si son pasados o futuros
                  const myScheduled = matches
                    .filter(m =>
                      m.tournament_id === selectedTournament.id &&
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

                  const matchTypeLabel = (m: Match) => {
                    if (m.phase === 'finals_repechage') return 'Repechaje';
                    if (m.phase === 'finals_main' && m.knockout_round === 'SF') return 'Semifinal';
                    if (m.phase === 'finals_main' && m.knockout_round === 'F') return 'Final';
                    return 'Liga';
};

                  return (
                    <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
                      <h2 className="text-2xl font-bold text-gray-800 mb-6">Partidos agendados</h2>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jugadores</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">División / Tipo</th>
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
                                    {formatDate(new Date(m.date))} {m.time ? `· ${m.time.slice(0,5)}` : ''}
                                  </td>
                                  <td className="px-4 py-2">
                                    {uiName(nameById(m.home_player_id))} vs {uiName(nameById(m.away_player_id)) || '(busca rival)'}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="text-sm text-gray-900">{divName(m.division_id)}</div>
                                    <div className="text-xs text-gray-500">{matchTypeLabel(m)}</div>
                                  </td>
                                  <td className="px-4 py-2">{loc}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex flex-wrap gap-2">
                                      {/* Editar fecha / hora / lugar */}
                                      <button
                                        onClick={() => openEditSchedule(m)}
                                        className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                                      >
                                        Editar horario
                                      </button>

                                      {/* Agregar resultados */}
                                      <button
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
                                            pintsCount: '1',
                                            anecdote: '',
                                          });
                                          setEditingMatch(m);
                                        }}
                                        className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                                      >
                                        Agregar resultados
                                      </button>

                                      {/* Eliminar partido (opcional, pero útil) */}
                                      <button
                                        onClick={() => handleDeleteScheduledMatch(m)}
                                        className="px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
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
                  ← Volver a {selectedTournament.name}
                </button>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">Detalles de la División</p>
              </div>

              {currentUser && (
                <div className="flex w-full md:w-auto items-center justify-end gap-2 md:gap-4">
                  <button
                    type="button"
                    onClick={goToMyPlayerProfile}
                    className="min-w-0 max-w-[58vw] md:max-w-none text-right hover:opacity-80 transition text-left md:text-right"
                  >
                    <p className="truncate font-semibold text-gray-800">{uiName(currentUser.name)}</p>
                    <p className="truncate text-sm text-gray-600">
                      {currentUserLatestTournamentName}
                    </p>
                  </button>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goToMyPlayerProfile}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                      aria-label="Ir a mi perfil de jugador"
                      title="Ir a mi perfil de jugador"
                    >
                      <img
                        src={avatarSrc(currentUser)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 hover:opacity-90 transition"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNavMenu(v => !v)}
                      className="p-3 sm:p-2 rounded-full hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                      aria-label="Abrir menú"
                      title="Menú"
                    >
                      <svg className="w-7 h-7 sm:w-6 sm:h-6 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </header>
        {renderNavMenu()}

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

          <div className="mb-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAvailability(prev => !prev)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition"
            >
              <span>📅</span>
              <span>Ver disponibilidad de los jugadores</span>
            </button>
          </div>

          {showAvailability && selectedDivision && selectedTournament && (
            <div className="mb-8 bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Disponibilidad de los jugadores
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Jugadores activos de esta división, agrupados por día y bloque horario.
                </p>
              </div>

              {activePlayers.length === 0 ? (
                <p className="text-sm text-gray-500">No hay jugadores activos en esta división.</p>
              ) : (
                <>
                  {/* Desktop / tablet */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full table-fixed border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-20 bg-white px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-r w-[130px]">
                            Bloque
                          </th>
                          {days.map(day => (
                            <th
                              key={day}
                              className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b min-w-[150px]"
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {[
                          { key: 'Morning', label: 'Morning', tone: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
                          { key: 'Afternoon', label: 'Afternoon', tone: 'bg-orange-50 text-orange-800 border-orange-200' },
                          { key: 'Evening', label: 'Evening', tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                        ].map(block => (
                          <tr key={block.key} className="align-top">
                            <td className="sticky left-0 z-10 bg-white px-3 py-3 border-b border-r">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${block.tone}`}>
                                {block.label}
                              </span>
                            </td>

                            {days.map(day => {
                              const playersInSlot = activePlayers.filter(player => {
                                const playerAvailability = divisionAvailabilityMap[player.id] || {};
                                const slots = playerAvailability[day] || [];
                                return slots.includes(block.key);
                              });

                              return (
                                <td key={`${block.key}-${day}`} className="px-3 py-3 border-b align-top">
                                  {playersInSlot.length === 0 ? (
                                    <span className="text-xs text-gray-300">—</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {playersInSlot.map(player => (
                                        <span
                                          key={player.id}
                                          className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium"
                                        >
                                          {uiName(player.name)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-4">
                    {days.map(day => (
                      <div key={day} className="rounded-xl border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">{day}</h4>

                        <div className="space-y-3">
                          {[
                            { key: 'Morning', label: 'Morning', tone: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
                            { key: 'Afternoon', label: 'Afternoon', tone: 'bg-orange-50 text-orange-800 border-orange-200' },
                            { key: 'Evening', label: 'Evening', tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                          ].map(block => {
                            const playersInSlot = activePlayers.filter(player => {
                              const playerAvailability = divisionAvailabilityMap[player.id] || {};
                              const slots = playerAvailability[day] || [];
                              return slots.includes(block.key);
                            });

                            return (
                              <div key={`${day}-${block.key}`}>
                                <div className="mb-1.5">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${block.tone}`}>
                                    {block.label}
                                  </span>
                                </div>

                                {playersInSlot.length === 0 ? (
                                  <div className="text-xs text-gray-300">—</div>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {playersInSlot.map(player => (
                                      <span
                                        key={player.id}
                                        className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium"
                                      >
                                        {uiName(player.name)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Division Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Resumen de la División</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Jugadores:</span>
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
                  <h2 className="text-2xl font-bold text-gray-800">Tabla Posiciones</h2>
                  <p className="text-gray-600">Presiona sobre el nombre de un jugador para ver el historial de partidos</p>
                </div>

                {hasDivisionZones(selectedDivision) && (
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {(selectedDivision?.direct_promotion_slots ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-white">
                          Ascenso directo
                        </span>
                      )}

                      {(selectedDivision?.promotion_playoff_slots ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-emerald-200 px-3 py-1 text-emerald-950">
                          Repechaje ascenso
                        </span>
                      )}

                      {(selectedDivision?.relegation_playoff_slots ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-rose-200 px-3 py-1 text-rose-950">
                          Repechaje descenso
                        </span>
                      )}

                      {(selectedDivision?.direct_relegation_slots ?? 0) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-rose-600 px-3 py-1 text-white">
                          Descenso directo
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posición</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugador</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Puntos</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PJ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">G</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SG</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SP</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DS</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pintas</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rosterSorted.length > 0 ? (
                        rosterSorted.map((stats, index) => {
                          const player = players.find(p => p.id === stats.profile_id);
                          if (!player) return null;

                            const zoneClass = getStandingZone(index + 1, rosterSorted.length, selectedDivision);

                            return (
                              <tr
                                key={stats.profile_id}
                                className="cursor-pointer hover:bg-gray-50 transition"
                                onClick={() => setSelectedPlayer(player)}
                              >
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
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
                              <td className={`px-6 py-4 whitespace-nowrap rounded-l-xl rounded-r-xl ${zoneClass}`}>
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img
                                      className={`h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 ${stats.isRetired ? 'opacity-70 grayscale' : ''}`}
                                      src={player.avatar_url || '/default-avatar.png'}
                                      alt=""
                                    />
                                  </div>
                                  <div className="ml-4">
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-medium text-gray-900 hover:text-green-700 cursor-pointer">
                                        {uiName(player.name)}
                                      </div>
                                      {stats.isRetired && (
                                        <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                          Retirado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{stats.points}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.wins + stats.losses}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{stats.wins}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{stats.losses}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sets_won}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sets_lost}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{stats.set_diff}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-amber-700">{stats.pints}</td>
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
                            Aún no hay jugadores en esta división
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
                      <option value="">Seleccionar Jugador</option>
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
                      <option value="">Seleccionar Jugador</option>
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
                    value={newMatch.player2 ?? PENDING_ID}
                    onChange={(e) => setNewMatch({ ...newMatch, player2: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    //required    -- Jugador 2 es opcional
                    disabled={!newMatch.player1}
                  >
                    <option value={PENDING_ID}>— Rival pendiente (publicar aviso) —</option>
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
                  const player1 = getAnyPlayerById(getMatchHomeId(match));
                  
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
                                alert('Partido pendiente cancelado.');

                              } catch (e:any) {
                                alert(`Error al cancelar el partido: ${e.message}`);
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jugadores</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">División</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicación</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th> {/* <-- NUEVA */}
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(new Date(m.date))}</td>
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

