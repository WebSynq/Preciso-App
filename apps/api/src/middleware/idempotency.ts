import type { NextFunction, Request, Response } from 'express';

/**
 * In-memory idempotency store.
 * In production, this should be backed by Redis or a DB table.
 */
const idempotencyStore = new Map<string, { status: number; body: unknown; createdAt: number }>();

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Express middleware that enforces idempotency keys on mutating requests.
 * Requires X-Idempotency-Key header. Returns cached response if key was already processed.
 */
export function requireIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-idempotency-key'] as string | undefined;

  if (!key) {
    res.status(400).json({ error: 'X-Idempotency-Key header is required.' });
    return;
  }

  if (key.length < 10 || key.length > 100) {
    res.status(400).json({ error: 'Idempotency key must be between 10 and 100 characters.' });
    return;
  }

  // Scope key to user to prevent cross-user collisions
  const scopedKey = `${req.user?.id || 'anon'}:${key}`;

  const cached = idempotencyStore.get(scopedKey);
  if (cached) {
    if (Date.now() - cached.createdAt < IDEMPOTENCY_TTL_MS) {
      res.status(cached.status).json(cached.body);
      return;
    }
    idempotencyStore.delete(scopedKey);
  }

  // Intercept res.json to capture the response for caching
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    idempotencyStore.set(scopedKey, {
      status: res.statusCode,
      body,
      createdAt: Date.now(),
    });
    return originalJson(body);
  };

  next();
}

/**
 * Periodically clean up expired idempotency keys.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyStore.entries()) {
    if (now - value.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Every hour
