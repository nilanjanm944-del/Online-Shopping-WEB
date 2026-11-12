/** Simple in-memory rate limiter (per IP + route bucket). */
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now > entry.reset) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
    return next();
  };
}

// Keep the map from growing without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}, 120000).unref();
