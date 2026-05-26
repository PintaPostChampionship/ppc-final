import * as React from "react";
import { useState, useMemo } from "react";
import {
  addPoint as calcAddPoint,
  initialState,
  formatPointScore,
  type LiveScoreState,
  type MatchFormat,
} from "./LiveScoreboard/liveScoreUtils";

interface Profile {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface FriendlyMatchCreatorProps {
  profiles: Profile[];
  currentUser: Profile;
}

export default function FriendlyMatchCreator({ profiles, currentUser }: FriendlyMatchCreatorProps) {
  const [step, setStep] = useState<"setup" | "playing">("setup");
  const [player1, setPlayer1] = useState<Profile>(currentUser);
  const [player2, setPlayer2] = useState<Profile | null>(null);
  const [format, setFormat] = useState<MatchFormat>("standard");
  const [searchQuery, setSearchQuery] = useState("");
  const [state, setState] = useState<LiveScoreState | null>(null);
  const [undoHistory, setUndoHistory] = useState<LiveScoreState[]>([]);

  // Filter profiles for search — only show results when typing
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return profiles
      .filter(p => p.id !== currentUser.id && p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [profiles, searchQuery, currentUser.id]);

  const startMatch = () => {
    if (!player2) return;
    const matchId = `friendly-${Date.now()}`;
    const init = {
      ...initialState(matchId, format, 1),
      id: matchId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as LiveScoreState;
    setState(init);
    setUndoHistory([]);
    setStep("playing");
  };

  const handlePoint = (player: 1 | 2) => {
    if (!state || state.status === "finished") return;
    setUndoHistory(prev => [...prev.slice(-19), state]);
    const newState = calcAddPoint(state, player);
    setState(newState);
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const prev = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev2 => prev2.slice(0, -1));
    setState(prev);
  };

  const resetMatch = () => {
    setState(null);
    setUndoHistory([]);
    setStep("setup");
  };

  // ── Setup view ──
  if (step === "setup") {
    return (
      <div className="space-y-4">
        {/* Player 1 (current user) */}
        <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{currentUser.name.split(" ")[0]}</p>
            <p className="text-white/50 text-xs">Jugador 1</p>
          </div>
        </div>

        <div className="text-center text-white/60 text-sm font-medium">vs</div>

        {/* Player 2 selector */}
        {player2 ? (
          <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold">
              {player2.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{player2.name.split(" ")[0]}</p>
              <p className="text-white/50 text-xs">Jugador 2</p>
            </div>
            <button onClick={() => setPlayer2(null)} className="text-white/50 hover:text-white text-xs">
              Cambiar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/20 focus:border-white/40 focus:outline-none text-sm"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPlayer2(p); setSearchQuery(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/15 transition text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold">
                    {p.name.charAt(0)}
                  </div>
                  <span className="text-white text-sm">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format selector */}
        <div className="flex gap-2">
          {([["standard", "Standard"], ["supertiebreak", "Super TB"], ["nextgen", "NextGen"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFormat(val)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${
                format === val
                  ? "bg-white text-emerald-700"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Start button */}
        <button
          onClick={startMatch}
          disabled={!player2}
          className="w-full py-3 rounded-xl bg-white text-emerald-700 font-bold text-sm hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Iniciar Amistoso
        </button>
      </div>
    );
  }

  // ── Playing view ──
  if (!state || !player2) return null;

  const pointScore = formatPointScore(
    state.p1_points,
    state.p2_points,
    state.in_tiebreak,
    state.in_super_tiebreak,
    state.format
  );

  const isFinished = state.status === "finished";
  const p1Name = currentUser.name.split(" ")[0];
  const p2Name = player2.name.split(" ")[0];

  return (
    <div className="space-y-4">
      {/* Score display */}
      <div className="bg-white rounded-2xl p-4 shadow-lg">
        {/* Sets */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 uppercase font-semibold">
            {format === "standard" ? "Standard" : format === "nextgen" ? "NextGen" : "Super TB"}
            {state.in_tiebreak && " · Tiebreak"}
            {state.in_super_tiebreak && " · Super Tiebreak"}
          </span>
          {isFinished && <span className="text-xs font-bold text-emerald-600 uppercase">Finalizado</span>}
        </div>

        {/* Player rows */}
        {[
          { name: p1Name, points: pointScore.p1, games: state.p1_games, sets: state.p1_sets, serving: state.server === 1, player: 1 as const },
          { name: p2Name, points: pointScore.p2, games: state.p2_games, sets: state.p2_sets, serving: state.server === 2, player: 2 as const },
        ].map((row) => (
          <div key={row.player} className="flex items-center justify-between py-2 border-b last:border-b-0 border-gray-100">
            <div className="flex items-center gap-2">
              {row.serving && !isFinished && <span className="text-lg">🎾</span>}
              <span className={`font-bold text-sm ${isFinished && row.sets > (row.player === 1 ? state.p2_sets : state.p1_sets) ? "text-emerald-700" : "text-gray-900"}`}>
                {row.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Completed sets */}
              {state.completed_sets.map((s, i) => (
                <span key={i} className={`text-sm font-bold tabular-nums ${
                  (row.player === 1 ? s.p1 : s.p2) > (row.player === 1 ? s.p2 : s.p1) ? "text-gray-900" : "text-gray-300"
                }`}>
                  {row.player === 1 ? s.p1 : s.p2}
                </span>
              ))}
              {/* Current games */}
              {!isFinished && (
                <span className="text-lg font-black tabular-nums text-emerald-700">{row.games}</span>
              )}
              {/* Current points */}
              {!isFinished && (
                <span className="text-sm font-bold tabular-nums text-gray-500 w-8 text-center">{row.points}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {!isFinished ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handlePoint(1)}
            className="py-4 rounded-xl bg-white font-bold text-emerald-700 text-sm hover:bg-emerald-50 active:scale-95 transition shadow"
          >
            Punto {p1Name}
          </button>
          <button
            onClick={() => handlePoint(2)}
            className="py-4 rounded-xl bg-white font-bold text-amber-700 text-sm hover:bg-amber-50 active:scale-95 transition shadow"
          >
            Punto {p2Name}
          </button>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-white font-bold text-lg">
            🏆 {state.p1_sets > state.p2_sets ? p1Name : p2Name} gana!
          </p>
          <p className="text-white/60 text-sm mt-1">
            {state.completed_sets.map((s, i) => `${s.p1}-${s.p2}`).join("  ")}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleUndo}
          disabled={undoHistory.length === 0 || isFinished}
          className="flex-1 py-2 rounded-lg bg-white/10 text-white/70 text-xs font-medium hover:bg-white/20 disabled:opacity-30 transition"
        >
          ↩ Deshacer
        </button>
        <button
          onClick={resetMatch}
          className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-200 text-xs font-medium hover:bg-red-500/30 transition"
        >
          ✕ Terminar
        </button>
      </div>
    </div>
  );
}
