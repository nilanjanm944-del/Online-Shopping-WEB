/**
 * ZYREX STORE — authentication & authorization.
 *
 * Passwords are hashed with bcrypt (never stored in plain text). Sessions are
 * signed JWTs delivered in an httpOnly, SameSite=Lax cookie; a Bearer token is
 * also accepted for API clients. Role checks happen on the server for every
 * protected route — the UI hiding admin links is not treated as security.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { find } from './store.js';

const COOKIE_NAME = 'zyrex_session';
const TOKEN_TTL = '7d';

// A generated secret keeps sessions working in development without ever
// committing a secret. Set JWT_SECRET in production so sessions survive restarts.
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET is not set — using an ephemeral secret for this process.');
}

export const hashPassword = (plain) => bcrypt.hashSync(String(plain), 10);
export const verifyPassword = (plain, hash) => {
  try {
    return bcrypt.compareSync(String(plain), String(hash || ''));
  } catch {
    return false;
  }
};

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, SECRET, { expiresIn: TOKEN_TTL });
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secure}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > 0) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    return acc;
  }, {});
}

export function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE_NAME] || null;
}

export function currentUser(req) {
  if (req.user !== undefined) return req.user;
  const token = tokenFromRequest(req);
  if (!token) {
    req.user = null;
    return null;
  }
  try {
    const payload = jwt.verify(token, SECRET);
    const user = find('users', (u) => u.id === payload.sub);
    req.user = user ? publicUser(user) : null;
  } catch {
    req.user = null;
  }
  return req.user;
}

export function publicUser(user) {
  if (!user) return null;
  const { password_hash, reset_token, ...rest } = user;
  return rest;
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  req.auth = user;
  return next();
}

export function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  req.auth = user;
  return next();
}

/** Attaches req.user when present, without blocking anonymous requests. */
export function optionalAuth(req, _res, next) {
  currentUser(req);
  next();
}
