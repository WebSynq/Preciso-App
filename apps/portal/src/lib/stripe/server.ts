import Stripe from 'stripe';

/**
 * Server-side Stripe client.
 *
 * SECURITY: This module is the trust boundary for PRECISO ↔ Stripe
 * communication. It is server-only (never imported by 'use client'
 * files) and its API is deliberately narrow.
 *
 * We enforce "no PHI to Stripe" at the type level. The payload shape
 * passed to `createPaymentIntent` is a closed interface; there is no
 * way to attach patient_ref, clinical_notes, diagnosis, or any
 * free-text field derived from kit_orders without editing the type
 * signature here. Code review catches any change to this type; the
 * compiler catches any attempt to call it with a wider shape.
 */

let _stripe: Stripe | null = null;

/**
 * Lazy singleton. Stripe client is heavy to construct and the
 * process may start without the key in dev scenarios; we only build
 * it when first needed so a missing key fails loudly at the call
 * site (and not at module load in routes that don't need payments).
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'STRIPE_SECRET_KEY is not configured. Set it in the app env before ' +
        'invoking a Stripe server operation.',
    );
  }
  _stripe = new Stripe(secret, {
    apiVersion: '2024-06-20',
    typescript: true,
    telemetry: false,
  });
  return _stripe;
}

/**
 * Payload for creating a PaymentIntent tied to a kit order.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │ DO NOT add PHI fields here. Every field is reviewed on sight. │
 * └────────────────────────────────────────────────────────────────┘
 *
 * If you need Stripe to know about a new non-PHI attribute, add it
 * here explicitly AND document why it's not PHI in a comment. An
 * attacker with write access to this file could still exfiltrate,
 * but the grep-ability of this one file makes audits trivial.
 */
export interface CreatePaymentIntentInput {
  /** Opaque UUID of the kit order. Not PHI. Stored in metadata. */
  kitOrderId: string;
  /** Opaque UUID of the provider. Not PHI. Stored in metadata. */
  providerId: string;
  /** Provider's email (work email for individual_clinician). */
  providerEmail: string;
  /** Amount in smallest currency unit (cents for USD). */
  amountCents: number;
  /** ISO 4217 code, lowercase (Stripe convention). Default 'usd'. */
  currency?: string;
  /** Panel type as a SKU-like identifier. Non-PHI. */
  panelType: 'newborn' | 'pediatric' | 'adult' | 'senior';
  /** Idempotency key — retries must pass the same key to avoid double-charge. */
  idempotencyKey: string;
}

/**
 * Returns the subset of a Stripe PaymentIntent that's safe to send
 * back to the browser (client_secret + id + status + amount).
 */
export interface CreatePaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: Stripe.PaymentIntent.Status;
  amountCents: number;
  currency: string;
}

/**
 * Creates or retrieves a Stripe Customer for a provider and attaches
 * it to a new PaymentIntent for the given kit order. The provider's
 * stripe_customer_id is the caller's responsibility to cache on the
 * providers table; this helper does not touch the DB.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
  existingCustomerId: string | null,
): Promise<{ result: CreatePaymentIntentResult; customerId: string }> {
  const stripe = getStripe();
  const currency = (input.currency ?? 'usd').toLowerCase();

  // ─── Resolve or create the Stripe Customer ─────────────────────────
  // SECURITY: We send email only. No name, no address (address is
  // collected at Payment Element time and never sent by us).
  let customerId = existingCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: input.providerEmail,
        metadata: {
          // Opaque identifiers only. Non-PHI.
          preciso_provider_id: input.providerId,
        },
      },
      { idempotencyKey: `customer-${input.providerId}` },
    );
    customerId = customer.id;
  }

  // ─── Create PaymentIntent ──────────────────────────────────────────
  const intent = await stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency,
      customer: customerId,
      // Metadata is visible to Stripe dashboards but is fully opaque
      // to them. UUIDs + SKU only.
      metadata: {
        preciso_order_id: input.kitOrderId,
        preciso_provider_id: input.providerId,
        preciso_panel_type: input.panelType,
      },
      // Auto-collect using Payment Element; also enables wallets.
      automatic_payment_methods: { enabled: true },
      description: `PRECISO genomics panel (${input.panelType})`,
      statement_descriptor_suffix: input.panelType.toUpperCase().slice(0, 10),
    },
    { idempotencyKey: input.idempotencyKey },
  );

  return {
    result: {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret ?? '',
      status: intent.status,
      amountCents: intent.amount,
      currency: intent.currency,
    },
    customerId,
  };
}

/**
 * Verifies a Stripe webhook signature and returns the typed event.
 * Throws on failure — caller must return 401 to Stripe (which then
 * retries, same contract as our FedEx / Centogene webhooks).
 */
export function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  }
  if (!signatureHeader) {
    throw new Error('Missing stripe-signature header.');
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
}

/**
 * Maps panel_type → Stripe Price ID (or falls back to cents amount
 * when prices aren't configured in Stripe yet). Kept server-only so
 * price IDs never leak into the client bundle.
 */
export function getPanelPricing(panelType: CreatePaymentIntentInput['panelType']): {
  priceId: string | null;
  amountCents: number;
} {
  const priceId =
    panelType === 'newborn'
      ? process.env.STRIPE_PRICE_NEWBORN
      : panelType === 'pediatric'
        ? process.env.STRIPE_PRICE_PEDIATRIC
        : panelType === 'adult'
          ? process.env.STRIPE_PRICE_ADULT
          : panelType === 'senior'
            ? process.env.STRIPE_PRICE_SENIOR
            : null;

  // Fallback amounts for demo — replace once real Stripe prices are
  // provisioned. All values are USD cents.
  const amountCents =
    panelType === 'newborn'
      ? 200000
      : panelType === 'pediatric'
        ? 180000
        : panelType === 'adult'
          ? 150000
          : 160000;

  return { priceId: priceId ?? null, amountCents };
}
