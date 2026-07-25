import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from './lib/verifyAuth.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

// Map booking_account_id → env var names for Better credentials
async function getAccountCredentials(bookingAccountId: string): Promise<{ username: string; password: string } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('booking_accounts')
    .select('env_username_key, env_password_key')
    .eq('id', bookingAccountId)
    .single();

  if (error || !data) return null;

  const username = process.env[data.env_username_key];
  const password = process.env[data.env_password_key];

  if (!username || !password) return null;
  return { username, password };
}

async function betterLogin(username: string, password: string): Promise<string | null> {
  try {
    const res = await fetch('https://better-admin.org.uk/api/auth/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.token || null;
  } catch {
    return null;
  }
}

async function cancelBetterBooking(token: string, betterBookingId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://better-admin.org.uk/api/v1/activities/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          cancellation_source: 'my-account',
          update_type: 'cancellation',
          booking_ids: [betterBookingId],
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Better API ${res.status}: ${text.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown error' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: verify user JWT
  const userId = await verifyAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { booking_id, better_booking_id, booking_account_id } = req.body ?? {};

  if (!booking_id || !better_booking_id || !booking_account_id) {
    return res.status(400).json({ error: 'Missing required fields: booking_id, better_booking_id, booking_account_id' });
  }

  // Verify user is admin or owner of the account
  const supabase = getSupabase();

  const { data: admins } = await supabase
    .from('booking_admins')
    .select('profile_id')
    .eq('profile_id', userId)
    .eq('is_active', true);

  const { data: account } = await supabase
    .from('booking_accounts')
    .select('owner_profile_id')
    .eq('id', booking_account_id)
    .single();

  const isAdmin = (admins && admins.length > 0);
  const isOwner = account?.owner_profile_id === userId;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'No tienes permiso para cancelar esta reserva' });
  }

  // Get Better credentials for the account
  const creds = await getAccountCredentials(booking_account_id);
  if (!creds) {
    return res.status(500).json({ error: 'No se encontraron credenciales para esta cuenta Better' });
  }

  // Login to Better
  const token = await betterLogin(creds.username, creds.password);
  if (!token) {
    return res.status(502).json({ error: 'Error al autenticarse en Better' });
  }

  // Cancel the booking
  const result = await cancelBetterBooking(token, better_booking_id);
  if (!result.ok) {
    console.error('[cancel-booking] Better cancel failed:', result.error);
    return res.status(502).json({ error: 'Error al cancelar en Better', details: result.error });
  }

  // Update Supabase: mark booking as cancelled
  const { error: updateError } = await supabase
    .from('better_bookings')
    .update({ status: 'cancelled', can_cancel: false })
    .eq('id', booking_id);

  if (updateError) {
    console.error('[cancel-booking] Supabase update error:', updateError);
    // The booking was already cancelled in Better, so we still return success
  }

  return res.status(200).json({ success: true });
}
