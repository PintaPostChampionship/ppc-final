import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Tournament, Division, Match, Registration, Profile } from '../types';

interface AdminDashboardProps {
  tournaments: Tournament[];
  divisions: Division[];
  matches: Match[];
  registrations: Registration[];
  profiles: Profile[];
  onBack: () => void;
}

interface DivisionProgress {
  name: string;
  color: string;
  activePlayers: number;
  expectedMatches: number;
  playedMatches: number;
  percent: number;
}

interface WeekData {
  weekNum: number;
  weekLabel: string;
  played: number;
  cumulative: number;
  cumulativePercent: number;
}

interface HistoricComparison {
  tournamentName: string;
  totalExpected: number;
  weeklyProgress: { weekNum: number; cumulativePercent: number }[];
}

export function AdminDashboard({
  tournaments,
  divisions,
  matches,
  registrations,
  profiles,
  onBack,
}: AdminDashboardProps) {
  // Select which tournament to analyze
  const leagueTournaments = tournaments
    .filter(t => t.format === 'league' || !t.format)
    .filter(t => t.status === 'active' || t.status === 'finished' || t.status === 'completed')
    .sort((a, b) => {
      // Active first, then finished
      const statusOrder = (s: string) => s === 'active' ? 0 : 1;
      const sd = statusOrder(a.status) - statusOrder(b.status);
      if (sd !== 0) return sd;
      // Within same status, use sort_order (lower = first)
      const so = (a.sort_order ?? 99) - (b.sort_order ?? 99);
      if (so !== 0) return so;
      // Fallback: newer first
      return (b.start_date || '').localeCompare(a.start_date || '');
    });

  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(() => {
    // Restore from sessionStorage if available
    try {
      const saved = sessionStorage.getItem('ppc_admin_dashboard_tournament');
      if (saved && leagueTournaments.some(t => t.id === saved)) return saved;
    } catch {}
    return leagueTournaments.find(t => t.status === 'active')?.id || leagueTournaments[0]?.id || '';
  });

  const [dashboardTab, setDashboardTab] = useState<'progress' | 'settings'>('progress');

  // Persist selection
  useEffect(() => {
    try { sessionStorage.setItem('ppc_admin_dashboard_tournament', selectedTournamentId); } catch {}
  }, [selectedTournamentId]);

  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId);
  const tournamentDivisions = divisions.filter(d => d.tournament_id === selectedTournamentId);
  const tournamentMatches = matches.filter(m => m.tournament_id === selectedTournamentId);
  const tournamentRegs = registrations.filter(r => r.tournament_id === selectedTournamentId);

  // --- Division progress ---
  const divisionProgress: DivisionProgress[] = useMemo(() => {
    return tournamentDivisions.map(div => {
      const divRegs = tournamentRegs.filter(r => r.division_id === div.id);
      const activeRegs = divRegs.filter(r => r.status !== 'retired');
      const activeIds = new Set(activeRegs.map(r => r.profile_id).filter(Boolean));
      const n = activeRegs.length;
      const expected = (n * (n - 1)) / 2;
      // Only count league matches between ACTIVE players
      const played = tournamentMatches.filter(m =>
        m.division_id === div.id &&
        m.status === 'played' &&
        !m.phase &&
        activeIds.has(m.home_player_id) &&
        activeIds.has(m.away_player_id)
      ).length;
      const percent = expected > 0 ? Math.round((played / expected) * 100) : 0;

      return {
        name: div.name || 'Sin nombre',
        color: div.color || '#6b7280',
        activePlayers: n,
        expectedMatches: expected,
        playedMatches: played,
        percent,
      };
    }).sort((a, b) => b.percent - a.percent);
  }, [tournamentDivisions, tournamentRegs, tournamentMatches]);

  const totalExpected = divisionProgress.reduce((s, d) => s + d.expectedMatches, 0);
  const totalPlayed = divisionProgress.reduce((s, d) => s + d.playedMatches, 0);
  const overallPercent = totalExpected > 0 ? Math.round((totalPlayed / totalExpected) * 100) : 0;

  // --- Timeline ---
  const startDate = selectedTournament?.start_date ? new Date(selectedTournament.start_date + 'T00:00:00') : null;
  // Use league_end_date (group stage deadline) if available, otherwise end_date
  const leagueDeadline = selectedTournament?.league_end_date || selectedTournament?.end_date || null;
  const endDate = leagueDeadline ? new Date(leagueDeadline + 'T00:00:00') : null;
  const tournamentEndDate = selectedTournament?.end_date ? new Date(selectedTournament.end_date + 'T00:00:00') : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalWeeks = startDate && endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 86400000))
    : 0;
  const elapsedWeeks = startDate
    ? Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (7 * 86400000)))
    : 0;
  const remainingWeeks = Math.max(0, totalWeeks - elapsedWeeks);

  // --- Weekly breakdown ---
  const weeklyData: WeekData[] = useMemo(() => {
    if (!startDate) return [];

    const playedMatches = tournamentMatches
      .filter(m => m.status === 'played' && m.date && (m.phase === null || m.phase === undefined || m.phase === ''))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (playedMatches.length === 0) return [];

    const weekMap = new Map<number, number>();

    for (const m of playedMatches) {
      const matchDate = new Date(m.date.slice(0, 10) + 'T00:00:00');
      const weekNum = Math.max(1, Math.ceil((matchDate.getTime() - startDate.getTime()) / (7 * 86400000)));
      weekMap.set(weekNum, (weekMap.get(weekNum) || 0) + 1);
    }

    const result: WeekData[] = [];
    let cumulative = 0;
    const maxWeek = Math.max(elapsedWeeks, ...Array.from(weekMap.keys()));

    for (let w = 1; w <= maxWeek; w++) {
      const played = weekMap.get(w) || 0;
      cumulative += played;
      const weekStart = new Date(startDate.getTime() + (w - 1) * 7 * 86400000);
      result.push({
        weekNum: w,
        weekLabel: `S${w}`,
        played,
        cumulative,
        cumulativePercent: totalExpected > 0 ? Math.round((cumulative / totalExpected) * 100) : 0,
      });
    }

    return result;
  }, [tournamentMatches, startDate, totalExpected, elapsedWeeks]);

  // --- Historic comparison ---
  const historicData: HistoricComparison[] = useMemo(() => {
    const finishedLeagues = tournaments
      .filter(t => (t.status === 'finished' || t.status === 'completed') && t.format !== 'knockout')
      .filter(t => /^(PPC|WPPC) Edición/i.test(t.name || ''))
      .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
      .slice(0, 4); // Last 4 editions

    return finishedLeagues.map(t => {
      const tDivs = divisions.filter(d => d.tournament_id === t.id);
      const tRegs = registrations.filter(r => r.tournament_id === t.id);
      const tMatches = matches.filter(m => m.tournament_id === t.id && m.status === 'played' && !m.phase);

      // Calculate expected
      let expected = 0;
      for (const div of tDivs) {
        const n = tRegs.filter(r => r.division_id === div.id && r.status !== 'retired').length;
        expected += (n * (n - 1)) / 2;
      }

      // Weekly progress
      const tStart = t.start_date ? new Date(t.start_date + 'T00:00:00') : null;
      if (!tStart || expected === 0) return { tournamentName: t.name, totalExpected: expected, weeklyProgress: [] };

      const sorted = tMatches
        .filter(m => m.date)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      const weekMap = new Map<number, number>();
      for (const m of sorted) {
        const mDate = new Date(m.date.slice(0, 10) + 'T00:00:00');
        const wk = Math.max(1, Math.ceil((mDate.getTime() - tStart.getTime()) / (7 * 86400000)));
        weekMap.set(wk, (weekMap.get(wk) || 0) + 1);
      }

      const progress: { weekNum: number; cumulativePercent: number }[] = [];
      let cum = 0;
      const maxW = Math.max(...Array.from(weekMap.keys()), 0);
      for (let w = 1; w <= maxW; w++) {
        cum += weekMap.get(w) || 0;
        progress.push({ weekNum: w, cumulativePercent: Math.round((cum / expected) * 100) });
      }

      return { tournamentName: t.name, totalExpected: expected, weeklyProgress: progress };
    });
  }, [tournaments, divisions, registrations, matches]);

  // --- Required pace ---
  const remainingMatches = totalExpected - totalPlayed;
  const requiredPerWeek = remainingWeeks > 0 ? Math.ceil(remainingMatches / remainingWeeks) : remainingMatches;
  const avgPerWeek = weeklyData.length > 0
    ? Math.round(weeklyData.reduce((s, w) => s + w.played, 0) / weeklyData.length * 10) / 10
    : 0;

  // --- Deadline info ---
  const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000)) : 0;
  const totalDays = startDate && endDate ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)) : 1;
  const elapsedDays = startDate ? Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / 86400000)) : 0;
  const timePercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition">
              ← Volver
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">📊 Dashboard Admin</h1>
          </div>
          <select
            value={selectedTournamentId}
            onChange={e => setSelectedTournamentId(e.target.value)}
            className="w-full sm:w-auto bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            {leagueTournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.status === 'active' ? '🟢' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setDashboardTab('progress')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              dashboardTab === 'progress'
                ? 'bg-slate-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📈 Progreso
          </button>
          <button
            onClick={() => setDashboardTab('settings')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              dashboardTab === 'settings'
                ? 'bg-slate-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚙️ Ajustes Divisiones
          </button>
        </div>

        {dashboardTab === 'progress' && (<>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{overallPercent}%</div>
            <div className="text-xs text-slate-400 mt-1">Partidos completados</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl sm:text-3xl font-bold text-purple-400">{timePercent}%</div>
            <div className="text-xs text-slate-400 mt-1">Tiempo transcurrido</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Queda {100 - timePercent}% del plazo</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl sm:text-3xl font-bold text-sky-400">{totalPlayed}/{totalExpected}</div>
            <div className="text-xs text-slate-400 mt-1">Partidos jugados</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl sm:text-3xl font-bold text-amber-400">{daysRemaining}d</div>
            <div className="text-xs text-slate-400 mt-1">Para cerrar fase de grupos</div>
            {tournamentEndDate && endDate && tournamentEndDate.getTime() !== endDate.getTime() && (
              <div className="text-[10px] text-slate-500 mt-0.5">Final: {selectedTournament?.end_date?.slice(5)}</div>
            )}
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl sm:text-3xl font-bold text-rose-400">{requiredPerWeek}</div>
            <div className="text-xs text-slate-400 mt-1">Partidos/sem necesarios</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Actual: {avgPerWeek}/sem</div>
          </div>
        </div>

        {/* Pace indicator */}
        {selectedTournament?.status === 'active' && (
          <>
            {/* Time vs Progress visual */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>Progreso vs Tiempo</span>
                <span className={overallPercent >= timePercent ? 'text-emerald-400' : 'text-rose-400'}>
                  {overallPercent >= timePercent ? '↑ Adelantados' : '↓ Atrasados'} ({overallPercent - timePercent > 0 ? '+' : ''}{overallPercent - timePercent}%)
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>⏱ Tiempo ({timePercent}%)</span>
                    <span>{elapsedDays}d de {totalDays}d</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${timePercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>🎾 Partidos ({overallPercent}%)</span>
                    <span>{totalPlayed} de {totalExpected}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${overallPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-4 mb-6 border ${
            avgPerWeek >= requiredPerWeek
              ? 'bg-emerald-900/30 border-emerald-700'
              : avgPerWeek >= requiredPerWeek * 0.7
                ? 'bg-amber-900/30 border-amber-700'
                : 'bg-rose-900/30 border-rose-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {avgPerWeek >= requiredPerWeek ? '✅' : avgPerWeek >= requiredPerWeek * 0.7 ? '⚠️' : '🚨'}
              </span>
              <span className="text-sm font-medium">
                {avgPerWeek >= requiredPerWeek
                  ? 'Buen ritmo — van a terminar a tiempo'
                  : avgPerWeek >= requiredPerWeek * 0.7
                    ? 'Ritmo ajustado — hay que acelerar un poco'
                    : `Ritmo bajo — necesitan ${requiredPerWeek} partidos/semana (actual: ${avgPerWeek})`
                }
              </span>
            </div>
          </div>
          </>
        )}

        {/* Division progress */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Progreso por División</h2>
          <div className="space-y-3">
            {divisionProgress.map(div => (
              <div key={div.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: div.color }} />
                    <span className="text-sm font-medium">{div.name}</span>
                    <span className="text-[10px] text-slate-500">({div.activePlayers} jugadores)</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {div.playedMatches}/{div.expectedMatches} ({div.percent}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${div.percent}%`, backgroundColor: div.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Partidos por Semana</h2>
          {weeklyData.length > 0 ? (
            <div className="space-y-2">
              {/* Bar chart — height relative to max played in any week */}
              <div className="flex items-end gap-1.5 h-40">
                {weeklyData.map(w => {
                  const maxPlayed = Math.max(...weeklyData.map(x => x.played), 1);
                  const heightPct = (w.played / maxPlayed) * 100;
                  return (
                    <div key={w.weekNum} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <span className="text-[10px] font-semibold text-slate-300">{w.played}</span>
                      <div
                        className={`w-full rounded-t-md ${w.played >= requiredPerWeek ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ height: `${Math.max(heightPct, 8)}%` }}
                      />
                      <span className="text-[9px] text-slate-500">{w.weekLabel}</span>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> ≥ ritmo necesario</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> bajo ritmo</span>
                </div>
                <span className="text-rose-400">Meta: {requiredPerWeek}/sem · Promedio: {avgPerWeek}/sem</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Sin datos de partidos aún</p>
          )}
        </div>

        {/* Historic comparison */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
            Comparación con Ediciones Anteriores (% completado por semana)
          </h2>
          {historicData.length > 0 || weeklyData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="text-left py-2 px-2">Semana</th>
                    {selectedTournament && (
                      <th className="text-center py-2 px-2 text-emerald-400">{selectedTournament.name}</th>
                    )}
                    {historicData.map(h => (
                      <th key={h.tournamentName} className="text-center py-2 px-2 text-slate-400">
                        {h.tournamentName.replace(/\s*\(.*\)/, '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(20, Math.max(elapsedWeeks, 8)) }, (_, i) => i + 1).map(week => {
                    const currentWeek = weeklyData.find(w => w.weekNum === week);
                    return (
                      <tr key={week} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-1.5 px-2 text-slate-400">S{week}</td>
                        <td className="py-1.5 px-2 text-center font-mono">
                          {currentWeek ? (
                            <span className="text-emerald-400 font-semibold">{currentWeek.cumulativePercent}%</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        {historicData.map(h => {
                          const hw = h.weeklyProgress.find(p => p.weekNum === week);
                          return (
                            <td key={h.tournamentName} className="py-1.5 px-2 text-center font-mono text-slate-400">
                              {hw ? `${hw.cumulativePercent}%` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">Sin datos históricos disponibles</p>
          )}
        </div>

        {/* Top 10 más y menos activos — across active PPC/WPPC tournaments */}
        <PlayerActivityRanking
          tournaments={tournaments}
          divisions={divisions}
          matches={matches}
          registrations={registrations}
          profiles={profiles}
        />

        {/* Top 10 Pintas */}
        <PintsRanking
          tournaments={tournaments}
          divisions={divisions}
          matches={matches}
          registrations={registrations}
          profiles={profiles}
        />
        </>)}

        {dashboardTab === 'settings' && (
          <DivisionSettings
            tournaments={tournaments}
            divisions={divisions}
            registrations={registrations}
            profiles={profiles}
            selectedTournamentId={selectedTournamentId}
          />
        )}
      </div>
    </div>
  );
}


// --- Division Settings Tab ---
function DivisionSettings({
  tournaments,
  divisions,
  registrations,
  profiles,
  selectedTournamentId,
}: {
  tournaments: Tournament[];
  divisions: Division[];
  registrations: Registration[];
  profiles: Profile[];
  selectedTournamentId: string;
}) {
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});

  // Division rank for sorting (same order as tournament view)
  const divRank = (name?: string | null) => {
    const n = (name || '').trim().toLowerCase();
    if (n === 'oro') return 1;
    if (n === 'plata') return 2;
    if (n === 'bronce') return 3;
    if (n === 'cobre') return 4;
    if (n === 'diamante') return 5;
    if (n === 'hierro') return 6;
    return 99;
  };

  const tournamentDivisions = divisions
    .filter(d => d.tournament_id === selectedTournamentId)
    .sort((a, b) => divRank(a.name) - divRank(b.name));

  const filteredRegs = registrations
    .filter(r => r.tournament_id === selectedTournamentId)
    .filter(r => divisionFilter === 'all' || r.division_id === divisionFilter)
    .filter(r => {
      if (statusFilter === 'all') return true;
      const s = localOverrides[r.id] || r.status || 'active';
      return s === statusFilter;
    })
    .sort((a, b) => {
      // Sort by division rank first
      const divA = divisions.find(d => d.id === a.division_id);
      const divB = divisions.find(d => d.id === b.division_id);
      const dr = divRank(divA?.name) - divRank(divB?.name);
      if (dr !== 0) return dr;
      // Then active first
      const statusA = localOverrides[a.id] || a.status || 'active';
      const statusB = localOverrides[b.id] || b.status || 'active';
      const statusOrder = (s: string) => s === 'retired' ? 1 : 0;
      const sd = statusOrder(statusA) - statusOrder(statusB);
      if (sd !== 0) return sd;
      // Then by name
      const nameA = profiles.find(p => p.id === a.profile_id)?.name || '';
      const nameB = profiles.find(p => p.id === b.profile_id)?.name || '';
      return nameA.localeCompare(nameB, 'es');
    });

  const handleToggleStatus = async (reg: Registration) => {
    const currentStatus = localOverrides[reg.id] || reg.status || 'active';
    const newStatus = currentStatus === 'retired' ? 'active' : 'retired';
    const playerName = profiles.find(p => p.id === reg.profile_id)?.name || 'Jugador';
    const action = newStatus === 'retired' ? 'retirar' : 'reactivar';

    if (!window.confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a ${playerName}?`)) return;

    setUpdating(reg.id);
    try {
      const { error } = await supabase
        .from('tournament_registrations')
        .update({ status: newStatus })
        .eq('id', reg.id);
      if (error) throw error;

      setLocalOverrides(prev => ({ ...prev, [reg.id]: newStatus }));
      setUpdating(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setUpdating(null);
    }
  };

  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId);

  return (
    <div>
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Jugadores — {selectedTournament?.name || 'Torneo'}
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="appearance-none bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 pr-7 text-sm text-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="retired">Retirados</option>
            </select>
            <select
              value={divisionFilter}
              onChange={e => setDivisionFilter(e.target.value)}
              className="appearance-none bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 pr-7 text-sm text-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
            >
              <option value="all">Todas las divisiones</option>
              {tournamentDivisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredRegs.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No hay jugadores registrados.</p>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <span>Jugador</span>
              <span className="w-20 text-center">División</span>
              <span className="w-24 text-center">Estado</span>
            </div>

            {filteredRegs.map(reg => {
              const player = profiles.find(p => p.id === reg.profile_id);
              const div = divisions.find(d => d.id === reg.division_id);
              const effectiveStatus = localOverrides[reg.id] || reg.status || 'active';
              const isRetired = effectiveStatus === 'retired';
              const isUpdating = updating === reg.id;

              return (
                <div
                  key={reg.id}
                  className={`grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 rounded-lg ${
                    isRetired ? 'bg-slate-800/50 opacity-60' : 'bg-slate-700/30'
                  }`}
                >
                  <span className={`text-sm font-medium truncate ${isRetired ? 'text-slate-400 line-through' : 'text-white'}`}>
                    {player?.name || '—'}
                  </span>
                  <span className="w-20 text-center text-xs text-slate-400">
                    {div?.name || '—'}
                  </span>
                  <button
                    onClick={() => handleToggleStatus(reg)}
                    disabled={isUpdating}
                    className={`w-24 text-center text-xs font-semibold py-1.5 rounded-lg transition ${
                      isRetired
                        ? 'bg-slate-600 text-slate-300 hover:bg-emerald-700 hover:text-white'
                        : 'bg-emerald-600/20 text-emerald-400 hover:bg-rose-700 hover:text-white'
                    } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {isUpdating ? '...' : isRetired ? 'Reactivar' : 'Activo ✓'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-[10px] text-slate-500">
          Click en el estado para cambiar entre Activo y Retirado. Los jugadores retirados no cuentan para la tabla de posiciones.
        </div>
      </div>
    </div>
  );
}


// --- Pints Ranking ---
function PintsRanking({
  tournaments,
  divisions,
  matches,
  registrations,
  profiles,
}: {
  tournaments: Tournament[];
  divisions: Division[];
  matches: Match[];
  registrations: Registration[];
  profiles: Profile[];
}) {
  const [onlyMen, setOnlyMen] = useState(false);
  const [showRatio, setShowRatio] = useState(false);

  const data = useMemo(() => {
    let activeTournaments = tournaments.filter(t =>
      t.status === 'active' &&
      (t.format === 'league' || !t.format) &&
      (/^(PPC|WPPC) Edición/i.test(t.name || ''))
    );

    if (onlyMen) {
      activeTournaments = activeTournaments.filter(t => /^PPC /i.test(t.name || ''));
    }

    if (activeTournaments.length === 0) return { byTotal: [], byRatio: [] };

    type PintRow = { id: string; name: string; division: string; pints: number; played: number; ratio: number };
    const rows: PintRow[] = [];

    for (const t of activeTournaments) {
      const tDivs = divisions.filter(d => d.tournament_id === t.id);
      const tRegs = registrations.filter(r => r.tournament_id === t.id && r.status !== 'retired');
      const activeIds = new Set(tRegs.map(r => r.profile_id).filter(Boolean));
      const tMatches = matches.filter(m =>
        m.tournament_id === t.id && m.status === 'played' && !m.phase &&
        activeIds.has(m.home_player_id) && activeIds.has(m.away_player_id)
      );

      for (const reg of tRegs) {
        const pid = reg.profile_id;
        if (!pid) continue;
        const profile = profiles.find(p => p.id === pid);
        if (!profile) continue;
        const div = tDivs.find(d => d.id === reg.division_id);

        let pints = 0;
        let played = 0;
        tMatches.forEach(m => {
          if (m.home_player_id === pid) { pints += m.player1_pints || 0; played++; }
          else if (m.away_player_id === pid) { pints += m.player2_pints || 0; played++; }
        });

        if (pints > 0) {
          rows.push({ id: pid, name: profile.name || '—', division: div?.name || '—', pints, played, ratio: played > 0 ? pints / played : 0 });
        }
      }
    }

    const byTotal = [...rows].sort((a, b) => b.pints - a.pints).slice(0, 10);
    const byRatio = [...rows].filter(r => r.played >= 2).sort((a, b) => b.ratio - a.ratio).slice(0, 10);

    return { byTotal, byRatio };
  }, [tournaments, divisions, matches, registrations, profiles, onlyMen]);

  if (data.byTotal.length === 0) return null;

  const displayData = showRatio ? data.byRatio : data.byTotal;

  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
          🍻 Top 10 — {showRatio ? 'Mejor Ratio Pintas/Partido' : 'Más Pintas'}
        </h2>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMen}
              onChange={e => setOnlyMen(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            Solo Hombres
          </label>
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRatio}
              onChange={e => setShowRatio(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
            />
            Ratio por partido
          </label>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-700">
        <div className="space-y-1.5">
          {displayData.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-500 w-4 text-right text-[11px] shrink-0">{i + 1}.</span>
                <span className="text-white text-xs sm:text-sm font-medium truncate">{p.name}</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 shrink-0">({p.division})</span>
              </div>
              <span className="text-amber-400 font-bold text-sm ml-2 shrink-0">
                {showRatio
                  ? `${p.ratio.toFixed(2)} (${p.pints}/${p.played})`
                  : `🍻 ${p.pints}`
                }
              </span>
            </div>
          ))}
        </div>
        {showRatio && (
          <p className="text-[10px] text-slate-500 mt-3">Mínimo 2 partidos jugados para aparecer en el ratio.</p>
        )}
      </div>

      {/* Top 1 por división */}
      <div className="bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-700 mt-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          🏆 Líder por División — {showRatio ? 'Ratio' : 'Total Pintas'}
        </h3>
        <div className="space-y-1.5">
          {(() => {
            let activeTournaments = tournaments.filter(t =>
              t.status === 'active' &&
              (t.format === 'league' || !t.format) &&
              (/^(PPC|WPPC) Edición/i.test(t.name || ''))
            );
            if (onlyMen) {
              activeTournaments = activeTournaments.filter(t => /^PPC /i.test(t.name || ''));
            }

            const divRank = (name?: string | null) => {
              const n = (name || '').trim().toLowerCase();
              if (n === 'oro') return 1; if (n === 'plata') return 2; if (n === 'bronce') return 3;
              if (n === 'cobre') return 4; if (n === 'diamante') return 5; if (n === 'hierro') return 6;
              return 99;
            };

            type DivLeader = { divName: string; tournament: string; name: string; pints: number; played: number; ratio: number };
            const leaders: DivLeader[] = [];

            for (const t of activeTournaments) {
              const tDivs = divisions.filter(d => d.tournament_id === t.id).sort((a, b) => divRank(a.name) - divRank(b.name));
              const tRegs = registrations.filter(r => r.tournament_id === t.id && r.status !== 'retired');
              const activeIds = new Set(tRegs.map(r => r.profile_id).filter(Boolean));
              const tMatches = matches.filter(m =>
                m.tournament_id === t.id && m.status === 'played' && !m.phase &&
                activeIds.has(m.home_player_id) && activeIds.has(m.away_player_id)
              );

              for (const div of tDivs) {
                const divRegs = tRegs.filter(r => r.division_id === div.id);
                let best: { name: string; pints: number; played: number; ratio: number } | null = null;

                for (const reg of divRegs) {
                  const pid = reg.profile_id;
                  if (!pid) continue;
                  const profile = profiles.find(p => p.id === pid);
                  if (!profile) continue;

                  let pints = 0; let played = 0;
                  tMatches.forEach(m => {
                    if (m.home_player_id === pid) { pints += m.player1_pints || 0; played++; }
                    else if (m.away_player_id === pid) { pints += m.player2_pints || 0; played++; }
                  });

                  if (pints === 0) continue;
                  const ratio = played > 0 ? pints / played : 0;
                  const isBetter = showRatio
                    ? (played >= 2 && (!best || ratio > best.ratio))
                    : (!best || pints > best.pints);
                  if (isBetter) best = { name: profile.name || '—', pints, played, ratio };
                }

                if (best) {
                  leaders.push({ divName: div.name || '—', tournament: t.name.replace(/\s*\(.*\)/, ''), ...best });
                }
              }
            }

            return leaders.map((l, i) => (
              <div key={`${l.divName}-${l.tournament}-${i}`} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-white text-xs sm:text-sm font-medium truncate">{l.name}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 shrink-0">({l.divName})</span>
                </div>
                <span className="text-amber-400 font-bold text-sm ml-2 shrink-0">
                  {showRatio ? `${l.ratio.toFixed(2)} (${l.pints}/${l.played})` : `🍻 ${l.pints}`}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}


// --- Extracted component: Player Activity Ranking with filters ---
function PlayerActivityRanking({
  tournaments,
  divisions,
  matches,
  registrations,
  profiles,
}: {
  tournaments: Tournament[];
  divisions: Division[];
  matches: Match[];
  registrations: Registration[];
  profiles: Profile[];
}) {
  const [onlyMen, setOnlyMen] = useState(false);
  const [includeScheduled, setIncludeScheduled] = useState(false);

  const data = useMemo(() => {
    // Find active PPC and WPPC tournaments
    let activeTournaments = tournaments.filter(t =>
      t.status === 'active' &&
      (t.format === 'league' || !t.format) &&
      (/^(PPC|WPPC) Edición/i.test(t.name || ''))
    );

    if (onlyMen) {
      activeTournaments = activeTournaments.filter(t => /^PPC /i.test(t.name || ''));
    }

    if (activeTournaments.length === 0) return { top10: [], bottom10: [] };

    type PlayerRow = { id: string; name: string; division: string; count: number };
    const playerRows: PlayerRow[] = [];

    for (const t of activeTournaments) {
      const tDivs = divisions.filter(d => d.tournament_id === t.id);
      const tRegs = registrations.filter(r => r.tournament_id === t.id && r.status !== 'retired');

      const statusFilter = includeScheduled
        ? (m: Match) => m.status === 'played' || m.status === 'scheduled'
        : (m: Match) => m.status === 'played';

      const tMatches = matches.filter(m => m.tournament_id === t.id && statusFilter(m) && !m.phase);

      for (const reg of tRegs) {
        const pid = reg.profile_id;
        if (!pid) continue;
        const profile = profiles.find(p => p.id === pid);
        if (!profile) continue;
        const div = tDivs.find(d => d.id === reg.division_id);
        const count = tMatches.filter(m =>
          m.home_player_id === pid || m.away_player_id === pid
        ).length;
        playerRows.push({
          id: pid,
          name: profile.name || '—',
          division: div?.name || '—',
          count,
        });
      }
    }

    const sorted = [...playerRows].sort((a, b) => b.count - a.count);
    const top10 = sorted.slice(0, 10);
    const bottom10 = [...playerRows].sort((a, b) => a.count - b.count).slice(0, 10);

    return { top10, bottom10 };
  }, [tournaments, divisions, matches, registrations, profiles, onlyMen, includeScheduled]);

  if (data.top10.length === 0 && data.bottom10.length === 0) return null;

  const countLabel = includeScheduled ? 'GP + GS' : 'GP';

  return (
    <div className="mt-6">
      {/* Title + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
          Ranking de Actividad — Torneos Activos
        </h2>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMen}
              onChange={e => setOnlyMen(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            Solo Hombres
          </label>
          <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeScheduled}
              onChange={e => setIncludeScheduled(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            Incluir agendados
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top 10 más activos */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-700">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">🏆 Más Partidos ({countLabel})</h3>
          <div className="space-y-1.5">
            {data.top10.map((p, i) => (
              <div key={`top-${p.id}`} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-500 w-4 text-right text-[11px] shrink-0">{i + 1}.</span>
                  <span className="text-white text-xs sm:text-sm font-medium truncate">{p.name}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 shrink-0">({p.division})</span>
                </div>
                <span className="text-emerald-400 font-bold text-sm ml-2 shrink-0">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 menos activos */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-700">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">⚠️ Menos Partidos ({countLabel})</h3>
          <div className="space-y-1.5">
            {data.bottom10.map((p, i) => (
              <div key={`bot-${p.id}`} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-500 w-4 text-right text-[11px] shrink-0">{i + 1}.</span>
                  <span className="text-white text-xs sm:text-sm font-medium truncate">{p.name}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 shrink-0">({p.division})</span>
                </div>
                <span className={`font-bold text-sm ml-2 shrink-0 ${p.count === 0 ? 'text-rose-400' : 'text-amber-400'}`}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
