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

const defaultRecord = (): LockoutRecord => ({
  stage: 0,
  failures: 0,
  lockedUntil: null,
  finalBlock: false,
});

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

function readStore(): StoredLockouts {
  if (!storageAvailable()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredLockouts;
  } catch {
    return {};
  }
}

function writeStore(store: StoredLockouts) {
  if (!storageAvailable()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // If storage is unavailable or full, keep the current login flow usable.
  }
}

function resetIfFinalBlockExpired(record: LockoutRecord, now: number) {
  if (record.finalBlock && record.lockedUntil != null && record.lockedUntil <= now) {
    return defaultRecord();
  }

  return record;
}

function readRecord(store: StoredLockouts, key: string, now: number) {
  return resetIfFinalBlockExpired(store[key] ?? defaultRecord(), now);
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} sec`;
}

export const loginAttemptLockout = {
  canAttempt(key: string, now = Date.now()): LoginAttemptDecision {
    const normalized = normalizeKey(key);
    if (!normalized) return { allowed: true };

    const store = readStore();
    const record = readRecord(store, normalized, now);
    if (record !== store[normalized]) {
      store[normalized] = record;
      writeStore(store);
    }

    if (record.lockedUntil != null && record.lockedUntil > now) {
      return {
        allowed: false,
        remainingMs: record.lockedUntil - now,
        finalBlock: record.finalBlock,
      };
    }

    return { allowed: true };
  },

  recordFailure(key: string, now = Date.now()): LoginAttemptFailureResult {
    const normalized = normalizeKey(key);
    if (!normalized) return { locked: false, remainingMs: 0, finalBlock: false };

    const store = readStore();
    const current = readRecord(store, normalized, now);
    const stage = Math.min(current.stage, ATTEMPT_LIMITS.length - 1);
    const failures = current.failures + 1;
    const limit = ATTEMPT_LIMITS[stage];

    if (failures < limit) {
      store[normalized] = { ...current, stage, failures, lockedUntil: null };
      writeStore(store);
      return { locked: false, remainingMs: 0, finalBlock: false };
    }

    const finalBlock = stage === ATTEMPT_LIMITS.length - 1;
    const remainingMs = finalBlock ? FINAL_BLOCK_MS : WAIT_MS;
    store[normalized] = {
      stage: finalBlock ? stage : stage + 1,
      failures: 0,
      lockedUntil: now + remainingMs,
      finalBlock,
    };
    writeStore(store);

    return { locked: true, remainingMs, finalBlock };
  },

  recordSuccess(key: string) {
    const normalized = normalizeKey(key);
    if (!normalized) return;

    const store = readStore();
    if (!(normalized in store)) return;
    delete store[normalized];
    writeStore(store);
  },

  formatRemaining,
};
