import { randomUUID } from 'crypto';

export {
  rateLimit,
  incrementCounter,
  resetCounter,
  readCounter,
  type RateLimitOptions,
  type RateLimitResult,
} from './rate-limit';

export { getOrCreateRequestId } from './request-id';

/**
 * Generates a UUID v4 for use as a primary key
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Generates an idempotency key for API requests
 */
export function generateIdempotencyKey(): string {
  return `idem_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Masks sensitive data for logging (shows first 4 and last 4 characters)
 */
export function maskSensitive(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/**
 * Returns the current timestamp in ISO 8601 format
 */
export function nowISO(): string {
  return new Date().toISOString();
}
