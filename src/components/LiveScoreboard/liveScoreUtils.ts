// ─────────────────────────────────────────────────────────────────────────────
// liveScoreUtils.ts — Lógica pura de puntuación para el Live Scoreboard PPC
// Sin efectos secundarios ni dependencias de React.
// ─────────────────────────────────────────────────────────────────────────────

export type MatchFormat = 'standard' | 'nextgen' | 'supertiebreak';

export interface CompletedSet {
  p1: number;
  p2: number;
}

// Snapshot del estado sin previous_state anidado (para evitar recursión infinita)
export type LiveScoreSnapshot = Omit<LiveScoreState, 'previous_state'> & {
  previous_state: null;
};

export interface LiveScoreState {
  id: string;
  match_id: string;
  // Sets ganados
  p1_sets: number;
  p2_sets: number;
  // Games del set actual
  p1_games: number;
  p2_games: number;
  // Puntos del juego actual
  // Standard: 0=0, 1=15, 2=30, 3=40, 4=Ad
  // Tiebreak/SuperTB: valor numérico directo
  p1_points: number;
  p2_points: number;
  // Saque: 1 = p1 saca, 2 = p2 saca
  server: 1 | 2;
  // Estado especial del juego
  in_tiebreak: boolean;
  in_super_tiebreak: boolean;
  // Historial de sets completados
  completed_sets: CompletedSet[];
  // Snapshot para undo de 1 nivel (null si no hay undo disponible)
  previous_state: LiveScoreSnapshot | null;
  // Formato del partido
  format: MatchFormat;
  best_of: number;
  // Editores adicionales (UUIDs)
  editor_ids: string[];
  // Estado del partido
  status: 'live' | 'finished';
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// initialState — Estado inicial de un partido
// ─────────────────────────────────────────────────────────────────────────────

export function initialState(
  matchId: string,
  format: MatchFormat,
  firstServer: 1 | 2
): Omit<LiveScoreState, 'id' | 'created_at' | 'updated_at'> {
  return {
    match_id: matchId,
    p1_sets: 0,
    p2_sets: 0,
    p1_games: 0,
    p2_games: 0,
    p1_points: 0,
    p2_points: 0,
    server: firstServer,
    in_tiebreak: false,
    in_super_tiebreak: false,
    completed_sets: [],
    previous_state: null,
    format,
    best_of: 3,
    editor_ids: [],
    status: 'live',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// isEditor — Determina si un usuario puede editar el marcador
// ─────────────────────────────────────────────────────────────────────────────

export function isEditor(
  userId: string | null | undefined,
  matchHomeId: string | null | undefined,
  matchAwayId: string | null | undefined,
  userRole: string | null | undefined,
  editorIds: string[]
): boolean {
  if (!userId) return false;
  return (
    userId === matchHomeId ||
    userId === matchAwayId ||
    userRole === 'admin' ||
    editorIds.includes(userId)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// formatPointScore — Convierte puntos internos a display legible
// ─────────────────────────────────────────────────────────────────────────────

export function formatPointScore(
  p1Points: number,
  p2Points: number,
  inTiebreak: boolean,
  inSuperTiebreak: boolean,
  _format: MatchFormat
): { p1: string; p2: string; label?: string } {
  // Tiebreak y Super Tiebreak: puntos numéricos directos
  if (inTiebreak || inSuperTiebreak) {
    return { p1: String(p1Points), p2: String(p2Points) };
  }

  // Standard y SuperTiebreak (primeros 2 sets): 0/15/30/40/Deuce/Ad
  const LABELS = ['0', '15', '30', '40'];

  // Deuce: ambos en 3
  if (p1Points === 3 && p2Points === 3) {
    return { p1: '40', p2: '40', label: 'Deuce' };
  }

  // Ventaja
  if (p1Points === 4) {
    return { p1: 'Ad', p2: '40', label: 'Ad P1' };
  }
  if (p2Points === 4) {
    return { p1: '40', p2: 'Ad', label: 'Ad P2' };
  }

  return {
    p1: LABELS[p1Points] ?? String(p1Points),
    p2: LABELS[p2Points] ?? String(p2Points),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getServeAfterGame — Alterna el saque entre juegos normales
// ─────────────────────────────────────────────────────────────────────────────

export function getServeAfterGame(currentServer: 1 | 2): 1 | 2 {
  return currentServer === 1 ? 2 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// getServeAfterTiebreakPoint — Saque en tiebreak: alterna cada 2 puntos
// tiebreakPointsPlayed = total de puntos jugados en el tiebreak ANTES de este punto
// ─────────────────────────────────────────────────────────────────────────────

export function getServeAfterTiebreakPoint(
  tiebreakFirstServer: 1 | 2,
  tiebreakPointsPlayed: number
): 1 | 2 {
  // Punto 1: primer sacador. Luego alterna cada 2.
  // Puntos 1 → primer sacador
  // Puntos 2,3 → segundo sacador
  // Puntos 4,5 → primer sacador
  // ...
  // Después del punto 1 (index 0), el bloque es floor((pointsPlayed) / 2)
  // Si el bloque es par → primer sacador, impar → segundo sacador
  const block = Math.floor(tiebreakPointsPlayed / 2);
  const isFirstServer = block % 2 === 0;
  if (isFirstServer) return tiebreakFirstServer;
  return tiebreakFirstServer === 1 ? 2 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function snapshot(state: LiveScoreState): LiveScoreSnapshot {
  // Copia sin previous_state para evitar anidamiento
  const { previous_state: _prev, ...rest } = state;
  return { ...rest, previous_state: null };
}

function setsToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

function gamesPerSet(format: MatchFormat): number {
  return format === 'nextgen' ? 4 : 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// addPoint — Función central: registra un punto y devuelve el nuevo estado
// ─────────────────────────────────────────────────────────────────────────────

export function addPoint(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  // Si el partido ya terminó, no hacer nada
  if (state.status === 'finished') return state;

  // Guardar snapshot para undo
  const prev = snapshot(state);

  let s = { ...state, previous_state: prev };

  if (s.in_super_tiebreak) {
    s = addPointSuperTiebreak(s, player);
  } else if (s.in_tiebreak) {
    s = addPointTiebreak(s, player);
  } else if (s.format === 'nextgen') {
    s = addPointNextGen(s, player);
  } else {
    // standard y supertiebreak (primeros 2 sets usan lógica standard)
    s = addPointStandard(s, player);
  }

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// addPointStandard — Lógica de puntos para formato Standard
// ─────────────────────────────────────────────────────────────────────────────

function addPointStandard(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  let s = { ...state };
  const p1 = s.p1_points;
  const p2 = s.p2_points;

  // Deuce (3-3): el que gana pasa a Ad (4)
  if (p1 === 3 && p2 === 3) {
    if (player === 1) s.p1_points = 4;
    else s.p2_points = 4;
    return s;
  }

  // Ad (4-3 o 3-4): el que tiene Ad gana el juego; el otro vuelve a Deuce
  if (p1 === 4 || p2 === 4) {
    if (player === 1 && p1 === 4) return winGame(s, 1);
    if (player === 2 && p2 === 4) return winGame(s, 2);
    // El que no tiene Ad gana → vuelve a Deuce
    s.p1_points = 3;
    s.p2_points = 3;
    return s;
  }

  // Progresión normal: 0→1→2→3
  if (player === 1) {
    if (p1 === 3) return winGame(s, 1); // 40 y rival < 40
    s.p1_points = p1 + 1;
  } else {
    if (p2 === 3) return winGame(s, 2);
    s.p2_points = p2 + 1;
  }

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// addPointNextGen — Lógica de puntos para formato NextGen (sin ventaja)
// ─────────────────────────────────────────────────────────────────────────────

function addPointNextGen(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  let s = { ...state };
  const p1 = s.p1_points;
  const p2 = s.p2_points;

  // Punto de oro: ambos en 3 (40-40), el siguiente punto gana el juego
  if (p1 === 3 && p2 === 3) {
    return winGame(s, player);
  }

  // Progresión normal: 0→1→2→3→Game
  if (player === 1) {
    if (p1 === 3) return winGame(s, 1);
    s.p1_points = p1 + 1;
  } else {
    if (p2 === 3) return winGame(s, 2);
    s.p2_points = p2 + 1;
  }

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// addPointTiebreak — Lógica de puntos en tiebreak (Standard y NextGen)
// ─────────────────────────────────────────────────────────────────────────────

function addPointTiebreak(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  let s = { ...state };

  if (player === 1) s.p1_points += 1;
  else s.p2_points += 1;

  const p1 = s.p1_points;
  const p2 = s.p2_points;
  const totalPoints = p1 + p2;

  // NextGen: punto de oro en 6-6 del tiebreak
  if (s.format === 'nextgen' && p1 === 6 && p2 === 6) {
    // El siguiente punto ganará el tiebreak — no hacemos nada especial aquí,
    // el punto de oro se resuelve en el siguiente addPoint
    // Actualizar saque
    s.server = getServeAfterTiebreakPoint(
      getTiebreakFirstServer(s),
      totalPoints - 1 // puntos jugados antes de este
    );
    return s;
  }

  // NextGen: si estamos en 6-6 y alguien acaba de ganar un punto → gana el tiebreak
  // (punto de oro ya jugado)
  if (s.format === 'nextgen') {
    const prevP1 = player === 1 ? p1 - 1 : p1;
    const prevP2 = player === 2 ? p2 - 1 : p2;
    if (prevP1 === 6 && prevP2 === 6) {
      return winTiebreak(s, player);
    }
  }

  // Standard: gana con 7+ y diferencia ≥ 2
  const minToWin = 7;
  const winner = checkTiebreakWinner(p1, p2, minToWin);
  if (winner) return winTiebreak(s, winner);

  // Actualizar saque (alterna cada 2 puntos)
  s.server = getServeAfterTiebreakPoint(
    getTiebreakFirstServer(s),
    totalPoints - 1
  );

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// addPointSuperTiebreak — Lógica del Super Tiebreak (10 puntos, diff ≥ 2)
// ─────────────────────────────────────────────────────────────────────────────

function addPointSuperTiebreak(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  let s = { ...state };

  if (player === 1) s.p1_points += 1;
  else s.p2_points += 1;

  const p1 = s.p1_points;
  const p2 = s.p2_points;
  const totalPoints = p1 + p2;

  const winner = checkTiebreakWinner(p1, p2, 10);
  if (winner) {
    // Guardar el super tiebreak como tercer set
    const newCompleted: CompletedSet[] = [...s.completed_sets, { p1, p2 }];
    s.completed_sets = newCompleted;
    s.in_super_tiebreak = false;
    s.p1_points = 0;
    s.p2_points = 0;
    s.p1_games = 0;
    s.p2_games = 0;

    if (winner === 1) s.p1_sets += 1;
    else s.p2_sets += 1;

    s.status = 'finished';
    return s;
  }

  // Actualizar saque
  s.server = getServeAfterTiebreakPoint(
    getTiebreakFirstServer(s),
    totalPoints - 1
  );

  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// winGame — El jugador gana el juego actual
// ─────────────────────────────────────────────────────────────────────────────

function winGame(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  let s = { ...state };

  // Resetear puntos
  s.p1_points = 0;
  s.p2_points = 0;

  // Incrementar games
  if (player === 1) s.p1_games += 1;
  else s.p2_games += 1;

  const g1 = s.p1_games;
  const g2 = s.p2_games;
  const limit = gamesPerSet(s.format);

  // ¿Hay tiebreak?
  if (g1 === limit && g2 === limit) {
    s.in_tiebreak = true;
    // El saque del tiebreak lo toma el jugador que NO sacó el último juego
    // (ya alternamos el saque al ganar el juego)
    s.server = getServeAfterGame(s.server);
    // Guardamos quién saca primero en el tiebreak en p1_points/p2_points = 0
    // El primer sacador del tiebreak es el que tiene server ahora
    return s;
  }

  // ¿Ganó el set?
  const setWinner = checkSetWinner(g1, g2, limit, s.format);
  if (setWinner) {
    return winSet(s, setWinner, g1, g2);
  }

  // Alternar saque
  s.server = getServeAfterGame(s.server);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// winTiebreak — El jugador gana el tiebreak
// ─────────────────────────────────────────────────────────────────────────────

function winTiebreak(state: LiveScoreState, player: 1 | 2): LiveScoreState {
  let s = { ...state };

  // El set queda 7-6 para el ganador
  const setP1 = player === 1 ? 7 : 6;
  const setP2 = player === 2 ? 7 : 6;

  s.in_tiebreak = false;
  s.p1_points = 0;
  s.p2_points = 0;

  return winSet(s, player, setP1, setP2);
}

// ─────────────────────────────────────────────────────────────────────────────
// winSet — El jugador gana el set
// ─────────────────────────────────────────────────────────────────────────────

function winSet(
  state: LiveScoreState,
  player: 1 | 2,
  finalG1: number,
  finalG2: number
): LiveScoreState {
  let s = { ...state };

  // Guardar set completado
  s.completed_sets = [...s.completed_sets, { p1: finalG1, p2: finalG2 }];

  // Incrementar sets
  if (player === 1) s.p1_sets += 1;
  else s.p2_sets += 1;

  // Resetear games
  s.p1_games = 0;
  s.p2_games = 0;

  // ¿Ganó el partido?
  const needed = setsToWin(s.best_of);
  if (s.p1_sets >= needed || s.p2_sets >= needed) {
    s.status = 'finished';
    return s;
  }

  // ¿Hay que iniciar Super Tiebreak? (formato supertiebreak, sets 1-1)
  if (s.format === 'supertiebreak' && s.p1_sets === 1 && s.p2_sets === 1) {
    s.in_super_tiebreak = true;
    // El saque del super tiebreak: el que no sacó el último juego del set
    s.server = getServeAfterGame(s.server);
    return s;
  }

  // Alternar saque al inicio del nuevo set
  s.server = getServeAfterGame(s.server);
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkSetWinner — Determina si hay ganador del set
// ─────────────────────────────────────────────────────────────────────────────

function checkSetWinner(
  g1: number,
  g2: number,
  limit: number,
  _format: MatchFormat
): 1 | 2 | null {
  // Gana con `limit` juegos y diferencia ≥ 2
  if (g1 >= limit && g1 - g2 >= 2) return 1;
  if (g2 >= limit && g2 - g1 >= 2) return 2;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkTiebreakWinner — Determina si hay ganador del tiebreak
// ─────────────────────────────────────────────────────────────────────────────

function checkTiebreakWinner(
  p1: number,
  p2: number,
  minToWin: number
): 1 | 2 | null {
  if (p1 >= minToWin && p1 - p2 >= 2) return 1;
  if (p2 >= minToWin && p2 - p1 >= 2) return 2;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// getTiebreakFirstServer — Recupera quién sacó primero en el tiebreak actual
// Se guarda implícitamente: cuando in_tiebreak pasa a true, server ya tiene
// el valor del primer sacador del tiebreak.
// ─────────────────────────────────────────────────────────────────────────────

function getTiebreakFirstServer(state: LiveScoreState): 1 | 2 {
  // El primer sacador del tiebreak es quien tenía el saque cuando in_tiebreak
  // se activó. Como lo guardamos en state.server en ese momento, y luego
  // getServeAfterTiebreakPoint lo usa para calcular el saque actual,
  // necesitamos reconstruirlo desde los puntos actuales.
  // Usamos el server actual y los puntos para inferir el primer sacador.
  const totalPoints = state.p1_points + state.p2_points;
  const block = Math.floor(totalPoints / 2);
  const isFirstServer = block % 2 === 0;

  // Si el bloque actual es par, el server actual ES el primer sacador
  if (isFirstServer) return state.server;
  return state.server === 1 ? 2 : 1;
}
