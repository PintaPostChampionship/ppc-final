import type { PendingOnboarding } from '../types';

export const PENDING_KEY = 'pending_onboarding';

// Comprime availability a forma compacta: { Mon:["M","A"], Tue:["E"] ... }
export function compressAvailability(av?: Record<string, string[]> | undefined): Record<string, string[]> | null {
  if (!av) return null;
  const map: Record<string, string[]> = {};
  Object.entries(av).forEach(([day, slots]) => {
    if (Array.isArray(slots) && slots.length) {
      // Usa inicial del bloque: M=Morning, A=Afternoon, E=Evening
      map[day] = slots.map(s => s.startsWith('Morning') ? 'M' : s.startsWith('Afternoon') ? 'A' : 'E');
    }
  });
  return Object.keys(map).length ? map : null;
}

export function decompressAvailability(comp?: Record<string, string[]> | null) {
  if (!comp) return {};
  const decode = (c: string) => c === 'M' ? 'Morning (07:00-12:00)'
                          : c === 'A' ? 'Afternoon (12:00-18:00)'
                                      : 'Evening (18:00-22:00)';
  const out: Record<string, string[]> = {};
  Object.entries(comp).forEach(([day, codes]) => {
    out[day] = codes.map(decode);
  });
  return out;
}

// Escribe en sessionStorage con try/catch
export function savePending(p: PendingOnboarding) {
  try {
    const safe: PendingOnboarding = { ...p };
    // Comprimir availability si vino "larga"
    if ((p as any).availability) {
      // @ts-ignore
      safe.availability_comp = compressAvailability((p as any).availability);
      // @ts-ignore
      delete (safe as any).availability;
    }
    // 1) Sesión actual (permite recuperar avatar y availability completos)
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(safe));

    // 2) Copia "light" en localStorage para que la vea la pestaña de verificación (sin foto)
    const lite: PendingOnboarding = { ...safe };
    delete (lite as any).profilePic;      // << NO guardamos la foto en localStorage
    localStorage.setItem(PENDING_KEY, JSON.stringify(lite));
  } catch (e) {
    console.warn('Pending onboarding not persisted.', e);
  }
}

export function loadPending(): PendingOnboarding | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingOnboarding;
    // reconstruye availability para tu UI si la usas
    // @ts-ignore
    if (!('availability' in p) && p.availability_comp) {
      // @ts-ignore
      p.availability = decompressAvailability(p.availability_comp);
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

// Migra (una sola vez) si todavía hay algo viejo en localStorage
export function migrateLocalToSession() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      sessionStorage.setItem(PENDING_KEY, raw);
      localStorage.removeItem(PENDING_KEY);
    }
  } catch {}
}
