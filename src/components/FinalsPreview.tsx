import React, { useState } from 'react';

// ── Finals Scoreboard Preview ─────────────────────────────────────────────────
// Preview page showing multiple scoreboard themes for PPC/WPPC Finals.
// Access via /#finals-preview (admin only).

// Mock data
const MOCK = {
  p1Name: 'Javier Fones',
  p2Name: 'Carlos Muñoz',
  p1Sets: 1,
  p2Sets: 0,
  completedSets: [{ p1: 6, p2: 4 }],
  p1Games: 4,
  p2Games: 3,
  p1Points: '30',
  p2Points: '15',
  server: 1 as 1 | 2,
  round: 'Final',
  tournament: 'PPC Edición 5',
};

interface Theme {
  id: string;
  name: string;
  desc: string;
  // Colors
  bg: string;
  scoreBg: string;
  rowBg: string;
  rowActiveBar: string; // left accent bar for serving player
  nameTxt: string;
  scoreTxt: string;
  pointsTxt: string;
  headerTxt: string;
  divider: string;
  // Optional
  sponsorSlot?: React.ReactNode;
  roundBadgeBg: string;
  roundBadgeTxt: string;
  glowEffect?: string;
}

const THEMES: Theme[] = [
  {
    id: 'forest-ppc',
    name: 'Forest × PPC',
    desc: 'Colaboración Forest Bikes. Verde profundo con acento lima.',
    bg: 'bg-gradient-to-br from-[#0a1f14] via-[#122b1d] to-[#0a1f14]',
    scoreBg: 'bg-[#0d2818]/95 border border-[#2d6b45]/60',
    rowBg: 'bg-[#143d28]/40',
    rowActiveBar: 'bg-[#4ade80]',
    nameTxt: 'text-white',
    scoreTxt: 'text-white font-mono',
    pointsTxt: 'text-[#4ade80] font-bold',
    headerTxt: 'text-[#4ade80]/80',
    divider: 'border-[#2d6b45]/40',
    roundBadgeBg: 'bg-[#4ade80]/10 border border-[#4ade80]/30',
    roundBadgeTxt: 'text-[#4ade80]',
    sponsorSlot: (
      <div className="flex items-center gap-1.5 opacity-70">
        <span className="text-[9px] text-white/40 uppercase tracking-wider">Powered by</span>
        <span className="text-[10px] font-bold text-[#4ade80]">🚲 Forest</span>
      </div>
    ),
  },
  {
    id: 'broadcast',
    name: 'Broadcast TV',
    desc: 'Estilo transmisión profesional. Alto contraste, fácil de leer.',
    bg: 'bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a]',
    scoreBg: 'bg-[#1e293b]/95 border border-slate-600/50',
    rowBg: 'bg-slate-800/50',
    rowActiveBar: 'bg-sky-400',
    nameTxt: 'text-white',
    scoreTxt: 'text-white font-mono',
    pointsTxt: 'text-sky-300 font-bold',
    headerTxt: 'text-slate-400',
    divider: 'border-slate-700/60',
    roundBadgeBg: 'bg-sky-500/10 border border-sky-500/30',
    roundBadgeTxt: 'text-sky-300',
  },
  {
    id: 'oro',
    name: 'Final Oro',
    desc: 'Para la final de la división Oro. Dorado brillante, elegante.',
    bg: 'bg-gradient-to-br from-[#1a1005] via-[#2d1a08] to-[#1a1005]',
    scoreBg: 'bg-[#2a1b0a]/95 border border-[#d4a533]/40',
    rowBg: 'bg-[#3d2a10]/40',
    rowActiveBar: 'bg-[#fbbf24]',
    nameTxt: 'text-white',
    scoreTxt: 'text-white font-mono',
    pointsTxt: 'text-[#fbbf24] font-bold',
    headerTxt: 'text-[#d4a533]/80',
    divider: 'border-[#d4a533]/30',
    roundBadgeBg: 'bg-[#fbbf24]/10 border border-[#fbbf24]/30',
    roundBadgeTxt: 'text-[#fbbf24]',
    glowEffect: 'shadow-[0_0_40px_rgba(251,191,36,0.08)]',
  },
  {
    id: 'plata',
    name: 'Final Plata',
    desc: 'Para la final de la división Plata. Gris plateado sofisticado.',
    bg: 'bg-gradient-to-br from-[#111318] via-[#1c1f26] to-[#111318]',
    scoreBg: 'bg-[#1c1f26]/95 border border-slate-500/40',
    rowBg: 'bg-slate-700/30',
    rowActiveBar: 'bg-slate-300',
    nameTxt: 'text-white',
    scoreTxt: 'text-white font-mono',
    pointsTxt: 'text-slate-200 font-bold',
    headerTxt: 'text-slate-400',
    divider: 'border-slate-600/40',
    roundBadgeBg: 'bg-slate-400/10 border border-slate-400/30',
    roundBadgeTxt: 'text-slate-300',
  },
  {
    id: 'bronce',
    name: 'Final Bronce / Cobre',
    desc: 'Para la final de la división Bronce o Cobre. Tono cálido cobrizo.',
    bg: 'bg-gradient-to-br from-[#1a0f08] via-[#2a1810] to-[#1a0f08]',
    scoreBg: 'bg-[#2a1810]/95 border border-[#cd7f32]/40',
    rowBg: 'bg-[#3a2015]/40',
    rowActiveBar: 'bg-[#cd7f32]',
    nameTxt: 'text-white',
    scoreTxt: 'text-white font-mono',
    pointsTxt: 'text-[#e8a055] font-bold',
    headerTxt: 'text-[#cd7f32]/80',
    divider: 'border-[#cd7f32]/30',
    roundBadgeBg: 'bg-[#cd7f32]/10 border border-[#cd7f32]/30',
    roundBadgeTxt: 'text-[#e8a055]',
  },
  {
    id: 'wppc',
    name: 'Final WPPC (Mujeres)',
    desc: 'Para la final del torneo femenino. Rosado/magenta del logo WPPC.',
    bg: 'bg-gradient-to-br from-[#1f0a1e] via-[#2d1230] to-[#1a0820]',
    scoreBg: 'bg-[#2d1230]/95 border border-[#e040a0]/30',
    rowBg: 'bg-[#3d1540]/30',
    rowActiveBar: 'bg-[#f472b6]',
    nameTxt: 'text-white',
    scoreTxt: 'text-white font-mono',
    pointsTxt: 'text-[#f472b6] font-bold',
    headerTxt: 'text-[#f472b6]/60',
    divider: 'border-[#e040a0]/20',
    roundBadgeBg: 'bg-[#f472b6]/10 border border-[#f472b6]/30',
    roundBadgeTxt: 'text-[#f472b6]',
  },
];

