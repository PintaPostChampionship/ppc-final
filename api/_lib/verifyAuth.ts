import { createClient } from '@supabase/supabase-js';

/**
 * Verifies a Supabase JWT from the Authorization header.
 * Returns the authenticated user's ID, or null if invalid/missing.
 *
 * Usage in API routes:
 *   const userId = await verifyAuth(req);
 *   if (!userId) return res.status(401).json({ error: 'Unauthorized' });
 */
export async function verifyAuth(req: { headers: Record<string, string | string[] | undefined> }): Promise<string | null> {
  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '') as string;

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) return null;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceKey) {
    console.error('[verifyAuth] SUPABASE_SERVICE_ROLE_KEY not configured');
    return null;
  }

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user?.id) {
    return null;
  }

  return data.user.id;
}

/**
 * Checks if the request has a valid internal service secret.
 * Used for server-to-server calls (cron jobs, etc.)
 */
export function isInternalCall(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '') as string;
  const cronHeader = (req.headers['x-cron-secret'] || '') as string;

  return authHeader === `Bearer ${cronSecret}` || cronHeader === cronSecret;
}
