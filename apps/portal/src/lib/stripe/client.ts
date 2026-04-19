'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Browser-side Stripe.js loader.
 *
 * The publishable key is safe to ship in the client bundle (Stripe's
 * design). It's the paired SECRET key on the server that grants any
 * sensitive capability.
 *
 * We cache the promise so the <Elements> provider doesn't re-init the
 * SDK on every render.
 */
let _stripePromise: Promise<Stripe | null> | null = null;

export function getStripeBrowser(): Promise<Stripe | null> {
  if (_stripePromise) return _stripePromise;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    // Return a resolved null so callers can render a graceful fallback
    // ("Payments are not configured yet") without a runtime throw.
    console.warn(
      '[stripe/client] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. ' +
        'Payment UI will render in disabled mode.',
    );
    _stripePromise = Promise.resolve(null);
    return _stripePromise;
  }
  _stripePromise = loadStripe(key);
  return _stripePromise;
}