// ── Score Row — ATP/Wimbledon style ───────────────────────────────────────────
// Layout: [serve indicator] [name] | [S1] [S2] [S3] | [points]

type ServeStyle = 'ball' | 'ppc-logo' | 'forest-logo';

function ScoreRow({
  name, isServing, sets, games, points, theme, isTop, serveStyle,
}: {
  name: string;
  isServing: boolean;
  sets: number[];
  games: number;
  points: string;
  theme: Theme;
  isTop: boolean;
  serveStyle: ServeStyle;
}) {
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ');

  const serveIndicator = () => {
    if (!isServing) return <div className="w-4" />;
    switch (serveStyle) {
      case 'ppc-logo':
        return <img src="/ppc-logo.png" alt="" className="w-4 h-4 object-contain" />;
      case 'forest-logo':
        return <img src="/forest-logo.png" alt="" className="w-4 h-4 object-contain" />;
      case 'ball':
      default:
        return <span className="text-[10px]">🎾</span>;
    }
  };

  return (
    <div className={`relative flex items-center ${theme.rowBg} ${isTop ? 'rounded-t-xl' : 'rounded-b-xl'}`}>
      {/* Active serve bar (left edge) */}
      {isServing && (
        <div className={`absolute left-0 top-1 bottom-1 w-1 rounded-full ${theme.rowActiveBar}`} />
      )}

      {/* Serve indicator + Name */}
      <div className={`flex-1 flex items-center gap-1.5 pl-3 py-3 ${theme.nameTxt}`}>
        {serveIndicator()}
        <span className="text-sm font-semibold">{firstName}</span>
        {lastName && <span className="text-sm font-normal opacity-60">{lastName.charAt(0)}.</span>}
      </div>

      {/* Set scores */}
      <div className="flex items-center">
        {sets.map((s, i) => (
          <div key={i} className={`w-7 text-center py-3 text-sm ${theme.scoreTxt} border-l ${theme.divider}`}>
            {s}
          </div>
        ))}
        {/* Current game */}
        <div className={`w-7 text-center py-3 text-sm ${theme.scoreTxt} border-l ${theme.divider}`}>
          {games}
        </div>
      </div>

      {/* Points (current game) */}
      <div className={`w-10 text-center py-3 text-base ${theme.pointsTxt} border-l ${theme.divider}`}>
        {points}
      </div>
    </div>
  );
}

// ── Scoreboard Card ───────────────────────────────────────────────────────────

