import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Twitch Live Status Check ────────────────────────────────────────────────
// Checks if pintaposttv is currently live on Twitch.
// Uses Twitch Helix API with Client Credentials (App Access Token).
//
// Environment variables needed:
//   TWITCH_CLIENT_ID — from dev.twitch.tv console
//   TWITCH_CLIENT_SECRET — from dev.twitch.tv console
//
// Fallback: if no Twitch credentials are configured, returns { live: false }
// so the feature degrades gracefully.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  // Reuse cached token if still valid (with 5min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const resp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cache for 60 seconds to avoid hammering Twitch
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    return res.status(200).json({ live: false, reason: 'not_configured' });
  }

  const token = await getAppAccessToken();
  if (!token) {
    return res.status(200).json({ live: false, reason: 'token_error' });
  }

  try {
    const channel = (req.query.channel as string) || 'pintaposttv';

    const resp = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!resp.ok) {
      return res.status(200).json({ live: false, reason: 'api_error' });
    }

    const data = await resp.json();
    const stream = data.data?.[0];

    if (stream && stream.type === 'live') {
      return res.status(200).json({
        live: true,
        title: stream.title,
        viewer_count: stream.viewer_count,
        game_name: stream.game_name,
        started_at: stream.started_at,
      });
    }

    return res.status(200).json({ live: false });
  } catch (err) {
    console.error('[twitch-status] Error:', err);
    return res.status(200).json({ live: false, reason: 'exception' });
  }
}
