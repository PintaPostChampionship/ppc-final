import type { PagosWebRow, PaymentStatus, PaymentStatusMap } from '../types/payment';

/**
 * Parses the raw gviz response from the Google Sheets public endpoint.
 *
 * The endpoint returns text in the format:
 *   /*O_o*\/
 *   google.visualization.Query.setResponse({...});
 *
 * Column order (fixed, matches pagos_web sheet):
 *   [0] profile_id, [1] nombre, [2] division, [3] torneo,
 *   [4] estado, [5] fecha_autoreporte, [6] fecha_validacion
 */
export function parseGvizResponse(raw: string): PagosWebRow[] {
  try {
    const match = raw.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
    if (!match || !match[1]) return [];

    const parsed = JSON.parse(match[1]) as {
      table: {
        cols: { label: string }[];
        rows: { c: ({ v: string | null } | null)[] }[];
      };
    };

    const rows = parsed?.table?.rows;
    if (!Array.isArray(rows)) return [];

    const result: PagosWebRow[] = [];

    for (const row of rows) {
      const c = row?.c;
      if (!Array.isArray(c)) continue;

      const profile_id = c[0]?.v ?? null;
      const estado = c[4]?.v ?? null;

      // Filter out rows with missing profile_id or estado
      if (!profile_id || !estado) continue;

      result.push({
        profile_id: String(profile_id),
        nombre: String(c[1]?.v ?? ''),
        division: String(c[2]?.v ?? ''),
        torneo: String(c[3]?.v ?? ''),
        estado: estado as PaymentStatus,
        fecha_autoreporte: c[5]?.v ? String(c[5].v) : null,
        fecha_validacion: c[6]?.v ? String(c[6].v) : null,
      });
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Builds a Map<profile_id, PaymentStatus> from an array of PagosWebRow,
 * filtering only rows that match the given activeTorneo.
 */
export function buildPaymentMap(rows: PagosWebRow[], activeTorneo: string): PaymentStatusMap {
  const map: PaymentStatusMap = new Map();
  for (const row of rows) {
    if (row.torneo === activeTorneo) {
      map.set(row.profile_id, row.estado);
    }
  }
  return map;
}

/**
 * Returns the payment icon for a given player based on their status in the map.
 * - '💰' if status is 'pendiente'
 * - '✅' if status is 'pagado_sin_validar' or 'pagado'
 * - null if no entry exists for the player
 */
export function getPaymentIcon(profileId: string, map: PaymentStatusMap): '💰' | '✅' | null {
  const status = map.get(profileId);
  if (status === 'pendiente') return '💰';
  if (status === 'pagado_sin_validar' || status === 'pagado') return '✅';
  return null;
}

/**
 * Counts how many "Ya pagué" buttons would be rendered for a list of players.
 * A button appears only if: playerId === currentUserId AND map.get(playerId) === 'pendiente'.
 * Always returns 0 or 1.
 */
export function countYaPaguéButtons(
  playerIds: string[],
  currentUserId: string | null | undefined,
  map: PaymentStatusMap,
): number {
  if (!currentUserId) return 0;
  for (const playerId of playerIds) {
    if (playerId === currentUserId && map.get(playerId) === 'pendiente') {
      return 1;
    }
  }
  return 0;
}
