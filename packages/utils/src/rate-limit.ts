/**
 * Shared rate limiter for the PRECISO platform.
 *
 * Backed by Upstash Redis over REST when UPSTASH_REDIS_URL and
 * UPSTASH_REDIS_TOKEN are set, so all portal (Vercel serverless),
 * admin, dev, and Express API instances share a single limit.
 *
 * Falls back to a per-process in-memory counter when Upstash is not
 * configured. The fallback is deliberately loud (console.warn) so we
 * never silently ship a misconfigured production build.
 *
 * SECURITY NOTE: Rate-limit identifiers must be built from trusted
 * inputs — authenticated user ID where available, otherwise the client
 * IP. Never trust a value from the request body as part of the key or
 * an attacker can bypass limits by changing it.
 */

export interface RateLimitOptions {
  /** Unique key for this limiter (e.g. "order:userId:123" or "login:ip:1.2.3.4"). */
  identifier: string;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Maximum requests allowed in the window. */
  maxRequests: number;
}

export interface RateLimitResult {
  /** `true` if the request is within the limit. */
  success: boolean;
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** The configured max per window. */
  limit: number;
  /** Unix ms timestamp when the current window resets. */
  resetAt: number;
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

let fallbackWarned = false;
function warnFallbackOnce(): void {
  if (fallbackWarned) return;
  fallbackWarned = true;
  console.warn(
    '[rate-limit] No Upstash env vars detected — using in-memory fallback. ' +
      'This is ONLY safe for local dev. Set UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN ' +
      'or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN before deploying.',
  );
}

/**
 * Resolves Upstash credentials from any of the three naming conventions:
 *   - UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN        (our .env.example)
 *   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *     (Vercel Marketplace "Upstash for Redis" integration)
 *   - KV_REST_API_URL / KV_REST_API_TOKEN
 *     (legacy Vercel KV-by-Upstash naming)
 * Returns null for both when neither pair is set.
 */
function getUpstashCreds(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function upstashCommand(
  url: string,
  token: string,
  args: string[],
): Promise<unknown> {
  // Upstash REST accepts a pipeline of command args as a JSON array.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash ${args[0]} failed: ${res.status} ${text}`);
  }
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (body.error) {
    throw new Error(`Upstash ${args[0]} error: ${body.error}`);
  }
  return body.result;
}

/**
 * Applies a fixed-window rate limit and returns the result.
 * Non-throwing — on upstream Redis errors the request is allowed through
 * and the error is logged. HIPAA posture favours availability over
 * strict limiting on backend failure; pair with CloudWatch alarms.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { identifier, windowSeconds, maxRequests } = opts;
  const now = Date.now();
  const windowLenMs = windowSeconds * 1000;
  const windowStart = Math.floor(now / windowLenMs) * windowLenMs;
  const resetAt = windowStart + windowLenMs;
  const key = `ratelimit:${identifier}:${windowStart}`;

  const creds = getUpstashCreds();
  if (creds) {
    try {
      const incr = (await upstashCommand(creds.url, creds.token, ['INCR', key])) as number;
      if (incr === 1) {
        // First request in this window — set TTL so the key is reaped.
        await upstashCommand(creds.url, creds.token, [
          'EXPIRE',
          key,
          String(windowSeconds),
        ]);
      }
      return {
        success: incr <= maxRequests,
        remaining: Math.max(0, maxRequests - incr),
        limit: maxRequests,
        resetAt,
      };
    } catch (err) {
      // Non-blocking: never 500 the user because Upstash is down.
      console.error('[rate-limit] Upstash failure, allowing request', err);
      return { success: true, remaining: maxRequests, limit: maxRequests, resetAt };
    }
  }

  warnFallbackOnce();
  const existing = memoryStore.get(key);
  const count = existing && existing.resetAt > now ? existing.count + 1 : 1;
  memoryStore.set(key, { count, resetAt });
  // Opportunistic cleanup of old keys.
  if (memoryStore.size > 10000) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt <= now) memoryStore.delete(k);
    }
  }
  return {
    success: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    limit: maxRequests,
    resetAt,
  };
}

/**
 * Increments a counter and returns the new value. Used for tracking
 * failed login attempts across all instances (Step 6b). Returns `null`
 * if Redis is unavailable — callers should treat `null` as "don't
 * block" to preserve availability.
 */
export async function incrementCounter(
  key: string,
  ttlSeconds: number,
): Promise<number | null> {
  const creds = getUpstashCreds();
  if (!creds) {
    warnFallbackOnce();
    const now = Date.now();
    const existing = memoryStore.get(key);
    const count = existing && existing.resetAt > now ? existing.count + 1 : 1;
    memoryStore.set(key, { count, resetAt: now + ttlSeconds * 1000 });
    return count;
  }
  try {
    const n = (await upstashCommand(creds.url, creds.token, ['INCR', key])) as number;
    if (n === 1) {
      await upstashCommand(creds.url, creds.token, ['EXPIRE', key, String(ttlSeconds)]);
    }
    return n;
  } catch (err) {
    console.error('[rate-limit] incrementCounter Upstash failure', err);
    return null;
  }
}

/** Deletes a counter (used to clear failed login attempts on success). */
export async function resetCounter(key: string): Promise<void> {
  const creds = getUpstashCreds();
  if (!creds) {
    memoryStore.delete(key);
    return;
  }
  try {
    await upstashCommand(creds.url, creds.token, ['DEL', key]);
  } catch (err) {
    console.error('[rate-limit] resetCounter Upstash failure', err);
  }
}

/** Reads a counter without modifying it (used to check lockout status). */
export async function readCounter(key: string): Promise<number> {
  const creds = getUpstashCreds();
  if (!creds) {
    const now = Date.now();
    const existing = memoryStore.get(key);
    return existing && existing.resetAt > now ? existing.count : 0;
  }
  try {
    const raw = (await upstashCommand(creds.url, creds.token, ['GET', key])) as
      | string
      | null;
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (err) {
    console.error('[rate-limit] readCounter Upstash failure', err);
    return 0;
  }
}
