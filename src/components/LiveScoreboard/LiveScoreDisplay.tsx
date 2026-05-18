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
            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          <span className="animate-pulse">●</span>
          {connectionStatus === 'connecting' ? 'Reconectando...' : 'Conexión perdida. Recarga la página.'}
        </div>
      )}

      {/* Badge tiebreak */}
      {isTiebreak && (
        <div className="mb-3 text-center">
          <span className="rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-800 ring-1 ring-amber-300">
            {in_super_tiebreak ? '⚡ Super Tiebreak' : '⚡ Tiebreak'}
          </span>
        </div>
      )}

      {/* Tarjeta principal del marcador */}
      <div className="overflow-hidden rounded-2xl shadow-xl bg-white border border-gray-200">
        {/* Franja superior verde */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" />

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
        />

        {/* Separador con puntuación del juego */}
        {!isFinished && (
          <div className="flex items-center justify-center py-4 mx-4 rounded-xl my-1 bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-5">
              {/* Puntos P1 */}
              <div className="flex flex-col items-center">
                <span className={`text-4xl font-black tabular-nums leading-none ${
                  pointScore.label === 'Ad P1' ? 'text-emerald-600' : 'text-gray-900'
                }`}>
                  {pointScore.p1}
                </span>
                <span className="text-[10px] text-gray-400 mt-1 font-medium">{player1Name.split(' ')[0]}</span>
              </div>

              {/* Label central (Deuce / Ad) */}
              <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                {pointScore.label ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                    {pointScore.label === 'Deuce'
                      ? 'Deuce'
                      : pointScore.label === 'Ad P1'
                      ? `Ad ${player1Name.split(' ')[0]}`
                      : `Ad ${player2Name.split(' ')[0]}`}
                  </span>
                ) : (
                  <span className="text-gray-300 text-lg font-bold">—</span>
                )}
              </div>

              {/* Puntos P2 */}
              <div className="flex flex-col items-center">
                <span className={`text-4xl font-black tabular-nums leading-none ${
                  pointScore.label === 'Ad P2' ? 'text-emerald-600' : 'text-gray-900'
                }`}>
                  {pointScore.p2}
                </span>
                <span className="text-[10px] text-gray-400 mt-1 font-medium">{player2Name.split(' ')[0]}</span>
              </div>
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
        />

        {/* Franja inferior */}
        <div className="px-4 py-2.5 flex items-center justify-between bg-gray-50 border-t border-gray-100">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {format === 'standard' && 'Standard · Bo3 · 6 juegos'}
            {format === 'nextgen' && 'NextGen · Bo3 · 4 juegos'}
            {format === 'supertiebreak' && 'Super TB · Bo3'}
          </span>
          {isFinished && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
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
    <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
      isWinner ? 'bg-emerald-50' : 'bg-white'
    }`}>
      {/* Serve indicator — pelota arriba del avatar */}
      <div className="relative shrink-0">
        {/* Pelota de saque — visible y animada */}
        {isServing && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
            <span className="text-lg drop-shadow-md animate-bounce" style={{ animationDuration: '2s' }}>🎾</span>
          </div>
        )}
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className={`h-12 w-12 rounded-full object-cover ${
              isWinner
                ? 'ring-2 ring-emerald-500'
                : isServing
                ? 'ring-2 ring-amber-400 shadow-md shadow-amber-200/50'
                : 'ring-1 ring-gray-200'
            }`}
          />
        ) : (
          <div
            className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-black text-white ${
              isWinner
                ? 'ring-2 ring-emerald-500'
                : isServing
                ? 'ring-2 ring-amber-400 shadow-md shadow-amber-200/50'
                : 'ring-1 ring-gray-200'
            }`}
            style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
          >
            {firstName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Nombre */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold leading-tight ${
            isWinner ? 'text-emerald-700' : 'text-gray-900'
          }`}>
            {firstName}
          </span>
          {isServing && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
              Saque
            </span>
          )}
          {isWinner && <span className="text-base">🏆</span>}
        </div>
        {lastName && (
          <span className="text-xs font-medium text-gray-400 leading-tight block">
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
                wonSet ? 'text-gray-900' : 'text-gray-300'
              }`}>
                {myGames}
              </span>
              <span className="text-[9px] text-gray-400 uppercase tracking-wider">S{i + 1}</span>
            </div>
          );
        })}

        {/* Games actuales o sets ganados */}
        <div className={`flex flex-col items-center justify-center rounded-lg min-w-[2.5rem] h-10 ${
          isFinished
            ? (isWinner ? 'bg-emerald-100' : 'bg-gray-50')
            : 'bg-emerald-50'
        }`}>
          <span className={`text-2xl font-black tabular-nums leading-none ${
            isFinished && isWinner ? 'text-emerald-700' : isFinished ? 'text-gray-400' : 'text-emerald-700'
          }`}>
            {isFinished ? setsWon : currentGames}
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wider">
            {isFinished ? 'sets' : 'games'}
          </span>
        </div>
      </div>
    </div>
  );
}
