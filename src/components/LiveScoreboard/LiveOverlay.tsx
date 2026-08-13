// ─────────────────────────────────────────────────────────────────────────────
// LiveOverlay.tsx — OBS Browser Source overlay for Twitch streaming.
// Renders a compact scoreboard with transparent background.
// URL: /#overlay/match/:id?theme=forest
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { LiveScoreState } from './liveScoreUtils';

interface OverlayProps {
  matchId: string | 'latest';
  theme?: string;
}

// ── Theme colors ─────────────────────────────────────────────────────────────

interface OverlayTheme {
  cardBg: string;
  border: string;
  nameTxt: string;
  scoreTxt: string;
  pointsTxt: string;
  serveDot: string;
  footerTxt: string;
  badgeBg: string;
  badgeTxt: string;
}

const THEMES: Record<string, OverlayTheme> = {
  forest: {
    cardBg: 'bg-[#0d2818]/90',
    border: 'border-[#2d6b45]/60',
    nameTxt: 'text-white',
    scoreTxt: 'text-white',
    pointsTxt: 'text-[#4ade80]',
    serveDot: 'text-[#4ade80]',
    footerTxt: 'text-[#4ade80]/60',
    badgeBg: 'bg-[#4ade80]/15',
    badgeTxt: 'text-[#4ade80]',
  },
  oro: {
    cardBg: 'bg-[#1a1005]/90',
    border: 'border-[#d4a533]/40',
    nameTxt: 'text-white',
    scoreTxt: 'text-white',
    pointsTxt: 'text-[#fbbf24]',
    serveDot: 'text-[#fbbf24]',
    footerTxt: 'text-[#d4a533]/60',
    badgeBg: 'bg-[#fbbf24]/15',
    badgeTxt: 'text-[#fbbf24]',
  },
  plata: {
    cardBg: 'bg-[#111318]/90',
    border: 'border-slate-500/40',
    nameTxt: 'text-white',
    scoreTxt: 'text-white',
    pointsTxt: 'text-slate-200',
    serveDot: 'text-slate-300',
    footerTxt: 'text-slate-400/60',
    badgeBg: 'bg-slate-400/15',
    badgeTxt: 'text-slate-300',
  },
  bronce: {
    cardBg: 'bg-[#1a0f08]/90',
    border: 'border-[#cd7f32]/40',
    nameTxt: 'text-white',
    scoreTxt: 'text-white',
    pointsTxt: 'text-[#e8a055]',
    serveDot: 'text-[#cd7f32]',
    footerTxt: 'text-[#cd7f32]/60',
    badgeBg: 'bg-[#cd7f32]/15',
    badgeTxt: 'text-[#e8a055]',
  },
  wppc: {
    cardBg: 'bg-[#1f0a1e]/90',
    border: 'border-[#e040a0]/30',
    nameTxt: 'text-white',
    scoreTxt: 'text-white',
    pointsTxt: 'text-[#f472b6]',
    serveDot: 'text-[#f472b6]',
    footerTxt: 'text-[#f472b6]/60',
    badgeBg: 'bg-[#f472b6]/15',
    badgeTxt: 'text-[#f472b6]',
  },
  broadcast: {
    cardBg: 'bg-[#0f172a]/90',
    border: 'border-slate-600/50',
    nameTxt: 'text-white',
    scoreTxt: 'text-white',
    pointsTxt: 'text-sky-300',
    serveDot: 'text-sky-400',
    footerTxt: 'text-slate-400/60',
    badgeBg: 'bg-sky-500/15',
    badgeTxt: 'text-sky-300',
  },
};

// ── Helper: format points ────────────────────────────────────────────────────

