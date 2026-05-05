import type { Registration, Tournament, Match, Standings, Division } from '../types';
import { isCalibrationTournamentByName, isOfficialMatchByTournamentId } from './tournamentUtils';

export function getAgeFromBirthDate(birthDate?: string | null): number | null {
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

export function getLeagueRegistrationsForPlayer(
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

export function getLastLeagueEntryForPlayer(
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

export function getFirstLeagueEntryForPlayer(
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

export function getDivisionNameByIdLocal(divisionId: string, divisions: Division[]) {
  return divisions.find(d => d.id === divisionId)?.name || '—';
}

export function getPrettyLeagueResultForPlayer(
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

export function getPlayerStatsSummaryAll(
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
