# Technical Design Document

## Overview

This document describes the technical architecture for **PlayCoach**, an independent web platform connecting tennis coaches with students. The system is built as a new project with its own infrastructure (Supabase, Vercel, domain) — completely separate from the existing PPC project.

The architecture follows a monolithic frontend with serverless API functions pattern, optimized for rapid MVP delivery while supporting future scaling to multiple cities and sports.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│         React 19 + TypeScript + Vite + Tailwind             │
│         (SPA with hash routing, PWA-enabled)                │
├─────────────────────────────────────────────────────────────┤
│                     VERCEL HOSTING                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ /api/    │  │ /api/    │  │ /api/    │  │ /api/cron │  │
│  │ auth     │  │ booking  │  │ notify   │  │ reminders │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
├───────┼──────────────┼──────────────┼─────────────┼─────────┤
│       │              │              │             │          │
│  ┌────▼──────────────▼──────────────▼─────────────▼──────┐  │
│  │                  SUPABASE                              │  │
│  │  PostgreSQL + Auth + Realtime + Storage + Edge Funcs   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐                 │
│  │  Web Push (VAPID)│  │  Email (Resend)  │                 │
│  └─────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite 7 | Fast DX, same stack as PPC (knowledge reuse) |
| Styling | Tailwind CSS 4 | Utility-first, design tokens via CSS variables |
| Routing | React Router v7 (hash mode) | Shareable URLs from day 1 (`/coach/:slug`, `/search`) |
| State | Zustand | Lightweight, no boilerplate, good for auth + UI state |
| Backend | Supabase (new project) | Auth, DB, Realtime, Storage — all-in-one |
| Serverless | Vercel Functions (Node.js 22) | Cron jobs, push notifications, email sending |
| Email | Resend | Developer-friendly, free tier (100 emails/day), React Email templates |
| Push | Web Push API (VAPID) | Same pattern as PPC, proven to work |
| Maps | Leaflet + OpenStreetMap | Free, no API key needed, good for location search |
| Geocoding | Nominatim (OSM) or postcodes.io (UK) | Free geocoding for postcode → lat/lng |
| Payments (future) | Stripe | Industry standard, handles subscriptions + one-off payments |

### Key Differences from PPC

| Aspect | PPC | PlayCoach |
|--------|-----|-----------|
| Routing | State-based (no router) | React Router v7 (hash mode) |
| State management | useState in App.tsx | Zustand stores |
| Architecture | Monolithic App.tsx | Feature-based folder structure |
| Auth | Supabase Auth (email) | Supabase Auth (email + Google OAuth) |
| Email | Gmail SMTP | Resend (API-based, templates) |

## Data Models

### Entity Relationship Diagram

```
profiles ──────┐
  │             │
  │ 1:N        │ 1:N
  ▼             ▼
coach_profiles  student_profiles
  │                │
  │ 1:N           │ 1:N
  ▼                ▼
coach_locations   bookings ◄── class_pack_credits
  │                ▲
  │                │ N:1
  │                │
  ▼                │
classes ───────────┘
  │
  │ 1:N (recurring)
  ▼
class_occurrences
```

### Tables

#### `profiles`
Core user identity (linked to Supabase Auth).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK → auth.users | User ID from Supabase Auth |
| email | text | NOT NULL, UNIQUE | Email address |
| name | text | NOT NULL, 1-100 chars | Full name |
| avatar_url | text | | Profile photo URL (Supabase Storage) |
| roles | text[] | NOT NULL, DEFAULT '{student}' | Array: 'coach', 'student', or both |
| postal_code | text | | Postcode for proximity search |
| city | text | DEFAULT 'London' | City |
| country | text | DEFAULT 'GB' | ISO country code |
| timezone | text | DEFAULT 'Europe/London' | IANA timezone |
| notification_prefs | jsonb | DEFAULT '{"push":true,"email":false}' | Notification channel preferences |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