function fmtPoints(pts: number, inTB: boolean, inSTB: boolean): string {
  if (inTB || inSTB) return String(pts);
  const labels = ['0', '15', '30', '40', 'Ad'];
  return labels[pts] ?? String(pts);
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function LiveOverlay({ matchId: matchIdProp, theme: themeName = 'auto' }: OverlayProps) {
  const [state, setState] = useState<LiveScoreState | null>(null);
  const [p1Name, setP1Name] = useState('Jugador 1');
  const [p2Name, setP2Name] = useState('Jugador 2');
  const [roundLabel, setRoundLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [resolvedMatchId, setResolvedMatchId] = useState<string | null>(null);
  const [autoTheme, setAutoTheme] = useState<string>('forest');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Use explicit theme or auto-detected one
  const effectiveTheme = themeName === 'auto' ? autoTheme : themeName;
  const t = THEMES[effectiveTheme] || THEMES.forest;

  // ── Resolve match ID (for 'latest' mode) ───────────────────────────────────

  useEffect(() => {
    async function resolve() {
      if (matchIdProp !== 'latest') {
        setResolvedMatchId(matchIdProp);
        return;
      }

      // Find featured match first
      const { data: featured } = await supabase
        .from('live_score_state')
        .select('match_id')
        .eq('is_featured', true)
        .eq('status', 'live')
        .maybeSingle();

      if (featured) {
        setResolvedMatchId((featured as any).match_id);
        return;
      }

      // Fallback: most recently created live match
      const { data: latest } = await supabase
        .from('live_score_state')
        .select('match_id')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        setResolvedMatchId((latest as any).match_id);
      } else {
        setResolvedMatchId(null);
      }
    }

    resolve();

    // Re-resolve every 5s in case featured changes or new match starts
    const interval = setInterval(resolve, 5000);
    return () => clearInterval(interval);
  }, [matchIdProp]);

  // ── Load match data + live state ───────────────────────────────────────────

  useEffect(() => {
    if (!resolvedMatchId) return;

    async function load() {
      // Load live state
      const { data: liveState } = await supabase
        .from('live_score_state')
        .select('*')
        .eq('match_id', resolvedMatchId)
        .maybeSingle();
      if (liveState) setState(liveState as LiveScoreState);

      // Load match + player names
      const { data: match } = await supabase
        .from('matches')
        .select('home_player_id, away_player_id, knockout_round, division_id')
        .eq('id', resolvedMatchId)
        .maybeSingle();

      if (match) {
        // Round label
        const roundMap: Record<string, string> = {
          'F': 'Final', 'SF': 'Semifinal', 'QF': 'Cuartos', 'R16': 'Ronda 16',
        };
        if ((match as any).knockout_round) {
          setRoundLabel(roundMap[(match as any).knockout_round] || '');
        }

        // Auto-detect theme from division name
        if (themeName === 'auto' && (match as any).division_id) {
          const { data: div } = await supabase
            .from('divisions')
            .select('name')
            .eq('id', (match as any).division_id)
            .maybeSingle();
          if (div) {
            const divName = ((div as any).name || '').toLowerCase();
            setDivisionLabel((div as any).name || '');
            if (divName.includes('oro') || divName.includes('gold')) setAutoTheme('oro');
            else if (divName.includes('plata') || divName.includes('silver')) setAutoTheme('plata');
            else if (divName.includes('bronce') || divName.includes('bronze') || divName.includes('cobre')) setAutoTheme('bronce');
            else if (divName.includes('wppc') || divName.includes('mujer') || divName.includes('women')) setAutoTheme('wppc');
            else setAutoTheme('forest');
          }
        }

        // Player names
        if ((match as any).home_player_id) {
          const { data: p1 } = await supabase
            .from('profiles').select('name, nickname')
            .eq('id', (match as any).home_player_id).maybeSingle();
          if (p1) setP1Name((p1 as any).nickname || (p1 as any).name?.split(' ')[0] || 'P1');
        }
        if ((match as any).away_player_id) {
          const { data: p2 } = await supabase
            .from('profiles').select('name, nickname')
            .eq('id', (match as any).away_player_id).maybeSingle();
          if (p2) setP2Name((p2 as any).nickname || (p2 as any).name?.split(' ')[0] || 'P2');
        }
      }
    }

    load();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`overlay-${resolvedMatchId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'live_score_state',
        filter: `match_id=eq.${resolvedMatchId}`,
      }, (payload) => {
        setState(payload.new as LiveScoreState);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [resolvedMatchId, themeName]);

  // ── Not live yet ───────────────────────────────────────────────────────────

  if (!resolvedMatchId || !state || state.status === 'finished') {
    return <div className="w-full h-full" />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const p1Pts = fmtPoints(state.p1_points, state.in_tiebreak, state.in_super_tiebreak);
  const p2Pts = fmtPoints(state.p2_points, state.in_tiebreak, state.in_super_tiebreak);

  // Layout: Logo PPC separado (esquina inferior izquierda) + Score Card (esquina superior derecha)
  // In OBS these are separate layers the user can position freely.
  // Here we render them together — OBS crops/positions as needed.
  return (
    <div className="p-2 font-sans">
      <div className={`rounded-xl ${t.cardBg} border ${t.border} backdrop-blur-sm overflow-hidden shadow-2xl`}
        style={{ minWidth: '260px', maxWidth: '320px' }}>

        {/* Player rows */}
        <div className="divide-y divide-white/5">
          {/* Player 1 */}
          <div className="flex items-center px-3 py-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {state.server === 1 && <span className="text-[10px] flex-shrink-0">🎾</span>}
              {state.server !== 1 && <div className="w-[14px]" />}
              <span className={`text-[13px] font-semibold truncate ${t.nameTxt}`}>{p1Name}</span>
            </div>
            {/* Sets */}
            <div className="flex items-center">
              {state.completed_sets.map((s, i) => (
                <div key={i} className={`w-5 text-center text-[13px] font-mono font-bold ${t.scoreTxt}`}>{s.p1}</div>
              ))}
              <div className={`w-5 text-center text-[13px] font-mono font-bold ${t.scoreTxt}`}>{state.p1_games}</div>
            </div>
            {/* Points */}
            <div className={`w-8 text-center text-[15px] font-black ${t.pointsTxt}`}>{p1Pts}</div>
          </div>

          {/* Player 2 */}
          <div className="flex items-center px-3 py-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {state.server === 2 && <span className="text-[10px] flex-shrink-0">🎾</span>}
              {state.server !== 2 && <div className="w-[14px]" />}
              <span className={`text-[13px] font-semibold truncate ${t.nameTxt}`}>{p2Name}</span>
            </div>
            {/* Sets */}
            <div className="flex items-center">
              {state.completed_sets.map((s, i) => (
                <div key={i} className={`w-5 text-center text-[13px] font-mono font-bold ${t.scoreTxt}`}>{s.p2}</div>
              ))}
              <div className={`w-5 text-center text-[13px] font-mono font-bold ${t.scoreTxt}`}>{state.p2_games}</div>
            </div>
            {/* Points */}
            <div className={`w-8 text-center text-[15px] font-black ${t.pointsTxt}`}>{p2Pts}</div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-3 py-1 flex items-center justify-between border-t border-white/5`}>
          <span className={`text-[8px] font-bold uppercase tracking-wider ${t.badgeTxt}`}>
            {roundLabel ? `PPC ${roundLabel}${divisionLabel ? ' ' + divisionLabel : ''}` : 'PPC'}
          </span>
          <span className={`text-[7px] ${t.footerTxt}`}>ppctennis.vercel.app</span>
        </div>
      </div>

      {/* PPC Logo — separate element, positioned bottom-left like keepthescore */}
      <div className="fixed bottom-4 left-4">
        <img src="/ppc-logo.png" alt="PPC" className="w-10 h-10 object-contain opacity-80 drop-shadow-lg" />
      </div>
    </div>
  );
}
