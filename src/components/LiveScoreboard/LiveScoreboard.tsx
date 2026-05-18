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
  // Por ahora solo admin puede iniciar/editar el marcador.
  // Cuando se abra a más usuarios, reemplazar por isEditor(...) completo.
  const canEdit = currentProfile?.role === 'admin';

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

          {/* Añadir editor */}
          <div>
            <button
              onClick={() => setShowAddEditor((v) => !v)}
              className="w-full rounded-xl py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 transition-all hover:bg-emerald-100"
            >
              {showAddEditor ? '✕ Cancelar' : '+ Añadir editor adicional'}
            </button>

            {showAddEditor && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={editorSearch}
                  onChange={(e) => setEditorSearch(e.target.value)}
                  placeholder="Buscar jugador por nombre..."
                  className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                      <span className="ml-auto text-xs text-emerald-600">✓ Ya es editor</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset + Cancelar partido */}
          <div className="grid grid-cols-2 gap-3">
            {/* Reset */}
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-medium text-amber-700 transition-all hover:bg-amber-100"
              >
                🔄 Reiniciar a 0
              </button>
            ) : (
              <div className="col-span-2 rounded-xl bg-amber-50 p-4 border border-amber-200">
                <p className="mb-3 text-center text-sm font-medium text-amber-800">
                  ¿Reiniciar el marcador a 0-0? El partido sigue en vivo pero se borra todo el score actual.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded-xl bg-gray-100 border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    No, continuar
                  </button>
                  <button
                    onClick={handleResetMatch}
                    disabled={resetting}
                    className="rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {resetting ? 'Reiniciando...' : 'Sí, reiniciar'}
                  </button>
                </div>
              </div>
            )}

            {/* Cancelar */}
            {!showResetConfirm && (
              !showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="rounded-xl border border-red-300 bg-red-50 py-2.5 text-sm font-medium text-red-700 transition-all hover:bg-red-100"
                >
                  ✕ Cancelar partido
                </button>
              ) : (
                <div className="col-span-2 rounded-xl bg-red-50 p-4 border border-red-200">
                  <p className="mb-3 text-center text-sm font-medium text-red-800">
                    ¿Cancelar el partido? El marcador se borra y el partido vuelve a estado pendiente.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="rounded-xl bg-gray-100 border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      No, continuar
                    </button>
                    <button
                      onClick={handleCancelMatch}
                      disabled={cancelling}
                      className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
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

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 transition-all hover:bg-purple-100"
      >
        <span>📺 Twitch — PintaPost TV</span>
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
