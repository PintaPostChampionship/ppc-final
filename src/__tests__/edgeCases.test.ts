import { describe, it, expect } from 'vitest';
import { formatISOToDDMMYYYY, parseDDMMYYYYToISO } from '../lib/dateUtils';
import { isCalibrationTournamentByName } from '../lib/tournamentUtils';
import { toTitleCase } from '../lib/displayUtils';
import { compressAvailability } from '../lib/onboardingUtils';

describe('edge cases — example-based unit tests', () => {
  it('formatISOToDDMMYYYY(null) returns empty string', () => {
    expect(formatISOToDDMMYYYY(null)).toBe('');
  });

  it('parseDDMMYYYYToISO("30/02/2024") returns null for invalid Feb 30', () => {
    expect(parseDDMMYYYYToISO('30/02/2024')).toBeNull();
  });

  it('isCalibrationTournamentByName("Calibraciones PPC") returns true', () => {
    expect(isCalibrationTournamentByName('Calibraciones PPC')).toBe(true);
  });

  it('isCalibrationTournamentByName("PPC Edición 1") returns false', () => {
    expect(isCalibrationTournamentByName('PPC Edición 1')).toBe(false);
  });

  it('toTitleCase("josé maría") capitalizes accented characters', () => {
    const result = toTitleCase('josé maría');
    expect(result).toBe('José María');
  });

  it('compressAvailability(undefined) returns null', () => {
    expect(compressAvailability(undefined)).toBeNull();
  });

  it('compressAvailability with empty object returns null', () => {
    expect(compressAvailability({})).toBeNull();
  });
});
