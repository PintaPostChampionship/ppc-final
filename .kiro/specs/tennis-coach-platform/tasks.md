# Implementation Plan: PlayCoach Phase 1

## Overview

Phase 1 delivers the core coach experience: profile creation with shareable URL, calendar/class management, and direct booking by students via the coach's link. This is the MVP that allows a coach to start receiving bookings immediately.

**Stack**: React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + React Router v7 + Zustand + Supabase (new project) + Vercel

**Duration estimate**: 4 weeks

## Tasks

- [x] 1. Project Scaffolding: Create Vite + React + TS project, install deps (tailwindcss@4, react-router-dom@7, zustand, @supabase/supabase-js, zod), configure Tailwind with design tokens, set up folder structure (src/features, src/components/ui, src/lib, src/hooks, src/stores, src/types, api/), create vercel.json, .env.local.example, ESLint config, public/site.webmanifest, public/sw.js, index.html with meta tags. Requirements: 12.1, 12.2, 12.3, 12.5
- [x] 2. Supabase Schema: Create migrations for tables (profiles, coach_profiles, coach_locations, classes, class_occurrences, bookings, push_subscriptions) with all columns, indexes, CHECK constraints, and RLS policies. Create DB trigger for auto-creating profiles on auth.users insert. Create generate_coach_slug() function. Enable Auth with email + Google OAuth. Create avatars storage bucket. Requirements: 1.1, 1.2, 2.1, 2.4, 11.1, 11.2
- [x] 3. Auth + Registration Flow: Create supabase.ts client, authStore (Zustand), TypeScript interfaces, RegisterPage (role selection + form + Zod validation), LoginPage (email + Google OAuth), AuthGuard and RoleGuard components. On coach registration create coach_profiles row with slug + 30-day trial. Redirect to appropriate dashboard on completion. Requirements: 1.1, 1.2, 1.6, 2.1, 2.3, 2.4, 2.5, 2.6
- [x] 4. Router + Layout + UI Primitives: Create router.tsx with all route definitions (hash mode), App.tsx with RouterProvider, Header (logo + nav + user menu), MobileNav (bottom bar), DashboardLayout (sidebar for coach). Create reusable UI components: Button (variants, sizes, loading), Input (label, error, Zod), Card, Modal (accessible), Toast (auto-dismiss). Requirements: 12.2, 12.4, 12.5
- [x] 5. Coach Profile + Coach_Page: Create ProfileEditor (headline, bio, experience, qualifications, avatar upload, visibility toggles), LocationManager (add/edit locations, geocode via postcodes.io), PaymentConfig (bank transfer, payment link, timing, instructions). Create public CoachPage at /coach/:slug with AvailabilitySection (weekly grid) and BookingWidget. Implement slug resolution + 404. Implement publish toggle (requires location + payment + class). Requirements: 1.2, 1.3, 1.4, 1.5, 1.7, 6.1, 6.2, 6.3, 6.4, 6.9
- [x] 6. Calendar + Class Management: Create CalendarView (weekly grid 06:00-22:00, color-coded occurrences), ClassForm (create/edit with Zod validation), RecurrenceConfig (days of week, end date, preview). Implement class creation with occurrence generation, slot blocking (only if no booking), occurrence cancellation with student notification, recurring release. Create ClassList with edit/deactivate. Subscribe to Realtime for live updates. Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
- [x] 7. Student Booking Flow: Create ClassCard (type badge, date, time, price, spots, book button), BookingConfirmation modal (details + payment info + confirm). Implement atomic booking creation (decrement spots, create booking). Handle auto-accept vs manual approval. Handle full class state. Create MyBookings page (upcoming/past, cancel button with 24h check). Implement cancellation (restore spots, notify coach). Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.8, 8.9
- [x] 8. Coach Booking Management: Create BookingList with tabs (Pending/Upcoming/Past), approve/reject actions, coach cancel class flow (cancel all bookings + notify students). Add booking count badges on calendar. Subscribe to Realtime for live booking updates. Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9
- [x] 9. Push Notifications: Generate VAPID keys, create usePush hook, PushBanner opt-in component, api/push-subscribe (POST/DELETE), api/send-notification (POST), api/lib/supabase.ts (service role), api/lib/push.ts (web-push config). Integrate into booking flow (notify on create/approve/reject/cancel). Create sw.js with push + notificationclick handlers. Requirements: 9.1, 9.2, 9.3, 5.2, 5.3, 5.4, 5.5
- [x] 10. Cron Jobs: Create api/cron/expire-bookings.ts (pending > 48h → expired, restore spots, notify student). Create api/cron/class-reminders.ts (24h before class → push to coach + students). Configure vercel.json cron schedules. Add CRON_SECRET validation. Requirements: 5.6, 9.5
- [x] 11. PWA + Performance: Finalize webmanifest with icons, configure Vite code splitting (lazy routes), add loading skeletons, test Lighthouse PWA audit, test responsive on 320-1920px, add SEO meta tags on Coach_Page. Requirements: 12.1, 12.2, 12.3, 12.4
- [ ] 12. Landing Page: Create LandingPage with hero ("Find your tennis coach" / "Grow your coaching business"), how-it-works section, value props for coaches and students, footer. Default route for unauthenticated users. Requirements: 12.5, 10.5

## Task Dependency Graph

```json
{
  "waves": [
    [1],
    [2],
    [3],
    [4],
    [5, 12],
    [6],
    [7, 11],
    [8],
    [9],
    [10]
  ]
}
```

## Notes

- Tasks are sequential (each depends on the previous) except Task 11 and 12 which can be done in parallel after their dependencies are met.
- The Supabase project and Vercel project must be created manually by the user before Task 2 can execute migrations.
- VAPID keys must be generated before Task 9 (push notifications).
- Resend account is needed for Phase 2 (email notifications), not Phase 1.
- Google OAuth requires manual setup in Google Cloud Console + Supabase Auth dashboard.
