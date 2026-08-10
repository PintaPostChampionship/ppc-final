import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

/**
 * Creates a Supabase client with service role key (bypasses RLS).
 * Used by Vercel Functions that need full DB access.
 */
export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    console.error('[pushUtils] SUPABASE_SERVICE_ROLE_KEY not found');
  }
  return createClient(url, key);
}

/**
 * Configures web-push with VAPID keys from environment variables.
 * Must be called before sending any push notification.
 */
export function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:pintapostchampionship@gmail.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}
