# Tasks: Push Notifications

## Task 1: Database setup — push_subscriptions table and matches column

- [x] 1.1 Create Supabase migration: `push_subscriptions` table with columns (id uuid PK, profile_id uuid FK, endpoint text, p256dh_key text, auth_key text, user_agent text, created_at timestamptz, updated_at timestamptz), UNIQUE constraint on (profile_id, endpoint), index on profile_id
- [x] 1.2 Create Supabase migration: add `reminder_sent` boolean column (default false) to `matches` table
- [x] 1.3 Create RLS policies for `push_subscriptions`: SELECT/INSERT/DELETE where auth.uid() = profile_id
- [ ] 1.4 Add `PushSubscriptionRecord` and `NotificationPayload` types to `src/types/index.ts`
- [ ] 1.5 Verify build passes: `npm run build`

## Task 2: Install dependencies and configure environment

- [x] 2.1 Install `web-push` package as a production dependency (used only in api/ functions)
- [ ] 2.2 Install `@types/web-push` as a dev dependency
- [ ] 2.3 Create `vercel.json` with cron configuration for `/api/cron/daily-reminders` at schedule `0 10 * * *`
- [ ] 2.4 Add `VITE_VAPID_PUBLIC_KEY` to `.env.local` (placeholder value for local dev)
- [ ] 2.5 Verify build passes: `npm run build`

## Task 3: Pure utility functions — notification payload builders

- [ ] 3.1 Create `src/lib/notificationUtils.ts` with `buildMatchScheduledPayload` function (takes match data, rival name, location → returns title, body, url, actions)
- [ ] 3.2 Add `buildResultLoadedPayload` function (takes match, sets, rival name, winner ID → returns title, body, url)
- [ ] 3.3 Add `buildReminderPayload` function (takes match, rival name → returns title, body, url)
- [ ] 3.4 Add `buildCalendarUrl` function (takes rival name, date, time?, location? → returns Google Calendar URL)
- [ ] 3.5 Add `determineRecipient` function (takes match, actor ID → returns recipient profile ID)
- [ ] 3.6 Add `shouldNotifyMatchScheduled` function (takes old match state, new match state → returns boolean)
- [ ] 3.7 Add `parsePushPayload` function (takes raw string → returns structured NotificationPayload)
- [ ] 3.8 Add `validateSendNotificationRequest` function (takes request body → returns validation result)
- [ ] 3.9 Add `filterEligibleMatches` function (takes matches array, reference date → returns eligible matches for reminder)
- [ ] 3.10 Verify build passes: `npm run build`

## Task 4: Property-based tests for utility functions

- [ ] 4.1 Create `src/__tests__/notificationUtils.test.ts` with property test for `determineRecipient` (Property 3)
- [ ] 4.2 Add property test for `buildMatchScheduledPayload` completeness (Property 4)
- [ ] 4.3 Add property test for `buildCalendarUrl` — includes all fields when time defined, omits calendar when time undefined (Property 5)
- [ ] 4.4 Add property test for `shouldNotifyMatchScheduled` — returns false when players unchanged (Property 6)
- [ ] 4.5 Add property test for `buildResultLoadedPayload` — contains all set scores and correct winner (Property 7)
- [ ] 4.6 Add property test for `filterEligibleMatches` — returns only yesterday + scheduled + has opponent + not reminded (Property 8)
- [ ] 4.7 Add property test for `parsePushPayload` — valid JSON parsed correctly, invalid JSON returns generic (Property 11)
- [ ] 4.8 Add property test for `validateSendNotificationRequest` — missing fields rejected (Property 12)
- [ ] 4.9 Verify all tests pass: `npm test`

## Task 5: Service Worker — push and notificationclick handlers

- [ ] 5.1 Update `public/sw.js`: add `push` event listener that parses JSON payload and calls `self.registration.showNotification` with title, body, icon (`/android-chrome-192x192.png`), badge (`/favicon-dark.png`), and data from payload
- [ ] 5.2 Add fallback in `push` handler: if JSON parsing fails, show generic notification with title "PPC Tennis" and raw text as body
- [ ] 5.3 Add `notificationclick` event listener: close notification, check `clients.matchAll` for existing window, focus if found or `clients.openWindow(data.url)` if not
- [ ] 5.4 Add `notificationclick` action handling: if action clicked has a URL, open that URL (for calendar actions)
- [ ] 5.5 Verify build passes: `npm run build`

## Task 6: Vercel Function — /api/push-subscribe

- [ ] 6.1 Create `api/lib/pushUtils.ts` with shared utilities: Supabase client initialization (using service role key), web-push configuration with VAPID keys
- [ ] 6.2 Create `api/push-subscribe.ts` POST handler: validate request body (profile_id, subscription object with endpoint and keys), upsert into push_subscriptions (ON CONFLICT profile_id + endpoint → update keys and updated_at)
- [ ] 6.3 Add DELETE handler to `api/push-subscribe.ts`: validate profile_id and endpoint, delete matching subscription from push_subscriptions
- [ ] 6.4 Add authentication: verify Supabase JWT from Authorization header using supabase-js `auth.getUser()`
- [ ] 6.5 Verify build passes: `npm run build`

