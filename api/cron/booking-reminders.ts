import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceSupabase, configureWebPush } from '../_lib/pushUtils.js';

/**
 * Cron: Send push notifications 24h before a Better court booking.
 * Runs daily at 18:00 UTC (19:00 London summer).
 * 
 * Also sends reminders for PPC matches scheduled for tomorrow.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'] || '';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let wp;
  try {
    wp = configureWebPush();
  } catch (e) {
    console.error('[booking-reminders] VAPID config error:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = getServiceSupabase();

  // Calculate tomorrow's date in London timezone
  const now = new Date();
  const londonFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' });
  const todayLondon = londonFormatter.format(now); // YYYY-MM-DD
  const tomorrow = new Date(todayLondon + 'T00:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  console.log(`[booking-reminders] Checking bookings for tomorrow: ${tomorrowStr}`);

  let courtRemindersSent = 0;
  let matchRemindersSent = 0;
  let failed = 0;

  // ============================
  // 1. COURT BOOKING REMINDERS
  // ============================
  try {
    // Get bookings that start tomorrow
    const tomorrowStart = `${tomorrowStr}T00:00:00+00:00`;
    const tomorrowEnd = `${tomorrowStr}T23:59:59+00:00`;

    const { data: bookings, error: bookingsErr } = await supabase
      .from('better_bookings')
      .select('*, booking_accounts!inner(label, owner_profile_id)')
      .gte('starts_at', tomorrowStart)
      .lte('starts_at', tomorrowEnd);

    if (bookingsErr) {
      console.error('[booking-reminders] Query error:', bookingsErr);
    } else if (bookings && bookings.length > 0) {
      console.log(`[booking-reminders] Found ${bookings.length} court bookings for tomorrow`);

      // Group by owner_profile_id to send one notification per person
      const byOwner: Record<string, typeof bookings> = {};
      for (const b of bookings) {
        const ownerId = (b as any).booking_accounts?.owner_profile_id;
        if (!ownerId) continue;
        if (!byOwner[ownerId]) byOwner[ownerId] = [];
        byOwner[ownerId].push(b);
      }

      for (const [profileId, ownerBookings] of Object.entries(byOwner)) {
        // Build notification body
        const lines = ownerBookings.map((b: any) => {
          const start = new Date(b.starts_at).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
          });
          const end = new Date(b.ends_at).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London'
          });
          const court = b.court_name.replace('Highbury Fields Tennis ', '').replace('Highbury Fields ', '');
          return `${start}-${end} · ${court}`;
        });

        const body = lines.join('\n');
        const payload = JSON.stringify({
          title: '🎾 Cancha mañana',
          body,
          data: { url: '/' },
        });

        // Get push subscriptions
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('profile_id', profileId);

        if (subs && subs.length > 0) {
          for (const sub of subs) {
            try {
              await wp.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                payload,
                { urgency: 'high' }
              );
              courtRemindersSent++;
            } catch (err: any) {
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              }
              failed++;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[booking-reminders] Court reminders error:', err);
    failed++;
  }

  // ============================
  // 2. MATCH REMINDERS (PPC matches scheduled for tomorrow)
  // ============================
  try {
    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select('id, home_player_id, away_player_id, date, time, location_details, status')
      .eq('status', 'scheduled')
      .eq('date', tomorrowStr)
      .not('away_player_id', 'is', null);

    if (matchErr) {
      console.error('[booking-reminders] Match query error:', matchErr);
    } else if (matches && matches.length > 0) {
      console.log(`[booking-reminders] Found ${matches.length} PPC matches for tomorrow`);

      for (const match of matches) {
        const playerIds = [match.home_player_id, match.away_player_id].filter(Boolean);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', playerIds);

        const getName = (id: string) => profiles?.find(p => p.id === id)?.name || 'Rival';

        for (const playerId of playerIds) {
          const rivalId = playerId === match.home_player_id ? match.away_player_id : match.home_player_id;
          const rivalName = getName(rivalId!);
          const timeStr = match.time || '';
          const location = match.location_details || '';

          let body = `Partido vs ${rivalName}`;
          if (timeStr) body += ` a las ${timeStr}`;
          if (location) body += ` en ${location}`;

          const payload = JSON.stringify({
            title: '🏆 Partido mañana (PPC)',
            body,
            data: { url: '/' },
          });

          const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('profile_id', playerId);

          if (subs && subs.length > 0) {
            for (const sub of subs) {
              try {
                await wp.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                  payload,
                  { urgency: 'high' }
                );
                matchRemindersSent++;
              } catch (err: any) {
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                }
                failed++;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[booking-reminders] Match reminders error:', err);
    failed++;
  }

  return res.status(200).json({
    success: true,
    court_reminders_sent: courtRemindersSent,
    match_reminders_sent: matchRemindersSent,
    failed,
  });
}
