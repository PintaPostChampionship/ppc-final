import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyAuth } from './lib/verifyAuth.js';

/**
 * /api/live-score — Proxy para sincronizar el marcador Garmin ↔ Supabase
 *
 * GET  /api/live-score?match_id=xxx           → devuelve estado actual del partido
 * GET  /api/live-score?player_id=xxx&active=1 → devuelve partidos live del jugador
 * POST /api/live-score                        → registra un punto desde el Garmin
 * POST /api/live-score (action: init)         → inicia un partido desde el Garmin
 * POST /api/live-score (action: undo)         → deshace el último punto
 *
 * Auth: JWT via Authorization header, or X-Player-Id as fallback for Garmin devices
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

function getSupabase(): Supabase {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for Garmin (though Garmin doesn't need CORS, useful for testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Player-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth: prefer JWT, fallback to X-Player-Id for Garmin devices
  let playerId = await verifyAuth(req);
  if (!playerId) {
    // Fallback for Garmin (can't do OAuth) — still requires a valid UUID
    const headerPlayerId = req.headers['x-player-id'] as string;
    if (headerPlayerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerPlayerId)) {
      playerId = headerPlayerId;
    }
  }

  if (!playerId) {
    return res.status(401).json({ error: 'Missing authentication (Authorization header or X-Player-Id)' });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    return handleGet(req, res, supabase, playerId);
  }

  if (req.method === 'POST') {
    return handlePost(req, res, supabase, playerId);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ─── GET: Leer estado ────────────────────────────────────────────────────────

async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Supabase,
  playerId: string
) {
  const { match_id, active, scheduled } = req.query;

  // Listar partidos agendados del jugador (para selección en Garmin)
  if (scheduled === '1') {
    return handleGetScheduled(res, supabase, playerId);
  }

  // Listar partidos live del jugador
  if (active === '1') {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('id, home_player_id, away_player_id, date, status')
      .eq('status', 'live')
      .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch matches' });
    }

    // También buscar partidos donde es editor
    const { data: editorMatches } = await supabase
      .from('live_score_state')
      .select('match_id')
      .contains('editor_ids', [playerId]);

    const editorMatchIds = (editorMatches || []).map((m: any) => m.match_id);
    const allMatchIds = [
      ...(matches || []).map((m: any) => m.id),
      ...editorMatchIds,
    ];
    const uniqueIds = Array.from(new Set(allMatchIds));

    return res.status(200).json({ matches: uniqueIds });
  }

  // Leer estado de un partido específico
  if (!match_id) {
    return res.status(400).json({ error: 'Missing match_id parameter' });
  }

  const { data, error } = await supabase
    .from('live_score_state')
    .select('*')
    .eq('match_id', match_id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch state' });
  }

  if (!data) {
    return res.status(404).json({ error: 'Match not found or not live' });
  }

  // Respuesta compacta para Garmin (minimizar payload)
  const d = data as any;
  return res.status(200).json({
    p1s: d.p1_sets,
    p2s: d.p2_sets,
    p1g: d.p1_games,
    p2g: d.p2_games,
    p1p: d.p1_points,
    p2p: d.p2_points,
    srv: d.server,
    tb: d.in_tiebreak,
    stb: d.in_super_tiebreak,
    fmt: d.format,
    st: d.status,
    sets: d.completed_sets,
  });
}

// ─── GET scheduled: partidos agendados del jugador ───────────────────────────
// Devuelve partidos con status 'scheduled' o 'pending' donde el jugador participa.
// Respuesta compacta para Garmin: id, rival (nombre corto), fecha, hora.

async function handleGetScheduled(
  res: VercelResponse,
  supabase: Supabase,
  playerId: string
) {
  // Buscar partidos agendados donde el jugador es home o away
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_player_id, away_player_id, date, time, status')
    .in('status', ['scheduled', 'pending'])
    .or(`home_player_id.eq.${playerId},away_player_id.eq.${playerId}`)
    .order('date', { ascending: true })
    .limit(10);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch scheduled matches' });
  }

  if (!matches || matches.length === 0) {
    return res.status(200).json({ matches: [] });
  }

  // Obtener nombres de los rivales
  const rivalIds = (matches as any[]).map((m: any) =>
    m.home_player_id === playerId ? m.away_player_id : m.home_player_id
  ).filter(Boolean);

  const uniqueRivalIds = Array.from(new Set(rivalIds));

  let profileMap: Record<string, string> = {};
  if (uniqueRivalIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, nickname')
      .in('id', uniqueRivalIds);

    if (profiles) {
      for (const p of profiles as any[]) {
        // Usar nickname si existe, sino primer nombre
        const displayName = p.nickname || (p.name ? p.name.split(' ')[0] : '?');
        profileMap[p.id] = displayName;
      }
    }
  }

  // Construir respuesta compacta para Garmin
  const result = (matches as any[]).map((m: any) => {
    const rivalId = m.home_player_id === playerId ? m.away_player_id : m.home_player_id;
    const rivalName = rivalId ? (profileMap[rivalId] || '?') : '?';
    const isHome = m.home_player_id === playerId;

    // Formatear fecha corta (DD/MM)
    let dateStr = '';
    if (m.date) {
      const d = new Date(m.date);
      dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
    }

    return {
      id: m.id,
      vs: rivalName,       // nombre corto del rival
      d: dateStr,          // fecha DD/MM
      t: m.time || '',     // hora
      h: isHome ? 1 : 0,  // 1 si es home (P1), 0 si es away (P2)
    };
  });

  return res.status(200).json({ matches: result });
}

// ─── POST: Registrar punto / init / undo ─────────────────────────────────────

async function handlePost(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Supabase,
  playerId: string
) {
  const { action, match_id, player, format, first_server, state, point_log, duration_secs, avg_hr, max_hr, calories, result } = req.body ?? {};

  // ── Action: save_log — Save point-by-point analytics (no match_id required) ──
  if (action === 'save_log') {
    return handleSaveLog(res, supabase, playerId, {
      match_id, format, result, point_log, duration_secs, avg_hr, max_hr, calories
    });
  }

  if (!match_id) {
    return res.status(400).json({ error: 'Missing match_id' });
  }

  // Verificar que el jugador tiene permiso de editar
  const canEdit = await checkEditPermission(supabase, match_id, playerId);
  if (!canEdit) {
    return res.status(403).json({ error: 'Not authorized to edit this match' });
  }

  // ── Action: init — Iniciar partido desde Garmin ──
  if (action === 'init') {
    return handleInit(res, supabase, match_id, format, first_server, playerId);
  }

  // ── Action: sync — Sincronizar estado completo desde Garmin ──
  if (action === 'sync') {
    return handleSync(res, supabase, match_id, state);
  }

  // ── Action: point — Registrar un punto ──
  if (action === 'point' || !action) {
    return handlePoint(res, supabase, match_id, player);
  }

  // ── Action: undo — Deshacer último punto ──
  if (action === 'undo') {
    return handleUndo(res, supabase, match_id);
  }

  return res.status(400).json({ error: 'Unknown action' });
}

// ─── Verificar permisos ──────────────────────────────────────────────────────

async function checkEditPermission(
  supabase: Supabase,
  matchId: string,
  playerId: string
): Promise<boolean> {
  // Check if player is home/away in the match
  const { data: match } = await supabase
    .from('matches')
    .select('home_player_id, away_player_id')
    .eq('id', matchId)
    .maybeSingle();

  if (match && ((match as any).home_player_id === playerId || (match as any).away_player_id === playerId)) {
    return true;
  }

  // Check if player is in editor_ids
  const { data: liveState } = await supabase
    .from('live_score_state')
    .select('editor_ids')
    .eq('match_id', matchId)
    .maybeSingle();

  const ls = liveState as any;
  if (ls && Array.isArray(ls.editor_ids) && ls.editor_ids.includes(playerId)) {
    return true;
  }

  // Check if player is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', playerId)
    .maybeSingle();

  return (profile as any)?.role === 'admin';
}

// ─── Init: crear live_score_state ────────────────────────────────────────────

async function handleInit(
  res: VercelResponse,
  supabase: Supabase,
  matchId: string,
  format: string | undefined,
  firstServer: number | undefined,
  playerId: string
) {
  const fmt = format || 'standard';
  const srv = firstServer || 1;

  // Check if already live
  const { data: existing } = await supabase
    .from('live_score_state')
    .select('id')
    .eq('match_id', matchId)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Match already has live state' });
  }

  // Read current match status to preserve it
  const { data: matchData } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .maybeSingle();

  const previousStatus = (matchData as any)?.status ?? 'scheduled';

  const initState = {
    match_id: matchId,
    p1_sets: 0,
    p2_sets: 0,
    p1_games: 0,
    p2_games: 0,
    p1_points: 0,
    p2_points: 0,
    server: srv,
    in_tiebreak: false,
    in_super_tiebreak: false,
    completed_sets: [],
    previous_state: null,
    format: fmt,
    best_of: 3,
    editor_ids: [playerId],
    status: 'live',
    previous_match_status: previousStatus,
  };

  const { error: insertErr } = await supabase
    .from('live_score_state')
    .insert(initState as any);

  if (insertErr) {
    return res.status(500).json({ error: 'Failed to init match', detail: insertErr.message });
  }

  // Update match status to 'live'
  await supabase
    .from('matches')
    .update({ status: 'live' } as any)
    .eq('id', matchId);

  return res.status(201).json({ ok: true });
}

// ─── Sync: actualizar estado completo desde Garmin ───────────────────────────
// El Garmin envía su estado local completo. Esto es más simple y robusto
// que enviar deltas punto a punto (evita problemas de sincronización).

async function handleSync(
  res: VercelResponse,
  supabase: Supabase,
  matchId: string,
  state: any
) {
  if (!state) {
    return res.status(400).json({ error: 'Missing state object' });
  }

  const updatePayload: Record<string, any> = {
    p1_sets: state.p1s ?? state.p1_sets ?? 0,
    p2_sets: state.p2s ?? state.p2_sets ?? 0,
    p1_games: state.p1g ?? state.p1_games ?? 0,
    p2_games: state.p2g ?? state.p2_games ?? 0,
    p1_points: state.p1p ?? state.p1_points ?? 0,
    p2_points: state.p2p ?? state.p2_points ?? 0,
    server: state.srv ?? state.server ?? 1,
    in_tiebreak: state.tb ?? state.in_tiebreak ?? false,
    in_super_tiebreak: state.stb ?? state.in_super_tiebreak ?? false,
    completed_sets: state.sets ?? state.completed_sets ?? [],
    status: state.st ?? state.status ?? 'live',
  };

  const { error } = await supabase
    .from('live_score_state')
    .update(updatePayload as any)
    .eq('match_id', matchId);

  if (error) {
    return res.status(500).json({ error: 'Failed to sync state', detail: error.message });
  }

  // If match finished, also update the matches table
  if (updatePayload.status === 'finished') {
    const completedSets = updatePayload.completed_sets as Array<{ p1: number; p2: number }>;
    const p1GamesTotal = completedSets.reduce((acc: number, s: any) => acc + (s.p1 || 0), 0);
    const p2GamesTotal = completedSets.reduce((acc: number, s: any) => acc + (s.p2 || 0), 0);

    await supabase
      .from('matches')
      .update({
        status: 'played',
        player1_sets_won: updatePayload.p1_sets,
        player2_sets_won: updatePayload.p2_sets,
        player1_games_won: p1GamesTotal,
        player2_games_won: p2GamesTotal,
      } as any)
      .eq('id', matchId);

    // Insert match_sets
    if (completedSets.length > 0) {
      await supabase.from('match_sets').delete().eq('match_id', matchId);
      const setsToInsert = completedSets.map((s: any, i: number) => ({
        match_id: matchId,
        set_number: i + 1,
        p1_games: s.p1,
        p2_games: s.p2,
      }));
      await supabase.from('match_sets').insert(setsToInsert as any);
    }
  }

  return res.status(200).json({ ok: true });
}

// ─── Point: registrar un punto usando la lógica del servidor ─────────────────
// Alternativa al sync completo: el Garmin solo dice "punto para player X"
// y el servidor calcula el nuevo estado. Más seguro pero requiere que el
// servidor tenga la lógica de puntuación.

async function handlePoint(
  res: VercelResponse,
  supabase: Supabase,
  matchId: string,
  player: number | undefined
) {
  if (player !== 1 && player !== 2) {
    return res.status(400).json({ error: 'player must be 1 or 2' });
  }

  // For now, the Garmin uses "sync" mode (sends full state).
  // This endpoint is a placeholder for future server-side scoring.
  return res.status(501).json({
    error: 'Point-by-point mode not implemented. Use action: sync instead.',
  });
}

// ─── Undo: revertir al previous_state ────────────────────────────────────────

async function handleUndo(
  res: VercelResponse,
  supabase: Supabase,
  matchId: string
) {
  const { data } = await supabase
    .from('live_score_state')
    .select('previous_state')
    .eq('match_id', matchId)
    .maybeSingle();

  const d = data as any;
  if (!d?.previous_state) {
    return res.status(400).json({ error: 'No previous state to undo' });
  }

  const prev = d.previous_state;
  const { error } = await supabase
    .from('live_score_state')
    .update({
      p1_sets: prev.p1_sets,
      p2_sets: prev.p2_sets,
      p1_games: prev.p1_games,
      p2_games: prev.p2_games,
      p1_points: prev.p1_points,
      p2_points: prev.p2_points,
      server: prev.server,
      in_tiebreak: prev.in_tiebreak,
      in_super_tiebreak: prev.in_super_tiebreak,
      completed_sets: prev.completed_sets,
      previous_state: null,
      status: prev.status || 'live',
    } as any)
    .eq('match_id', matchId);

  if (error) {
    return res.status(500).json({ error: 'Failed to undo' });
  }

  return res.status(200).json({ ok: true });
}

// ─── Save Log: guardar point-by-point analytics ──────────────────────────────
// Called from Garmin on Quit (friendly) or match finish (Go Live).
// Stores timestamps, HR, and result for future analytics.

async function handleSaveLog(
  res: VercelResponse,
  supabase: Supabase,
  playerId: string,
  data: {
    match_id?: string;
    format?: string;
    result?: any;
    point_log?: any[];
    duration_secs?: number;
    avg_hr?: number;
    max_hr?: number;
    calories?: number;
  }
) {
  if (!data.point_log || !Array.isArray(data.point_log) || data.point_log.length === 0) {
    return res.status(400).json({ error: 'Missing or empty point_log' });
  }

  const logEntry = {
    profile_id: playerId,
    match_id: data.match_id || null,
    format: data.format || 'standard',
    result: data.result || null,
    point_log: data.point_log,
    duration_secs: data.duration_secs || null,
    avg_hr: data.avg_hr || null,
    max_hr: data.max_hr || null,
    calories: data.calories || null,
    source: 'garmin',
  };

  const { error } = await supabase
    .from('match_point_logs')
    .insert(logEntry as any);

  if (error) {
    return res.status(500).json({ error: 'Failed to save log', detail: error.message });
  }

  return res.status(201).json({ ok: true });
}
