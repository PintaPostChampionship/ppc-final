// src/supabaseData.ts
import { supabase } from './supabaseClient';

export type Tournament = {
  id: string;
  name: string;
  season: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
};

export type Division = {
  id: string;
  tournament_id: string;
  name: string;
  color: string | null;
};

export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id,name,season,start_date,end_date,status')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDivisions(tournamentId: string): Promise<Division[]> {
  const { data, error } = await supabase
    .from('divisions')
    .select('id,tournament_id,name,color')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