#### `coach_profiles`
Extended coach-specific data (1:1 with profiles where 'coach' in roles).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| profile_id | uuid | FK → profiles, UNIQUE | Owner profile |
| slug | text | UNIQUE, NOT NULL, 3-60 chars | URL slug for Coach_Page |
| headline | text | max 200 chars | Short tagline ("LTA Level 4 Coach, 10 years experience") |
| bio | text | max 2000 chars | Full description |
| experience_years | int | 0-50 | Years coaching |
| qualifications | text[] | | Array of certifications (e.g., "LTA Level 3") |
| sports | text[] | DEFAULT '{tennis}' | Sports offered |
| booking_mode | text | DEFAULT 'auto_accept' | 'auto_accept' or 'manual_approval' |
| cancellation_hours | int | DEFAULT 24 | Hours before class for free cancellation |
| payment_methods | jsonb | | Configured payment options (see below) |
| payment_timing | text | DEFAULT 'pre_class' | 'pre_class' or 'post_class' |
| payment_instructions | text | max 500 chars | Free-text instructions shown to student |
| currency | text | DEFAULT 'GBP' | ISO 4217 currency code |
| is_published | boolean | DEFAULT false | Whether Coach_Page is live |
| subscription_status | text | DEFAULT 'trial' | 'trial', 'active', 'expired' |
| trial_ends_at | timestamptz | | 30 days after creation |
| subscription_ends_at | timestamptz | | Current subscription end date |
| visibility | jsonb | DEFAULT '{}' | Field visibility toggles |
| rating_avg | numeric(2,1) | DEFAULT 0.0 | Average rating (1.0-5.0) |
| rating_count | int | DEFAULT 0 | Number of reviews |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**`payment_methods` JSONB structure:**
```json
{
  "bank_transfer": {
    "enabled": true,
    "account_name": "John Smith",
    "account_number": "12345678",
    "sort_code": "12-34-56"
  },
  "payment_link": {
    "enabled": true,
    "url": "https://paypal.me/johnsmith"
  },
  "card": {
    "enabled": false,
    "stripe_account_id": null
  }
}
```

#### `coach_locations`
Where a coach teaches (supports multiple locations per coach).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| coach_profile_id | uuid | FK → coach_profiles | |
| venue_name | text | NOT NULL, max 200 chars | e.g., "Highbury Fields Tennis Courts" |
| area | text | | e.g., "Islington" |
| city | text | NOT NULL, DEFAULT 'London' | |
| country | text | NOT NULL, DEFAULT 'GB' | |
| postal_code | text | | For geocoding |
| latitude | numeric(9,6) | | Geocoded lat |
| longitude | numeric(9,6) | | Geocoded lng |
| timezone | text | DEFAULT 'Europe/London' | IANA timezone |
| is_primary | boolean | DEFAULT false | Primary teaching location |
| created_at | timestamptz | DEFAULT now() | |

#### `classes`
Template for a class offering (not a specific occurrence).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| coach_profile_id | uuid | FK → coach_profiles | |
| location_id | uuid | FK → coach_locations | Where this class happens |
| title | text | NOT NULL, max 100 chars | e.g., "Adult Intermediate Drill" |
| class_type | text | NOT NULL | 'individual', 'group_drill', 'group_tournament', 'group_social' |
| duration_minutes | int | NOT NULL, 30-240 | Duration in minutes |
| price | numeric(7,2) | NOT NULL, 0-9999.99 | Price per student |
| max_capacity | int | NOT NULL, 1-50 | Max students (1 for individual) |
| min_capacity | int | DEFAULT 1 | Min students for class to run (group only) |
| description | text | max 1000 chars | Class description |
| level | text | | 'beginner', 'intermediate', 'advanced', 'all_levels' |
| is_recurring | boolean | DEFAULT false | Whether this generates recurring occurrences |
| recurrence_days | int[] | | Days of week (0=Sun, 1=Mon, ..., 6=Sat) |
| recurrence_end_date | date | | Last date for recurring generation |
| is_active | boolean | DEFAULT true | Whether class is bookable |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

#### `class_occurrences`
Specific instances of a class (one row per scheduled session).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| class_id | uuid | FK → classes | Parent class template |
| coach_profile_id | uuid | FK → coach_profiles | Denormalized for query speed |
| date | date | NOT NULL | Date of this occurrence |
| start_time | time | NOT NULL | Start time (local to location timezone) |
| end_time | time | NOT NULL | End time |
| status | text | DEFAULT 'available' | 'available', 'full', 'cancelled', 'completed' |
| spots_remaining | int | NOT NULL | Decremented on booking |
| is_blocked | boolean | DEFAULT false | Coach manually blocked this slot |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Index:** `(coach_profile_id, date, start_time)` for calendar queries.
**Index:** `(date, status)` for search queries.