function ScoreboardCard({ theme, match, large, serveStyle = 'ball' }: {
  theme: Theme; match: typeof MOCK; large?: boolean; serveStyle?: ServeStyle;
}) {
  const p1Sets = match.completedSets.map(s => s.p1);
  const p2Sets = match.completedSets.map(s => s.p2);

  return (
    <div className={`rounded-2xl p-4 ${theme.bg} ${theme.glowEffect || ''} ${large ? 'p-6' : ''}`}>
      {/* Top bar: round badge + sponsor/tournament */}
      <div className="flex items-center justify-between mb-3">
        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] ${theme.roundBadgeBg} ${theme.roundBadgeTxt}`}>
          🏆 {match.round}
        </div>
        {theme.sponsorSlot || (
          <span className={`text-[10px] ${theme.headerTxt} uppercase tracking-wider`}>
            {match.tournament}
          </span>
        )}
      </div>

      {/* Score table */}
      <div className={`rounded-xl overflow-hidden ${theme.scoreBg}`}>
        {/* Header row */}
        <div className={`flex items-center text-[9px] uppercase tracking-wider ${theme.headerTxt} border-b ${theme.divider}`}>
          <div className="flex-1 pl-4 py-1.5">Jugador</div>
          <div className="flex items-center">
            {match.completedSets.map((_, i) => (
              <div key={i} className={`w-7 text-center py-1.5 border-l ${theme.divider}`}>S{i + 1}</div>
            ))}
            <div className={`w-7 text-center py-1.5 border-l ${theme.divider}`}>G</div>
          </div>
          <div className={`w-10 text-center py-1.5 border-l ${theme.divider}`}>Pts</div>
        </div>

        {/* Player rows */}
        <ScoreRow
          name={match.p1Name}
          isServing={match.server === 1}
          sets={p1Sets}
          games={match.p1Games}
          points={match.p1Points}
          theme={theme}
          isTop={true}
          serveStyle={serveStyle}
        />
        <div className={`border-t ${theme.divider}`} />
        <ScoreRow
          name={match.p2Name}
          isServing={match.server === 2}
          sets={p2Sets}
          games={match.p2Games}
          points={match.p2Points}
          theme={theme}
          isTop={false}
          serveStyle={serveStyle}
        />
      </div>

      {/* Live indicator */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="animate-pulse text-red-500 text-xs">●</span>
        <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-red-400">En Vivo</span>
      </div>
    </div>
  );
}

// ── Main Preview Page ─────────────────────────────────────────────────────────

export default function FinalsPreview({ onBack }: { onBack: () => void }) {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const selected = THEMES.find(t => t.id === selectedTheme);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← Volver</button>
          <h1 className="text-xl font-bold text-gray-900">🏆 Finals Scoreboard Preview</h1>
          <div className="w-16" />
        </div>

        <p className="text-center text-sm text-gray-500 mb-8 max-w-lg mx-auto">
          Layout estilo ATP/Wimbledon: tabla con sets, games y puntos. Click en una para ampliar.
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {THEMES.map((theme) => {
            // Default serve style per theme
            const defaultServe: ServeStyle = theme.id === 'forest-ppc' ? 'forest-logo' : 'ball';
            return (
              <div key={theme.id}>
                <button
                  onClick={() => setSelectedTheme(selectedTheme === theme.id ? null : theme.id)}
                  className={`w-full rounded-2xl overflow-hidden transition-all hover:scale-[1.02] shadow-lg ${
                    selectedTheme === theme.id ? 'ring-3 ring-emerald-500 scale-[1.02]' : ''
                  }`}
                >
                  <ScoreboardCard theme={theme} match={MOCK} serveStyle={defaultServe} />
                </button>
                <div className="mt-2 px-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{theme.name}</h3>
                  <p className="text-xs text-gray-500">{theme.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Serve indicator comparison */}
        <div className="mt-10">
          <h2 className="text-center text-lg font-bold text-gray-900 mb-2">Indicador de servicio — opciones</h2>
          <p className="text-center text-xs text-gray-500 mb-4">Mismo tema (Forest), 3 estilos de indicador de saque</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {(['ball', 'ppc-logo', 'forest-logo'] as ServeStyle[]).map(style => (
              <div key={style} className="text-center">
                <div className="rounded-2xl overflow-hidden shadow-lg">
                  <ScoreboardCard theme={THEMES[0]} match={MOCK} serveStyle={style} />
                </div>
                <p className="mt-2 text-xs font-medium text-gray-700 capitalize">
                  {style === 'ball' ? '🎾 Pelota emoji' : style === 'ppc-logo' ? '🏆 Logo PPC' : '🚲 Logo Forest'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded view */}
        {selected && (
          <div className="mt-10">
            <h2 className="text-center text-lg font-bold text-gray-900 mb-4">
              {selected.name} — Vista ampliada
            </h2>
            <div className="max-w-sm mx-auto">
              <ScoreboardCard
                theme={selected}
                match={MOCK}
                large
                serveStyle={selected.id === 'forest-ppc' ? 'forest-logo' : 'ball'}
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mt-12 bg-white rounded-2xl p-5 border border-gray-200 text-sm text-gray-600 space-y-2">
          <h3 className="font-bold text-gray-900">Ideas para personalizar:</h3>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>El servicio se indica con la barrita verde a la izquierda + punto verde al lado del nombre</li>
            <li>Se puede poner logo de Forest como marca de agua o en el indicador de servicio</li>
            <li>Los logos de división (ppc-oro.png, ppc-plata.png, etc.) se pueden poner en la esquina</li>
            <li>Para la WPPC se puede usar un logo específico en vez del trofeo</li>
            <li>Los colores se pueden ajustar — esto es un punto de partida</li>
            <li>El fondo, bordes y acentos son lo que más cambia entre temas</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
