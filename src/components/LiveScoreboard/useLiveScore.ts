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
  initMatch: (format: MatchFormat, firstServer: 1 | 2) => Promise<void>;
  finalizeMatch: () => Promise<void>;
  cancelMatch: () => Promise<boolean>;
  resetMatch: () => Promise<boolean>;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;
// Máximo de estados en el historial de undo (en memoria)
const MAX_UNDO_HISTORY = 20;

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
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
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

      const newState = calcAddPoint(state, player);
      const ok = await persistState(newState);

      if (!ok) {
        // Revertir historial si falló
        undoHistoryRef.current = undoHistoryRef.current.slice(0, -1);
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

    const ok = await persistState(prev);
    if (!ok) {
      // Restaurar historial si falló
      undoHistoryRef.current = [...undoHistoryRef.current, prev];
      setError('No se pudo deshacer el punto. Inténtalo de nuevo.');
    }
  }, [persistState]);

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
    async (format: MatchFormat, firstServer: 1 | 2) => {
      // Leer el status actual del partido antes de cambiarlo a 'live'
      const { data: matchData } = await supabase
        .from('matches')
        .select('status')
        .eq('id', matchId)
        .maybeSingle();

      const previousMatchStatus = matchData?.status ?? 'scheduled';

      const init = {
        ...initialState(matchId, format, firstServer),
        previous_match_status: previousMatchStatus,
      };

      const { error: insertErr } = await supabase
        .from('live_score_state')
        .insert(init);

      if (insertErr) {
        setError('No se pudo iniciar el partido. Inténtalo de nuevo.');
        return;
      }

      const { error: updateErr } = await supabase
        .from('matches')
        .update({ status: 'live' })
        .eq('id', matchId);

      if (updateErr) {
        setError('Error al actualizar el estado del partido.');
      }

      // Limpiar historial de undo al iniciar
      undoHistoryRef.current = [];
    },
    [matchId]
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
        setError('Error al guardar el resultado final. Por favor, inténtalo de nuevo.');
        return;
      }

      const setsToInsert = finishedState.completed_sets.map((s, i) => ({
        match_id: matchId,
        set_number: i + 1,
        p1_games: s.p1,
        p2_games: s.p2,
      }));

      if (setsToInsert.length > 0) {
        await supabase.from('match_sets').delete().eq('match_id', matchId);
        const { error: setsErr } = await supabase.from('match_sets').insert(setsToInsert);
        if (setsErr) {
          setError('Error al guardar los sets. Por favor, edita el partido manualmente.');
        }
      }

      await supabase
        .from('live_score_state')
        .update({ status: 'finished' })
        .eq('match_id', matchId);
    },
    [matchId]
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
    return true;
  }, [state, matchId]);

  return {
    state,
    loading,
    error,
    connectionStatus,
    canUndo: undoHistoryRef.current.length > 0,
    addPoint,
    undo,
    addEditor,
    initMatch,
    finalizeMatch,
    cancelMatch,
    resetMatch,
  };
}
