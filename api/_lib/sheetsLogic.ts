export interface StateTransitionResult {
  allowed: boolean;
}

export interface ProfileExistsResult {
  valid: boolean;
}

/**
 * Only allows the transition pendiente → pagado_sin_validar.
 * Any other current status is rejected.
 */
export function validateStateTransition(currentStatus: string): StateTransitionResult {
  return { allowed: currentStatus === 'pendiente' };
}

/**
 * Verifies that a row with the exact profile_id AND torneo combination exists.
 */
export function validateProfileExists(
  rows: Array<{ profile_id: string; torneo: string }>,
  profileId: string,
  torneo: string,
): ProfileExistsResult {
  return { valid: rows.some((r) => r.profile_id === profileId && r.torneo === torneo) };
}

/**
 * Finds the row matching both profile_id AND torneo.
 * Returns undefined if not found.
 */
export function findRow<T extends { profile_id: string; torneo: string }>(
  rows: T[],
  profileId: string,
  torneo: string,
): T | undefined {
  return rows.find((r) => r.profile_id === profileId && r.torneo === torneo);
}
