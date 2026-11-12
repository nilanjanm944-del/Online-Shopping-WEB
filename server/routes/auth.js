/**
 * Authentication, profile and address routes.
 */
import express from 'express';
import crypto from 'node:crypto';
import { find, filter, insert, update, remove, newId } from '../store.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  publicUser,
  requireAuth,
  currentUser,
} from '../auth.js';
import { rateLimit } from '../lib/rate-limit.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const isEmail = (v) => EMAIL_RE.test(String(v || '').trim());

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must include a letter and a number.';
  return null;
}

router.post('/register', rateLimit({ windowMs: 60_000, max: 10 }), (req, res) => {
  const { name, email, password, phone } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanName.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!isEmail(cleanEmail)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  if (find('users', (u) => u.email === cleanEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
  }
  const user = insert('users', {
    name: cleanName,
    email: cleanEmail,
    password_hash: hashPassword(password),
    role: 'customer',
    phone: String(phone || '').trim(),
    email_verified: false,
  });
  setSessionCookie(res, signToken(user));
  return res.status(201).json({ user: publicUser(user), email_verification: 'pending' });
});

router.post('/login', rateLimit({ windowMs: 60_000, max: 12 }), (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = find('users', (u) => u.email === cleanEmail);
  // Same response for unknown email and wrong password: no account enumeration.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  setSessionCookie(res, signToken(user));
  return res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: currentUser(req) });
});

router.patch('/profile', requireAuth, (req, res) => {
  const { name, phone } = req.body || {};
  const patch = {};
  if (name !== undefined) {
    if (String(name).trim().length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
    patch.name = String(name).trim();
  }
  if (phone !== undefined) patch.phone = String(phone).trim();
  const updated = update('users', req.auth.id, patch);
  res.json({ user: publicUser(updated) });
});

router.post('/password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  const user = find('users', (u) => u.id === req.auth.id);
  if (!verifyPassword(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  const pwError = validatePassword(new_password);
  if (pwError) return res.status(400).json({ error: pwError });
  update('users', user.id, { password_hash: hashPassword(new_password) });
  res.json({ ok: true });
});

/**
 * Password reset. Without a configured email provider the reset token is returned
 * only in non-production so the flow can be completed; production requires email.
 */
router.post('/forgot-password', rateLimit({ windowMs: 60_000, max: 6 }), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = find('users', (u) => u.email === email);
  if (!user) {
    return res.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  update('users', user.id, {
    reset_token: token,
    reset_expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  const payload = {
    ok: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  };
  if (!process.env.EMAIL_API_KEY && process.env.NODE_ENV !== 'production') {
    payload.dev_reset_token = token;
    payload.message = 'Email provider not configured — use the development reset token below.';
  }
  return res.json(payload);
});

router.post('/reset-password', rateLimit({ windowMs: 60_000, max: 10 }), (req, res) => {
  const { token, password } = req.body || {};
  const user = find('users', (u) => u.reset_token && u.reset_token === String(token || ''));
  if (!user || !user.reset_expires || new Date(user.reset_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  update('users', user.id, {
    password_hash: hashPassword(password),
    reset_token: null,
    reset_expires: null,
  });
  res.json({ ok: true });
});

/* ----------------------------- Addresses -------------------------------- */

const ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'landmark', 'instructions'];

function cleanAddress(body) {
  const out = {};
  for (const f of ADDRESS_FIELDS) out[f] = String(body?.[f] ?? '').trim();
  return out;
}

export function validateAddress(a) {
  if (!a.name || a.name.length < 2) return 'Please enter the recipient name.';
  if (!/^[0-9+\-\s()]{8,16}$/.test(a.phone)) return 'Please enter a valid mobile number.';
  if (!a.line1 || a.line1.length < 6) return 'Please enter the delivery address.';
  if (!a.city) return 'Please enter your city.';
  if (!a.state) return 'Please enter your state.';
  if (!/^[1-9][0-9]{5}$/.test(a.pincode)) return 'Please enter a valid 6-digit PIN code.';
  return null;
}

router.get('/addresses', requireAuth, (req, res) => {
  res.json({ addresses: filter('addresses', (a) => a.user_id === req.auth.id) });
});

router.post('/addresses', requireAuth, (req, res) => {
  const address = cleanAddress(req.body);
  const error = validateAddress(address);
  if (error) return res.status(400).json({ error });
  const existing = filter('addresses', (a) => a.user_id === req.auth.id);
  const isDefault = req.body?.is_default === true || existing.length === 0;
  if (isDefault) {
    for (const a of existing) update('addresses', a.id, { is_default: false });
  }
  const row = insert('addresses', { ...address, user_id: req.auth.id, is_default: isDefault });
  res.status(201).json({ address: row });
});

router.patch('/addresses/:id', requireAuth, (req, res) => {
  const row = find('addresses', (a) => a.id === req.params.id && a.user_id === req.auth.id);
  if (!row) return res.status(404).json({ error: 'Address not found.' });
  const address = { ...cleanAddress({ ...row, ...req.body }) };
  const error = validateAddress(address);
  if (error) return res.status(400).json({ error });
  if (req.body?.is_default) {
    for (const a of filter('addresses', (x) => x.user_id === req.auth.id)) update('addresses', a.id, { is_default: false });
  }
  const updated = update('addresses', row.id, { ...address, is_default: Boolean(req.body?.is_default ?? row.is_default) });
  res.json({ address: updated });
});

router.delete('/addresses/:id', requireAuth, (req, res) => {
  const row = find('addresses', (a) => a.id === req.params.id && a.user_id === req.auth.id);
  if (!row) return res.status(404).json({ error: 'Address not found.' });
  remove('addresses', (a) => a.id === row.id);
  res.json({ ok: true });
});

/** Create a fresh guest id so anonymous carts can be merged after sign-in. */
router.get('/guest-id', (_req, res) => res.json({ guest_id: newId() }));

export default router;
