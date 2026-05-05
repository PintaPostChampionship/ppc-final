// Shared TypeScript interfaces and type aliases extracted from App.tsx
// These map to the Supabase database schema and local application types.

export interface Profile {
  id: string;
  name: string;
  role: string;
  created_at: string;
  email?: string;
  avatar_url?: string;
  postal_code?: string;
  nickname?: string | null;
}

export interface PlayerCard {
  profile_id: string;
  nickname?: string | null;
  age?: number | null; // temporal (fallback)
  birth_date?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  nationality?: string | null;
  birth_place?: string | null;
  dominant_hand?: string | null;
  backhand_style?: string | null;
  ppc_objective?: string | null;
  favourite_shot?: string | null;
  favourite_surface?: string | null;
  favourite_player?: string | null;
  racket_brand?: string | null;
  racket_model?: string | null;
  tennis_start_year?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricPlayer {
  id: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface AvailabilitySlot {
  id: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_id?: string;
}

export interface Tournament {
  id: string;
  name: string;
  season: string;
  start_date: string;
  end_date: string;
  status: string;
  format?: 'league' | 'knockout';
  sort_order?: number;
}

export interface Division {
  id: string;
  tournament_id: string;
  name: string;
  color?: string;
  direct_promotion_slots?: number;
  promotion_playoff_slots?: number;
  relegation_playoff_slots?: number;
  direct_relegation_slots?: number;
}

export interface Registration {
  id: string;
  tournament_id: string;
  division_id: string;
  profile_id: string | null;
  historic_player_id?: string | null;
  seed?: number;
  created_at: string;
  status?: 'active' | 'retired' | null;
}

export interface Match {
  id: string;
  tournament_id: string;
  division_id: string;
  date: string;
  time?: string;
  location_id?: string;
  location_details?: string;
  status: string;
  home_player_id: string;
  away_player_id: string | null;
  home_historic_player_id?: string | null;
  away_historic_player_id?: string | null;
  player1_sets_won: number;
  player2_sets_won: number;
  player1_games_won: number;
  player2_games_won: number;
  player1_had_pint: boolean;
  player2_had_pint: boolean;
  player1_pints: number;
  player2_pints: number;
  created_by: string;
  created_at: string;
  knockout_round?: string | null;
  bracket_position?: number | null;
  phase?: string | null;
  group_code?: string | null;
  anecdote?: string | null;
}

export interface MatchSet {
  id: string;
  match_id: string;
  set_number: number;
  p1_games: number;
  p2_games: number;
}

export interface Standings {
  profile_id: string;
  tournament_id: string;
  division_id: string;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  games_won: number;
  games_lost: number;
  set_diff: number;
  pints: number;
  points: number;
  name?: string;
}

export type BookingAdmin = {
  id: string;
  profile_id: string;
  created_at: string | null;
};

export type BookingAccount = {
  id: string;
  label?: string | null;
  env_username_key: string;
  env_password_key: string;
  owner_profile_id: string;
  is_active?: boolean | null;
  created_at: string | null;
};

export type CourtBookingRequest = {
  id: string;
  profile_id: string;
  better_account_id: string;
  venue_slug: string;
  activity_slug: string;
  target_date: string;              // 'YYYY-MM-DD'
  target_start_time: string;        // 'HH:MM:SS'
  target_end_time: string;          // 'HH:MM:SS'
  search_start_date: string | null;
  search_window_start_time: string | null;
  search_window_end_time: string | null;
  preferred_court_name_1: string | null;
  preferred_court_name_2: string | null;
  preferred_court_name_3: string | null;
  status: string;
  booked_court_name: string | null;
  booked_slot_start: string | null;
  booked_slot_end: string | null;
  last_run_at: string | null;
  attempt_count: number | null;
  last_error: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialEvent = {
  id: string;
  title: string;
  description: string | null;
  date: string;        // YYYY-MM-DD
  time: string | null; // "19:30", etc.
  venue: string | null;
  image_url: string | null;
  rsvp_url: string | null;
  is_active: boolean;
};

export type PendingOnboarding = {
  name?: string;
  email?: string;
  profilePic?: string;            // solo dataURL (preview) si ya lo usabas, si pesa mucho, preferible omitir
  locations?: string[];           // ["West","SE",...]
  availability_comp?: Record<string, string[]> | null; // comprimido
  tournament?: string | null;
  division?: string | null;
};

export type PPCNotif = { id: string; text: string; matchId?: string; at: number };

export type BookingVenueKey = 'highbury' | 'rosemary';

export interface PushSubscriptionRecord {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  actions?: Array<{ action: string; title: string; url?: string }>;
}
