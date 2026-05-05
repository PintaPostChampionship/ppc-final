import React from 'react';
import type { Tournament, Match, Profile, HistoricPlayer, MatchSet } from '../types';
import { uiName } from '../lib/displayUtils';
import { supabase } from '../lib/supabaseClient';

export function getNextMatchPosition(round: string | null | undefined, pos: number | null | undefined) {
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

  // Calcular el partido siguiente
  const meta = getNextMatchPosition(match.knockout_round, match.bracket_position);
  if (!meta) return; // Final no tiene siguiente ronda

  const { nextRound, nextPos } = meta;

  // Buscar si ya existe el partido de la siguiente ronda
  const { data: existing, error: existingErr } = await supabaseClient
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

    await supabaseClient.from('matches').insert({
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

  // Colocamos siempre los slots, aunque no haya partido en BD → se ve el "esqueleto" completo
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

        {/* Desktop: tabla */}
        <div className="hidden sm:block bg-white/95 border border-slate-200 rounded-2xl overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
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

        {/* Mobile: tarjetas */}
        <div className="sm:hidden space-y-3">
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
                return (a.time || "").localeCompare(b.time || "");
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
                <div
                  key={m.id}
                  className="bg-white/95 border border-slate-200 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {roundLabel}
                    </span>
                    {m.status === "played" && (
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Jugado
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-slate-800 mb-2">
                    {p1?.name ?? "Por definir"}
                    <span className="text-slate-400 mx-1">vs</span>
                    {p2?.name ?? "—"}
                  </p>

                  <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                    <div>📅 {dateText}{timeText && ` · ${timeText}`}</div>
                    <div>📍 {placeText}</div>
                  </div>

                  {canEditSchedule(m) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEditSchedule(m)}
                        className="flex-1 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xs font-medium"
                      >
                        Editar horario
                      </button>
                      <button
                        onClick={() => onEditResult(m)}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium"
                      >
                        Agregar resultados
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>


    </div>
  );
}
