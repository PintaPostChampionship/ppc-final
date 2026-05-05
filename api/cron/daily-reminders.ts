import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceSupabase, configureWebPush } from '../lib/pushUtils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'] || '';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Configure web-push
  let wp;
  try {
    wp = configureWebPush();
  } catch (e) {
    console.error('[daily-reminders] VAPID config error:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = getServiceSupabase();

  // Calculate yesterday's date in London timezone
  const now = new Date();
  const londonDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD format
  const londonDate = new Date(londonDateStr + 'T00:00:00');
  londonDate.setDate(londonDate.getDate() - 1);
  const yesterday = londonDate.toISOString().slice(0, 10);

  console.log(`[daily-reminders] Looking for matches on ${yesterday}`);

  // Find eligible matches: yesterday + scheduled + has opponent + reminder not sent
  const { data: eligibleMatches, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_player_id, away_player_id, date, time, location_details, status, reminder_sent')
    .eq('status', 'scheduled')
    .eq('reminder_sent', false)
    .not('away_player_id', 'is', null)
    .eq('date', yesterday);

  if (matchErr) {
    console.error('[daily-reminders] Query error:', matchErr);
    return res.status(500).json({ error: 'Failed to query matches' });
  }

  if (!eligibleMatches || eligibleMatches.length === 0) {
    return res.status(200).json({ success: true, eligible: 0, reminders_sent: 0, failed: 0 });
  }

  console.log(`[daily-reminders] Found ${eligibleMatches.length} eligible matches`);

  let remindersSent = 0;
  let failedCount = 0;

  for (const match of eligibleMatches) {
    try {
      // Get player names
      const playerIds = [match.home_player_id, match.away_player_id].filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', playerIds);

      const getName = (id: string) => profiles?.find(p => p.id === id)?.name || 'Rival';

      // Send to both players
      for (const playerId of playerIds) {
        const rivalId = playerId === match.home_player_id ? match.away_player_id : match.home_player_id;
        const rivalName = getName(rivalId!);

        const payload = JSON.stringify({
          title: '⏰ ¿Se jugó el partido?',
          body: `Partido vs ${rivalName}\nRecuerda agregar el resultado o reagendarlo.`,
          data: { url: '/' },
        });

        // Get subscriptions for this player
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('profile_id', playerId);

        if (subs && subs.length > 0) {
          for (const sub of subs) {
            try {
              await wp.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                payload
              );
            } catch (err: any) {
              if (err?.statusCode === 410 || err?.statusCode === 404) {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              }
            }
          }
        }
      }

      // Mark reminder as sent
      await supabase
        .from('matches')
        .update({ reminder_sent: true })
        .eq('id', match.id);

      remindersSent++;
    } catch (err) {
      console.error(`[daily-reminders] Failed for match ${match.id}:`, err);
      failedCount++;
    }
  }

  return res.status(200).json({
    success: true,
    eligible: eligibleMatches.length,
    reminders_sent: remindersSent,
    failed: failedCount,
  });
}
