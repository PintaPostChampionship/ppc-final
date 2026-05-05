import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseYMDLocal,
  formatDateLocal,
  formatISOToDDMMYYYY,
  parseDDMMYYYYToISO,
} from '../lib/dateUtils';

/**
 * **Validates: Requirements 2.6**
 * Property 2: Date parsing and formatting consistency
 *
 * For any valid ISO date string in YYYY-MM-DD format (within 1900-01-01 to 2099-12-31),
 * parsing with parseYMDLocal SHALL produce a valid Date object, and formatting that Date
 * with formatDateLocal SHALL produce a non-empty Spanish-locale date string that contains
 * the correct day number.
 */
describe('dateUtils — date parsing and formatting consistency', () => {
  // Generator: valid dates in range 1900-01-01 to 2099-12-31
  const isoDateArb = fc
    .date({ min: new Date(1900, 0, 1), max: new Date(2099, 11, 31) })
    .map(d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });

  it('parseYMDLocal produces valid Date and formatDateLocal produces non-empty string with correct day (property)', () => {
    fc.assert(
      fc.property(isoDateArb, (iso) => {
        const parsed = parseYMDLocal(iso);

        // Must be a valid Date
        expect(parsed).toBeInstanceOf(Date);
        expect(isNaN(parsed.getTime())).toBe(false);

        // formatDateLocal must produce a non-empty string
        const formatted = formatDateLocal(iso);
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);

        // The formatted string must contain the correct day number
        const dayNumber = parsed.getDate();
        expect(formatted).toContain(String(dayNumber));
      }),
      { numRuns: 100 }
    );
  });
});

describe('dateUtils — edge cases', () => {
  it('formatISOToDDMMYYYY returns empty string for null', () => {
    expect(formatISOToDDMMYYYY(null)).toBe('');
  });

  it('formatISOToDDMMYYYY returns empty string for undefined', () => {
    expect(formatISOToDDMMYYYY(undefined)).toBe('');
  });

  it('formatISOToDDMMYYYY returns empty string for empty string', () => {
    expect(formatISOToDDMMYYYY('')).toBe('');
  });

  it('parseDDMMYYYYToISO returns null for invalid date 30/02/2024', () => {
    expect(parseDDMMYYYYToISO('30/02/2024')).toBeNull();
  });

  it('parseDDMMYYYYToISO returns null for month 13', () => {
    expect(parseDDMMYYYYToISO('01/13/2024')).toBeNull();
  });
});
