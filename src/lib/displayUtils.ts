export function capitaliseFirst(value?: string | null) {
  if (!value) return '—';
  const trimmed = value.trim();
  if (!trimmed) return '—';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export const toTitleCase = (str: string) => {
  if (!str) return '';

  return str
    .normalize('NFC') // <-- AÑADE ESTA LÍNEA
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase());
};

export const uiName = (raw?: string | null) => toTitleCase((raw ?? '').trim());

export function divisionLogoSrc(name: string) {
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

export function divisionColors(name: string, league?: HofLeague): {
  barGradient: string;
  ringColor: string;
  avatarShadow: string;
  cardBorder: string;
  blurTop: string;
  blurBottom: string;
} {
  const n = (name || '').trim();

  // Divisiones femeninas compartidas (Oro/Plata/Bronce en WPPC): tinte rosado
  // sutil por encima del color base para diferenciarlas de las masculinas.
  if (league === 'wppc' && ['Oro', 'Plata', 'Bronce'].includes(n)) {
    return {
      barGradient: 'from-rose-400 via-pink-400 to-fuchsia-400',
      ringColor: 'ring-rose-200',
      avatarShadow: '0_12px_30px_rgba(244,114,182,0.28)',
      cardBorder: 'border-rose-100',
      blurTop: 'bg-rose-100/70',
      blurBottom: 'bg-pink-100/70',
    };
  }

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

export function divisionIcon(name: string) {
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

export function tournamentLogoSrc(name: string) {
  if (/^PPC Winter/i.test(name)) return '/ppc-logo.png';            // PPC Winter 2025/2026
  if (/^WPPC Winter/i.test(name)) return '/wppc-logo-transparente.png';          // WPPC Winter 2025/2026
  if (/PPC Cup/i.test(name)) return '/ppc-cup-trophy-transparente.png';          // PPC Cup 2025
  if (/Andrea Vivaldi/i.test(name)) return '/Andrea-Vivaldi/foto-1.jpeg';        // Copa Andrea Vivaldi
  return '/ppc-logo.png';
}

// ─────────────────────────────────────────────────────────────
// Salón de la Fama — helpers de liga / división canónica
// ─────────────────────────────────────────────────────────────

export type HofLeague = 'ppc' | 'wppc' | 'special';

/** Detecta la liga de un torneo por su nombre. WPPC = mujeres, PPC = hombres. */
export function hofLeagueFromTournamentName(name?: string | null): HofLeague {
  const n = (name || '').trim();
  if (/^WPPC/i.test(n)) return 'wppc';
  if (/^PPC\s+Edici[oó]n/i.test(n) || /^PPC\s+Winter/i.test(n)) return 'ppc';
  // Torneos especiales (PPC Cup, Andrea Vivaldi, etc.)
  return 'special';
}

/** Etiqueta corta para el chip de liga. */
export function hofLeagueLabel(league: HofLeague): string {
  if (league === 'wppc') return 'WPPC';
  if (league === 'ppc') return 'PPC';
  return '';
}

/**
 * Clave canónica de una división, única a través de ediciones y que separa
 * Oro Hombres (ppc) de Oro Mujeres (wppc). Formato: `${league}:${divisionLower}`.
 * Para torneos especiales usamos solo la división (no colisionan).
 */
export function hofDivisionKey(tournamentName: string, divisionName: string): string {
  const league = hofLeagueFromTournamentName(tournamentName);
  const div = (divisionName || '').trim().toLowerCase();
  if (league === 'special') return `special:${div}`;
  return `${league}:${div}`;
}

/** Label legible de una división canónica (agrega "Mujeres"/"Hombres" cuando el nombre colisiona). */
export function hofDivisionLabel(tournamentName: string, divisionName: string): string {
  const league = hofLeagueFromTournamentName(tournamentName);
  const div = (divisionName || '').trim();
  const divLower = div.toLowerCase();
  // Torneos especiales con división genérica → "Otros Torneos"
  if (league === 'special' && (divLower === 'principal' || divLower === '')) return 'Otros Torneos';
  // Divisiones cuyo nombre existe en ambas ligas → desambiguar
  const shared = ['oro', 'plata', 'bronce'];
  if (league === 'wppc' && shared.includes(divLower)) return `${div} Mujeres`;
  if (league === 'ppc' && shared.includes(divLower)) return `${div} Hombres`;
  return div;
}

/** Extrae el año de un torneo (usa end_date/start_date; si no, busca 4 dígitos en el nombre). */
export function hofYearFromTournament(name: string, endDate?: string | null, startDate?: string | null): string {
  const iso = (endDate || startDate || '').trim();
  if (iso.length >= 4 && /^\d{4}/.test(iso)) return iso.slice(0, 4);
  const m = (name || '').match(/(20\d{2})/);
  return m ? m[1] : 'Sin fecha';
}
