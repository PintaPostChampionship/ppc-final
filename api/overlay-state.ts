import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Public endpoint — no auth required.
// Returns the current featured live match state for the OBS overlay.

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  // Find featured live match, or most recent live match
  const { data: featured } = await supabase
    .from('live_score_state')
    .select('*')
    .eq('is_featured', true)
    .eq('status', 'live')
    .maybeSingle();

  let liveState = featured;

  if (!liveState) {
    const { data: latest } = await supabase
      .from('live_score_state')
      .select('*')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    liveState = latest;
  }

  if (!liveState) {
    return res.status(200).json({ live: false });
  }

  const matchId = (liveState as any).match_id;

  // Load match details
  const { data: match } = await supabase
    .from('matches')
    .select('home_player_id, away_player_id, knockout_round, division_id')
    .eq('id', matchId)
    .maybeSingle();

  let p1Name = 'Jugador 1';
  let p2Name = 'Jugador 2';
  let roundLabel = '';
  let divisionName = '';
  let theme = 'forest';

  if (match) {
    // Round
    const roundMap: Record<string, string> = {
      'F': 'Final', 'SF': 'Semifinal', 'QF': 'Cuartos', 'R16': 'Ronda 16',
    };
    roundLabel = roundMap[(match as any).knockout_round] || '';

    // Division + auto-theme
    if ((match as any).division_id) {
      const { data: div } = await supabase
        .from('divisions')
        .select('name')
        .eq('id', (match as any).division_id)
        .maybeSingle();
      if (div) {
        divisionName = (div as any).name || '';
        const dn = divisionName.toLowerCase();
        if (dn.includes('oro') || dn.includes('gold')) theme = 'oro';
        else if (dn.includes('plata') || dn.includes('silver')) theme = 'plata';
        else if (dn.includes('bronce') || dn.includes('bronze') || dn.includes('cobre')) theme = 'bronce';
        else if (dn.includes('wppc') || dn.includes('mujer') || dn.includes('women')) theme = 'wppc';
        else theme = 'forest';
      }
    }

    // Player names
    if ((match as any).home_player_id) {
      const { data: p1 } = await supabase
        .from('profiles')
        .select('name, nickname')
        .eq('id', (match as any).home_player_id)
        .maybeSingle();
      if (p1) p1Name = (p1 as any).name || (p1 as any).nickname || 'Jugador 1';
    }
    if ((match as any).away_player_id) {
      const { data: p2 } = await supabase
        .from('profiles')
        .select('name, nickname')
        .eq('id', (match as any).away_player_id)
        .maybeSingle();
      if (p2) p2Name = (p2 as any).name || (p2 as any).nickname || 'Jugador 2';
    }
  }

  // Use theme from DB if set, otherwise auto-detect from division
  const dbTheme = (liveState as any).theme;
  if (dbTheme && dbTheme !== 'auto') {
    theme = dbTheme;
  }

  const serveIndicator = (liveState as any).serve_indicator || 'ball';
  const overlayLogo = (liveState as any).overlay_logo || 'ppc';

  return res.status(200).json({
    live: true,
    match_id: matchId,
    p1_name: p1Name,
    p2_name: p2Name,
    round: roundLabel,
    division: divisionName,
    theme,
    serve_indicator: serveIndicator,
    overlay_logo: overlayLogo,
    state: {
      p1_sets: (liveState as any).p1_sets,
      p2_sets: (liveState as any).p2_sets,
      p1_games: (liveState as any).p1_games,
      p2_games: (liveState as any).p2_games,
      p1_points: (liveState as any).p1_points,
      p2_points: (liveState as any).p2_points,
      server: (liveState as any).server,
      in_tiebreak: (liveState as any).in_tiebreak,
      in_super_tiebreak: (liveState as any).in_super_tiebreak,
      completed_sets: (liveState as any).completed_sets,
      status: (liveState as any).status,
    },
  });
}
