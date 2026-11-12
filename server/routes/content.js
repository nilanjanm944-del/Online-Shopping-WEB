/**
 * Public content routes: site settings, blog, vlog, FAQs, contact and newsletter.
 */
import express from 'express';
import { filter, find, insert, getSetting } from '../store.js';
import { optionalAuth } from '../auth.js';
import { commerceConfig, activeCoupons } from '../lib/commerce.js';
import { razorpayPublicConfig } from '../payments.js';
import { rateLimit } from '../lib/rate-limit.js';

const router = express.Router();

router.get('/site', (_req, res) => {
  const brand = getSetting('brand', {});
  const faqs = (getSetting('faqs', []) || []).map((f) => ({
    question: f.question || f.q || '',
    answer: f.answer || f.a || '',
    category: f.category || 'General',
  }));
  res.json({
    brand,
    commerce: commerceConfig(),
    payments: razorpayPublicConfig(),
    faqs,
    coupons: activeCoupons().map((c) => ({
      code: c.code,
      description: c.description,
      campaign: c.campaign,
      min_order: c.min_order,
      expires_at: c.expires_at,
    })),
    languages: ['en', 'bn'],
  });
});

router.get('/blog', (req, res) => {
  const posts = filter('blog_posts', (p) => p.published !== false)
    .sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at))
    .map(({ body, ...rest }) => rest);
  res.json({ posts });
});

router.get('/blog/:slug', (req, res) => {
  const post = find('blog_posts', (p) => p.slug === req.params.slug && p.published !== false);
  if (!post) return res.status(404).json({ error: 'Article not found.' });
  const related = filter('blog_posts', (p) => p.slug !== post.slug && p.published !== false)
    .slice(0, 3)
    .map(({ body, ...rest }) => rest);
  res.json({ post, related });
});

router.get('/vlog', (_req, res) => {
  const posts = filter('vlog_posts', (p) => p.published !== false).sort(
    (a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at)
  );
  res.json({ posts });
});

router.get('/vlog/:slug', (req, res) => {
  const post = find('vlog_posts', (p) => p.slug === req.params.slug && p.published !== false);
  if (!post) return res.status(404).json({ error: 'Video not found.' });
  res.json({ post });
});

router.get('/faqs', (_req, res) => {
  const faqs = (getSetting('faqs', []) || []).map((f) => ({
    question: f.question || f.q || '',
    answer: f.answer || f.a || '',
    category: f.category || 'General',
  }));
  const categories = [...new Set(faqs.map((f) => f.category))];
  res.json({ faqs, categories });
});

router.post('/contact', rateLimit({ windowMs: 300_000, max: 8 }), optionalAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  const orderNumber = String(req.body?.order_number || '').trim();
  if (!name || name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (subject.length < 3) return res.status(400).json({ error: 'Please add a subject.' });
  if (message.length < 10) return res.status(400).json({ error: 'Please describe your question in at least 10 characters.' });
  const ticket = insert('tickets', {
    user_id: req.user?.id || null,
    name,
    email,
    subject,
    message,
    order_number: orderNumber || null,
    status: 'open',
    replies: [],
  });
  res.status(201).json({ ticket: { id: ticket.id, status: ticket.status }, message: 'Your request has been received.' });
});

router.post('/newsletter', rateLimit({ windowMs: 300_000, max: 10 }), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (find('newsletter', (n) => n.email === email)) {
    return res.json({ ok: true, message: 'You are already subscribed.' });
  }
  insert('newsletter', { email, source: String(req.body?.source || 'footer') });
  res.status(201).json({ ok: true, message: 'Subscribed. Watch your inbox for offers.' });
});

export default router;
