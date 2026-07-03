// Pure lockout-state transitions for MFA brute-force protection.
// Kept side-effect free so the policy is unit-testable; persistence happens
// in the MFA server actions.

import { MFA_LOCKOUT_MINUTES, MFA_MAX_FAILED_ATTEMPTS } from "./levels";

export interface LockoutState {
  mfaFailedCount: number;
  mfaLockedUntil: Date | null;
}

export function isLockedOut(state: LockoutState, now: Date = new Date()): boolean {
  return state.mfaLockedUntil !== null && state.mfaLockedUntil.getTime() > now.getTime();
}

/** State after one more failed attempt. */
export function nextStateAfterFailure(state: LockoutState, now: Date = new Date()): LockoutState & { justLocked: boolean } {
  const mfaFailedCount = state.mfaFailedCount + 1;
  if (mfaFailedCount >= MFA_MAX_FAILED_ATTEMPTS) {
    return {
      // Counter resets when the lock is applied; the time penalty is the deterrent.
      mfaFailedCount: 0,
      mfaLockedUntil: new Date(now.getTime() + MFA_LOCKOUT_MINUTES * 60 * 1000),
      justLocked: true,
    };
  }
  return { mfaFailedCount, mfaLockedUntil: null, justLocked: false };
}

export function stateAfterSuccess(): LockoutState {
  return { mfaFailedCount: 0, mfaLockedUntil: null };
}
