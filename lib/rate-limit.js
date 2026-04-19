import { LRUCache } from 'lru-cache';

// One LRU cache per named limiter bucket
const limiters = new Map();

function getLimiter(name, windowMs) {
  if (!limiters.has(name)) {
    limiters.set(name, new LRUCache({ max: 10000, ttl: windowMs }));
  }
  return limiters.get(name);
}

/**
 * Simple in-memory rate limiter for Next.js API routes.
 *
 * @param {object} req   - Next.js request object
 * @param {object} opts  - { name, max, windowMs }
 * @returns {{ success: boolean, remaining: number }}
 */
export function rateLimit(req, { name = 'default', max = 20, windowMs = 60_000 } = {}) {
  const cache = getLimiter(name, windowMs);

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown';

  const key = `${name}:${ip}`;
  const count = (cache.get(key) || 0) + 1;
  cache.set(key, count);

  return {
    success: count <= max,
    remaining: Math.max(0, max - count),
  };
}
