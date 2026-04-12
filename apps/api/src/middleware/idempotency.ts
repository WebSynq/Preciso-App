import type { NextFunction, Request, Response } from 'express';

import { createAdminClient } from '../lib/supabase';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Express middleware that enforces idempotency keys on mutating requests.
 *
 * Requires X-Idempotency-Key header. Returns the cached response if the same
 * scoped key was already processed within the TTL window.
 *
 * Keys are stored in Postgres (idempotency_keys table) so they survive server
 * restarts and work correctly across multiple API instances.
 */
export async function requireIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-idempotency-key'] as string | undefined;

  if (!key) {
    res.status(400).json({ error: 'X-Idempotency-Key header is required.' });
    return;
  }

  if (key.length < 10 || key.length > 100) {
    res.status(400).json({ error: 'Idempotency key must be between 10 and 100 characters.' });
    return;
  }

  // Scope key to the authenticated user to prevent cross-user replay attacks.
  const scopedKey = `${req.user?.id || 'anon'}:${key}`;

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();

  // Look up an existing, non-expired entry.
  const { data: existing, error: lookupError } = await supabase
    .from('idempotency_keys')
    .select('status_code, response_body')
    .eq('scoped_key', scopedKey)
    .gte('created_at', cutoff)
    .maybeSingle();

  if (lookupError) {
    // Non-fatal: log and fall through so the request is processed normally.
    console.error('[Idempotency] DB lookup failed — processing request without cache', {
      error: lookupError.message,
    });
    next();
    return;
  }

  if (existing) {
    // Return the previously stored response — exact replay.
    res.status(existing.status_code).json(existing.response_body);
    return;
  }

  // Intercept res.json to persist the response before it is sent.
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    // Fire-and-forget insert; a failure here must not block the response.
    supabase
      .from('idempotency_keys')
      .upsert(
        {
          scoped_key: scopedKey,
          status_code: res.statusCode,
          response_body: body,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'scoped_key' },
      )
      .then(({ error }) => {
        if (error) {
          console.error('[Idempotency] Failed to persist idempotency key', {
            error: error.message,
          });
        }
      });

    return originalJson(body);
  };

  next();
}

/**
 * Deletes idempotency keys older than the TTL window.
 * Call this on a schedule (e.g. daily via pg_cron or a Lambda) rather than
 * running an in-process interval, which does not scale across multiple instances.
 *
 * Exported so it can be invoked from a maintenance endpoint or a scheduled job.
 */
export async function purgeExpiredIdempotencyKeys(): Promise<{ deleted: number }> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();

  const { error, count } = await supabase
    .from('idempotency_keys')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) {
    console.error('[Idempotency] Purge failed', { error: error.message });
    return { deleted: 0 };
  }

  return { deleted: count ?? 0 };
}
