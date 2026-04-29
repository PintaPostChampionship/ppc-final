import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildPaymentMap, getPaymentIcon, countYaPaguéButtons, parseGvizResponse } from '../lib/paymentUtils';
import type { PagosWebRow, PaymentStatus } from '../types/payment';

// ─── Helpers ────────────────────────────────────────────────────────────────

const paymentStatusArb = fc.constantFrom<PaymentStatus>('pendiente', 'pagado_sin_validar', 'pagado');

const pagosWebRowArb = fc.record<PagosWebRow>({
  profile_id: fc.uuid(),
  nombre: fc.string(),
  division: fc.string(),
  torneo: fc.string(),
  estado: paymentStatusArb,
  fecha_autoreporte: fc.option(fc.string(), { nil: null }),
  fecha_validacion: fc.option(fc.string(), { nil: null }),
});

// ─── Unit tests: parseGvizResponse ──────────────────────────────────────────

describe('parseGvizResponse', () => {
  it('returns empty array for empty string', () => {
    expect(parseGvizResponse('')).toEqual([]);
  });

  it('returns empty array for malformed input', () => {
    expect(parseGvizResponse('not valid json at all')).toEqual([]);
  });

  it('parses a valid gviz response correctly', () => {
    const payload = {
      table: {
        cols: [
          { label: 'profile_id' },
          { label: 'nombre' },
          { label: 'division' },
          { label: 'torneo' },
          { label: 'estado' },
          { label: 'fecha_autoreporte' },
          { label: 'fecha_validacion' },
        ],
        rows: [
          {
            c: [
              { v: 'uuid-1' },
              { v: 'Juan' },
              { v: 'Plata' },
              { v: 'PPC Edición 5' },
              { v: 'pendiente' },
              { v: null },
              { v: null },
            ],
          },
        ],
      },
    };
    const raw = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`;
    const result = parseGvizResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      profile_id: 'uuid-1',
      nombre: 'Juan',
      division: 'Plata',
      torneo: 'PPC Edición 5',
      estado: 'pendiente',
      fecha_autoreporte: null,
      fecha_validacion: null,
    });
  });

  it('filters out rows with null profile_id', () => {
    const payload = {
      table: {
        cols: [{ label: 'profile_id' }, { label: 'nombre' }, { label: 'division' }, { label: 'torneo' }, { label: 'estado' }, { label: 'fecha_autoreporte' }, { label: 'fecha_validacion' }],
        rows: [
          { c: [{ v: null }, { v: 'Juan' }, { v: 'Plata' }, { v: 'PPC 5' }, { v: 'pendiente' }, { v: null }, { v: null }] },
        ],
      },
    };
    const raw = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`;
    expect(parseGvizResponse(raw)).toHaveLength(0);
  });

  it('filters out rows with null estado', () => {
    const payload = {
      table: {
        cols: [{ label: 'profile_id' }, { label: 'nombre' }, { label: 'division' }, { label: 'torneo' }, { label: 'estado' }, { label: 'fecha_autoreporte' }, { label: 'fecha_validacion' }],
        rows: [
          { c: [{ v: 'uuid-1' }, { v: 'Juan' }, { v: 'Plata' }, { v: 'PPC 5' }, { v: null }, { v: null }, { v: null }] },
        ],
      },
    };
    const raw = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(payload)});`;
    expect(parseGvizResponse(raw)).toHaveLength(0);
  });
});

// ─── Unit tests: buildPaymentMap ────────────────────────────────────────────

describe('buildPaymentMap', () => {
  it('returns empty map for empty rows', () => {
    expect(buildPaymentMap([], 'PPC 5').size).toBe(0);
  });

  it('includes only rows matching the active torneo', () => {
    const rows: PagosWebRow[] = [
      { profile_id: 'a', nombre: '', division: '', torneo: 'PPC 5', estado: 'pendiente', fecha_autoreporte: null, fecha_validacion: null },
      { profile_id: 'b', nombre: '', division: '', torneo: 'PPC 4', estado: 'pagado', fecha_autoreporte: null, fecha_validacion: null },
    ];
    const map = buildPaymentMap(rows, 'PPC 5');
    expect(map.size).toBe(1);
    expect(map.get('a')).toBe('pendiente');
    expect(map.has('b')).toBe(false);
  });
});

// ─── Unit tests: getPaymentIcon ──────────────────────────────────────────────

describe('getPaymentIcon', () => {
  it('returns 💰 for pendiente', () => {
    const map = new Map([['p1', 'pendiente' as PaymentStatus]]);
    expect(getPaymentIcon('p1', map)).toBe('💰');
  });

  it('returns ✅ for pagado_sin_validar', () => {
    const map = new Map([['p1', 'pagado_sin_validar' as PaymentStatus]]);
    expect(getPaymentIcon('p1', map)).toBe('✅');
  });

  it('returns ✅ for pagado', () => {
    const map = new Map([['p1', 'pagado' as PaymentStatus]]);
    expect(getPaymentIcon('p1', map)).toBe('✅');
  });

  it('returns null when player has no entry', () => {
    expect(getPaymentIcon('unknown', new Map())).toBeNull();
  });
});

// ─── Unit tests: countYaPaguéButtons ────────────────────────────────────────

describe('countYaPaguéButtons', () => {
  it('returns 0 when currentUserId is null', () => {
    const map = new Map([['p1', 'pendiente' as PaymentStatus]]);
    expect(countYaPaguéButtons(['p1'], null, map)).toBe(0);
  });

  it('returns 0 when currentUserId is undefined', () => {
    const map = new Map([['p1', 'pendiente' as PaymentStatus]]);
    expect(countYaPaguéButtons(['p1'], undefined, map)).toBe(0);
  });

  it('returns 1 when currentUser has pendiente status', () => {
    const map = new Map([['p1', 'pendiente' as PaymentStatus]]);
    expect(countYaPaguéButtons(['p1', 'p2'], 'p1', map)).toBe(1);
  });

  it('returns 0 when currentUser has pagado status', () => {
    const map = new Map([['p1', 'pagado' as PaymentStatus]]);
    expect(countYaPaguéButtons(['p1'], 'p1', map)).toBe(0);
  });

  it('returns 0 when currentUser is not in the player list', () => {
    const map = new Map([['p1', 'pendiente' as PaymentStatus]]);
    expect(countYaPaguéButtons(['p2', 'p3'], 'p1', map)).toBe(0);
  });
});

// ─── Property tests ─────────────────────────────────────────────────────────

// Feature: fee-payment-tracking, Property 1: filtrado por torneo
describe('Property 1: Filtrado de pagos por torneo', () => {
  it('el mapa resultante solo contiene entradas cuyo torneo coincide exactamente', () => {
    // Validates: Requirements 1.2, 1.5
    fc.assert(
      fc.property(
        fc.array(pagosWebRowArb),
        fc.string(),
        (rows, activeTorneo) => {
          const map = buildPaymentMap(rows, activeTorneo);

          // Every entry in the map must come from a row with torneo === activeTorneo
          for (const [profileId] of map) {
            const sourceRow = rows.find(
              (r) => r.profile_id === profileId && r.torneo === activeTorneo,
            );
            expect(sourceRow).toBeDefined();
          }

          // No row with a different torneo should appear in the map
          // (unless the same profile_id also has a row with the correct torneo)
          const otherRows = rows.filter((r) => r.torneo !== activeTorneo);
          for (const row of otherRows) {
            const hasMatchingRow = rows.some(
              (r) => r.profile_id === row.profile_id && r.torneo === activeTorneo,
            );
            if (!hasMatchingRow) {
              expect(map.has(row.profile_id)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: fee-payment-tracking, Property 2: íconos de estado de pago
describe('Property 2: Íconos de estado de pago son correctos y completos', () => {
  it('asigna el ícono correcto para cada estado posible', () => {
    // Validates: Requirements 2.1, 2.2, 2.3
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            profile_id: fc.uuid(),
            status: fc.option(paymentStatusArb, { nil: undefined }),
          }),
        ),
        (players) => {
          const map: Map<string, PaymentStatus> = new Map(
            players
              .filter((p): p is { profile_id: string; status: PaymentStatus } => p.status !== undefined)
              .map((p) => [p.profile_id, p.status]),
          );

          for (const player of players) {
            const icon = getPaymentIcon(player.profile_id, map);
            if (player.status === 'pendiente') {
              expect(icon).toBe('💰');
            } else if (player.status === 'pagado_sin_validar' || player.status === 'pagado') {
              expect(icon).toBe('✅');
            } else {
              // undefined — no entry in map
              expect(icon).toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
