import { CreateKitOrderSchema } from '@preciso/schemas';
import type { CustodyEventType, OrderStatus } from '@preciso/types';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { createOpportunity } from '../integrations/ghl';
import { submitOrder } from '../integrations/firstsource.stub';
import { createAdminClient, createUserClient } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { requireIdempotency } from '../middleware/idempotency';
import { writeAuditLog } from '../services/audit-logger';

const router = Router();

/** Rate limit: 10 orders per provider per hour */
const orderRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: { error: 'Order rate limit exceeded. Maximum 10 orders per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/v1/orders
 * Creates a new kit order.
 *
 * Security:
 *   - Requires valid Supabase JWT
 *   - provider_id extracted from JWT (never from body)
 *   - Idempotency key required
 *   - Rate limited: 10/hour per provider
 */
router.post('/', requireAuth, orderRateLimit, requireIdempotency, async (req, res, next) => {
  try {
    const providerId = req.user!.id;

    // Validate request body
    const parsed = CreateKitOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid order data.', parsed.error.message);
    }

    const { patientRef, panelType, clinicalNotes, deliveryAddress } = parsed.data;

    const adminClient = createAdminClient();

    // Look up provider to get GHL contact ID and NPI
    const { data: provider, error: providerError } = await adminClient
      .from('providers')
      .select('ghl_contact_id, npi_number, first_name, last_name')
      .eq('id', providerId)
      .single();

    if (providerError || !provider) {
      throw new AppError(404, 'Provider not found.');
    }

    // Insert kit_orders record (status: pending)
    const { data: order, error: orderError } = await adminClient
      .from('kit_orders')
      .insert({
        provider_id: providerId,
        patient_ref: patientRef,
        panel_type: panelType,
        order_status: 'pending' satisfies OrderStatus,
        delivery_address: deliveryAddress,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      throw new AppError(500, 'Failed to create order.');
    }

    const orderId = order.id as string;

    // Fire GHL: create opportunity
    let ghlOpportunityId: string | null = null;
    try {
      if (provider.ghl_contact_id) {
        ghlOpportunityId = await createOpportunity(providerId, {
          contactId: provider.ghl_contact_id,
          panelType,
          patientRef,
          orderDate: new Date().toISOString().split('T')[0]!,
        });
      }
    } catch (ghlErr) {
      // Log but don't fail the order — GHL is non-blocking
      console.error('[Orders] GHL opportunity creation failed', ghlErr);
    }

    // Fire FirstSource stub
    let firstsourceOrderId: string | null = null;
    let kitBarcode: string | null = null;
    let estimatedShipDate: string | null = null;
    try {
      const fsResult = await submitOrder({
        providerNpi: provider.npi_number || '',
        panelType,
        deliveryAddress,
        internalRef: patientRef,
        clinicalNotes,
      });
      firstsourceOrderId = fsResult.orderId;
      kitBarcode = fsResult.kitBarcode;
      estimatedShipDate = fsResult.estimatedShipDate;
    } catch (fsErr) {
      console.error('[Orders] FirstSource submission failed', fsErr);
    }

    // Update order with external IDs, advance status to submitted
    await adminClient
      .from('kit_orders')
      .update({
        order_status: 'submitted' satisfies OrderStatus,
        firstsource_order_id: firstsourceOrderId,
        kit_barcode: kitBarcode,
        ghl_opportunity_id: ghlOpportunityId,
      })
      .eq('id', orderId);

    // Insert custody event: ordered
    await adminClient.from('custody_events').insert({
      kit_order_id: orderId,
      event_type: 'ordered' satisfies CustodyEventType,
      scanned_by: 'system',
      location: 'PRECISO Portal',
      barcode: kitBarcode,
    });

    // Write audit log
    await writeAuditLog({
      actorId: providerId,
      actorType: 'provider',
      action: 'order.created',
      resourceType: 'kit_orders',
      resourceId: orderId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // CloudWatch metric placeholder
    console.warn('[Metric] order_created', { orderId, panelType, providerId });

    res.status(201).json({
      orderId,
      status: 'submitted',
      estimatedShipDate,
      kitBarcode,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders
 * Lists the authenticated provider's orders (paginated).
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const providerId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const userClient = createUserClient(req.accessToken!);

    const { data: orders, error, count } = await userClient
      .from('kit_orders')
      .select('*', { count: 'exact' })
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError(500, 'Failed to retrieve orders.');
    }

    res.json({
      orders: orders || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/orders/:orderId
 * Gets a single order with its custody events.
 */
router.get('/:orderId', requireAuth, async (req, res, next) => {
  try {
    const userClient = createUserClient(req.accessToken!);
    const orderId = req.params.orderId!;

    const { data: order, error } = await userClient
      .from('kit_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new AppError(404, 'Order not found.');
    }

    // Fetch custody events for this order
    const { data: custodyEvents } = await userClient
      .from('custody_events')
      .select('*')
      .eq('kit_order_id', orderId)
      .order('created_at', { ascending: true });

    // Fetch lab results if any
    const { data: labResults } = await userClient
      .from('lab_results')
      .select('*')
      .eq('kit_order_id', orderId);

    res.json({
      order,
      custodyEvents: custodyEvents || [],
      labResults: labResults || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/orders/:orderId/cancel
 * Cancels an order (only if status is pending or submitted).
 */
router.post('/:orderId/cancel', requireAuth, async (req, res, next) => {
  try {
    const providerId = req.user!.id;
    const orderId = req.params.orderId!;

    const adminClient = createAdminClient();

    // Verify order exists and belongs to this provider
    const { data: order, error } = await adminClient
      .from('kit_orders')
      .select('id, order_status, provider_id')
      .eq('id', orderId)
      .eq('provider_id', providerId)
      .single();

    if (error || !order) {
      throw new AppError(404, 'Order not found.');
    }

    const cancellableStatuses = ['pending', 'submitted'];
    if (!cancellableStatuses.includes(order.order_status as string)) {
      throw new AppError(400, 'Order cannot be cancelled in its current status.');
    }

    await adminClient
      .from('kit_orders')
      .update({ order_status: 'cancelled' satisfies OrderStatus })
      .eq('id', orderId);

    await writeAuditLog({
      actorId: providerId,
      actorType: 'provider',
      action: 'order.cancelled',
      resourceType: 'kit_orders',
      resourceId: orderId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ orderId, status: 'cancelled' });
  } catch (err) {
    next(err);
  }
});

export default router;
