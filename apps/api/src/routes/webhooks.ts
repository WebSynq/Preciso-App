import type { CustodyEventType, OrderStatus } from '@preciso/types';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { updateOpportunityStage, triggerWorkflow } from '../integrations/ghl';
import { logAuditEvent } from '../integrations/vericense.stub';
import { createAdminClient } from '../lib/supabase';
import {
  fedexWebhookAuth,
  cenegenicsWebhookAuth,
  sampledWebhookAuth,
} from '../middleware/webhook-auth';
import { writeAuditLog } from '../services/audit-logger';
import { processLabResult } from '../services/result-processor';

const router = Router();

/** Rate limit: 100 webhooks per minute per source IP */
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(webhookRateLimit);

// ─────────────────────────────────────────────────────────────────────────────
// FedEx / 3PL Tracking Webhook
// POST /webhooks/tracking
// ─────────────────────────────────────────────────────────────────────────────

interface FedExTrackingEvent {
  trackingNumber: string;
  eventType: 'shipped' | 'out_for_delivery' | 'delivered';
  eventTimestamp: string;
  location?: string;
  details?: string;
}

/** Maps FedEx event types to PRECISO order statuses */
const TRACKING_STATUS_MAP: Record<string, OrderStatus> = {
  shipped: 'in_transit',
  out_for_delivery: 'in_transit',
  delivered: 'delivered',
};

/** Maps FedEx event types to custody event types */
const TRACKING_CUSTODY_MAP: Record<string, CustodyEventType> = {
  shipped: 'kit_shipped',
  delivered: 'kit_delivered',
};

/** Maps FedEx event types to GHL pipeline stages */
const TRACKING_GHL_MAP: Record<string, 'kit_in_transit' | 'kit_delivered'> = {
  shipped: 'kit_in_transit',
  out_for_delivery: 'kit_in_transit',
  delivered: 'kit_delivered',
};

