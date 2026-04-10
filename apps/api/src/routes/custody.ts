import { CustodyEventSchema } from '@preciso/schemas';
import type { CustodyEventType, OrderStatus } from '@preciso/types';
import { Router } from 'express';

import { type GhlPipelineStage, updateOpportunityStage } from '../integrations/ghl';
import { logAuditEvent } from '../integrations/vericense.stub';
import { createAdminClient, createUserClient } from '../lib/supabase';
import { requireApiKey } from '../middleware/api-key-auth';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { writeAuditLog } from '../services/audit-logger';
import { validateCustodyTransition } from '../services/custody-validator';

const router = Router();

/**
 * POST /api/v1/custody/scan
 * Records a barcode scan event in the chain of custody.
 *
 * Auth: System API key (not provider JWT — called by scan hardware/apps)
 *
 * Payload:
 *   { barcode, eventType, location, scannedBy }
 *
 * Logic:
 *   1. Validate API key
 *   2. Validate payload with Zod
 *   3. Look up kit_order by barcode
 *   4. Validate state transition
 *   5. Insert custody event
 *   6. Update order status
 *   7. Advance GHL pipeline
 *   8. Push VeriCense audit event
 *   9. If lab_received: log sequencing notification
 */
router.post('/scan', requireApiKey, async (req, res, next) => {
  try {
    // Validate payload
    const parsed = CustodyEventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid scan data.', parsed.error.message);
    }

    const { barcode, eventType, location, scannedBy } = parsed.data;
    const supabase = createAdminClient();

    // Look up kit order by barcode
    const { data: order, error: lookupError } = await supabase
      .from('kit_orders')
      .select('id, provider_id, order_status, ghl_opportunity_id')
      .eq('kit_barcode', barcode)
      .single();

    if (lookupError || !order) {
      throw new AppError(404, 'No order found for this barcode.');
    }

    const orderId = order.id as string;
    const providerId = order.provider_id as string;
    const currentStatus = order.order_status as OrderStatus;
    const ghlOpportunityId = order.ghl_opportunity_id as string | null;

    // Validate state transition
    const validation = validateCustodyTransition(
      currentStatus,
      eventType as CustodyEventType,
    );

    if (!validation.valid) {
      throw new AppError(
        409,
        `Invalid scan: ${validation.reason}`,
      );
    }

    // Insert custody event
    const { error: insertError } = await supabase.from('custody_events').insert({
      kit_order_id: orderId,
      event_type: eventType,
      scanned_by: scannedBy,
      location,
      barcode,
    });

    if (insertError) {
      throw new AppError(500, 'Failed to record scan event.');
    }

    // Update order status
    if (validation.newOrderStatus) {
      await supabase
        .from('kit_orders')
        .update({ order_status: validation.newOrderStatus })
        .eq('id', orderId);
    }

    // Advance GHL pipeline
    if (ghlOpportunityId && validation.ghlStage) {
      try {
        await updateOpportunityStage(
          ghlOpportunityId,
          validation.ghlStage as GhlPipelineStage,
        );
      } catch (ghlErr) {
        console.error('[Custody] GHL stage update failed (non-blocking)', ghlErr);
      }
    }

    // Push VeriCense audit event
    try {
      const vcResult = await logAuditEvent({
        eventType: `custody.${eventType}`,
        actorId: scannedBy,
        actorType: 'system',
        resourceType: 'kit_orders',
        resourceId: orderId,
        details: {
          barcode,
          eventType,
          location,
          scannedBy,
          previousStatus: currentStatus,
          newStatus: validation.newOrderStatus || currentStatus,
        },
        timestamp: new Date().toISOString(),
      });

      // Store VeriCense reference on the custody event
      if (vcResult.referenceId) {
        await supabase
          .from('custody_events')
          .update({ vericense_audit_ref: vcResult.referenceId })
          .eq('kit_order_id', orderId)
          .eq('event_type', eventType)
          .order('created_at', { ascending: false })
          .limit(1);
      }
    } catch (vcErr) {
      console.error('[Custody] VeriCense audit push failed (non-blocking)', vcErr);
    }

    // Write internal audit log
    await writeAuditLog({
      actorId: providerId,
      actorType: 'system',
      action: `custody.${eventType}`,
      resourceType: 'kit_orders',
      resourceId: orderId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // If lab_received: log notification for provider
    if (eventType === 'lab_received') {
      console.warn('[Custody] Lab received — sequencing notification triggered', {
        orderId,
        barcode,
        providerId,
      });
    }

    // CloudWatch metric
    console.warn('[Metric] custody_scan', {
      orderId,
      eventType,
      barcode,
      location,
    });

    res.status(201).json({
      success: true,
      orderId,
      eventType,
      newStatus: validation.newOrderStatus,
      ghlStage: validation.ghlStage,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/custody/:barcode
 * Returns the full custody history for a barcode.
 *
 * Auth: Provider JWT — only returns data if the barcode belongs to the provider's order.
 */
router.get('/:barcode', requireAuth, async (req, res, next) => {
  try {
    const barcode = req.params.barcode!;
    const userClient = createUserClient(req.accessToken!);

    // Look up the order by barcode (RLS ensures provider can only see their own)
    const { data: order, error: orderError } = await userClient
      .from('kit_orders')
      .select('id, provider_id, panel_type, order_status, kit_barcode, tracking_number, created_at')
      .eq('kit_barcode', barcode)
      .single();

    if (orderError || !order) {
      throw new AppError(404, 'No order found for this barcode.');
    }

    // Fetch custody events (RLS scoped through kit_orders)
    const { data: events, error: eventsError } = await userClient
      .from('custody_events')
      .select('*')
      .eq('kit_order_id', order.id)
      .order('created_at', { ascending: true });

    if (eventsError) {
      throw new AppError(500, 'Failed to retrieve custody history.');
    }

    res.json({
      barcode,
      order,
      custodyEvents: events || [],
      totalEvents: events?.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
