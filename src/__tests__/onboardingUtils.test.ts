import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { compressAvailability, decompressAvailability } from '../lib/onboardingUtils';

/**
 * **Validates: Requirements 6.7**
 * Property 1: Availability compression round-trip
 *
 * For any valid availability record (a mapping of day names to arrays of slot strings),
 * compressing with compressAvailability then decompressing with decompressAvailability
 * SHALL produce an equivalent availability record.
 */
describe('onboardingUtils — availability compression round-trip', () => {
  const SLOT_VALUES = [
    'Morning (07:00-12:00)',
    'Afternoon (12:00-18:00)',
    'Evening (18:00-22:00)',
  ] as const;

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

  // Generator: a record mapping day names to non-empty arrays of unique slot strings
  const availabilityArb = fc
    .uniqueArray(fc.constantFrom(...DAY_NAMES), { minLength: 1 })
    .chain(days =>
      fc.tuple(
        ...days.map(day =>
          fc.uniqueArray(fc.constantFrom(...SLOT_VALUES), { minLength: 1 }).map(slots => [day, slots] as const)
        )
      )
    )
    .map(entries => Object.fromEntries(entries) as Record<string, string[]>);

  it('compress then decompress produces equivalent availability (property)', () => {
    fc.assert(
      fc.property(availabilityArb, (availability) => {
        const compressed = compressAvailability(availability);
        expect(compressed).not.toBeNull();

        const decompressed = decompressAvailability(compressed);

        // Same set of days
        const inputDays = Object.keys(availability).sort();
        const outputDays = Object.keys(decompressed).sort();
        expect(outputDays).toEqual(inputDays);

        // Same slots per day (order-independent)
        for (const day of inputDays) {
          expect([...decompressed[day]].sort()).toEqual([...availability[day]].sort());
        }
      }),
      { numRuns: 100 }
    );
  });
});
