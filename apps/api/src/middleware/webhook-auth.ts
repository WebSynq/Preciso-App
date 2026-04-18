import { createHmac, timingSafeEqual } from 'crypto';

import type { NextFunction, Request, Response } from 'express';

/**
 * Configuration for vendor-specific webhook authentication.
 */
interface WebhookAuthConfig {
  /** The HTTP header containing the HMAC signature */
  signatureHeader: string;
  /** Environment variable name for the HMAC secret */
  secretEnvVar: string;
  /** Vendor name for logging */
  vendor: string;
}

/**
 * Creates reusable webhook authentication middleware.
 *
 * Security:
 *   - Extracts HMAC-SHA256 signature from vendor-specific header
 *   - Computes expected signature using vendor secret
 *   - Uses timing-safe comparison to prevent timing attacks
 *   - Rejects with 401 if signature missing or invalid
 *   - Logs every webhook attempt (valid and invalid) to CloudWatch
 *   - Returns generic error messages — never reveals validation logic
 */
export function createWebhookAuth(config: WebhookAuthConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { signatureHeader, secretEnvVar, vendor } = config;

    const signature = req.headers[signatureHeader.toLowerCase()] as string | undefined;
    const secret = process.env[secretEnvVar];

    // Log every attempt
    console.warn(`[Webhook] ${vendor} attempt received`, {
      vendor,
      ip: req.ip,
      hasSignature: !!signature,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    if (!secret) {
      console.error(`[Webhook] ${vendor} secret not configured: ${secretEnvVar}`);
      res.status(500).json({ error: 'Webhook configuration error.' });
      return;
    }

    if (!signature) {
      console.error(`[Webhook] ${vendor} missing signature header: ${signatureHeader}`, {
        ip: req.ip,
      });
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    // Compute expected HMAC-SHA256 signature
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    let isValid = false;
    try {
      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length === expectedBuffer.length) {
        isValid = timingSafeEqual(sigBuffer, expectedBuffer);
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      console.error(`[Webhook] ${vendor} invalid HMAC signature`, {
        ip: req.ip,
        path: req.path,
      });
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    console.warn(`[Webhook] ${vendor} signature validated successfully`, {
      ip: req.ip,
      path: req.path,
    });

    next();
  };
}

// ─── Pre-configured webhook auth for each vendor ─────────────────────────────

export const fedexWebhookAuth = createWebhookAuth({
  signatureHeader: 'X-FedEx-Signature',
  secretEnvVar: 'FEDEX_WEBHOOK_SECRET',
  vendor: 'FedEx',
});

export const centogeneWebhookAuth = createWebhookAuth({
  signatureHeader: 'X-Centogene-Signature',
  secretEnvVar: 'CENTOGENE_WEBHOOK_SECRET',
  vendor: 'Centogene',
});

/**
 * @deprecated Use centogeneWebhookAuth. Kept as an alias so any
 * external route configuration that still references the old name
 * continues to work until callers are updated.
 */
export const cenegenicsWebhookAuth = centogeneWebhookAuth;

export const sampledWebhookAuth = createWebhookAuth({
  signatureHeader: 'X-Sampled-Signature',
  secretEnvVar: 'SAMPLED_WEBHOOK_SECRET',
  vendor: 'Sampled',
});

export const ghlWebhookAuth = createWebhookAuth({
  signatureHeader: 'X-GHL-Signature',
  secretEnvVar: 'GHL_WEBHOOK_SECRET',
  vendor: 'GHL',
});

export const firstsourceWebhookAuth = createWebhookAuth({
  signatureHeader: 'X-FirstSource-Signature',
  secretEnvVar: 'FIRSTSOURCE_WEBHOOK_SECRET',
  vendor: 'FirstSource',
});
