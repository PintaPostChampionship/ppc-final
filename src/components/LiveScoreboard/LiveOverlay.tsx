// ─────────────────────────────────────────────────────────────────────────────
// LiveOverlay.tsx — OBS Browser Source overlay for Twitch streaming.
// Renders a compact scoreboard with transparent background.
// URL: /#overlay/match/:id?theme=forest
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
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

export default function LiveOverlay({ matchId: _matchIdProp, theme: themeName = 'auto' }: OverlayProps) {
  const [isLive, setIsLive] = useState(false);
  const [p1Name, setP1Name] = useState('Jugador 1');
  const [p2Name, setP2Name] = useState('Jugador 2');
  const [roundLabel, setRoundLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [autoTheme, setAutoTheme] = useState<string>('forest');
  const [score, setScore] = useState({
    p1_sets: 0, p2_sets: 0,
    p1_games: 0, p2_games: 0,
    p1_points: 0, p2_points: 0,
    server: 1 as 1 | 2,
    in_tiebreak: false,
    in_super_tiebreak: false,
    completed_sets: [] as Array<{ p1: number; p2: number }>,
  });

  // Use explicit theme or auto-detected one
  const effectiveTheme = themeName === 'auto' ? autoTheme : themeName;
  const t = THEMES[effectiveTheme] || THEMES.forest;

  // ── Poll API for state (uses service role, no auth needed) ─────────────────

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const resp = await fetch('/api/overlay-state');
        if (!resp.ok) return;
        const data = await resp.json();

        if (cancelled) return;

        if (!data.live) {
          setIsLive(false);
          return;
        }

        setIsLive(true);
        setP1Name(data.p1_name || 'Jugador 1');
        setP2Name(data.p2_name || 'Jugador 2');
        setRoundLabel(data.round || '');
        setDivisionLabel(data.division || '');
        if (themeName === 'auto') setAutoTheme(data.theme || 'forest');
        setScore(data.state);
      } catch { /* ignore */ }
    }

    poll();
    const interval = setInterval(poll, 2000); // Poll every 2s for responsive updates

    return () => { cancelled = true; clearInterval(interval); };
  }, [themeName]);

  // ── Not live — show default placeholder ────────────────────────────────────

  if (!isLive) {
    const dt = THEMES.broadcast;
    return (
      <div className="fixed inset-0 pointer-events-none font-sans">
        <div className="absolute bottom-4 left-12 right-4 flex items-center justify-between">
          <img src="/ppc-logo.png" alt="PPC" className="w-20 h-20 object-contain drop-shadow-lg" />
          <div className={`rounded-xl ${dt.cardBg} border ${dt.border} backdrop-blur-md overflow-hidden shadow-2xl`}
            style={{ minWidth: '360px', maxWidth: '450px' }}>
            <div className="divide-y divide-white/5">
              <div className="flex items-center px-4 py-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-4" />
                  <span className={`text-[15px] font-semibold ${dt.nameTxt}`}>Jugador 1</span>
                </div>
                <div className={`w-6 text-center text-[15px] font-mono font-bold ${dt.scoreTxt}`}>0</div>
                <div className={`w-10 text-center text-lg font-black ${dt.pointsTxt}`}>0</div>
              </div>
              <div className="flex items-center px-4 py-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-4" />
                  <span className={`text-[15px] font-semibold ${dt.nameTxt}`}>Jugador 2</span>
                </div>
                <div className={`w-6 text-center text-[15px] font-mono font-bold ${dt.scoreTxt}`}>0</div>
                <div className={`w-10 text-center text-lg font-black ${dt.pointsTxt}`}>0</div>
              </div>
            </div>
            <div className={`px-4 py-1.5 flex items-center justify-between border-t border-white/5`}>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${dt.badgeTxt}`}>PPC</span>
              <span className={`text-[8px] ${dt.footerTxt}`}>ppctennis.vercel.app</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render live ──────────────────────────────────────────────────────────────

  const p1Pts = fmtPoints(score.p1_points, score.in_tiebreak, score.in_super_tiebreak);
  const p2Pts = fmtPoints(score.p2_points, score.in_tiebreak, score.in_super_tiebreak);

  return (
    <div className="fixed inset-0 pointer-events-none font-sans">
      {/* Bottom bar: logo far left, scoreboard right */}
      <div className="absolute bottom-4 left-6 right-4 flex items-center justify-between">
        {/* Logo PPC — left */}
        <img src="/ppc-logo.png" alt="PPC" className="w-20 h-20 object-contain drop-shadow-lg" />

        {/* Score card — right */}
        <div className={`rounded-xl ${t.cardBg} border ${t.border} backdrop-blur-md overflow-hidden shadow-2xl`}
          style={{ minWidth: '360px', maxWidth: '450px' }}>
          <div className="divide-y divide-white/5">
            {/* Player 1 */}
            <div className="flex items-center px-4 py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {score.server === 1 && <span className="text-xs flex-shrink-0">🎾</span>}
                {score.server !== 1 && <div className="w-4" />}
                <span className={`text-[15px] font-semibold truncate ${t.nameTxt}`}>{p1Name}</span>
              </div>
              <div className="flex items-center">
                {score.completed_sets.map((s, i) => (
                  <div key={i} className={`w-6 text-center text-[15px] font-mono font-bold ${t.scoreTxt}`}>{s.p1}</div>
                ))}
                <div className={`w-6 text-center text-[15px] font-mono font-bold ${t.scoreTxt}`}>{score.p1_games}</div>
              </div>
              <div className={`w-10 text-center text-lg font-black ${t.pointsTxt}`}>{p1Pts}</div>
            </div>

            {/* Player 2 */}
            <div className="flex items-center px-4 py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {score.server === 2 && <span className="text-xs flex-shrink-0">🎾</span>}
                {score.server !== 2 && <div className="w-4" />}
                <span className={`text-[15px] font-semibold truncate ${t.nameTxt}`}>{p2Name}</span>
              </div>
              <div className="flex items-center">
                {score.completed_sets.map((s, i) => (
                  <div key={i} className={`w-6 text-center text-[15px] font-mono font-bold ${t.scoreTxt}`}>{s.p2}</div>
                ))}
                <div className={`w-6 text-center text-[15px] font-mono font-bold ${t.scoreTxt}`}>{score.p2_games}</div>
              </div>
              <div className={`w-10 text-center text-lg font-black ${t.pointsTxt}`}>{p2Pts}</div>
            </div>
          </div>

          {/* Footer */}
          <div className={`px-4 py-1.5 flex items-center justify-between border-t border-white/5`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${t.badgeTxt}`}>
              {roundLabel ? `PPC ${roundLabel}${divisionLabel ? ' ' + divisionLabel : ''}` : 'PPC'}
            </span>
            <span className={`text-[8px] ${t.footerTxt}`}>ppctennis.vercel.app</span>
          </div>
        </div>
      </div>
    </div>
  );
}
