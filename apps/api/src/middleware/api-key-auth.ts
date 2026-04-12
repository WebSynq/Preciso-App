import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Express middleware that validates a system API key from the Authorization header.
 * Used for machine-to-machine endpoints (barcode scanners, system integrations).
 * NOT for user-facing endpoints — use requireAuth (JWT) for those.
 *
 * Uses crypto.timingSafeEqual to prevent timing-based key enumeration attacks.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('ApiKey ')) {
    res.status(401).json({ error: 'API key required.' });
    return;
  }

  const providedKey = authHeader.slice(7);
  const validKey = process.env.SYSTEM_API_KEY;

  if (!validKey) {
    console.error('[ApiKeyAuth] SYSTEM_API_KEY not configured');
    res.status(500).json({ error: 'Server configuration error.' });
    return;
  }

  // Constant-time comparison to prevent timing attacks.
  // Buffers must be the same byte length for timingSafeEqual.
  const providedBuf = Buffer.from(providedKey);
  const validBuf = Buffer.from(validKey);
  const keysMatch =
    providedBuf.length === validBuf.length &&
    timingSafeEqual(providedBuf, validBuf);

  if (!keysMatch) {
    console.error('[ApiKeyAuth] Invalid API key attempt', { ip: req.ip });
    res.status(401).json({ error: 'Invalid API key.' });
    return;
  }

  next();
}
