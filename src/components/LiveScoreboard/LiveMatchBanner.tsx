// ─────────────────────────────────────────────────────────────────────────────
// LiveMatchBanner.tsx — Banner global de partidos en vivo
// Solo visible para admins en Fase 1.
// Se actualiza automáticamente via Supabase Realtime.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import LiveScoreDisplay from './LiveScoreDisplay';
import type { LiveScoreState } from './liveScoreUtils';

interface ProfileData {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
}

interface LiveMatchInfo {
  id: string;
  home_player_id: string;
  away_player_id: string | null;
  home_historic_player_id?: string | null;
  away_historic_player_id?: string | null;
  p1Name: string;
  p2Name: string;
  p1Avatar?: string;
  p2Avatar?: string;
  liveState?: LiveScoreState | null;
}

export interface LiveMatchBannerProps {
  currentProfile: ProfileData | null;
}

export default function LiveMatchBanner({ currentProfile }: LiveMatchBannerProps) {
  const [liveMatches, setLiveMatches] = useState<LiveMatchInfo[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Solo admins en Fase 1
  if (currentProfile?.role !== 'admin') return null;

  // ── Carga de partidos en vivo ───────────────────────────────────────────────

  async function loadLiveMatches() {
    const { data: matches } = await supabase
      .from('matches')
      .select('id, home_player_id, away_player_id, home_historic_player_id, away_historic_player_id')
      .eq('status', 'live');

    if (!matches || matches.length === 0) {
      setLiveMatches([]);
      return;
    }

    // Cargar perfiles y estados en paralelo
    const enriched = await Promise.all(
      matches.map(async (m) => {
        const info: LiveMatchInfo = {
          id: m.id,
          home_player_id: m.home_player_id,
          away_player_id: m.away_player_id,
          home_historic_player_id: m.home_historic_player_id,
          away_historic_player_id: m.away_historic_player_id,
          p1Name: 'Jugador 1',
          p2Name: 'Jugador 2',
        };

        // Jugador 1
        if (m.home_player_id) {
          const { data: p1 } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', m.home_player_id)
            .maybeSingle();
          if (p1) {
            info.p1Name = p1.name;
            info.p1Avatar = p1.avatar_url ?? undefined;
          }
        } else if (m.home_historic_player_id) {
          const { data: p1 } = await supabase
            .from('historic_players')
            .select('id, name, avatar_url')
            .eq('id', m.home_historic_player_id)
            .maybeSingle();
          if (p1) {
            info.p1Name = p1.name;
            info.p1Avatar = p1.avatar_url ?? undefined;
          }
        }

        // Jugador 2
        if (m.away_player_id) {
          const { data: p2 } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .eq('id', m.away_player_id)
            .maybeSingle();
          if (p2) {
            info.p2Name = p2.name;
            info.p2Avatar = p2.avatar_url ?? undefined;
          }
        } else if (m.away_historic_player_id) {
          const { data: p2 } = await supabase
            .from('historic_players')
            .select('id, name, avatar_url')
            .eq('id', m.away_historic_player_id)
            .maybeSingle();
          if (p2) {
            info.p2Name = p2.name;
            info.p2Avatar = p2.avatar_url ?? undefined;
          }
        }

        // Estado del marcador
        const { data: liveState } = await supabase
          .from('live_score_state')
          .select('*')
          .eq('match_id', m.id)
          .maybeSingle();
        info.liveState = liveState as LiveScoreState | null;

        return info;
      })
    );

    setLiveMatches(enriched);
  }

  // ── Suscripción Realtime ───────────────────────────────────────────────────

  useEffect(() => {
    loadLiveMatches();

    const channel = supabase
      .channel('live-matches-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          // Recargar cuando cambia cualquier partido
          loadLiveMatches();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_score_state' },
        (payload) => {
          // Actualizar el estado del marcador del partido correspondiente
          const updated = payload.new as LiveScoreState;
          setLiveMatches((prev) =>
            prev.map((m) =>
              m.id === updated.match_id ? { ...m, liveState: updated } : m
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── No hay partidos en vivo ────────────────────────────────────────────────
  if (liveMatches.length === 0) return null;

  // ── Banner ─────────────────────────────────────────────────────────────────
  return (
    <div className="sticky top-0 z-50 w-full bg-red-950/95 shadow-lg ring-1 ring-red-800/50 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4 py-2">
        {/* Cabecera */}
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-400">
            <span className="animate-pulse">●</span>
            {liveMatches.length === 1
              ? 'Partido en vivo'
              : `${liveMatches.length} partidos en vivo`}
          </span>
        </div>

        {/* Lista de partidos */}
        <div className="space-y-2">
          {liveMatches.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-4 rounded-xl bg-red-900/30 px-3 py-2"
            >
              {/* Score compacto */}
              <div className="flex-1 overflow-hidden">
                {m.liveState ? (
                  <LiveScoreDisplay
                    state={m.liveState}
                    player1Name={m.p1Name}
                    player2Name={m.p2Name}
                    player1Avatar={m.p1Avatar}
                    player2Avatar={m.p2Avatar}
                    compact
                  />
                ) : (
                  <span className="text-sm text-gray-300">
                    {m.p1Name} vs {m.p2Name}
                  </span>
                )}
              </div>

              {/* Enlace */}
              <a
                href={`#live/match/${m.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.hash = `live/match/${m.id}`;
                }}
                className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-red-500"
              >
                Ver →
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
