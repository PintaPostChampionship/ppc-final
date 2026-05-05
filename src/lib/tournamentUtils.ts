import type { Match, Tournament } from '../types';

export function isCalibrationTournamentByName(name?: string | null) {
  return /^Calibraciones/i.test((name || '').trim());
}

export function isOfficialMatchByTournamentId(
  match: Match,
  tournaments: Tournament[]
) {
  const tournamentName = tournaments.find(t => t.id === match.tournament_id)?.name || '';
  return !isCalibrationTournamentByName(tournamentName);
}
