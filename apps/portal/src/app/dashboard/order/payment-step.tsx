'use client';

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { getStripeBrowser } from '@/lib/stripe/client';

/**
 * Step 4 of the order flow: collect payment for a kit order that has
 * already been persisted (order_status='pending') by POST /api/v1/orders.
 *
 * Flow
 *   1. This component mounts with {orderId, amountCents}.
 *   2. We POST /api/v1/payments/checkout → server creates Stripe
 *      PaymentIntent and returns a client_secret.
 *   3. <Elements> is mounted with that client_secret. User fills card.
 *   4. On confirm, Stripe.js handles card auth + 3DS. We set return_url
 *      to the order detail page.
 *   5. The Stripe webhook (Phase 3, separate handler) is the source of
 *      truth for payment_status. The return_url is purely UX.
 *
 * SECURITY
 *   - No card data ever touches our origin. PaymentElement talks
 *     directly to Stripe from the iframe.
 *   - The client_secret is scoped to this single PaymentIntent and is
 *     safe to expose to this browser session.
 */
export function PaymentStep({
  orderId,
  amountCents,
  panelTitle,
  onBack,
}: {
  orderId: string;
  amountCents: number;
  panelTitle: string;
  onBack: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);

  // Kick off checkout server-side and remember whether Stripe.js is
  // available in this browser bundle. If the publishable key is
  // missing we show a disabled state instead of crashing.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const stripe = await getStripeBrowser();
        if (cancelled) return;
        if (!stripe) {
          setStripeReady(false);
          setInitError(
            'Payments are not yet configured for this environment. An admin must add the Stripe keys before checkout is available.',
          );
          return;
        }
        setStripeReady(true);

        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setInitError('Your session has expired. Please sign in again.');
          return;
        }

        const res = await fetch('/api/v1/payments/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderId }),
        });
        const body = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setInitError(body.error || 'Could not start payment.');
          return;
        }
        setClientSecret(body.clientSecret);
      } catch {
        if (!cancelled) setInitError('Network error while starting payment.');
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (stripeReady === false) {
    return (
      <PaymentShell amountCents={amountCents} panelTitle={panelTitle} onBack={onBack}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {initError}
        </div>
        <OrderSavedNotice orderId={orderId} />
      </PaymentShell>
    );
  }

  if (initError) {
    return (
      <PaymentShell amountCents={amountCents} panelTitle={panelTitle} onBack={onBack}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {initError}
        </div>
        <OrderSavedNotice orderId={orderId} />
      </PaymentShell>
    );
  }

  if (!clientSecret) {
    return (
      <PaymentShell amountCents={amountCents} panelTitle={panelTitle} onBack={onBack}>
        <div className="py-8 text-center text-sm text-gray-500">Initializing secure checkout…</div>
      </PaymentShell>
    );
  }

  const appearance: Appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#0ea5a8',
      colorBackground: '#ffffff',
      colorText: '#0f172a',
      borderRadius: '8px',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  };

  return (
    <PaymentShell amountCents={amountCents} panelTitle={panelTitle} onBack={onBack}>
      <Elements stripe={getStripeBrowser()} options={{ clientSecret, appearance }}>
        <PaymentForm orderId={orderId} />
      </Elements>
    </PaymentShell>
  );
}

function PaymentForm({ orderId }: { orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const returnUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/orders/${orderId}?payment=processing`
        : `/dashboard/orders/${orderId}?payment=processing`;

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      // If the card doesn't require redirect (no 3DS), Stripe resolves
      // here instead of navigating. We handle both cases.
      redirect: 'if_required',
    });

    if (confirmError) {
      // card_error and validation_error are safe to show to the user;
      // everything else is treated as a generic failure.
      const userSafe =
        confirmError.type === 'card_error' || confirmError.type === 'validation_error';
      setError(userSafe ? confirmError.message || 'Payment failed.' : 'Payment could not be processed.');
      setSubmitting(false);
      return;
    }

    // No redirect needed — payment either succeeded or is processing.
    // Navigate to the order detail page; the webhook will finalize state.
    router.push(`/dashboard/orders/${orderId}?payment=processing`);
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="button"
        disabled={!stripe || !elements || submitting}
        onClick={handlePay}
        className="w-full rounded-lg bg-teal px-8 py-3 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Processing payment…' : 'Pay & submit order'}
      </button>
      <p className="text-xs text-gray-400">
        Payments are processed by Stripe. Card details never touch PRECISO servers. No patient PHI is transmitted to Stripe.
      </p>
    </div>
  );
}

function PaymentShell({
  amountCents,
  panelTitle,
  onBack,
  children,
}: {
  amountCents: number;
  panelTitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const dollars = (amountCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-navy">Payment</h2>
      <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {panelTitle} Panel
          </p>
          <p className="text-xs text-gray-400">Billed to your Stripe-on-file card</p>
        </div>
        <p className="text-xl font-semibold text-navy">{dollars}</p>
      </div>
      {children}
      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function OrderSavedNotice({ orderId }: { orderId: string }) {
  return (
    <p className="mt-4 text-xs text-gray-500">
      Your order (<span className="font-mono">{orderId.slice(0, 8)}…</span>) has been saved in
      pending status. You can complete payment later from the order detail page once checkout is
      enabled.
    </p>
  );
}
