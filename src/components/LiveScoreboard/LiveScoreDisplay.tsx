// ─────────────────────────────────────────────────────────────────────────────
// LiveScoreDisplay.tsx — Display del marcador en vivo (UI estilo PPC)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { formatPointScore, type LiveScoreState } from './liveScoreUtils';
import type { ConnectionStatus } from './useLiveScore';

export interface LiveScoreDisplayProps {
  state: LiveScoreState;
  player1Name: string;
  player2Name: string;
  player1Avatar?: string;
  player2Avatar?: string;
  connectionStatus?: ConnectionStatus;
  compact?: boolean;
}

// ── Colores PPC ───────────────────────────────────────────────────────────────
// Paleta: verde esmeralda (principal), fondo oscuro verdoso, acentos amarillo-lima

export default function LiveScoreDisplay({
  state,
  player1Name,
  player2Name,
  player1Avatar,
  player2Avatar,
  connectionStatus = 'connected',
  compact = false,
}: LiveScoreDisplayProps) {
  const {
    p1_sets,
    p2_sets,
    p1_games,
    p2_games,
    p1_points,
    p2_points,
    server,
    in_tiebreak,
    in_super_tiebreak,
    completed_sets,
    format,
    status,
  } = state;

  const pointScore = formatPointScore(
    p1_points,
    p2_points,
    in_tiebreak,
    in_super_tiebreak,
    format
  );

  const isFinished = status === 'finished';
  const isTiebreak = in_tiebreak || in_super_tiebreak;

  // ── Modo compacto (Banner) ────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        {server === 1 && <span className="text-yellow-400 text-xs">🎾</span>}
        <span className="text-white font-semibold">{player1Name.split(' ')[0]}</span>
        <span className="text-gray-400 tabular-nums">
          {completed_sets.map((s) => `${s.p1}-${s.p2}`).join('  ')}
          {!isFinished && completed_sets.length > 0 && <span className="text-gray-600">  </span>}
          {!isFinished && `${p1_games}-${p2_games}`}
        </span>
        <span className="text-white font-semibold">{player2Name.split(' ')[0]}</span>
        {server === 2 && <span className="text-yellow-400 text-xs">🎾</span>}
      </div>
    );
  }

  // ── Modo completo ─────────────────────────────────────────────────────────
  return (
    <div className="w-full select-none">
      {/* Indicador de conexión */}
      {connectionStatus !== 'connected' && (
        <div className={`mb-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
          connectionStatus === 'connecting'
            ? 'bg-yellow-900/40 text-yellow-300'
            : 'bg-red-900/40 text-red-300'
        }`}>
          <span className="animate-pulse">●</span>
          {connectionStatus === 'connecting' ? 'Reconectando...' : 'Conexión perdida. Recarga la página.'}
        </div>
      )}

      {/* Badge tiebreak */}
      {isTiebreak && (
        <div className="mb-3 text-center">
          <span className="rounded-full bg-yellow-400/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-yellow-300 ring-1 ring-yellow-400/30">
            {in_super_tiebreak ? '⚡ Super Tiebreak' : '⚡ Tiebreak'}
          </span>
        </div>
      )}

      {/* Tarjeta principal del marcador */}
      <div
        className="overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #1a3a2a 0%, #1e4a32 50%, #163320 100%)',
          border: '1px solid rgba(52,211,153,0.15)',
        }}
      >
        {/* Franja superior verde */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #34d399, #10b981, #6ee7b7)' }} />

        {/* Fila Jugador 1 */}
        <PlayerRow
          name={player1Name}
          avatar={player1Avatar}
          isServing={server === 1 && !isFinished}
          completedSets={completed_sets}
          playerIndex={1}
          currentGames={p1_games}
          setsWon={p1_sets}
          isFinished={isFinished}
          isWinner={isFinished && p1_sets > p2_sets}
          rivalSets={p2_sets}
        />

        {/* Separador con puntuación del juego */}
        {!isFinished && (
          <div
            className="flex items-center justify-center py-3 mx-4 rounded-xl my-1"
            style={{ background: 'rgba(0,0,0,0.25)' }}
          >
            <div className="flex items-center gap-5">
              {/* Puntos P1 */}
              <span className={`text-4xl font-black tabular-nums leading-none ${
                pointScore.label === 'Ad P1' ? 'text-yellow-300' : 'text-white'
              }`}>
                {pointScore.p1}
              </span>

              {/* Label central (Deuce / Ad) */}
              <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                {pointScore.label ? (
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                    {pointScore.label === 'Deuce'
                      ? 'Deuce'
                      : pointScore.label === 'Ad P1'
                      ? `Ad ${player1Name.split(' ')[0]}`
                      : `Ad ${player2Name.split(' ')[0]}`}
                  </span>
                ) : (
                  <span className="text-gray-600 text-lg font-bold">—</span>
                )}
              </div>

              {/* Puntos P2 */}
              <span className={`text-4xl font-black tabular-nums leading-none ${
                pointScore.label === 'Ad P2' ? 'text-yellow-300' : 'text-white'
              }`}>
                {pointScore.p2}
              </span>
            </div>
          </div>
        )}

        {/* Fila Jugador 2 */}
        <PlayerRow
          name={player2Name}
          avatar={player2Avatar}
          isServing={server === 2 && !isFinished}
          completedSets={completed_sets}
          playerIndex={2}
          currentGames={p2_games}
          setsWon={p2_sets}
          isFinished={isFinished}
          isWinner={isFinished && p2_sets > p1_sets}
          rivalSets={p1_sets}
        />

        {/* Franja inferior */}
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
            {format === 'standard' && 'Standard · Bo3 · 6 juegos'}
            {format === 'nextgen' && 'NextGen · Bo3 · 4 juegos'}
            {format === 'supertiebreak' && 'Super TB · Bo3'}
          </span>
          {isFinished && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              ✓ Finalizado
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────

interface PlayerRowProps {
  name: string;
  avatar?: string;
  isServing: boolean;
  completedSets: { p1: number; p2: number }[];
  playerIndex: 1 | 2;
  currentGames: number;
  setsWon: number;
  isFinished: boolean;
  isWinner: boolean;
  rivalSets: number;
}

function PlayerRow({
  name,
  avatar,
  isServing,
  completedSets,
  playerIndex,
  currentGames,
  setsWon,
  isFinished,
  isWinner,
}: PlayerRowProps) {
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ');

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${
      isWinner ? 'bg-emerald-900/30' : ''
    }`}>
      {/* Avatar grande */}
      <div className="relative shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-14 w-14 rounded-full object-cover"
            style={{
              border: isWinner
                ? '2px solid #34d399'
                : isServing
                ? '2px solid #fbbf24'
                : '2px solid rgba(255,255,255,0.15)',
              boxShadow: isServing ? '0 0 12px rgba(251,191,36,0.4)' : undefined,
            }}
          />
        ) : (
          <div
            className="h-14 w-14 rounded-full flex items-center justify-center text-xl font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #065f46, #047857)',
              border: isWinner
                ? '2px solid #34d399'
                : isServing
                ? '2px solid #fbbf24'
                : '2px solid rgba(255,255,255,0.15)',
            }}
          >
            {firstName.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Indicador de saque sobre el avatar */}
        {isServing && (
          <span
            className="absolute -bottom-1 -right-1 text-sm"
            title="Saque"
          >
            🎾
          </span>
        )}
      </div>

      {/* Nombre */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-black leading-tight ${
            isWinner ? 'text-emerald-300' : 'text-white'
          }`}>
            {firstName}
          </span>
          {isWinner && <span className="text-base">🏆</span>}
        </div>
        {lastName && (
          <span className="text-xs font-medium text-gray-500 leading-tight block">
            {lastName}
          </span>
        )}
      </div>

      {/* Sets completados */}
      <div className="flex items-center gap-2">
        {completedSets.map((s, i) => {
          const myGames = playerIndex === 1 ? s.p1 : s.p2;
          const oppGames = playerIndex === 1 ? s.p2 : s.p1;
          const wonSet = myGames > oppGames;
          return (
            <div key={i} className="flex flex-col items-center">
              <span className={`text-xl font-black tabular-nums leading-none ${
                wonSet ? 'text-white' : 'text-gray-600'
              }`}>
                {myGames}
              </span>
              <span className="text-[9px] text-gray-700 uppercase tracking-wider">S{i + 1}</span>
            </div>
          );
        })}

        {/* Games actuales o sets ganados */}
        <div
          className="flex flex-col items-center justify-center rounded-lg min-w-[2.5rem] h-10"
          style={{
            background: isFinished
              ? (isWinner ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)')
              : 'rgba(255,255,255,0.08)',
          }}
        >
          <span className={`text-2xl font-black tabular-nums leading-none ${
            isFinished && isWinner ? 'text-emerald-300' : 'text-white'
          }`}>
            {isFinished ? setsWon : currentGames}
          </span>
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">
            {isFinished ? 'sets' : 'juegos'}
          </span>
        </div>
      </div>
    </div>
  );
}