#### `bookings`
Student reservations for class occurrences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| occurrence_id | uuid | FK → class_occurrences | Which class session |
| student_profile_id | uuid | FK → profiles | Who booked |
| coach_profile_id | uuid | FK → coach_profiles | Denormalized |
| status | text | NOT NULL, DEFAULT 'pending' | 'pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'completed' |
| price_paid | numeric(7,2) | | Amount due/paid |
| payment_method | text | | 'bank_transfer', 'payment_link', 'card', 'class_pack' |
| class_pack_credit_id | uuid | FK → class_pack_credits | If paid via pack |
| expires_at | timestamptz | | For pending bookings (48h expiry) |
| confirmed_at | timestamptz | | When confirmed |
| cancelled_at | timestamptz | | When cancelled |
| cancellation_reason | text | | 'student', 'coach', 'expired', 'system' |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Index:** `(student_profile_id, status)` for "My Bookings".
**Index:** `(coach_profile_id, status)` for coach dashboard.
**Index:** `(occurrence_id)` for capacity checks.

#### `class_packs`
Pack templates created by coaches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| coach_profile_id | uuid | FK → coach_profiles | |
| name | text | NOT NULL, max 100 chars | e.g., "4-Class Bundle" |
| total_classes | int | NOT NULL, 2-50 | Number of classes in pack |
| discount_percent | int | NOT NULL, 1-100 | Discount percentage |
| price | numeric(7,2) | NOT NULL | Total pack price |
| class_types | text[] | | Which class types this pack applies to |
| is_active | boolean | DEFAULT true | |
| created_at | timestamptz | DEFAULT now() | |

#### `class_pack_credits`
Purchased packs by students (tracks remaining credits).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| pack_id | uuid | FK → class_packs | Which pack template |
| student_profile_id | uuid | FK → profiles | Who purchased |
| coach_profile_id | uuid | FK → coach_profiles | Which coach |
| total_classes | int | NOT NULL | Original total |
| remaining_classes | int | NOT NULL | Current balance |
| purchased_at | timestamptz | DEFAULT now() | |
| expires_at | timestamptz | | Optional expiry |

#### `reviews`
Student reviews of coaches (after completed class).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| booking_id | uuid | FK → bookings, UNIQUE | One review per booking |
| student_profile_id | uuid | FK → profiles | |
| coach_profile_id | uuid | FK → coach_profiles | |
| rating | int | NOT NULL, 1-5 | Star rating |
| comment | text | max 500 chars | Optional text review |
| is_visible | boolean | DEFAULT true | Coach can flag, admin hides |
| created_at | timestamptz | DEFAULT now() | |

#### `push_subscriptions`
Web Push subscriptions for notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| profile_id | uuid | FK → profiles | |
| endpoint | text | NOT NULL | Push endpoint URL |
| keys_p256dh | text | NOT NULL | P256DH key |
| keys_auth | text | NOT NULL | Auth key |
| user_agent | text | | Browser info |
| created_at | timestamptz | DEFAULT now() | |

**Unique:** `(profile_id, endpoint)`

#### `coach_subscriptions` (Phase 3)
Subscription billing records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| coach_profile_id | uuid | FK → coach_profiles | |
| plan | text | NOT NULL | 'monthly', 'quarterly', 'annual' |
| status | text | DEFAULT 'active' | 'active', 'cancelled', 'past_due' |
| stripe_subscription_id | text | | Stripe reference |
| current_period_start | timestamptz | | |
| current_period_end | timestamptz | | |
| created_at | timestamptz | DEFAULT now() | |

## Frontend Architecture

### Folder Structure

```
playcoach/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Router setup + layout
│   ├── router.tsx                  # Route definitions
│   ├── stores/
│   │   ├── authStore.ts            # Auth state (Zustand)
│   │   └── uiStore.ts             # UI state (modals, toasts)
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   ├── api.ts                 # API helpers (fetch wrappers)
│   │   └── utils.ts              # Shared utilities
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth hook (login, register, session)
│   │   ├── usePush.ts            # Push notification subscription
│   │   └── useGeolocation.ts     # Browser geolocation
│   ├── components/
│   │   ├── ui/                    # Reusable UI primitives (Button, Input, Card, Modal)
│   │   ├── layout/                # Header, Footer, Sidebar, MobileNav
│   │   └── shared/                # CoachCard, ClassCard, BookingCard, Rating
│   ├── features/
│   │   ├── auth/                  # Login, Register, RoleSelection
│   │   ├── coach-dashboard/       # Dashboard, Calendar, ClassForm, BookingList
│   │   ├── coach-page/            # Public Coach_Page (shareable)
│   │   ├── student-dashboard/     # My Bookings, My Packs, Settings
│   │   ├── search/                # SearchPage, Filters, Map, Results
│   │   └── notifications/         # NotificationPrefs, PushBanner
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces
│   └── styles/
│       └── tokens.css            # Design tokens (CSS custom properties)
├── api/
│   ├── push-subscribe.ts         # POST/DELETE push subscriptions
│   ├── send-notification.ts      # POST send push to user
│   ├── cron/
│   │   ├── class-reminders.ts    # 24h before class reminders
│   │   └── expire-bookings.ts   # Expire pending bookings after 48h
│   └── lib/
│       ├── supabase.ts           # Server-side Supabase (service role)
│       └── push.ts              # Web-push config
├── public/
│   ├── sw.js                     # Service Worker
│   └── site.webmanifest         # PWA manifest
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                   # Cron schedules
└── package.json
```

