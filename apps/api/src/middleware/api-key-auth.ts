import type { NextFunction, Request, Response } from 'express';

/**
 * Express middleware that validates a system API key from the Authorization header.
 * Used for machine-to-machine endpoints (barcode scanners, system integrations).
 * NOT for user-facing endpoints — use requireAuth (JWT) for those.
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

  if (providedKey !== validKey) {
    console.error('[ApiKeyAuth] Invalid API key', { ip: req.ip });
    res.status(401).json({ error: 'Invalid API key.' });
    return;
  }

  next();
}