router.post('/tracking', fedexWebhookAuth, async (req, res) => {
  try {
    const event = req.body as FedExTrackingEvent;

    console.warn('[Webhook] FedEx tracking event received', {
      label: 'FEDEX_TRACKING_EVENT',
      trackingNumber: event.trackingNumber,
      eventType: event.eventType,
      timestamp: event.eventTimestamp,
    });

    const supabase = createAdminClient();

    // Look up order by tracking number
    const { data: order, error: lookupError } = await supabase
      .from('kit_orders')
      .select('id, provider_id, kit_barcode, ghl_opportunity_id')
      .eq('tracking_number', event.trackingNumber)
      .single();

    if (lookupError || !order) {
      console.error('[Webhook] FedEx: no order found for tracking number', {
        trackingNumber: event.trackingNumber,
      });
      // Return 200 to acknowledge — don't make FedEx retry for unknown tracking numbers
      res.json({ received: true, matched: false });
      return;
    }

    const orderId = order.id as string;
    const providerId = order.provider_id as string;
    const ghlOpportunityId = order.ghl_opportunity_id as string | null;

    // Update order status
    const newStatus = TRACKING_STATUS_MAP[event.eventType];
    if (newStatus) {
      await supabase
        .from('kit_orders')
        .update({ order_status: newStatus })
        .eq('id', orderId);
    }

    // Insert custody event
    const custodyType = TRACKING_CUSTODY_MAP[event.eventType];
    if (custodyType) {
      await supabase.from('custody_events').insert({
        kit_order_id: orderId,
        event_type: custodyType,
        scanned_by: 'fedex-system',
        location: event.location || 'FedEx',
        barcode: order.kit_barcode as string | null,
      });
    }

    // Advance GHL pipeline stage
    const ghlStage = TRACKING_GHL_MAP[event.eventType];
    if (ghlOpportunityId && ghlStage) {
      try {
        await updateOpportunityStage(ghlOpportunityId, ghlStage);
      } catch (ghlErr) {
        console.error('[Webhook] FedEx: GHL stage update failed (non-blocking)', ghlErr);
      }
    }

    // If delivered: trigger GHL notification workflow to provider
    if (event.eventType === 'delivered' && ghlOpportunityId) {
      try {
        // Look up provider's GHL contact ID
        const { data: provider } = await supabase
          .from('providers')
          .select('ghl_contact_id')
          .eq('id', providerId)
          .single();

        if (provider?.ghl_contact_id) {
          const deliveryWorkflowId = process.env.GHL_DELIVERY_WORKFLOW_ID;
          if (deliveryWorkflowId) {
            await triggerWorkflow(
              deliveryWorkflowId,
              provider.ghl_contact_id as string,
            );
          }
        }
      } catch (notifErr) {
        console.error('[Webhook] FedEx: delivery notification failed (non-blocking)', notifErr);
      }
    }

    // Push to VeriCense audit ledger
    try {
      await logAuditEvent({
        eventType: `tracking.${event.eventType}`,
        actorId: 'fedex-system',
        actorType: 'logistics',
        resourceType: 'kit_orders',
        resourceId: orderId,
        details: {
          trackingNumber: event.trackingNumber,
          eventType: event.eventType,
          location: event.location || '',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (vcErr) {
      console.error('[Webhook] FedEx: VeriCense audit push failed (non-blocking)', vcErr);
    }

    // Write internal audit log
    await writeAuditLog({
      actorId: providerId,
      actorType: 'system',
      action: `tracking.${event.eventType}`,
      resourceType: 'kit_orders',
      resourceId: orderId,
    });

    console.warn('[Webhook] FedEx tracking processed', {
      orderId,
      eventType: event.eventType,
      newStatus,
    });

    res.json({ received: true, matched: true, orderId });
  } catch (err) {
    console.error('[Webhook] FedEx processing error', err);
    res.status(500).json({ error: 'Internal processing error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cenegenics Lab Result Webhook (STUB)
// POST /webhooks/lab/cenegenics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected payload from Cenegenics (to be confirmed in IT call).
 *
 * TODO — Confirm with Cenegenics IT:
 *   - Exact field names and types
 *   - HL7/FHIR format specifics
 *   - Result delivery cadence
 *   - Error/retry behavior
 *   - Flagged value codes and meanings
 */
interface CenegenicsResultPayload {
  orderId: string;
  kitBarcode: string;
  resultStatus: 'complete' | 'flagged' | 'failed';
  resultRef: string;
  reportUrl?: string;
  completedAt: string;
  flaggedValues?: string[];
}

router.post('/lab/cenegenics', cenegenicsWebhookAuth, async (req, res) => {
  try {
    const payload = req.body as CenegenicsResultPayload;

    // Log non-PHI metadata only — resultRef, flaggedValues, and reportUrl may contain PHI
    console.warn('[Webhook] Cenegenics result received', {
      label: 'CENEGENICS_RESULT_RECEIVED',
      orderId: payload.orderId,
      kitBarcode: payload.kitBarcode,
      resultStatus: payload.resultStatus,
      completedAt: payload.completedAt,
      timestamp: new Date().toISOString(),
    });

    // Process through the result pipeline
    const result = await processLabResult({
      orderId: payload.orderId,
      kitBarcode: payload.kitBarcode,
      labPartner: 'cenegenics',
      resultStatus: payload.resultStatus,
      resultRef: payload.resultRef,
      reportUrl: payload.reportUrl,
      completedAt: payload.completedAt,
      flaggedValues: payload.flaggedValues,
    });

    if (!result.success) {
      console.error('[Webhook] Cenegenics result processing failed', {
        error: result.error,
      });
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true, processed: result.success, labResultId: result.labResultId });
  } catch (err) {
    console.error('[Webhook] Cenegenics processing error', err);
    res.status(500).json({ error: 'Internal processing error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Sampled Lab Result Webhook (STUB)
// POST /webhooks/lab/sampled
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected payload from Sampled (to be confirmed after pilot agreement).
 *
 * TODO — Confirm with Sampled:
 *   - API documentation URL
 *   - Auth method for webhook callbacks
 *   - Payload format (may differ from Cenegenics)
 *   - Pilot validation requirements
 */
interface SampledResultPayload {
  orderId: string;
  kitBarcode: string;
  resultStatus: 'complete' | 'flagged' | 'failed';
  resultRef: string;
  reportUrl?: string;
  completedAt: string;
  flaggedValues?: string[];
}

router.post('/lab/sampled', sampledWebhookAuth, async (req, res) => {
  try {
    const payload = req.body as SampledResultPayload;

    // Log non-PHI metadata only
    console.warn('[Webhook] Sampled result received', {
      label: 'SAMPLED_RESULT_RECEIVED',
      orderId: payload.orderId,
      kitBarcode: payload.kitBarcode,
      resultStatus: payload.resultStatus,
      completedAt: payload.completedAt,
      timestamp: new Date().toISOString(),
    });

    // Process through the result pipeline
    const result = await processLabResult({
      orderId: payload.orderId,
      kitBarcode: payload.kitBarcode,
      labPartner: 'sampled',
      resultStatus: payload.resultStatus,
      resultRef: payload.resultRef,
      reportUrl: payload.reportUrl,
      completedAt: payload.completedAt,
      flaggedValues: payload.flaggedValues,
    });

    if (!result.success) {
      console.error('[Webhook] Sampled result processing failed', {
        error: result.error,
      });
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true, processed: result.success, labResultId: result.labResultId });
  } catch (err) {
    console.error('[Webhook] Sampled processing error', err);
    res.status(500).json({ error: 'Internal processing error.' });
  }
});

export default router;
