// --- Scoring Simulator ---
// Exact replica of PPCScoreboard.mc logic translated to TypeScript.
// Simulates a tennis match point-by-point to detect game/set boundaries.

export interface PointLogEntry {
  p: 1 | 2;
  t: number;
  hr: number;
}

export interface SimulatedGame {
  points: PointLogEntry[];
  wonByMe: boolean;
  isTiebreak: boolean;
}

export interface SimulatedSet {
  games: SimulatedGame[];
  myGames: number;
  rivalGames: number;
  wonByMe: boolean;
  isSuperTiebreak: boolean;
}

export interface SimulatedMatch {
  sets: SimulatedSet[];
  remainder: PointLogEntry[];
}

export function simulateMatch(
  pointLog: PointLogEntry[],
  format: string
): SimulatedMatch {
  // --- State (mirrors PPCScoreboard exactly) ---
  let p1Points = 0; // me
  let p2Points = 0; // rival
  let p1Games: number[] = [0];
  let p2Games: number[] = [0];
  let inTiebreak = false;
  let inSuperTiebreak = false;
  let matchFinished = false;
  let server = 1;
  const setsToWin = 2;
  const isNextGen = format === "nextgen";
  const gamesPerSet = isNextGen ? 4 : 6;

  // --- Output tracking ---
  const sets: SimulatedSet[] = [];
  let currentSetGames: SimulatedGame[] = [];
  let currentGamePoints: PointLogEntry[] = [];

  function getSetIdx() { return p1Games.length - 1; }

  function countSetsWon(player: 1 | 2): number {
    const g = player === 1 ? p1Games : p2Games;
    const o = player === 1 ? p2Games : p1Games;
    let count = 0;
    for (let i = 0; i < g.length - 1; i++) {
      if (g[i] > o[i]) count++;
    }
    return count;
  }

  // --- Record a completed game into output ---
  function recordGame(wonByMe: boolean, isTB: boolean) {
    currentSetGames.push({ points: [...currentGamePoints], wonByMe, isTiebreak: isTB });
    currentGamePoints = [];
  }

  // --- Record a completed set into output ---
  function recordSet(wonByMe: boolean, isSTB: boolean) {
    const si = getSetIdx() - 1; // set just finished is previous index
    sets.push({
      games: [...currentSetGames],
      myGames: p1Games[si] ?? 0,
      rivalGames: p2Games[si] ?? 0,
      wonByMe,
      isSuperTiebreak: isSTB,
    });
    currentSetGames = [];
  }

  // --- winGame (mirrors PPCScoreboard.winGame) ---
  function winGame(scorer: 1 | 2): number {
    p1Points = 0;
    p2Points = 0;
    const si = getSetIdx();
    if (scorer === 1) p1Games[si]++;
    else p2Games[si]++;

    const g1 = scorer === 1 ? p1Games[si] : p2Games[si];
    const g2 = scorer === 1 ? p2Games[si] : p1Games[si];

    const wonByMe = scorer === 1;
    recordGame(wonByMe, false);

    // Check tiebreak
    if (g1 === gamesPerSet && g2 === gamesPerSet) {
      inTiebreak = true;
      server = server === 1 ? 2 : 1;
      return 1;
    }
    // Check set win
    if (g1 >= gamesPerSet && (g1 - g2) >= 2) {
      return winSet(scorer);
    }
    server = server === 1 ? 2 : 1;
    return 1;
  }

  // --- winTiebreak ---
  function winTiebreak(scorer: 1 | 2): number {
    const si = getSetIdx();
    if (scorer === 1) p1Games[si] = gamesPerSet + 1;
    else p2Games[si] = gamesPerSet + 1;
    inTiebreak = false;
    p1Points = 0;
    p2Points = 0;

    const wonByMe = scorer === 1;
    recordGame(wonByMe, true);

    return winSet(scorer);
  }

  // --- winSet ---
  function winSet(scorer: 1 | 2): number {
    p1Games.push(0);
    p2Games.push(0);
    p1Points = 0;
    p2Points = 0;

    const wonByMe = scorer === 1;
    const isSTB = inSuperTiebreak;
    inSuperTiebreak = false;
    recordSet(wonByMe, isSTB);

    const setsWon = countSetsWon(scorer);
    if (setsWon >= setsToWin) {
      matchFinished = true;
      return 3;
    }

    // Super tiebreak check
    if (format === "supertiebreak" && countSetsWon(1) === 1 && countSetsWon(2) === 1) {
      inSuperTiebreak = true;
      server = server === 1 ? 2 : 1;
      return 2;
    }

    server = server === 1 ? 2 : 1;
    return 2;
  }

  // --- addPointStandard (exact copy of PPCScoreboard.addPointStandard) ---
  function addPointStandard(scorer: 1 | 2): number {
    const myPts = scorer === 1 ? p1Points : p2Points;
    const otherPts = scorer === 1 ? p2Points : p1Points;

    // Deuce (3-3): scorer gets Ad (4)
    if (myPts === 3 && otherPts === 3) {
      if (scorer === 1) p1Points = 4;
      else p2Points = 4;
      return 0;
    }

    // Ad situations (4-3 or 3-4)
    if (myPts === 4 || otherPts === 4) {
      if (myPts === 4) {
        // Scorer has Ad and scores → game
        return winGame(scorer);
      }
      // Opponent has Ad, scorer scores → back to Deuce
      p1Points = 3;
      p2Points = 3;
      return 0;
    }

    // Normal: at 40 (3) and opponent < 40 → win game
    if (myPts === 3) {
      return winGame(scorer);
    }

    // Normal increment: 0→1→2→3
    if (scorer === 1) p1Points++;
    else p2Points++;
    return 0;
  }

  // --- addPointNextGen ---
  function addPointNextGen(scorer: 1 | 2): number {
    const myPts = scorer === 1 ? p1Points : p2Points;
    const otherPts = scorer === 1 ? p2Points : p1Points;

    // Golden point: both at 3 (40-40), next point wins
    if (myPts === 3 && otherPts === 3) {
      return winGame(scorer);
    }
    // At 40, opponent < 40 → win
    if (myPts === 3) {
      return winGame(scorer);
    }
    if (scorer === 1) p1Points++;
    else p2Points++;
    return 0;
  }

  // --- addPointTiebreak ---
  function addPointTiebreak(scorer: 1 | 2): number {
    if (scorer === 1) p1Points++;
    else p2Points++;

    const totalPoints = p1Points + p2Points;
    const hi = Math.max(p1Points, p2Points);
    const lo = Math.min(p1Points, p2Points);

    if (hi >= 7 && (hi - lo) >= 2) {
      const winner: 1 | 2 = p1Points > p2Points ? 1 : 2;
      return winTiebreak(winner);
    }

    // Server: after 1st point, then every 2
    if (totalPoints === 1 || (totalPoints > 1 && (totalPoints - 1) % 2 === 0)) {
      server = server === 1 ? 2 : 1;
    }
    return 0;
  }

  // --- addPointSuperTiebreak ---
  function addPointSuperTiebreak(scorer: 1 | 2): number {
    if (scorer === 1) p1Points++;
    else p2Points++;

    const totalPoints = p1Points + p2Points;
    const hi = Math.max(p1Points, p2Points);
    const lo = Math.min(p1Points, p2Points);

    if (hi >= 10 && (hi - lo) >= 2) {
      const winner: 1 | 2 = p1Points > p2Points ? 1 : 2;
      // Record STB score as games for the set
      const si = getSetIdx();
      p1Games[si] = p1Points;
      p2Games[si] = p2Points;
      p1Games.push(0);
      p2Games.push(0);
      p1Points = 0;
      p2Points = 0;

      const wonByMe = winner === 1;
      recordGame(wonByMe, true);
      recordSet(wonByMe, true);
      matchFinished = true;
      return 3;
    }

    // Server: after 1st point, then every 2
    if (totalPoints === 1 || (totalPoints > 1 && (totalPoints - 1) % 2 === 0)) {
      server = server === 1 ? 2 : 1;
    }
    return 0;
  }

  // --- Main loop: replay each point ---
  for (const pt of pointLog) {
    if (matchFinished) break;

    currentGamePoints.push(pt);
    const scorer = pt.p as 1 | 2;

    if (inSuperTiebreak) {
      addPointSuperTiebreak(scorer);
    } else if (inTiebreak) {
      addPointTiebreak(scorer);
    } else if (isNextGen) {
      addPointNextGen(scorer);
    } else {
      addPointStandard(scorer);
    }
  }

  return {
    sets,
    remainder: currentGamePoints,
  };
}
