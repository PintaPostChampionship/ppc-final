import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceSupabase } from './lib/pushUtils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    // Save subscription
    const { profile_id, subscription, user_agent } = req.body ?? {};

    if (!profile_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = getServiceSupabase();

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
      console.error('[push-subscribe] Upsert error:', error);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    // Remove subscription
    const { profile_id, endpoint } = req.body ?? {};

    if (!profile_id || !endpoint) {
      return res.status(400).json({ error: 'Missing profile_id or endpoint' });
    }

    const supabase = getServiceSupabase();

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('profile_id', profile_id)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('[push-subscribe] Delete error:', error);
      return res.status(500).json({ error: 'Failed to remove subscription' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