### Routing

| Route | Component | Access |
|-------|-----------|--------|
| `/` | Landing / Search | Public |
| `/search` | SearchPage | Public |
| `/coach/:slug` | CoachPage | Public (shareable link) |
| `/register` | RegisterPage | Public |
| `/login` | LoginPage | Public |
| `/dashboard` | CoachDashboard | Coach only |
| `/dashboard/calendar` | CalendarView | Coach only |
| `/dashboard/classes` | ClassManagement | Coach only |
| `/dashboard/bookings` | BookingManagement | Coach only |
| `/dashboard/settings` | CoachSettings | Coach only |
| `/my-bookings` | StudentBookings | Student only |
| `/my-packs` | StudentPacks | Student only |
| `/settings` | UserSettings | Authenticated |

### State Management (Zustand)

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  profile: Profile | null;
  coachProfile: CoachProfile | null;
  isCoach: boolean;
  isStudent: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}
```

### Realtime Subscriptions

Used for:
1. **Coach Calendar** — live updates when a student books/cancels
2. **Booking status** — student sees confirmation in real-time when coach approves

```typescript
// Subscribe to booking changes for a coach
supabase
  .channel('coach-bookings')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'bookings',
    filter: `coach_profile_id=eq.${coachId}`
  }, handleBookingChange)
  .subscribe();
```

## API Design (Vercel Functions)

### `/api/push-subscribe` (POST/DELETE)
Same pattern as PPC. Manages push subscription records.

### `/api/send-notification` (POST)
Sends push notification to a specific user. Called internally by booking logic and cron jobs.

### `/api/cron/class-reminders` (GET, cron: `0 * * * *`)
Runs hourly. Finds classes starting in ~24h and sends reminders to coach + enrolled students.

### `/api/cron/expire-bookings` (GET, cron: `*/30 * * * *`)
Runs every 30 minutes. Finds pending bookings older than 48h and marks them as expired.

## Authentication Flow

1. User lands on `/register` → selects role (Coach or Student)
2. Supabase Auth creates user (email + password, or Google OAuth)
3. Database trigger creates `profiles` row with selected role
4. If Coach: also creates `coach_profiles` row with generated slug + 30-day trial
5. Redirect to appropriate dashboard

**Google OAuth** is included from day 1 — reduces friction significantly for both coaches and students.

## Search & Geocoding

### Postcode → Coordinates
- **UK**: Use `postcodes.io` API (free, no key needed) — returns lat/lng for any UK postcode
- **Chile (future)**: Use Nominatim (OpenStreetMap) — free, rate-limited

### Proximity Search
PostgreSQL `earthdistance` extension with `cube` for fast distance calculations:

```sql
-- Find coaches within 25 miles of a point
SELECT cp.*, 
  (point(cl.longitude, cl.latitude) <@> point($lng, $lat)) AS distance_miles
FROM coach_profiles cp
JOIN coach_locations cl ON cl.coach_profile_id = cp.id
WHERE cp.is_published = true
  AND (point(cl.longitude, cl.latitude) <@> point($lng, $lat)) < 25
ORDER BY distance_miles
LIMIT 50;
```

### Map Display
Leaflet with OpenStreetMap tiles (free). Coach locations shown as markers. Student can click to view Coach_Page.

## Notification Architecture

Same proven pattern as PPC:

1. **Push**: Web Push API with VAPID keys (new key pair for PlayCoach)
2. **Email**: Resend API (replaces Gmail SMTP — better DX, templates, free tier)
3. **Service Worker**: Handles `push` event + `notificationclick` for deep linking
4. **Cron**: Vercel cron for scheduled reminders

### Notification Types

| Event | Coach receives | Student receives | Channel |
|-------|---------------|-----------------|---------|
| New booking | ✅ | ✅ (if pending) | Push + Email |
| Booking confirmed | | ✅ | Push + Email |
| Booking rejected | | ✅ | Push |
| Booking cancelled (by student) | ✅ | | Push |
| Class cancelled (by coach) | | ✅ | Push + Email |
| 24h reminder | ✅ | ✅ | Push |
| Slot opened | | ✅ (subscribed) | Push |
| Class nearby | | ✅ (opted in) | Push |

## Deployment & Infrastructure

### Vercel
- **Framework**: Vite
- **Functions**: `/api/` directory (Node.js 22)
- **Cron**: Defined in `vercel.json`
- **Domain**: `playcoach.vercel.app` initially → custom domain later

### Supabase (new project)
- **Region**: EU West (London) for low latency
- **Extensions needed**: `earthdistance`, `cube`, `pg_cron` (for DB-level scheduled tasks if needed)
- **Storage**: `avatars` bucket for profile photos
- **Auth**: Email + Google OAuth provider

### Environment Variables

```
# Frontend (.env.local)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
VITE_VAPID_PUBLIC_KEY=xxxxx

