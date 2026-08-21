import React, { useState } from 'react';
import type { Tournament, Match, Profile, HistoricPlayer, MatchSet } from '../types';
import { uiName } from '../lib/displayUtils';
import { supabase } from '../lib/supabaseClient';

export function getNextMatchPosition(round: string | null | undefined, pos: number | null | undefined) {
  if (!round || !pos) return null;

  // R32 -> R16
  if (round === 'R32') {
    return {
      nextRound: 'R16',
      nextPos: Math.ceil(pos / 2),
    };
  }

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


export async function advanceWinner(match: Match, supabaseClient: any) {
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

  // Obtener el usuario actual para created_by
  const { data: { user } } = await supabaseClient.auth.getUser();
  const currentUserId = user?.id ?? null;

  // Calcular el partido siguiente
  const meta = getNextMatchPosition(match.knockout_round, match.bracket_position);
  if (!meta) return; // Final no tiene siguiente ronda

  const { nextRound, nextPos } = meta;

  // Buscar si ya existe el partido de la siguiente ronda (por division + round + position)
  // Check both with and without phase to handle league playoffs (finals_main) and pure knockout
  const { data: existingList, error: existingErr } = await supabaseClient
    .from('matches')
    .select('*')
    .eq('tournament_id', match.tournament_id)
    .eq('division_id', match.division_id)
    .eq('knockout_round', nextRound)
    .eq('bracket_position', nextPos);

  // Pick the match — prefer one with same phase, otherwise any match found
  const existing = existingList?.find((m: any) => m.phase === match.phase) 
    || existingList?.[0] 
    || null;

  // 1) Si NO existe → crear el partido
  if (!existing) {
    // Fecha fija para knockout (los jugadores la editarán después)
    const defaultDate = '2026-06-01';

    // Posición impar (1,3,5,7) → home del siguiente match
    // Posición par (2,4,6,8) → away del siguiente match
    const isOddPosition = ((match.bracket_position ?? 1) % 2) === 1;

    await supabaseClient.from('matches').insert({
      tournament_id: match.tournament_id,
      division_id: match.division_id,
      knockout_round: nextRound,
      bracket_position: nextPos,
      phase: match.phase || null,
      home_player_id: isOddPosition ? winner : null,
      away_player_id: isOddPosition ? null : winner,
      date: defaultDate,
      status: 'pending',
      created_by: currentUserId,
    });

    return;
  }

  // 2) Si existe → colocamos en el slot que corresponde por posición
  const isOddPosition = ((match.bracket_position ?? 1) % 2) === 1;
  const updatePayload: any = {};

  if (isOddPosition) {
    updatePayload.home_player_id = winner;
  } else {
    updatePayload.away_player_id = winner;
  }

  // Si el slot ya está ocupado (raro, pero por seguridad), no sobreescribir
  if (isOddPosition && existing.home_player_id) return;
  if (!isOddPosition && existing.away_player_id) return;

  // Si ambos jugadores están ahora completos, cambiar status a scheduled
  const willBeComplete = isOddPosition
    ? (existing.away_player_id != null)
    : (existing.home_player_id != null);
  if (willBeComplete) {
    updatePayload.status = 'scheduled';
  }

  await supabaseClient
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
  onStartLive?: (matchId: string) => void;
  currentUser?: Profile | null;
};

type BracketPlayerSlotProps = {
  player?: BracketAnyPlayer | null;
  isWinner?: boolean;
  isLoser?: boolean;
  compact?: boolean;
};

function BracketPlayerSlot({ player, isWinner, isLoser, compact = false }: BracketPlayerSlotProps) {
  const base = compact
    ? 'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all duration-150'
    : 'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 min-w-[150px]';

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
      <div className={`rounded-full overflow-hidden ring-2 ring-white bg-slate-200 shadow-sm flex-shrink-0 ${compact ? 'h-5 w-5' : 'h-8 w-8'}`}>
        {player?.avatar_url ? (
          <img
            src={player.avatar_url}
            alt={player?.name ?? 'Player'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={`h-full w-full flex items-center justify-center ${compact ? 'text-[8px]' : 'text-xs'}`}>
            🎾
          </div>
        )}
      </div>
      <div className={`font-medium truncate ${compact ? 'text-[10px]' : 'text-sm'}`}>
        {player ? uiName(player.name) : '\u00A0'}
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
  compact?: boolean;
};

const BracketMatchCard: React.FC<BracketMatchCardProps> = ({
  match,
  player1,
  player2,
  header,
  sets = [],
  compact = false,
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
    <div className="flex flex-col gap-1">
      {header && (
        <div className={`uppercase tracking-[0.20em] text-emerald-700 text-center font-semibold ${compact ? 'text-[9px] mb-0.5' : 'text-[11px] mb-1'}`}>
          {header}
        </div>
      )}

      <div className={`rounded-xl border border-white/80 bg-white/95 text-slate-900 text-sm flex flex-col shadow-[0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur-sm ${compact ? 'p-1.5 gap-1 min-h-[56px] rounded-lg' : 'p-3 gap-2 min-h-[88px] rounded-2xl shadow-[0_12px_30px_rgba(15,23,42,0.08)]'}`}>
        <BracketPlayerSlot
          player={player1}
          isWinner={isWinner(player1)}
          isLoser={isLoser(player1)}
          compact={compact}
        />
        <BracketPlayerSlot
          player={player2}
          isWinner={isWinner(player2)}
          isLoser={isLoser(player2)}
          compact={compact}
        />

        {scoreLine && (
          <div className={`text-slate-600 text-center tracking-[0.14em] font-semibold ${compact ? 'text-[9px]' : 'mt-1 text-[11px]'}`}>
            {scoreLine}
          </div>
        )}
      </div>
    </div>
  );
};



export function BracketView({
  tournament,
  matches,
  profiles,
  historicPlayers,
  matchSets,
  onBack,
  onEditSchedule,
  onEditResult,
  canEditSchedule,
  onStartLive,
  currentUser,
}: BracketViewProps) {

  const is1PointSlam = /Andrea Vivaldi/i.test(tournament.name);
  const isAdmin = currentUser?.role === 'admin';

  // Alert state for 1-point slam
  const [alertingId, setAlertingId] = useState<string | null>(null);
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null);

  const getAlertMessage = (round?: string | null) => {
    const isGrass = round === 'QF' || round === 'SF' || round === 'F';
    return isGrass
      ? '🌱 Tu partido en la Copa Andrea Vivaldi comienza pronto. ¡Acércate a las canchas de PASTO!'
      : '🎾 Tu partido en la Copa Andrea Vivaldi comienza pronto. ¡Acércate a las canchas de CEMENTO!';
  };

  const sendPlayerAlert = async (targetProfileId: string, round?: string | null) => {
    setAlertingId(targetProfileId);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          targetUserId: targetProfileId,
          title: '🏆 Copa Andrea Vivaldi — ¡Te toca!',
          body: getAlertMessage(round),
          url: `${window.location.origin}/#registro-1-punto`,
        }),
      });
    } catch { /* silent */ }
    finally { setAlertingId(null); }
  };

  const selectWinner = async (matchId: string, winnerId: string) => {
    setSelectingWinner(matchId);
    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;
      const isP1Winner = match.home_player_id === winnerId;
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'played',
          player1_sets_won: isP1Winner ? 1 : 0,
          player2_sets_won: isP1Winner ? 0 : 1,
        })
        .eq('id', matchId);
      if (error) throw error;
      // Advance winner to next round
      const updatedMatch = { ...match, status: 'played' as const, player1_sets_won: isP1Winner ? 1 : 0, player2_sets_won: isP1Winner ? 0 : 1 };
      await advanceWinner(updatedMatch as Match, supabase);
      window.location.reload();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setSelectingWinner(null);
    }
  };

  const getPlayer = (id?: string | null): BracketAnyPlayer | null => {
    if (!id) return null;

    const p = profiles.find(x => x.id === id);
    if (p) return { id: p.id, name: p.name, avatar_url: p.avatar_url ?? null };

    const h = historicPlayers.find(x => x.id === id);
    if (h) return { id: h.id, name: h.name, avatar_url: h.avatar_url ?? null };

    return null;
  };

  // Collapsible round sections — default: first incomplete round open, rest closed
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>(() => {
    const rounds = ['R32', 'R16', 'QF', 'SF', 'F'] as const;
    const initial: Record<string, boolean> = {};
    let foundIncomplete = false;
    for (const round of rounds) {
      const roundMatches = matches.filter(m => m.knockout_round === round);
      const allPlayed = roundMatches.length > 0 && roundMatches.every(m => m.status === 'played');
      if (!allPlayed && !foundIncomplete) {
        initial[round] = true; // open the first incomplete round
        foundIncomplete = true;
      } else {
        initial[round] = false;
      }
    }
    // If all rounds are complete, open the Final
    if (!foundIncomplete) initial['F'] = true;
    return initial;
  });

  const toggleRound = (round: string) => {
    setOpenRounds(prev => ({ ...prev, [round]: !prev[round] }));
  };

  const byRound = (
    round: 'R32' | 'R16' | 'QF' | 'SF' | 'F',
    pos: number
  ): Match | null =>
    matches.find(
      m =>
        m.knockout_round === round &&
        (m.bracket_position ?? 0) === pos
    ) || null;

  // Colocamos siempre los slots, aunque no haya partido en BD → se ve el "esqueleto" completo
  const is32 = /Andrea Vivaldi/i.test(tournament.name);
  const r32Left = [1, 2, 3, 4, 5, 6, 7, 8].map(pos => byRound('R32', pos));
  const r32Right = [9, 10, 11, 12, 13, 14, 15, 16].map(pos => byRound('R32', pos));
  const r16Left = is32 ? [1, 2, 3, 4].map(pos => byRound('R16', pos)) : [1, 2, 3, 4].map(pos => byRound('R16', pos));
  const r16Right = is32 ? [5, 6, 7, 8].map(pos => byRound('R16', pos)) : [5, 6, 7, 8].map(pos => byRound('R16', pos));
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
    <div className="min-h-screen bg-gradient-to-br from-[#eefaf7] via-[#f7fffd] to-[#eef6ff] text-slate-900 overflow-x-hidden">
      <div className="max-w-[1400px] mx-auto px-2 py-8">
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
              src={/Andrea Vivaldi/i.test(tournament.name) ? '/Andrea-Vivaldi/foto-1.jpeg' : '/ppc-cup-trophy.jpg'}
              alt={tournament.name}
              className={/Andrea Vivaldi/i.test(tournament.name)
                ? "h-32 w-32 mb-4 rounded-full object-cover object-[60%_20%] ring-4 ring-yellow-200 shadow-lg"
                : "h-40 w-auto mb-4 object-contain drop-shadow-[0_10px_25px_rgba(16,185,129,0.18)]"
              }
            />
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 mb-3">
              {/Andrea Vivaldi/i.test(tournament.name) ? (
                <span className="text-sm">💛</span>
              ) : (
                <span className="text-sm">🏆</span>
              )}
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                {/Andrea Vivaldi/i.test(tournament.name) ? 'Golden Point Slam' : 'PPC Cup'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wide text-slate-900">
              {tournament.name}
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              Knockout · {/Andrea Vivaldi/i.test(tournament.name) ? '32' : '16'} jugadores
            </p>
          </div>
        </div>

        {/* Grid del bracket */}
        <div className={is32 ? "w-full" : "overflow-x-auto"}>
          {is32 ? (
          /* 32-player bracket: R32 | R16 | QF | SF+F | QF | R16 | R32 */
          <div className="w-full grid grid-cols-7 gap-x-2">
            {/* R32 izquierda */}
            <div className="space-y-3">
              {r32Left.map((m, idx) => (
                <BracketMatchCard
                  key={`r32-L-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'Ronda de 32' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                  compact
                />
              ))}
            </div>

            {/* R16 izquierda */}
            <div className="flex flex-col justify-around py-6">
              {r16Left.map((m, idx) => (
                <BracketMatchCard
                  key={`r16-L-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'R16' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                  compact
                />
              ))}
            </div>

            {/* QF izquierda */}
            <div className="flex flex-col justify-around py-6">
              {qfLeft.map((m, idx) => (
                <BracketMatchCard
                  key={`qf-L-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'QF' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                  compact
                />
              ))}
            </div>

            {/* Centro: SF1, Final, SF2 — verticalmente centrados */}
            <div className="flex flex-col justify-center gap-3 py-6">
              <div className="text-center mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">SF</div>
              <BracketMatchCard
                match={sf[0]}
                player1={getPlayer(getMatchHomeId(sf[0]))}
                player2={getPlayer(getMatchAwayId(sf[0]))}
                sets={sf[0] ? matchSets.filter(s => s.match_id === sf[0]!.id) : []}
                compact
              />
              <div className="my-1 text-center text-[11px] uppercase tracking-[0.2em] text-emerald-600 font-bold">Final</div>
              <BracketMatchCard
                match={finalMatch}
                player1={getPlayer(getMatchHomeId(finalMatch))}
                player2={getPlayer(getMatchAwayId(finalMatch))}
                sets={finalMatch ? matchSets.filter(s => s.match_id === finalMatch.id) : []}
                compact
              />
              {champion && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Campeón</p>
                  <h2 className="text-base font-extrabold text-slate-900">{uiName(champion.name)}</h2>
                </div>
              )}
              <div className="text-center mt-1 mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">SF</div>
              <BracketMatchCard
                match={sf[1]}
                player1={getPlayer(getMatchHomeId(sf[1]))}
                player2={getPlayer(getMatchAwayId(sf[1]))}
                sets={sf[1] ? matchSets.filter(s => s.match_id === sf[1]!.id) : []}
                compact
              />
            </div>

            {/* QF derecha */}
            <div className="flex flex-col justify-around py-6">
              {qfRight.map((m, idx) => (
                <BracketMatchCard
                  key={`qf-R-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'QF' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                  compact
                />
              ))}
            </div>

            {/* R16 derecha */}
            <div className="flex flex-col justify-around py-6">
              {r16Right.map((m, idx) => (
                <BracketMatchCard
                  key={`r16-R-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'R16' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                  compact
                />
              ))}
            </div>

            {/* R32 derecha */}
            <div className="space-y-3">
              {r32Right.map((m, idx) => (
                <BracketMatchCard
                  key={`r32-R-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'Ronda de 32' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                  compact
                />
              ))}
            </div>
          </div>
          ) : (
          /* 16-player bracket: R16 | QF | SF+F | QF | R16 */
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
            {qfLeft.map((m, idx) => (
              <BracketMatchCard
                key={`qf-L-${idx}`}
                match={m}
                player1={getPlayer(getMatchHomeId(m))}
                player2={getPlayer(getMatchAwayId(m))}
                header={idx === 0 ? 'Cuartos de final' : undefined}
                sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
              />
            ))}
          </div>

          {/* Centro: SF + Final */}
          <div className="flex flex-col items-center justify-between py-4">
            <div className="space-y-12">
              {sf.map((m, idx) => (
                <BracketMatchCard
                  key={`sf-${idx}`}
                  match={m}
                  player1={getPlayer(getMatchHomeId(m))}
                  player2={getPlayer(getMatchAwayId(m))}
                  header={idx === 0 ? 'Semifinales' : undefined}
                  sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
                />
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center">
              <div className="text-center mb-2 text-[11px] uppercase tracking-[0.2em] text-emerald-600 font-semibold">
                Final
              </div>
              <BracketMatchCard
                match={finalMatch}
                player1={getPlayer(getMatchHomeId(finalMatch))}
                player2={getPlayer(getMatchAwayId(finalMatch))}
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
            {qfRight.map((m, idx) => (
              <BracketMatchCard
                key={`qf-R-${idx}`}
                match={m}
                player1={getPlayer(getMatchHomeId(m))}
                player2={getPlayer(getMatchAwayId(m))}
                header={idx === 0 ? 'Cuartos de final' : undefined}
                sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
              />
            ))}
          </div>

          {/* R16 derecha */}
          <div className="space-y-6">
            {r16Right.map((m, idx) => (
              <BracketMatchCard
                key={`r16-R-${idx}`}
                match={m}
                player1={getPlayer(getMatchHomeId(m))}
                player2={getPlayer(getMatchAwayId(m))}
                header={idx === 0 ? 'Ronda de 16' : undefined}
                sets={m ? matchSets.filter(s => s.match_id === m.id) : []}
              />
            ))}
          </div>
        </div>
          )}
        </div>
      </div>

      {/* Panel inferior: lista de partidos separada por ronda */}
      <div className="px-4 pb-8 mt-6 max-w-6xl mx-auto">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-6">
          Partidos y resultados
        </h2>

        <div className="space-y-8">
          {(["R32", "R16", "QF", "SF", "F"] as const).map((round) => {
            const roundConfig = {
              R32: { label: "Ronda de 32", icon: "🎾", color: "slate" },
              R16: { label: "Ronda de 16", icon: "🎯", color: "emerald" },
              QF: { label: "Cuartos de final", icon: "⚡", color: "sky" },
              SF: { label: "Semifinales", icon: "🔥", color: "amber" },
              F: { label: "Final", icon: "🏆", color: "yellow" },
            }[round];

            const roundMatches = matches
              .filter((m) => m.knockout_round === round)
              .sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0));

            if (roundMatches.length === 0) return null;

            const playedCount = roundMatches.filter(m => m.status === 'played').length;
            const totalCount = roundMatches.length;

            return (
              <div key={round} className="bg-white/95 border border-slate-200 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                {/* Round header — clickeable para abrir/cerrar */}
                <button
                  type="button"
                  onClick={() => toggleRound(round)}
                  className="w-full px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{roundConfig.icon}</span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">
                      {roundConfig.label}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {playedCount}/{totalCount} jugados
                    </span>
                    {playedCount === totalCount && totalCount > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        ✓ Completa
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openRounds[round] ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {openRounds[round] && (<>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left font-medium">#</th>
                        <th className="px-4 py-2.5 text-left font-medium">Partido</th>
                        <th className="px-4 py-2.5 text-center font-medium">Resultado</th>
                        <th className="px-4 py-2.5 text-center font-medium">Fecha</th>
                        <th className="px-4 py-2.5 text-center font-medium">Lugar</th>
                        <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {roundMatches.map((m, idx) => {
                        const p1 = getPlayer(m.home_player_id);
                        const p2 = m.away_player_id ? getPlayer(m.away_player_id) : null;

                        const mSets = matchSets
                          .filter(s => s.match_id === m.id)
                          .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0));
                        const scoreText = mSets.length > 0
                          ? mSets.map(s => `${s.p1_games}-${s.p2_games}`).join('  ')
                          : '';

                        const dateText = m.date ? m.date.slice(0, 10) : "—";
                        const timeText = m.time ? m.time.slice(0, 5) : "";
                        const placeText = m.location_details || "—";

                        const isPlayed = m.status === 'played';

                        return (
                          <tr key={m.id} className={`transition-colors ${isPlayed ? 'bg-emerald-50/30' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                              {round}{m.bracket_position ?? idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  {p1?.avatar_url && (
                                    <img src={p1.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-white" />
                                  )}
                                  <span className={`font-medium ${isPlayed && m.player1_sets_won > m.player2_sets_won ? 'text-emerald-700' : 'text-slate-800'}`}>
                                    {p1 ? uiName(p1.name) : 'Por definir'}
                                  </span>
                                </div>
                                <span className="text-slate-400 text-xs">vs</span>
                                <div className="flex items-center gap-1.5">
                                  {p2?.avatar_url && (
                                    <img src={p2.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-white" />
                                  )}
                                  <span className={`font-medium ${isPlayed && m.player2_sets_won > m.player1_sets_won ? 'text-emerald-700' : 'text-slate-800'}`}>
                                    {p2 ? uiName(p2.name) : <span className="text-slate-400 italic">Esperando rival</span>}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isPlayed && scoreText ? (
                                <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                                  {scoreText}
                                </span>
                              ) : isPlayed ? (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  Jugado
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-slate-600">
                              {dateText !== '—' ? dateText : <span className="text-slate-400">—</span>}
                              {timeText && <span className="text-slate-400 ml-1">· {timeText}</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-slate-600">
                              {placeText !== '—' ? placeText : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5 justify-end">
                                {/* 1-Point Slam: alert + select winner */}
                                {is1PointSlam && isAdmin && m.status !== 'played' && p1 && (
                                  <button
                                    onClick={() => sendPlayerAlert(p1.id, round)}
                                    disabled={alertingId === p1.id}
                                    className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[11px] font-medium transition-colors disabled:opacity-50"
                                    title={`Llamar a ${uiName(p1.name)}`}
                                  >
                                    🔔 {uiName(p1.name)?.split(' ')[0]}
                                  </button>
                                )}
                                {is1PointSlam && isAdmin && m.status !== 'played' && p2 && (
                                  <button
                                    onClick={() => sendPlayerAlert(p2.id, round)}
                                    disabled={alertingId === p2.id}
                                    className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[11px] font-medium transition-colors disabled:opacity-50"
                                    title={`Llamar a ${uiName(p2.name)}`}
                                  >
                                    🔔 {uiName(p2.name)?.split(' ')[0]}
                                  </button>
                                )}
                                {is1PointSlam && isAdmin && m.status !== 'played' && p1 && p2 && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => selectWinner(m.id, p1.id)}
                                      disabled={selectingWinner === m.id}
                                      className="px-2 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-medium transition-colors disabled:opacity-50"
                                    >
                                      ✓ {uiName(p1.name)?.split(' ')[0]}
                                    </button>
                                    <button
                                      onClick={() => selectWinner(m.id, p2.id)}
                                      disabled={selectingWinner === m.id}
                                      className="px-2 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-medium transition-colors disabled:opacity-50"
                                    >
                                      ✓ {uiName(p2.name)?.split(' ')[0]}
                                    </button>
                                  </div>
                                )}
                                {/* Standard tournament actions */}
                                {!is1PointSlam && canEditSchedule(m) && m.status !== 'played' && m.home_player_id && m.away_player_id && onStartLive && (
                                  <button
                                    onClick={() => onStartLive(m.id)}
                                    className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-[11px] font-medium transition-colors"
                                  >
                                    🔴 En Vivo
                                  </button>
                                )}
                                {!is1PointSlam && canEditSchedule(m) && (
                                  <button
                                    onClick={() => onEditSchedule(m)}
                                    className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-[11px] font-medium transition-colors"
                                  >
                                    📅 Horario
                                  </button>
                                )}
                                {!is1PointSlam && canEditSchedule(m) && (
                                  <button
                                    onClick={() => onEditResult(m)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-medium transition-colors"
                                  >
                                    ✏️ Resultado
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

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {roundMatches.map((m, idx) => {
                    const p1 = getPlayer(m.home_player_id);
                    const p2 = m.away_player_id ? getPlayer(m.away_player_id) : null;

                    const mSets = matchSets
                      .filter(s => s.match_id === m.id)
                      .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0));
                    const scoreText = mSets.length > 0
                      ? mSets.map(s => `${s.p1_games}-${s.p2_games}`).join('  ')
                      : '';

                    const dateText = m.date ? m.date.slice(0, 10) : "Por definir";
                    const timeText = m.time ? m.time.slice(0, 5) : "";
                    const placeText = m.location_details || "Por definir";
                    const isPlayed = m.status === 'played';

                    return (
                      <div key={m.id} className={`px-4 py-3.5 ${isPlayed ? 'bg-emerald-50/30' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {round}{m.bracket_position ?? idx + 1}
                          </span>
                          {isPlayed && scoreText && (
                            <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {scoreText}
                            </span>
                          )}
                          {isPlayed && !scoreText && (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ Jugado
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            {p1?.avatar_url && (
                              <img src={p1.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                            )}
                            <span className={`text-sm font-medium ${isPlayed && m.player1_sets_won > m.player2_sets_won ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {p1 ? uiName(p1.name) : 'TBD'}
                            </span>
                          </div>
                          <span className="text-slate-400 text-xs">vs</span>
                          <div className="flex items-center gap-1.5">
                            {p2?.avatar_url && (
                              <img src={p2.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                            )}
                            <span className={`text-sm font-medium ${isPlayed && m.player2_sets_won > m.player1_sets_won ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {p2 ? uiName(p2.name) : <span className="text-slate-400 italic text-xs">Esperando rival</span>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-slate-500">
                            {dateText !== 'Por definir' && <span>📅 {dateText}{timeText && ` · ${timeText}`}</span>}
                            {placeText !== 'Por definir' && <span className="ml-2">📍 {placeText}</span>}
                          </div>

                          {is1PointSlam && isAdmin && m.status !== 'played' && (
                            <div className="flex flex-wrap gap-1">
                              {p1 && (
                                <button onClick={() => sendPlayerAlert(p1.id, round)} disabled={alertingId === p1.id}
                                  className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium disabled:opacity-50">
                                  🔔{uiName(p1.name)?.split(' ')[0]}
                                </button>
                              )}
                              {p2 && (
                                <button onClick={() => sendPlayerAlert(p2.id, round)} disabled={alertingId === p2.id}
                                  className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium disabled:opacity-50">
                                  🔔{uiName(p2.name)?.split(' ')[0]}
                                </button>
                              )}
                              {p1 && p2 && (
                                <>
                                  <button onClick={() => selectWinner(m.id, p1.id)} disabled={selectingWinner === m.id}
                                    className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-medium disabled:opacity-50">
                                    ✓{uiName(p1.name)?.split(' ')[0]}
                                  </button>
                                  <button onClick={() => selectWinner(m.id, p2.id)} disabled={selectingWinner === m.id}
                                    className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-medium disabled:opacity-50">
                                    ✓{uiName(p2.name)?.split(' ')[0]}
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {!is1PointSlam && canEditSchedule(m) && (
                            <div className="flex gap-1.5">
                              {m.status !== 'played' && m.home_player_id && m.away_player_id && onStartLive && (
                                <button
                                  onClick={() => onStartLive(m.id)}
                                  className="px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[10px] font-medium"
                                >
                                  🔴
                                </button>
                              )}
                              <button
                                onClick={() => onEditSchedule(m)}
                                className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-medium"
                              >
                                📅
                              </button>
                              <button
                                onClick={() => onEditResult(m)}
                                className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-medium"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>)}
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
}
