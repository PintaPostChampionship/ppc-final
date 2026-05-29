import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, isInternalCall } from './lib/verifyAuth';
import { configureWebPush } from './lib/pushUtils';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: accept either a valid user JWT or an internal service call
  const userId = await verifyAuth(req);
  const internal = isInternalCall(req);

  if (!userId && !internal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { recipient_profile_id, title, body, url, actions } = req.body ?? {};

  if (!recipient_profile_id || !title || !body || !url) {
    return res.status(400).json({ error: 'Missing required fields: recipient_profile_id, title, body, url' });
  }

  // Configure VAPID via shared utility
  let webpush: ReturnType<typeof configureWebPush>;
  try {
    webpush = configureWebPush();
  } catch (e: any) {
    console.error('[send-notification] VAPID config error:', e?.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Get subscriptions
  const supabase = getSupabase();
  const { data: subscriptions, error: fetchErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('profile_id', recipient_profile_id);

  if (fetchErr) {
    console.error('[send-notification] DB error:', fetchErr.message);
    return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({ success: true, sent: 0, failed: 0 });
  }

  const payload = JSON.stringify({
    title,
    body,
    data: { url, actions: actions || [] },
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
        payload,
        { urgency: 'high' }
      );
      sent++;
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        console.log(`[send-notification] Removed expired sub ${sub.id}`);
      } else {
        console.error(`[send-notification] Send failed:`, err?.message || err);
      }
      failed++;
    }
  }

  return res.status(200).json({ success: sent > 0, sent, failed });
}
