import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  console.warn('[Supabase] Faltan variables de entorno', { url, anonPresent: !!anon });
}

export const supabase = createClient(url!, anon!);
