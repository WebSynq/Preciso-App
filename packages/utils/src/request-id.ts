import { randomUUID } from 'crypto';

/**
 * Generates or preserves a request ID so logs can be correlated across
 * portal → API → external integrations. Honours an incoming
 * `x-request-id` header if present (from upstream / load balancer),
 * otherwise mints a fresh UUID.
 *
 * SECURITY NOTE: Include the request ID in every log line and in the
 * JSON error response body. Clients pass it back when reporting bugs.
 * It is NOT a secret and must not be used for any authentication
 * decision.
 */
export function getOrCreateRequestId(
  existingHeader: string | null | undefined,
): string {
  const trimmed = existingHeader?.trim();
  // Only accept UUID-shaped values from upstream. An attacker-supplied
  // request ID is harmless for tracing, but rejecting oversized or
  // weird values keeps log parsers happy.
  if (trimmed && /^[0-9a-f-]{36}$/i.test(trimmed)) {
    return trimmed;
  }
  return randomUUID();
}
