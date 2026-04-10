import type { NextFunction, Request, Response } from 'express';

import { createAdminClient } from '../lib/supabase';

/**
 * Express middleware that validates Supabase JWT from Authorization header.
 * Attaches the authenticated user to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7);
  const supabase = createAdminClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  req.user = { id: user.id, email: user.email || '' };
  req.accessToken = token;
  next();
}
