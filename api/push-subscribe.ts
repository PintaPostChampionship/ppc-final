import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[push-subscribe] Method:', req.method);

  if (req.method === 'POST') {
    const { profile_id, subscription, user_agent } = req.body ?? {};

    console.log('[push-subscribe] profile_id:', profile_id);
    console.log('[push-subscribe] endpoint:', subscription?.endpoint?.slice(0, 50));

    if (!profile_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          profile_id,
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          user_agent: user_agent || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id,endpoint' });

      if (error) {
        console.error('[push-subscribe] Supabase error:', JSON.stringify(error));
        return res.status(500).json({ error: 'Failed to save subscription', details: error.message });
      }

      console.log('[push-subscribe] Success!');
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('[push-subscribe] Unexpected error:', err?.message || err);
      return res.status(500).json({ error: 'Internal server error', details: err?.message });
    }
  }

  if (req.method === 'DELETE') {
    const { profile_id, endpoint } = req.body ?? {};

    if (!profile_id || !endpoint) {
      return res.status(400).json({ error: 'Missing profile_id or endpoint' });
    }

    try {
      const supabase = getSupabase();

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('profile_id', profile_id)
        .eq('endpoint', endpoint);

      if (error) {
        console.error('[push-subscribe] Delete error:', JSON.stringify(error));
        return res.status(500).json({ error: 'Failed to remove subscription' });
      }

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('[push-subscribe] Unexpected error:', err?.message || err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
