import type { PaymentStatus } from '@preciso/types';
import { getOrCreateRequestId, rateLimit } from '@preciso/utils';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { createPaymentIntent, getPanelPricing } from '@/lib/stripe/server';

/**
 * POST /api/v1/payments/checkout
 *
 * Creates (or re-fetches) a Stripe PaymentIntent for a kit order the
 * authenticated provider owns. Returns the publishable client_secret so
 * the browser can confirm the payment via Stripe Elements.
 *
 * Request body:  { orderId: string }
 * Response 200:  { clientSecret, paymentIntentId, amountCents, currency, panelType }
 *
 * SECURITY INVARIANTS
 *   - provider_id is read from the verified JWT — never the body.
 *   - Order ownership is re-checked here; the service role bypasses RLS.
 *   - Price is computed server-side from panel_type. We never trust an
 *     amount sent by the client.
 *   - NO PHI is forwarded to Stripe. The stripe helper enforces this at
 *     the type level (see apps/portal/src/lib/stripe/server.ts).
 *   - Idempotent: Stripe PI create with key `checkout-<orderId>` returns
 *     the same PaymentIntent for repeat calls, so retries never
 *     double-charge.
 *   - Rate-limited to 20 checkout starts / hour / provider.
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get('x-request-id'));
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // ─── Auth ────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.', requestId },
        { status: 401, headers: { 'x-request-id': requestId } },
      );
    }
    const token = authHeader.slice(7);

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token.', requestId },
        { status: 401, headers: { 'x-request-id': requestId } },
      );
    }

    const providerId = user.id;

    // ─── Rate limit: 20 checkout starts / hour / provider ────────────────
    const rl = await rateLimit({
      identifier: `checkout-start:${providerId}`,
      windowSeconds: 60 * 60,
      maxRequests: 20,
    });
    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'Checkout rate limit exceeded. Please try again later.',
          requestId,
          retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'x-request-id': requestId,
            'x-ratelimit-limit': String(rl.limit),
            'x-ratelimit-remaining': String(rl.remaining),
          },
        },
      );
    }

    // ─── Body ────────────────────────────────────────────────────────────
    const body = (await request.json()) as { orderId?: unknown };
    const orderId = typeof body.orderId === 'string' ? body.orderId : null;
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json(
        { error: 'orderId (UUID) is required.', requestId },
        { status: 400, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Service role client + ownership re-check ────────────────────────
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[api/checkout] SUPABASE_SERVICE_ROLE_KEY missing', { requestId });
      return NextResponse.json(
        { error: 'Server configuration error.', requestId },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } },
    );

    const { data: order, error: orderErr } = await adminClient
      .from('kit_orders')
      .select('id, provider_id, panel_type, payment_status, stripe_payment_intent_id, amount_cents, currency')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json(
        { error: 'Order not found.', requestId },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }
    if (order.provider_id !== providerId) {
      // Treat as 404 to avoid leaking existence of other providers' orders.
      return NextResponse.json(
        { error: 'Order not found.', requestId },
        { status: 404, headers: { 'x-request-id': requestId } },
      );
    }
    if (order.payment_status === 'succeeded' || order.payment_status === 'refunded') {
      return NextResponse.json(
        { error: 'Order is already paid.', requestId },
        { status: 409, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Price (server-authoritative) ────────────────────────────────────
    const panelType = order.panel_type as 'newborn' | 'pediatric' | 'adult' | 'senior';
    const { amountCents } = getPanelPricing(panelType);

    // ─── Fetch provider (email + cached Stripe customer id) ──────────────
    const { data: provider, error: providerErr } = await adminClient
      .from('providers')
      .select('email, stripe_customer_id')
      .eq('id', providerId)
      .single();
    if (providerErr || !provider) {
      console.error('[api/checkout] provider lookup failed', { requestId, providerErr });
      return NextResponse.json(
        { error: 'Provider record not found.', requestId },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Create / retrieve PaymentIntent ─────────────────────────────────
    const { result, customerId } = await createPaymentIntent(
      {
        kitOrderId: orderId,
        providerId,
        providerEmail: provider.email,
        amountCents,
        currency: 'usd',
        panelType,
        idempotencyKey: `checkout-${orderId}`,
      },
      provider.stripe_customer_id,
    );

    // ─── Cache stripe_customer_id on provider (first payment only) ───────
    if (!provider.stripe_customer_id) {
      const { error: updProviderErr } = await adminClient
        .from('providers')
        .update({ stripe_customer_id: customerId })
        .eq('id', providerId);
      if (updProviderErr) {
        console.error('[api/checkout] cache stripe_customer_id failed', {
          requestId,
          updProviderErr,
        });
      }
    }

    // ─── Link PI back to order + mark payment pending ────────────────────
    // We move to 'pending' only if we were at 'none' — never downgrade a
    // later webhook-driven state.
    const shouldMark = order.payment_status === 'none';
    const { error: updOrderErr } = await adminClient
      .from('kit_orders')
      .update({
        stripe_payment_intent_id: result.paymentIntentId,
        amount_cents: amountCents,
        currency: 'usd',
        ...(shouldMark ? { payment_status: 'pending' satisfies PaymentStatus } : {}),
      })
      .eq('id', orderId);
    if (updOrderErr) {
      console.error('[api/checkout] link PI to order failed', { requestId, updOrderErr });
      return NextResponse.json(
        { error: 'Failed to attach payment to order.', requestId },
        { status: 500, headers: { 'x-request-id': requestId } },
      );
    }

    // ─── Audit ───────────────────────────────────────────────────────────
    await adminClient.from('audit_logs').insert({
      actor_id: providerId,
      actor_type: 'provider',
      action: 'payment.checkout_started',
      resource_type: 'kit_orders',
      resource_id: orderId,
      ip_address: clientIp !== 'unknown' ? clientIp : null,
      user_agent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json(
      {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        amountCents: result.amountCents,
        currency: result.currency,
        panelType,
        requestId,
      },
      {
        status: 200,
        headers: {
          'x-request-id': requestId,
          'cache-control': 'no-store',
        },
      },
    );
  } catch (err) {
    console.error('[api/checkout] unexpected', { requestId, err });
    return NextResponse.json(
      { error: 'An unexpected error occurred.', requestId },
      { status: 500, headers: { 'x-request-id': requestId } },
    );
  }
}
