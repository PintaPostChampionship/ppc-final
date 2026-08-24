// ─────────────────────────────────────────────────────────────────────────────
// LiveScoreboard.tsx — Componente principal del Live Scoreboard PPC
// Orquesta: carga de datos, permisos, flujo de inicio, controles de editor,
// finalización, compartir.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { useLiveScore } from './useLiveScore';
import LiveScoreDisplay from './LiveScoreDisplay';
import { isEditor, type MatchFormat } from './liveScoreUtils';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface MatchData {
  id: string;
  home_player_id: string;
  away_player_id: string | null;
  home_historic_player_id?: string | null;
  away_historic_player_id?: string | null;
  status: string;
  tournament_id: string;
  division_id: string;
}

interface ProfileData {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
  nickname?: string | null;
}

interface HistoricPlayerData {
  id: string;
  name: string;
  avatar_url?: string | null;
}

export interface LiveScoreboardProps {
  matchId: string;
  currentUser: User | null;
  currentProfile: ProfileData | null;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarUrl(profile?: ProfileData | HistoricPlayerData | null): string | undefined {
  return profile?.avatar_url ?? undefined;
}

function playerName(
  profile?: ProfileData | HistoricPlayerData | null,
  fallback = 'Jugador'
): string {
  return profile?.name ?? fallback;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function LiveScoreboard({
  matchId,
  currentUser,
  currentProfile,
  onBack,
}: LiveScoreboardProps) {
  // ── Estado local ────────────────────────────────────────────────────────────
  const [match, setMatch] = useState<MatchData | null>(null);
  const [player1, setPlayer1] = useState<ProfileData | HistoricPlayerData | null>(null);
  const [player2, setPlayer2] = useState<ProfileData | HistoricPlayerData | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Flujo de inicio
  const [selectedFormat, setSelectedFormat] = useState<MatchFormat>('standard');
  const [selectedServer, setSelectedServer] = useState<1 | 2>(1);
  const [starting, setStarting] = useState(false);

  // Compartir
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState(false);

  // Añadir editor
  const [showAddEditor, setShowAddEditor] = useState(false);
  const [editorSearch, setEditorSearch] = useState('');
  const [editorResults, setEditorResults] = useState<ProfileData[]>([]);
  const [addingEditor, setAddingEditor] = useState(false);

  // Toast de error
  const [toast, setToast] = useState<string | null>(null);

  // Cancelar partido
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Reset partido
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Admin panel
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('broadcast');
  const [selectedServeIndicator, setSelectedServeIndicator] = useState('ball');
  const [selectedLogo, setSelectedLogo] = useState('ppc');
  const [settingFeatured, setSettingFeatured] = useState(false);

  // ── Hook de live score ──────────────────────────────────────────────────────
  const {
    state,
    loading: scoreLoading,
    error: scoreError,
    connectionStatus,
    canUndo,
    addPoint,
    undo,
    addEditor,
    initMatch,
    cancelMatch,
    resetMatch,
  } = useLiveScore(matchId, currentUser?.id);

  // ── Mostrar errores del hook como toast ─────────────────────────────────────
  useEffect(() => {
    if (scoreError) showToast(scoreError);
  }, [scoreError]);

  // ── Carga de datos del partido ──────────────────────────────────────────────
  useEffect(() => {
    async function loadMatch() {
      setMatchLoading(true);

      const { data: matchData, error: matchErr } = await supabase
        .from('matches')
        .select('id, home_player_id, away_player_id, home_historic_player_id, away_historic_player_id, status, tournament_id, division_id')
        .eq('id', matchId)
        .maybeSingle();

      if (matchErr || !matchData) {
        setMatchError('Partido no encontrado.');
        setMatchLoading(false);
        return;
      }

      setMatch(matchData as MatchData);

      // Cargar jugador 1
      if (matchData.home_player_id) {
        const { data: p1 } = await supabase
          .from('profiles')
          .select('id, name, role, avatar_url, nickname')
          .eq('id', matchData.home_player_id)
          .maybeSingle();
        setPlayer1(p1 as ProfileData | null);
      } else if (matchData.home_historic_player_id) {
        const { data: p1 } = await supabase
          .from('historic_players')
          .select('id, name, avatar_url')
          .eq('id', matchData.home_historic_player_id)
          .maybeSingle();
        setPlayer1(p1 as HistoricPlayerData | null);
      }

      // Cargar jugador 2
      if (matchData.away_player_id) {
        const { data: p2 } = await supabase
          .from('profiles')
          .select('id, name, role, avatar_url, nickname')
          .eq('id', matchData.away_player_id)
          .maybeSingle();
        setPlayer2(p2 as ProfileData | null);
      } else if (matchData.away_historic_player_id) {
        const { data: p2 } = await supabase
          .from('historic_players')
          .select('id, name, avatar_url')
          .eq('id', matchData.away_historic_player_id)
          .maybeSingle();
        setPlayer2(p2 as HistoricPlayerData | null);
      }

      setMatchLoading(false);
    }

    loadMatch();
  }, [matchId]);

  // ── Permisos ────────────────────────────────────────────────────────────────
  const canEdit = (() => {
    if (!currentProfile) return false;
    if (currentProfile.role === 'admin') return true;
    if (match && (currentProfile.id === match.home_player_id || currentProfile.id === match.away_player_id)) return true;
    if (state?.editor_ids?.includes(currentProfile.id)) return true;
    return false;
  })();

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Inicio del partido ──────────────────────────────────────────────────────
  const handleInitMatch = async () => {
    setStarting(true);
    await initMatch(selectedFormat, selectedServer);
    setStarting(false);
  };

  // ── Cancelar partido ────────────────────────────────────────────────────────
  const handleCancelMatch = async () => {
    setCancelling(true);
    await cancelMatch();
    setCancelling(false);
    setShowCancelConfirm(false);
    // Siempre volver y limpiar el hash, independientemente del resultado
    window.location.hash = '';
    onBack();
  };

  // ── Reset partido ────────────────────────────────────────────────────────────
  const handleResetMatch = async () => {
    setResetting(true);
    const ok = await resetMatch();
    setResetting(false);
    setShowResetConfirm(false);
    if (!ok) showToast('No se pudo resetear el partido.');
  };

  // ── Cambiar tema ────────────────────────────────────────────────────────────
  const handleChangeTheme = async (newTheme: string) => {
    setSelectedTheme(newTheme);
    await supabase
      .from('live_score_state')
      .update({ theme: newTheme })
      .eq('match_id', matchId);
  };

  // ── Cambiar indicador de servicio ───────────────────────────────────────────
  const handleChangeServeIndicator = async (indicator: string) => {
    setSelectedServeIndicator(indicator);
    await supabase
      .from('live_score_state')
      .update({ serve_indicator: indicator })
      .eq('match_id', matchId);
  };

  // ── Cambiar logo del overlay ────────────────────────────────────────────────
  const handleChangeLogo = async (logo: string) => {
    setSelectedLogo(logo);
    await supabase
      .from('live_score_state')
      .update({ overlay_logo: logo })
      .eq('match_id', matchId);
  };

  // ── Marcar como featured (prioridad para streaming) ─────────────────────────
  const handleSetFeatured = async () => {
    setSettingFeatured(true);
    // Quitar featured de todos
    await supabase
      .from('live_score_state')
      .update({ is_featured: false })
      .eq('is_featured', true);
    // Marcar este como featured
    await supabase
      .from('live_score_state')
      .update({ is_featured: true })
      .eq('match_id', matchId);
    setSettingFeatured(false);
    showToast('✓ Este partido ahora tiene prioridad en el streaming');
  };

  // Load settings from state when it arrives
  useEffect(() => {
    if (state?.theme) setSelectedTheme(state.theme);
    if (state?.serve_indicator) setSelectedServeIndicator(state.serve_indicator);
    if (state?.overlay_logo) setSelectedLogo(state.overlay_logo);
  }, [state?.match_id, state?.theme, state?.serve_indicator, state?.overlay_logo]);

  // ── Compartir ───────────────────────────────────────────────────────────────
  const liveUrl = `${window.location.origin}${window.location.pathname}#live/match/${matchId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopyConfirm(true);
      setTimeout(() => setCopyConfirm(false), 2000);
    } catch {
      showToast(`Copia este enlace: ${liveUrl}`);
    }
    setShowShareMenu(false);
  };

  const handleShareWhatsApp = () => {
    const p1Name = playerName(player1, 'Jugador 1');
    const p2Name = playerName(player2, 'Jugador 2');
    const scoreText = state
      ? state.completed_sets.map((s) => `${s.p1}-${s.p2}`).join(' ') ||
        `${state.p1_games}-${state.p2_games}`
      : '';
    const text = `🎾 Partido en vivo PPC: ${p1Name} vs ${p2Name}${scoreText ? `, ${scoreText}` : ''}. Síguelo en vivo: ${liveUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setShowShareMenu(false);
  };

  // ── Búsqueda de editores ────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorSearch.trim()) {
      setEditorResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, role, avatar_url, nickname')
        .ilike('name', `%${editorSearch}%`)
        .limit(5);
      setEditorResults((data as ProfileData[]) ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [editorSearch]);

  const handleAddEditor = async (userId: string) => {
    setAddingEditor(true);
    await addEditor(userId);
    setAddingEditor(false);
    setEditorSearch('');
    setEditorResults([]);
    setShowAddEditor(false);
  };

  // ── Renders de estado ───────────────────────────────────────────────────────

  if (matchLoading || scoreLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <img src="/loading-beer.gif" alt="Cargando..." className="h-16 w-16" />
          <p className="text-gray-400">Cargando partido...</p>
        </div>
      </div>
    );
  }

  if (matchError || !match) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 p-6">
        <p className="text-xl text-red-400">⚠️ {matchError ?? 'Partido no encontrado.'}</p>
        <button
          onClick={onBack}
          className="rounded-xl bg-gray-800 px-6 py-3 font-semibold text-white hover:bg-gray-700"
        >
          ← Volver
        </button>
      </div>
    );
  }

  const p1Name = playerName(player1, 'Jugador 1');
  const p2Name = playerName(player2, 'Jugador 2');
  const isFinished = state?.status === 'finished' || match.status === 'played';

  // ── Partido ya finalizado (solo lectura) ────────────────────────────────────
  if (isFinished && state) {
    const winnerName = state.p1_sets > state.p2_sets ? p1Name : p2Name;
    const loserName = state.p1_sets > state.p2_sets ? p2Name : p1Name;
    const scoreStr = state.completed_sets.map(s => `${s.p1}-${s.p2}`).join(' · ');

    return (
      <ScoreboardShell onBack={onBack} p1Name={p1Name} p2Name={p2Name} liveUrl={liveUrl}>
        {/* Victory screen */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🏆</div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">
            ¡{winnerName.split(' ')[0]} gana!
          </h2>
          <p className="text-lg font-semibold text-gray-600">
            {scoreStr}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            vs {loserName.split(' ')[0]}
          </p>
        </div>

        <LiveScoreDisplay
          state={state}
          player1Name={p1Name}
          player2Name={p2Name}
          player1Avatar={avatarUrl(player1)}
          player2Avatar={avatarUrl(player2)}
          connectionStatus="connected"
        />

        {/* Undo para corregir si se cerró por error */}
        {canEdit && canUndo && (
          <button
            onClick={undo}
            className="mt-4 w-full rounded-xl py-3 font-semibold text-amber-700 bg-amber-50 border border-amber-200 transition-all hover:bg-amber-100"
          >
            ↩ Deshacer último punto (cerrado por error)
          </button>
        )}

        {/* Retry finalization if match result wasn't saved to DB */}
        {canEdit && state?.status === 'finished' && match.status !== 'played' && (
          <button
            onClick={finalizeMatch}
            className="mt-4 w-full rounded-xl py-3 font-semibold text-red-700 bg-red-50 border border-red-200 transition-all hover:bg-red-100"
          >
            ⚠️ Guardar resultado (no se guardó correctamente)
          </button>
        )}

        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-700 border border-emerald-200">
          🍺 Recuerda editar el partido después para agregar las pintas o cambiar algo.
        </div>

        <ShareButton
          showMenu={showShareMenu}
          onToggle={() => setShowShareMenu((v) => !v)}
          onCopy={handleCopyLink}
          onWhatsApp={handleShareWhatsApp}
          copyConfirm={copyConfirm}
        />

        <button
          onClick={onBack}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-emerald-500"
        >
          ← Salir
        </button>
      </ScoreboardShell>
    );
  }

  // ── Flujo de inicio (no hay live_score_state aún) ───────────────────────────
  if (!state && canEdit) {
    return (
      <ScoreboardShell onBack={onBack} p1Name={p1Name} p2Name={p2Name} liveUrl={liveUrl}>
        <div className="mx-auto max-w-sm space-y-6">
          <h2 className="text-center text-xl font-bold text-white">
            Iniciar marcador en vivo
          </h2>

          {/* Selector de formato */}
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Formato
            </p>
            {(
              [
                { value: 'standard', label: 'Standard', desc: 'Mejor de 3 · Sets de 6 · Con ventaja' },
                { value: 'nextgen', label: 'NextGen', desc: 'Mejor de 3 · Sets de 4 · Sin ventaja' },
                { value: 'short', label: 'Short Sets', desc: 'Mejor de 3 · Sets de 4 · Con ventaja' },
                { value: 'supertiebreak', label: 'Super Tiebreak', desc: 'Mejor de 3 · 3er set = Super TB' },
              ] as { value: MatchFormat; label: string; desc: string }[]
            ).map((f) => (
              <button
                key={f.value}
                onClick={() => setSelectedFormat(f.value)}
                className={`w-full rounded-xl px-4 py-3 text-left transition-all ${
                  selectedFormat === f.value
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="font-semibold">{f.label}</span>
                <span className="ml-2 text-xs opacity-70">{f.desc}</span>
              </button>
            ))}
          </div>

          {/* Selector de primer sacador */}
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              ¿Quién saca primero?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedServer(s)}
                  className={`rounded-xl px-4 py-3 font-semibold transition-all ${
                    selectedServer === s
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🎾 {s === 1 ? p1Name.split(' ')[0] : p2Name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleInitMatch}
            disabled={starting}
            className="w-full rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-emerald-500 disabled:opacity-50"
          >
            {starting ? 'Iniciando...' : '🎾 Iniciar partido'}
          </button>
        </div>
      </ScoreboardShell>
    );
  }

  // ── Viewer sin partido iniciado ─────────────────────────────────────────────
  if (!state) {
    return (
      <ScoreboardShell onBack={onBack} p1Name={p1Name} p2Name={p2Name} liveUrl={liveUrl}>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="text-5xl">⏳</div>
          <p className="text-lg font-semibold text-white">
            El partido aún no ha comenzado
          </p>
          <p className="text-sm text-gray-400">
            Espera a que los jugadores inicien el marcador.
          </p>
        </div>
      </ScoreboardShell>
    );
  }

  // ── Vista principal en vivo ─────────────────────────────────────────────────
  return (
    <ScoreboardShell onBack={onBack} p1Name={p1Name} p2Name={p2Name} liveUrl={liveUrl}>
      {/* Toast */}
      {toast && (
        <div className="mb-4 rounded-xl bg-red-900/60 px-4 py-3 text-center text-sm font-medium text-red-200 ring-1 ring-red-700/40">
          {toast}
        </div>
      )}

      {/* Marcador */}
      <LiveScoreDisplay
        state={state}
        player1Name={p1Name}
        player2Name={p2Name}
        player1Avatar={avatarUrl(player1)}
        player2Avatar={avatarUrl(player2)}
        connectionStatus={connectionStatus}
      />

      {/* Controles de editor */}
      {canEdit && state.status === 'live' && (
        <div className="mt-6 space-y-4">
          {/* Botones de punto */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => addPoint(1)}
              className="rounded-2xl py-5 text-lg font-bold text-white shadow-lg transition-all active:scale-95 bg-gradient-to-br from-emerald-500 to-emerald-700"
            >
              🎾 {p1Name.split(' ')[0]}
            </button>
            <button
              onClick={() => addPoint(2)}
              className="rounded-2xl py-5 text-lg font-bold text-white shadow-lg transition-all active:scale-95 bg-gradient-to-br from-blue-500 to-blue-700"
            >
              🎾 {p2Name.split(' ')[0]}
            </button>
          </div>

          {/* Undo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-full rounded-xl py-3 font-semibold text-gray-600 bg-gray-100 border border-gray-200 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↩ Deshacer último punto
          </button>

          {/* Panel de Edición (solo admins) */}
          {currentProfile?.role === 'admin' && (
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowAdminPanel(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700">⚙️ Panel de Edición</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAdminPanel && (
                <div className="px-4 py-4 space-y-4 bg-white">
                  {/* Tema / Color del overlay */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Color del Overlay</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'broadcast', label: 'Broadcast', bg: 'bg-[#0f172a]', accent: 'bg-sky-400', txt: 'text-white' },
                        { id: 'forest', label: 'Forest', bg: 'bg-[#0d2818]', accent: 'bg-[#4ade80]', txt: 'text-white' },
                        { id: 'oro', label: 'Oro', bg: 'bg-[#1a1005]', accent: 'bg-[#fbbf24]', txt: 'text-white' },
                        { id: 'plata', label: 'Plata', bg: 'bg-[#111318]', accent: 'bg-slate-300', txt: 'text-white' },
                        { id: 'bronce', label: 'Bronce', bg: 'bg-[#1a0f08]', accent: 'bg-[#cd7f32]', txt: 'text-white' },
                        { id: 'wppc', label: 'WPPC', bg: 'bg-[#1f0a1e]', accent: 'bg-[#f472b6]', txt: 'text-white' },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleChangeTheme(t.id)}
                          className={`rounded-xl overflow-hidden border-2 transition-all ${
                            selectedTheme === t.id
                              ? 'border-emerald-500 ring-2 ring-emerald-200 scale-[1.02]'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Mini scoreboard preview */}
                          <div className={`${t.bg} px-2.5 py-2`}>
                            <div className="flex items-center justify-between mb-1">
                              <div className={`h-1.5 w-8 rounded-full ${t.accent} opacity-80`} />
                              <div className="h-1.5 w-5 rounded-full bg-white/20" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`h-1 w-1 rounded-full ${t.accent}`} />
                                <div className="h-1.5 w-12 rounded-sm bg-white/70" />
                                <div className="ml-auto h-1.5 w-3 rounded-sm bg-white/50" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="h-1 w-1 rounded-full bg-white/20" />
                                <div className="h-1.5 w-10 rounded-sm bg-white/50" />
                                <div className="ml-auto h-1.5 w-3 rounded-sm bg-white/30" />
                              </div>
                            </div>
                          </div>
                          <div className={`px-2.5 py-1.5 text-center text-[11px] font-semibold ${
                            selectedTheme === t.id ? 'text-emerald-700 bg-emerald-50' : 'text-gray-700 bg-gray-50'
                          }`}>
                            {t.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prioridad Streaming */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Indicador de Saque</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'ball', label: '🎾 Pelota', preview: '🎾' },
                        { id: 'ppc-logo', label: 'Logo PPC', preview: '🏆' },
                        { id: 'forest-logo', label: 'Logo Forest', preview: '🌲' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleChangeServeIndicator(opt.id)}
                          className={`rounded-lg px-3 py-2.5 text-xs font-medium border transition-all ${
                            selectedServeIndicator === opt.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-base block mb-0.5">{opt.preview}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo del overlay */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Logo (esquina izq.)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'ppc', label: 'PPC', src: '/ppc-logo.png' },
                        { id: 'forest', label: 'Forest', src: '/forest-logo.png' },
                        { id: 'ppc-forest', label: 'PPC + Forest', src: '/ppc-forest-logo.png' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleChangeLogo(opt.id)}
                          className={`rounded-lg px-2 py-2 text-xs font-medium border transition-all flex flex-col items-center gap-1.5 ${
                            selectedLogo === opt.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <img src={opt.src} alt={opt.label} className="h-8 w-auto object-contain opacity-80" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prioridad Streaming (original) */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Prioridad Streaming</p>
                    <button
                      onClick={handleSetFeatured}
                      disabled={settingFeatured || state?.is_featured === true}
                      className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all ${
                        state?.is_featured
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      } disabled:opacity-60`}
                    >
                      {state?.is_featured ? '⭐ Este partido tiene prioridad' : '📺 Dar prioridad a este partido'}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1">El overlay del streaming muestra el partido con prioridad.</p>
                  </div>

                  {/* Añadir editor */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Editores</p>
                    <button
                      onClick={() => setShowAddEditor((v) => !v)}
                      className="w-full rounded-xl py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 transition-all hover:bg-emerald-100"
                    >
                      {showAddEditor ? '✕ Cerrar' : '+ Añadir editor adicional'}
                    </button>

                    {showAddEditor && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={editorSearch}
                          onChange={(e) => setEditorSearch(e.target.value)}
                          placeholder="Buscar jugador por nombre..."
                          className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {editorResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleAddEditor(p.id)}
                            disabled={addingEditor || (state.editor_ids ?? []).includes(p.id)}
                            className="flex w-full items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-left text-sm text-gray-900 transition-all hover:bg-gray-50 disabled:opacity-50"
                          >
                            <span className="font-medium">{p.name}</span>
                            {(state.editor_ids ?? []).includes(p.id) && (
                              <span className="ml-auto text-xs text-emerald-600">✓ Editor</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reset + Cancelar */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Acciones</p>
                    <div className="grid grid-cols-2 gap-2">
                      {!showResetConfirm && !showCancelConfirm && (
                        <>
                          <button
                            onClick={() => setShowResetConfirm(true)}
                            className="rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                          >
                            🔄 Reiniciar
                          </button>
                          <button
                            onClick={() => setShowCancelConfirm(true)}
                            className="rounded-xl border border-red-300 bg-red-50 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
                          >
                            ✕ Cancelar
                          </button>
                        </>
                      )}
                      {showResetConfirm && (
                        <div className="col-span-2 rounded-xl bg-amber-50 p-3 border border-amber-200">
                          <p className="mb-2 text-center text-sm font-medium text-amber-800">¿Reiniciar marcador a 0-0?</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setShowResetConfirm(false)} className="rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700">No</button>
                            <button onClick={handleResetMatch} disabled={resetting} className="rounded-lg bg-amber-600 py-2 text-sm font-medium text-white disabled:opacity-50">
                              {resetting ? '...' : 'Sí'}
                            </button>
                          </div>
                        </div>
                      )}
                      {showCancelConfirm && (
                        <div className="col-span-2 rounded-xl bg-red-50 p-3 border border-red-200">
                          <p className="mb-2 text-center text-sm font-medium text-red-800">¿Cancelar partido? Vuelve a pendiente.</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setShowCancelConfirm(false)} className="rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700">No</button>
                            <button onClick={handleCancelMatch} disabled={cancelling} className="rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50">
                              {cancelling ? '...' : 'Sí'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compartir */}
      <div className="mt-4">
        <ShareButton
          showMenu={showShareMenu}
          onToggle={() => setShowShareMenu((v) => !v)}
          onCopy={handleCopyLink}
          onWhatsApp={handleShareWhatsApp}
          copyConfirm={copyConfirm}
        />
      </div>

      {/* Twitch embed */}
      <TwitchEmbed />
    </ScoreboardShell>
  );
}

// ── ScoreboardShell — Layout común ───────────────────────────────────────────

function ScoreboardShell({
  onBack,
  p1Name,
  p2Name,
  liveUrl: _liveUrl,
  children,
}: {
  onBack: () => void;
  p1Name: string;
  p2Name: string;
  liveUrl: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 bg-gradient-to-br from-emerald-50 via-white to-gray-100">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-100 border border-emerald-200"
          >
            ← Volver
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-600 bg-red-50 border border-red-200">
            <span className="animate-pulse">●</span> En vivo
          </span>

          <div className="w-20" />
        </div>

        {/* Logo PPC pequeño + título */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <img src="/ppc-logo.png" alt="PPC" className="h-8 w-auto object-contain" />
          <h1 className="text-base font-bold text-emerald-700 uppercase tracking-widest">
            Live Scoreboard
          </h1>
        </div>

        {children}
      </div>
    </div>
  );
}

// ── ShareButton ───────────────────────────────────────────────────────────────

function ShareButton({
  showMenu,
  onToggle,
  onCopy,
  onWhatsApp,
  copyConfirm,
}: {
  showMenu: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onWhatsApp: () => void;
  copyConfirm: boolean;
}) {
  return (
    <div className="relative mt-4">
      <button
        onClick={onToggle}
        className="w-full rounded-xl bg-gray-100 border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200"
      >
        {copyConfirm ? '✓ ¡Enlace copiado!' : '🔗 Compartir partido'}
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl bg-white shadow-xl border border-gray-200">
          <button
            onClick={onCopy}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-gray-900 transition-all hover:bg-gray-50"
          >
            <span>📋</span> Copiar enlace
          </button>
          <div className="h-px bg-gray-100" />
          <button
            onClick={onWhatsApp}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-gray-900 transition-all hover:bg-gray-50"
          >
            <span>💬</span> Compartir por WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

// ── TwitchEmbed — Embed colapsable de Twitch ──────────────────────────────────

function TwitchEmbed() {
  const [expanded, setExpanded] = React.useState(() => window.innerWidth >= 1024);
  const [isLive, setIsLive] = React.useState(false);

  // Check Twitch live status
  React.useEffect(() => {
    let cancelled = false;

    async function checkLive() {
      try {
        const resp = await fetch('/api/twitch-status');
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled) {
          setIsLive(data.live === true);
          // Auto-expand when live
          if (data.live === true) setExpanded(true);
        }
      } catch { /* ignore */ }
    }

    checkLive();
    const interval = setInterval(checkLive, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
          isLive
            ? 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100'
            : 'text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100'
        }`}
      >
        <span className="flex items-center gap-2">
          {isLive && <span className="animate-pulse text-red-500">●</span>}
          📺 {isLive ? '🔴 LIVE — PintaPost TV' : 'Twitch — PintaPost TV'}
        </span>
        <span className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {expanded && (
        <div className="mt-2 rounded-xl overflow-hidden border border-purple-200 shadow-sm" style={{ aspectRatio: '16/9' }}>
          <iframe
            src="https://player.twitch.tv/?channel=pintaposttv&parent=ppctennis.vercel.app&parent=localhost"
            width="100%"
            height="100%"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}
