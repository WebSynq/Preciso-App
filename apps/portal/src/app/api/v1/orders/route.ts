import { CreateKitOrderSchema } from '@preciso/schemas';
import type { CustodyEventType, OrderStatus } from '@preciso/types';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * POST /api/v1/orders
 *
 * Creates a new kit order for the authenticated provider.
 *
 * Ported from apps/api (Express) into the portal's Next.js route so order
 * submission works end-to-end on Vercel without a separate API host.
 *
 * Auth: Supabase JWT in `Authorization: Bearer <token>` header. The
 * provider_id is taken from the token — NEVER from the body — so a client
 * cannot create orders on behalf of another provider.
 *
 * Writes:
 *   - kit_orders row (provider_id = authenticated user)
 *   - custody_events row (event_type = 'ordered')
 *   - audit_logs row (action = 'order.created')
 *
 * SECURITY NOTE: The service role client bypasses RLS, so this handler is
 * the trust boundary. We explicitly re-assert the provider_id from the
 * verified JWT before every insert. Never accept provider_id from the body.
 *
 * GHL opportunity creation + FirstSource kit fulfilment are currently
 * stubs (see apps/api/src/integrations/*.stub.ts) and are not invoked
 * from this route yet. They will move to a background queue once the
 * real integrations are wired up — the current synchronous pattern does
 * not scale under production load.
 */
export async function POST(request: NextRequest) {
  try {
    // ─── Auth ────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
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
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    const providerId = user.id;

    // ─── Idempotency header (present in current portal client) ───────────
    // SECURITY NOTE: Keep validating this so retries don't double-write.
    // TODO: back with a short-TTL store (Redis) once Step 3 lands.
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (!idempotencyKey || idempotencyKey.length < 10 || idempotencyKey.length > 100) {
      return NextResponse.json(
        { error: 'X-Idempotency-Key header is required (10-100 chars).' },
        { status: 400 },
      );
    }

    // ─── Body validation ─────────────────────────────────────────────────
    const body = await request.json();
    const parsed = CreateKitOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid order data.', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { patientRef, panelType, deliveryAddress } = parsed.data;

    // ─── Service role client (trust boundary — this handler re-checks ID)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[api/orders] SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 },
      );
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } },
    );

    // ─── Insert kit_orders ───────────────────────────────────────────────
    const { data: order, error: orderError } = await adminClient
      .from('kit_orders')
      .insert({
        provider_id: providerId,
        patient_ref: patientRef,
        panel_type: panelType,
        order_status: 'submitted' satisfies OrderStatus,
        delivery_address: deliveryAddress,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('[api/orders] insert kit_orders failed', orderError);
      return NextResponse.json({ error: 'Failed to create order.' }, { status: 500 });
    }

    const orderId = order.id as string;

    // ─── Insert custody event ────────────────────────────────────────────
    const { error: custodyError } = await adminClient.from('custody_events').insert({
      kit_order_id: orderId,
      event_type: 'ordered' satisfies CustodyEventType,
      scanned_by: 'system',
      location: 'PRECISO Portal',
    });
    if (custodyError) {
      console.error('[api/orders] insert custody_events failed (non-blocking)', custodyError);
    }

    // ─── Write audit log (append-only, service role can INSERT) ──────────
    const { error: auditError } = await adminClient.from('audit_logs').insert({
      actor_id: providerId,
      actor_type: 'provider',
      action: 'order.created',
      resource_type: 'kit_orders',
      resource_id: orderId,
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
    });
    if (auditError) {
      console.error('[api/orders] insert audit_logs failed (non-blocking)', auditError);
    }

    console.warn('[Metric] order_created', { orderId, panelType, providerId });

    return NextResponse.json(
      {
        orderId,
        status: 'submitted',
        kitBarcode: null,
        estimatedShipDate: null,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[api/orders] unexpected error', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    );
  }
}