## Task 7: Vercel Function — /api/send-notification

- [ ] 7.1 Create `api/send-notification.ts`: validate request body using `validateSendNotificationRequest`, return 400 if invalid
- [ ] 7.2 Add authentication: accept either Supabase JWT (Authorization: Bearer) or x-cron-secret header
- [ ] 7.3 Add VAPID configuration check: if VAPID env vars missing, return 500 with generic error
- [ ] 7.4 Add core logic: query push_subscriptions for recipient_profile_id, iterate and send via web-push `sendNotification()`
- [ ] 7.5 Add expired subscription cleanup: on 410/404 response, delete subscription from DB, continue with remaining
- [ ] 7.6 Return response with `{ success, sent, failed }` counts
- [ ] 7.7 Verify build passes: `npm run build`

## Task 8: Vercel Function — /api/cron/daily-reminders

- [ ] 8.1 Create `api/cron/daily-reminders.ts`: validate CRON_SECRET from `x-vercel-cron-secret` or `authorization` header
- [ ] 8.2 Add query logic: fetch matches where date = yesterday (London timezone), status = 'scheduled', away_player_id IS NOT NULL, reminder_sent = false
- [ ] 8.3 For each eligible match: look up both player names from profiles, build reminder payload using `buildReminderPayload`
- [ ] 8.4 Send notification to both players (home_player_id and away_player_id) by calling send-notification logic directly (function import, not HTTP)
- [ ] 8.5 On successful send for a match: update matches SET reminder_sent = true WHERE id = match.id
- [ ] 8.6 On failed send: log error, do NOT update reminder_sent, continue with next match
- [ ] 8.7 Return summary response: `{ success: true, eligible: N, reminders_sent: M, failed: F }`
- [ ] 8.8 Verify build passes: `npm run build`

## Task 9: Frontend hook — usePushNotifications

- [ ] 9.1 Create `src/hooks/usePushNotifications.ts`: check `isSupported` (serviceWorker in navigator && PushManager in window), get current permission state
- [ ] 9.2 Add `subscribe` function: request permission, call `pushManager.subscribe` with applicationServerKey (VITE_VAPID_PUBLIC_KEY), POST subscription to `/api/push-subscribe`
- [ ] 9.3 Add `unsubscribe` function: call `pushSubscription.unsubscribe()`, DELETE from `/api/push-subscribe`
- [ ] 9.4 Add `isSubscribed` state: on mount, check if current service worker registration has an active push subscription
- [ ] 9.5 Add error handling: catch and surface errors from permission request, subscription, and API calls
- [ ] 9.6 Verify build passes: `npm run build`

## Task 10: Frontend UI — notification banner and toggle

- [ ] 10.1 Add notification opt-in banner component in App.tsx: shown when user is authenticated, permission is 'default', and isSupported is true. Includes "Activar notificaciones" button.
- [ ] 10.2 Add notification toggle in player profile section: shown when permission is 'granted', allows toggling subscription on/off
- [ ] 10.3 Add visual feedback: loading spinner during subscribe/unsubscribe, success/error toast messages
- [ ] 10.4 Handle 'denied' state: show informational text that notifications are blocked, hide banner
- [ ] 10.5 Verify build passes: `npm run build`

## Task 11: Frontend triggers — send notifications after mutations

- [ ] 11.1 Add notification trigger after match scheduling: in the match creation/scheduling flow in App.tsx, after successful Supabase mutation, call `/api/send-notification` with match scheduled payload for the recipient
- [ ] 11.2 Add notification trigger after result loading: in the result submission flow in App.tsx, after successful Supabase mutation, call `/api/send-notification` with result loaded payload for the recipient
- [ ] 11.3 Add guard logic using `shouldNotifyMatchScheduled`: only trigger "match scheduled" notification when player assignment changes, not on metadata-only edits
- [ ] 11.4 Add error handling for notification triggers: catch and log errors silently (notification failure should never block the primary mutation)
- [ ] 11.5 Verify build passes: `npm run build`

## Task 12: End-to-end verification and documentation

- [ ] 12.1 Run full test suite: `npm test` — all property tests and unit tests pass
- [x] 12.2 Run build verification: `npm run build` — no TypeScript errors, no warnings
- [ ] 12.3 Run lint: `npm run lint` — no new lint errors introduced
- [ ] 12.4 Verify vercel.json cron configuration is valid
- [ ] 12.5 Document required Vercel environment variables in README or deployment notes: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, VITE_VAPID_PUBLIC_KEY
