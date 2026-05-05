import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceSupabase, configureWebPush } from './lib/pushUtils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipient_profile_id, title, body, url, actions } = req.body ?? {};

  // Validate required fields
  if (!recipient_profile_id || !title || !body || !url) {
    return res.status(400).json({ error: 'Missing required fields: recipient_profile_id, title, body, url' });
  }

  // Configure web-push
  let wp;
  try {
    wp = configureWebPush();
  } catch (e) {
    console.error('[send-notification] VAPID config error:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Get subscriptions for recipient
  const supabase = getServiceSupabase();
  const { data: subscriptions, error: fetchErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('profile_id', recipient_profile_id);

  if (fetchErr) {
    console.error('[send-notification] Fetch subscriptions error:', fetchErr);
    return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({ success: true, sent: 0, failed: 0 });
  }

  // Build payload
  const payload = JSON.stringify({
    title,
    body,
    data: { url, actions: actions || [] },
  });

  let sent = 0;
  let failed = 0;

  // Send to each subscription
  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key,
      },
    };

    try {
      await wp.sendNotification(pushSubscription, payload);
      sent++;
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired — clean up
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id);
        console.log(`[send-notification] Removed expired subscription ${sub.id}`);
      } else {
        console.error(`[send-notification] Send failed for ${sub.id}:`, err?.message || err);
      }
      failed++;
    }
  }

  return res.status(200).json({ success: sent > 0, sent, failed });
}
