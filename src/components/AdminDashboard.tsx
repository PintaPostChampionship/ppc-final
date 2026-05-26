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
      const n = activeRegs.length;
      const expected = (n * (n - 1)) / 2;
      // Only count league matches (not playoffs)
      const played = tournamentMatches.filter(m =>
        m.division_id === div.id &&
        m.status === 'played' &&
        !m.phase
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition">
              ← Volver
            </button>
            <h1 className="text-xl sm:text-2xl font-bold">📊 Dashboard Admin</h1>
          </div>
          <select
            value={selectedTournamentId}
            onChange={e => setSelectedTournamentId(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {leagueTournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.status === 'active' ? '🟢' : ''}
              </option>
            ))}
          </select>
        </div>

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
      </div>
    </div>
  );
}
