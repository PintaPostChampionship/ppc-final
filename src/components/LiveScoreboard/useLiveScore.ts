// ─────────────────────────────────────────────────────────────────────────────
// useLiveScore.ts — Hook de estado y persistencia para el Live Scoreboard
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  addPoint as calcAddPoint,
  initialState,
  type LiveScoreState,
  type MatchFormat,
} from './liveScoreUtils';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface UseLiveScoreReturn {
  state: LiveScoreState | null;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  canUndo: boolean;
  addPoint: (player: 1 | 2) => Promise<void>;
  undo: () => Promise<void>;
  addEditor: (userId: string) => Promise<void>;
  initMatch: (format: MatchFormat, firstServer: 1 | 2, silent?: boolean) => Promise<void>;
  finalizeMatch: () => Promise<void>;
  cancelMatch: () => Promise<boolean>;
  resetMatch: () => Promise<boolean>;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;
// Máximo de estados en el historial de undo (en memoria)
const MAX_UNDO_HISTORY = 20;

// ── Build point_log from undo history ─────────────────────────────────────────
// Each entry in undoHistory is the state BEFORE a point was added.
// By comparing consecutive states, we can infer who scored each point.
function buildPointLogFromHistory(
  history: LiveScoreState[],
  finalState: LiveScoreState
): Array<{ p: 1 | 2; ts: number }> {
  const allStates = [...history, finalState];
  const log: Array<{ p: 1 | 2; ts: number }> = [];
  const startTime = Date.now() - (history.length * 30000); // approximate timestamps

  for (let i = 0; i < allStates.length - 1; i++) {
    const before = allStates[i];
    const after = allStates[i + 1];

    // Determine who scored by comparing total points/games/sets
    // Simple heuristic: if p1's score increased in any dimension, p1 scored
    const p1ScoreBefore = before.p1_sets * 10000 + before.p1_games * 100 + before.p1_points;
    const p1ScoreAfter = after.p1_sets * 10000 + after.p1_games * 100 + after.p1_points;
    const p2ScoreBefore = before.p2_sets * 10000 + before.p2_games * 100 + before.p2_points;
    const p2ScoreAfter = after.p2_sets * 10000 + after.p2_games * 100 + after.p2_points;

    // When a new set starts, games reset — so we use completed_sets to detect set wins
    const p1SetsGained = after.p1_sets - before.p1_sets;
    const p2SetsGained = after.p2_sets - before.p2_sets;

    let scorer: 1 | 2;
    if (p1SetsGained > 0) {
      scorer = 1;
    } else if (p2SetsGained > 0) {
      scorer = 2;
    } else if (after.p1_games > before.p1_games) {
      scorer = 1;
    } else if (after.p2_games > before.p2_games) {
      scorer = 2;
    } else if (p1ScoreAfter > p1ScoreBefore) {
      scorer = 1;
    } else if (p2ScoreAfter > p2ScoreBefore) {
      scorer = 2;
    } else {
      // Deuce situation (both went from 4 to 3): the non-advantage player scored
      // If points went down (deuce reset), the OTHER player scored
      if (before.p1_points === 4 && after.p1_points === 3) {
        scorer = 2;
      } else if (before.p2_points === 4 && after.p2_points === 3) {
        scorer = 1;
      } else {
        scorer = 1; // fallback
      }
    }

    log.push({ p: scorer, ts: startTime + i * 30000 });
  }

  return log;
}

export function useLiveScore(
  matchId: string,
  currentUserId: string | null | undefined
): UseLiveScoreReturn {
  const [state, setState] = useState<LiveScoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  // Historial de undo en memoria (no se persiste en DB — solo para la sesión actual)
  const undoHistoryRef = useRef<LiveScoreState[]>([]);
  // Force re-render when undo history changes
  const [undoCount, setUndoCount] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  const loadState = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('live_score_state')
      .select('*')
      .eq('match_id', matchId)
      .maybeSingle();

    if (err) {
      setError('Error al cargar el estado del partido.');
      setLoading(false);
      return;
    }

    setState(data as LiveScoreState | null);
    setLoading(false);
  }, [matchId]);

  // ── Suscripción Realtime ───────────────────────────────────────────────────

  const subscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`live-match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_score_state',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setState(payload.new as LiveScoreState);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('connecting');
          handleReconnect();
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus('disconnected');
      return;
    }
    const delay = RECONNECT_DELAY_MS * (reconnectAttemptsRef.current + 1);
    reconnectAttemptsRef.current += 1;
    reconnectTimerRef.current = setTimeout(async () => {
      await loadState();
      subscribe();
    }, delay);
  }, [loadState, subscribe]);

  useEffect(() => {
    loadState();
    subscribe();

    // Polling fallback: fetch state every 5s in case Realtime disconnects silently
    const pollInterval = setInterval(() => {
      loadState();
    }, 5000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      clearInterval(pollInterval);
    };
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persistir estado ───────────────────────────────────────────────────────

  const persistState = useCallback(
    async (newState: LiveScoreState): Promise<boolean> => {
      const { error: err } = await supabase
        .from('live_score_state')
        .update({
          p1_sets: newState.p1_sets,
          p2_sets: newState.p2_sets,
          p1_games: newState.p1_games,
          p2_games: newState.p2_games,
          p1_points: newState.p1_points,
          p2_points: newState.p2_points,
          server: newState.server,
          in_tiebreak: newState.in_tiebreak,
          in_super_tiebreak: newState.in_super_tiebreak,
          completed_sets: newState.completed_sets,
          previous_state: newState.previous_state,
          editor_ids: newState.editor_ids,
          status: newState.status,
        })
        .eq('match_id', matchId);
      return !err;
    },
    [matchId]
  );

  // ── addPoint ───────────────────────────────────────────────────────────────

  const addPoint = useCallback(
    async (player: 1 | 2) => {
      if (!state) return;

      // Guardar estado actual en historial de undo (en memoria)
      undoHistoryRef.current = [
        ...undoHistoryRef.current.slice(-MAX_UNDO_HISTORY + 1),
        state,
      ];
      setUndoCount(undoHistoryRef.current.length);

      const newState = calcAddPoint(state, player);

      // Optimistic update — actualizar UI inmediatamente
      setState(newState);

      const ok = await persistState(newState);

      if (!ok) {
        // Revertir si falló
        undoHistoryRef.current = undoHistoryRef.current.slice(0, -1);
        setUndoCount(undoHistoryRef.current.length);
        setState(state); // revertir al estado anterior
        setError('No se pudo guardar el punto. Inténtalo de nuevo.');
        return;
      }

      if (newState.status === 'finished') {
        await finalizeMatchWithState(newState);
      }
    },
    [state, persistState] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── undo (múltiple, desde historial en memoria) ────────────────────────────

  const undo = useCallback(async () => {
    if (undoHistoryRef.current.length === 0) return;

    const prev = undoHistoryRef.current[undoHistoryRef.current.length - 1];
    undoHistoryRef.current = undoHistoryRef.current.slice(0, -1);
    setUndoCount(undoHistoryRef.current.length);

    // Optimistic update
    const currentState = state;
    setState(prev);

    const ok = await persistState(prev);
    if (!ok) {
      // Restaurar si falló
      undoHistoryRef.current = [...undoHistoryRef.current, prev];
      setUndoCount(undoHistoryRef.current.length);
      setState(currentState);
      setError('No se pudo deshacer el punto. Inténtalo de nuevo.');
    }
  }, [state, persistState]);

  // ── addEditor ──────────────────────────────────────────────────────────────

  const addEditor = useCallback(
    async (userId: string) => {
      if (!state) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        setError('Usuario no encontrado.');
        return;
      }

      if (state.editor_ids.includes(userId)) return;

      const newEditorIds = [...state.editor_ids, userId];
      await supabase
        .from('live_score_state')
        .update({ editor_ids: newEditorIds })
        .eq('match_id', matchId);
    },
    [state, matchId]
  );

  // ── initMatch ──────────────────────────────────────────────────────────────

  const initMatch = useCallback(
    async (format: MatchFormat, firstServer: 1 | 2, silent?: boolean) => {
      // Leer el status actual del partido antes de cambiarlo a 'live'
      const { data: matchData } = await supabase
        .from('matches')
        .select('status')
        .eq('id', matchId)
        .maybeSingle();

      const previousMatchStatus = matchData?.status ?? 'scheduled';

      // Unmark any other featured match, then mark this one
      await supabase
        .from('live_score_state')
        .update({ is_featured: false })
        .eq('is_featured', true);

      const init = {
        ...initialState(matchId, format, firstServer),
        previous_match_status: previousMatchStatus,
        is_featured: true,
        theme: 'broadcast',
        serve_indicator: 'ball',
        overlay_logo: 'ppc',
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('live_score_state')
        .insert(init)
        .select()
        .single();

      if (insertErr) {
        setError('No se pudo iniciar el partido. Inténtalo de nuevo.');
        return;
      }

      // Actualizar estado local inmediatamente (no esperar Realtime)
      if (inserted) setState(inserted as LiveScoreState);

      const { error: updateErr } = await supabase
        .from('matches')
        .update({ status: 'live' })
        .eq('id', matchId);

      if (updateErr) {
        setError('Error al actualizar el estado del partido.');
      }

      // Notify subscribers that a match is live (fire-and-forget)
      if (!silent) {
        fetch('/api/live-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'notify-live', match_id: matchId }),
        }).catch(() => {});
      }

      // Limpiar historial de undo al iniciar
      undoHistoryRef.current = [];
      setUndoCount(0);
    },
    [matchId, currentUserId]
  );

  // ── finalizeMatch ──────────────────────────────────────────────────────────

  const finalizeMatchWithState = useCallback(
    async (finishedState: LiveScoreState) => {
      const p1GamesTotal = finishedState.completed_sets.reduce((acc, s) => acc + s.p1, 0);
      const p2GamesTotal = finishedState.completed_sets.reduce((acc, s) => acc + s.p2, 0);

      const { error: matchErr } = await supabase
        .from('matches')
        .update({
          status: 'played',
          player1_sets_won: finishedState.p1_sets,
          player2_sets_won: finishedState.p2_sets,
          player1_games_won: p1GamesTotal,
          player2_games_won: p2GamesTotal,
        })
        .eq('id', matchId);

      if (matchErr) {
        console.error('[finalizeMatch] Error updating matches:', matchErr);
        setError('Error al guardar el resultado final. Usa el botón para reintentar.');
        return;
      }

      const setsToInsert = finishedState.completed_sets.map((s, i) => ({
        match_id: matchId,
        set_number: i + 1,
        p1_games: s.p1,
        p2_games: s.p2,
      }));

      if (setsToInsert.length > 0) {
        // Delete existing sets first (ignore errors — may not exist yet)
        await supabase.from('match_sets').delete().eq('match_id', matchId);
        const { error: setsErr } = await supabase.from('match_sets').insert(setsToInsert);
        if (setsErr) {
          console.error('[finalizeMatch] Error inserting match_sets:', setsErr);
          setError('Error al guardar los sets. Por favor, edita el partido manualmente.');
        }
      }

      await supabase
        .from('live_score_state')
        .update({ status: 'finished' })
        .eq('match_id', matchId);

      // ── Save point_log from undo history (web-originated matches) ──
      // Build point_log: each entry in undo history is a state BEFORE a point was scored.
      // The sequence of states lets us reconstruct who scored each point.
      if (undoHistoryRef.current.length > 0 && currentUserId) {
        try {
          const pointLog = buildPointLogFromHistory(undoHistoryRef.current, finishedState);
          const resultStr = `${finishedState.p1_sets}-${finishedState.p2_sets}`;
          const setScores = finishedState.completed_sets.map(s => `${s.p1}-${s.p2}`).join(', ');

          await fetch('/api/live-score', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Player-Id': currentUserId,
            },
            body: JSON.stringify({
              action: 'save_log',
              match_id: matchId,
              format: finishedState.format,
              result: `${resultStr} (${setScores})`,
              point_log: pointLog,
              source: 'web',
            }),
          });
        } catch (e) {
          console.error('[useLiveScore] Failed to save point_log:', e);
        }
      }
    },
    [matchId, currentUserId]
  );

  const finalizeMatch = useCallback(async () => {
    if (!state) return;
    await finalizeMatchWithState(state);
  }, [state, finalizeMatchWithState]);

  // ── cancelMatch — borra live_score_state y revierte al status original ──────

  const cancelMatch = useCallback(async (): Promise<boolean> => {
    // 1) Leer el status original guardado antes de borrar
    const { data: liveData } = await supabase
      .from('live_score_state')
      .select('previous_match_status')
      .eq('match_id', matchId)
      .maybeSingle();

    const restoreStatus = (liveData as any)?.previous_match_status ?? 'scheduled';

    // 2) Borrar live_score_state
    const { error: deleteErr } = await supabase
      .from('live_score_state')
      .delete()
      .eq('match_id', matchId);

    if (deleteErr) {
      setError('No se pudo cancelar el partido. Inténtalo de nuevo.');
      return false;
    }

    // 3) Revertir matches.status al valor original ('scheduled' o 'pending')
    await supabase
      .from('matches')
      .update({ status: restoreStatus })
      .eq('id', matchId);

    undoHistoryRef.current = [];
    setUndoCount(0);
    return true;
  }, [matchId]);

  // ── resetMatch — vuelve el marcador a 0-0 sin cancelar el partido ──────────
  // Borra match_sets, resetea matches a 'live' con scores en 0,
  // y reinicia live_score_state al estado inicial con el mismo formato y sacador.

  const resetMatch = useCallback(async (): Promise<boolean> => {
    if (!state) return false;

    const fresh = initialState(matchId, state.format, state.server);

    // Resetear live_score_state
    const { error: resetErr } = await supabase
      .from('live_score_state')
      .update({
        ...fresh,
        editor_ids: state.editor_ids, // conservar editores
      })
      .eq('match_id', matchId);

    if (resetErr) {
      setError('No se pudo resetear el partido. Inténtalo de nuevo.');
      return false;
    }

    // Borrar match_sets si se habían guardado
    await supabase.from('match_sets').delete().eq('match_id', matchId);

    // Resetear scores en matches (mantener status 'live')
    await supabase
      .from('matches')
      .update({
        status: 'live',
        player1_sets_won: 0,
        player2_sets_won: 0,
        player1_games_won: 0,
        player2_games_won: 0,
      })
      .eq('id', matchId);

    undoHistoryRef.current = [];
    setUndoCount(0);
    return true;
  }, [state, matchId]);

  return {
    state,
    loading,
    error,
    connectionStatus,
    canUndo: undoCount > 0,
    addPoint,
    undo,
    addEditor,
    initMatch,
    finalizeMatch,
    cancelMatch,
    resetMatch,
  };
}
