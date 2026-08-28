import {
  ADMIN_LOGIN_ATTEMPT_WINDOW_MS,
  ADMIN_LOGIN_LOCKOUT_MS,
  ADMIN_LOGIN_MAX_ATTEMPTS,
} from '@/constants'

const STORAGE_PREFIX = 'wm-admin-login:'

interface LoginAttemptRecord {
  failedCount: number
  windowStartedAt: number
  lockedUntil: number | null
}

export interface LoginLockState {
  locked: boolean
  retryAfterMs: number
  attemptsRemaining: number
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function storageKey(email: string) {
  return `${STORAGE_PREFIX}${normalizeEmail(email)}`
}

function readRecord(email: string): LoginAttemptRecord | null {
  if (!email.trim()) return null
  try {
    const raw = localStorage.getItem(storageKey(email))
    if (!raw) return null
    return JSON.parse(raw) as LoginAttemptRecord
  } catch {
    return null
  }
}

function writeRecord(email: string, record: LoginAttemptRecord) {
  localStorage.setItem(storageKey(email), JSON.stringify(record))
}

function removeRecord(email: string) {
  localStorage.removeItem(storageKey(email))
}

export function getLoginLockState(email: string): LoginLockState {
  const now = Date.now()
  const record = readRecord(email)

  if (!record) {
    return { locked: false, retryAfterMs: 0, attemptsRemaining: ADMIN_LOGIN_MAX_ATTEMPTS }
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      locked: true,
      retryAfterMs: record.lockedUntil - now,
      attemptsRemaining: 0,
    }
  }

  if (record.lockedUntil && record.lockedUntil <= now) {
    removeRecord(email)
    return { locked: false, retryAfterMs: 0, attemptsRemaining: ADMIN_LOGIN_MAX_ATTEMPTS }
  }

  if (now - record.windowStartedAt > ADMIN_LOGIN_ATTEMPT_WINDOW_MS) {
    removeRecord(email)
    return { locked: false, retryAfterMs: 0, attemptsRemaining: ADMIN_LOGIN_MAX_ATTEMPTS }
  }

  return {
    locked: false,
    retryAfterMs: 0,
    attemptsRemaining: Math.max(0, ADMIN_LOGIN_MAX_ATTEMPTS - record.failedCount),
  }
}

export function recordLoginFailure(email: string): LoginLockState {
  const now = Date.now()
  let record = readRecord(email)

  if (!record || now - record.windowStartedAt > ADMIN_LOGIN_ATTEMPT_WINDOW_MS) {
    record = { failedCount: 0, windowStartedAt: now, lockedUntil: null }
  }

  record.failedCount += 1

  if (record.failedCount >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    record.lockedUntil = now + ADMIN_LOGIN_LOCKOUT_MS
  }

  writeRecord(email, record)
  return getLoginLockState(email)
}

export function clearLoginLock(email: string) {
  if (!email.trim()) return
  removeRecord(email)
}

export function formatRetryAfter(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes} min ${seconds.toString().padStart(2, '0')} s`
  }
  return `${seconds} s`
}
