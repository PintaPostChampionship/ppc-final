export function formatISOToDDMMYYYY(iso?: string | null): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseDDMMYYYYToISO(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  if (year < 1900 || year > new Date().getFullYear()) return null;
  if (month < 1 || month > 12) return null;

  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!valid) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function tituloFechaEs(iso?: string | null) {
  if (!iso) return 'Fecha por definir';
  const str = iso.includes('T') ? iso : `${iso}T00:00:00`;
  const d = new Date(str);
  if (isNaN(d.getTime())) return 'Fecha por definir';
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.replace(/ de /g, ' ').replace(',', '').replace(/^\w/, c => c.toUpperCase());
}

export function isTodayOrFuture(iso?: string | null) {
  if (!iso) return false;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return false;

  const today = new Date();
  const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const dateNum  = y * 10000 + m * 100 + d;
  return dateNum >= todayNum;
}

export function parseYMDLocal(iso?: string | null) {
  if (!iso) return new Date(NaN);
  const [y, m, d] = String(iso).split('-').map(n => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDateLocal(iso?: string | null) {
  const dt = parseYMDLocal(iso);
  return dt.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function dateKey(val: string | Date) {
  const dt = typeof val === 'string' ? parseYMDLocal(val) : val;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // YYYY-MM-DD (local)
}
