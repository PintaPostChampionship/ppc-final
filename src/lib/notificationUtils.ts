import type { Match, MatchSet, NotificationPayload } from '../types';

/**
 * Determines who should receive the notification based on who performed the action.
 * For match scheduled: recipient = the player who did NOT schedule
 * For result loaded: recipient = the player who did NOT submit the result
 */
export function determineRecipient(
  match: Match,
  actorId: string
): string | null {
  if (!match.home_player_id || !match.away_player_id) return null;
  if (actorId === match.home_player_id) return match.away_player_id;
  if (actorId === match.away_player_id) return match.home_player_id;
  // If actor is admin (not a player in the match), notify away_player
  return match.away_player_id;
}

/**
 * Determines if a "match scheduled" notification should be sent.
 * Returns true only when player assignment changes (not metadata-only edits).
 */
export function shouldNotifyMatchScheduled(
  oldMatch: { home_player_id: string | null; away_player_id: string | null; status: string } | null,
  newMatch: { home_player_id: string | null; away_player_id: string | null; status: string }
): boolean {
  // New match created with both players → notify
  if (!oldMatch && newMatch.home_player_id && newMatch.away_player_id && newMatch.status === 'scheduled') {
    return true;
  }
  // Existing match: opponent was null, now assigned → notify
  if (oldMatch && !oldMatch.away_player_id && newMatch.away_player_id && newMatch.status === 'scheduled') {
    return true;
  }
  // Metadata-only change (same players) → don't notify
  return false;
}

/**
 * Builds the notification payload for a scheduled match.
 */
export function buildMatchScheduledPayload(
  match: Match,
  rivalName: string,
  locationName?: string
): NotificationPayload {
  let body = `Partido agendado vs ${rivalName}`;
  if (match.date) {
    const dateStr = new Date(match.date + 'T00:00:00').toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    body += `\n📅 ${dateStr}`;
  }
  if (match.time) {
    body += ` · ${match.time.slice(0, 5)}`;
  }
  if (locationName) {
    body += `\n📍 ${locationName}`;
  }

  const payload: NotificationPayload = {
    title: '🎾 Nuevo partido agendado',
    body,
    url: '/',
  };

  // Add calendar action if time is defined
  if (match.date && match.time) {
    const calUrl = buildCalendarUrl(rivalName, match.date, match.time, locationName);
    payload.actions = [
      { action: 'calendar', title: '📅 Agregar al calendario', url: calUrl },
    ];
  }

  return payload;
}

/**
 * Builds the notification payload for a result loaded.
 */
export function buildResultLoadedPayload(
  match: Match,
  sets: MatchSet[],
  rivalName: string,
  winnerId: string
): NotificationPayload {
  const sortedSets = [...sets].sort((a, b) => a.set_number - b.set_number);
  const scoreLine = sortedSets.map(s => `${s.p1_games}-${s.p2_games}`).join('  ');
  
  const winnerIsHome = winnerId === match.home_player_id;
  const setsWon = winnerIsHome ? match.player1_sets_won : match.player2_sets_won;
  const setsLost = winnerIsHome ? match.player2_sets_won : match.player1_sets_won;

  const body = `Resultado: ${scoreLine}\n${rivalName} ${winnerId === match.home_player_id ? 'ganó' : 'perdió'} ${setsWon}-${setsLost}\n\nRevisa si el resultado está correcto.`;

  return {
    title: '📊 Resultado cargado',
    body,
    url: '/',
  };
}

/**
 * Builds the notification payload for a daily reminder.
 */
export function buildReminderPayload(
  match: Match,
  rivalName: string
): NotificationPayload {
  return {
    title: '⏰ ¿Se jugó el partido?',
    body: `Partido vs ${rivalName}\nRecuerda agregar el resultado o reagendarlo.`,
    url: '/',
  };
}

/**
 * Generates a Google Calendar URL for a match.
 */
export function buildCalendarUrl(
  rivalName: string,
  date: string,
  time?: string,
  location?: string
): string {
  const title = `PPC: vs ${rivalName}`;
  
  // Parse date and time
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time || '12:00').split(':').map(Number);
  
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDT = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
  const endHour = hour + 1 < 24 ? hour + 1 : 23;
  const endDT = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(minute)}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startDT}/${endDT}`,
    details: 'Partido PPC Tennis',
  });

  if (location) {
    params.set('location', location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Parses a raw push event payload string into a structured NotificationPayload.
 * Falls back to a generic notification if JSON parsing fails.
 */
export function parsePushPayload(raw: string): NotificationPayload {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.title === 'string' && typeof parsed.body === 'string') {
      return {
        title: parsed.title,
        body: parsed.body,
        url: parsed.data?.url || parsed.url || '/',
        actions: parsed.data?.actions || parsed.actions,
      };
    }
    return { title: 'PPC Tennis', body: raw, url: '/' };
  } catch {
    return { title: 'PPC Tennis', body: raw, url: '/' };
  }
}

/**
 * Validates the request body for /api/send-notification.
 */
export function validateSendNotificationRequest(body: any): { valid: boolean; error?: string } {
  if (!body) return { valid: false, error: 'Request body is empty' };
  if (!body.recipient_profile_id || typeof body.recipient_profile_id !== 'string') {
    return { valid: false, error: 'Missing or invalid recipient_profile_id' };
  }
  if (!body.title || typeof body.title !== 'string') {
    return { valid: false, error: 'Missing or invalid title' };
  }
  if (!body.body || typeof body.body !== 'string') {
    return { valid: false, error: 'Missing or invalid body' };
  }
  if (!body.url || typeof body.url !== 'string') {
    return { valid: false, error: 'Missing or invalid url' };
  }
  return { valid: true };
}

/**
 * Filters matches eligible for daily reminder.
 * Eligible = date is yesterday + status is 'scheduled' + has opponent + reminder not sent.
 */
export function filterEligibleMatches(
  matches: Array<Match & { reminder_sent?: boolean }>,
  yesterday: string // 'YYYY-MM-DD'
): Array<Match & { reminder_sent?: boolean }> {
  return matches.filter(m =>
    m.date?.slice(0, 10) === yesterday &&
    m.status === 'scheduled' &&
    m.away_player_id != null &&
    m.reminder_sent !== true
  );
}
