const STORAGE_KEY = 'softlogic.loginAttemptLockout.v1';
const ATTEMPT_LIMITS = [3, 2, 1, 1] as const;
const WAIT_MS = 180 * 1000;
const FINAL_BLOCK_MS = 2 * 60 * 60 * 1000;

type LockoutRecord = {
  stage: number;
  failures: number;
  lockedUntil: number | null;
  finalBlock: boolean;
};

type StoredLockouts = Record<string, LockoutRecord>;

export type LoginAttemptDecision =
  | { allowed: true }
  | { allowed: false; remainingMs: number; finalBlock: boolean };

export type LoginAttemptFailureResult = {
  locked: boolean;
  remainingMs: number;
  finalBlock: boolean;
};

export const loginAttemptLockout = {
  canAttempt(key: string, now = Date.now()): LoginAttemptDecision {
    return { allowed: true };
  },

  recordFailure(key: string, now = Date.now()): LoginAttemptFailureResult {
    return { locked: false, remainingMs: 0, finalBlock: false };
  },

  recordSuccess(key: string) {
    // No-op
  },

  formatRemaining(ms: number) {
    return '';
  },
};

