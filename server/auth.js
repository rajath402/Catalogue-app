import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const AUTH_FILE = path.join(DATA_DIR, 'auth.json')
const SEED_FILE = path.join(DATA_DIR, 'password-seed.txt')

// The default admin password, used only once — to seed the hashed
// credential file the very first time the server starts. It lives in this
// server-only text file, which is never bundled into the frontend and
// never served by any route, so it's never exposed to the browser. Change
// it immediately via System Configuration after first login: from then on
// only the one-way hash in auth.json matters, and this file is never read
// again.
const DEFAULT_PASSWORD = 'admin123'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// One-way by construction: scrypt is a memory-hard KDF, so there's no
// inverse — verifying means re-deriving from the candidate password with
// the same salt and comparing, never decrypting the stored value.
function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return crypto.timingSafeEqual(candidate, expected)
}

// Creates the seed file and the hashed credential file on first run only.
// Both are written with mode 0o600 (owner read/write only) — belt-and-
// suspenders on top of the fact that neither is ever served by an Express
// route, so there's no URL that could expose them even if permissions were
// looser.
export function initAuth() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(SEED_FILE)) {
    fs.writeFileSync(SEED_FILE, DEFAULT_PASSWORD, { mode: 0o600 })
  }
  if (!fs.existsSync(AUTH_FILE)) {
    const seedPassword = fs.readFileSync(SEED_FILE, 'utf-8').trim() || DEFAULT_PASSWORD
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ passwordHash: hashPassword(seedPassword) }), {
      mode: 0o600,
    })
  }
}

function readAuthFile() {
  return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
}

// `mode` on writeFileSync only applies at file-CREATION time — if the file
// already exists (which it always does after the first run), Node silently
// ignores it and leaves whatever permissions were already there. Without
// the explicit chmod, a file that somehow ended up world-readable (a
// backup/restore, a permissive umask, an archive that doesn't preserve
// POSIX modes) would stay that way forever, silently, even across
// legitimate password changes.
function writeAuthFile(data) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data), { mode: 0o600 })
  fs.chmodSync(AUTH_FILE, 0o600)
}

export function checkPassword(password) {
  if (typeof password !== 'string') return false
  const { passwordHash } = readAuthFile()
  return verifyPassword(password, passwordHash)
}

export function changePassword(currentPassword, newPassword) {
  if (!checkPassword(currentPassword)) {
    return { ok: false, error: 'Current password is incorrect.' }
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }
  writeAuthFile({ passwordHash: hashPassword(newPassword) })
  return { ok: true }
}

// In-memory only — a server restart invalidates every session, which is
// the right failure mode for a security feature (fail closed and force a
// fresh login) rather than persisting sessions to disk.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const sessions = new Map()

export function createSession() {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  return token
}

export function isValidSession(token) {
  const expiry = sessions.get(token)
  if (!expiry) return false
  if (Date.now() > expiry) {
    sessions.delete(token)
    return false
  }
  return true
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token || !isValidSession(token)) {
    return res.status(401).json({ error: 'Login required.' })
  }
  next()
}

// Login has no account concept to lock — a per-IP attempt counter is the
// cheapest thing that still meaningfully slows down an online brute force
// against a single shared password, without needing a dependency.
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 10
const loginAttempts = new Map()

export function isLoginRateLimited(ip) {
  const now = Date.now()
  const attempts = (loginAttempts.get(ip) || []).filter((t) => now - t < LOGIN_ATTEMPT_WINDOW_MS)
  loginAttempts.set(ip, attempts)
  return attempts.length >= MAX_LOGIN_ATTEMPTS_PER_WINDOW
}

export function recordFailedLogin(ip) {
  const attempts = loginAttempts.get(ip) || []
  attempts.push(Date.now())
  loginAttempts.set(ip, attempts)
}