# Vercel (server-side)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
VAPID_PUBLIC_KEY=xxxxx
VAPID_PRIVATE_KEY=xxxxx
VAPID_SUBJECT=mailto:playcoach@example.com
RESEND_API_KEY=xxxxx
CRON_SECRET=xxxxx
```

## MVP Phasing

### Phase 1 — Coach Profile + Direct Booking (Weeks 1-4)
- Auth (email + Google)
- Coach registration + profile + slug URL
- Calendar (create slots, block times)
- Class creation (individual + group)
- Student registration
- Booking flow (via Coach_Page link)
- Basic notifications (push)
- PWA setup

### Phase 2 — Marketplace + Discovery (Weeks 5-8)
- Search by location (map + list)
- Filters (price, type, availability)
- Reviews/ratings
- Email notifications (Resend)
- Class packs
- "Available class nearby" alerts

### Phase 3 — Monetization + Scale (Weeks 9-12)
- Coach subscriptions (Stripe)
- Payment processing (Stripe Connect for card payments)
- Multi-currency support
- Landing page + marketing
- Analytics dashboard for coaches

## Security Considerations

1. **RLS on all tables** — Students can only see published coaches and their own bookings
2. **Coach data isolation** — Coaches can only modify their own classes/calendar
3. **Payment data** — Bank details stored encrypted, only shown to confirmed booking students
4. **Rate limiting** — Vercel Functions have built-in rate limiting; add custom limits for booking creation
5. **Input validation** — Zod schemas for all form inputs (shared between frontend and API)
6. **CORS** — Restrict API access to the PlayCoach domain only

## Correctness Properties

### Property 1: Booking Capacity Invariant
`spots_remaining` on a `class_occurrence` must never go below 0. Enforced via a PostgreSQL CHECK constraint and a transaction that decrements + checks atomically.

**Validates: Requirements 4.6, 8.6**

### Property 2: No Double-Booking
A student cannot have two confirmed bookings for overlapping time slots. Enforced via a unique partial index on `(student_profile_id, occurrence_id)` where status IN ('pending', 'confirmed').

**Validates: Requirements 5.2, 8.2**

### Property 3: Class Pack Balance Integrity
`remaining_classes` on a `class_pack_credit` must never go below 0. Enforced via CHECK constraint. Restoration on cancellation is handled in the same transaction as booking cancellation.

**Validates: Requirements 6.6, 6.7, 6.8**

### Property 4: Pending Booking Expiry
Bookings in 'pending' status older than 48 hours are automatically expired by the cron job. The cron runs every 30 minutes, so maximum overshoot is 30 minutes.

**Validates: Requirements 5.6**

### Property 5: Slug Uniqueness
Coach slugs are globally unique. Generated from name with numeric suffix on collision. Enforced via UNIQUE constraint.

**Validates: Requirements 1.2**

### Property 6: Timezone Consistency
All times stored as local time + timezone reference. Display always uses the class location's timezone, never the viewer's local timezone.

**Validates: Requirements 11.5**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Supabase unavailable | Frontend shows "Service temporarily unavailable" toast. Retry with exponential backoff (3 attempts). |
| Push notification delivery failure | Log error, attempt email fallback if user has verified email. |
| Geocoding API failure | Show manual location entry fallback (lat/lng or area selection from list). |
| Booking race condition (last spot) | Database transaction with row-level lock. Loser gets "class is now full" error. |
| Payment method not configured | Block class publishing until at least one payment method is active. |
| Invalid coach slug | 404 page with "Coach not found" message and link to search. |
| Expired session | Redirect to login with return URL preserved. |
| Cron job failure | Vercel logs alert. Idempotent design — safe to re-run. |

## Testing Strategy

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Vitest | Pure functions (pricing calc, date utils, validation) |
| Component | @testing-library/react | UI components in isolation |
| Integration | Vitest + Supabase local | API functions + DB queries |
| E2E (future) | Playwright | Critical flows (register → book → confirm) |
