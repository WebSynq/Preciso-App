import type { LabPartner, OrderStatus, ResultStatus } from '@preciso/types';

import { updateOpportunityFields, updateOpportunityStage } from '../integrations/ghl';
import { logAuditEvent } from '../integrations/vericense.stub';
import { createAdminClient } from '../lib/supabase';
import { writeAuditLog } from './audit-logger';

/**
 * Allowlisted hostnames that are permitted as report URL sources.
 * Add each lab partner's domain here when integrating live APIs.
 */
const ALLOWED_REPORT_HOSTS = new Set([
  'results.cenegenics.com',
  'portal.cenegenics.com',
  'api.sampled.com',
  'results.sampled.com',
]);

/**
 * Validates that a report URL is safe to store:
 *  - Must use https:// (no javascript:, data:, http:, etc.)
 *  - Hostname must be in the allowlist
 * Returns the validated URL string, or null if invalid.
 */
function validateReportUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    console.error('[ResultProcessor] reportUrl failed URL parse — rejected', { raw });
    return null;
  }
  if (parsed.protocol !== 'https:') {
    console.error('[ResultProcessor] reportUrl uses non-https scheme — rejected', {
      scheme: parsed.protocol,
    });
    return null;
  }
  if (!ALLOWED_REPORT_HOSTS.has(parsed.hostname)) {
    console.error('[ResultProcessor] reportUrl hostname not allowlisted — rejected', {
      hostname: parsed.hostname,
    });
    return null;
  }
  return parsed.toString();
}

/**
 * Payload shape for processing a lab result.
 */
export interface LabResultPayload {
  /** Maps to kit_orders.firstsource_order_id or kit_orders.kit_barcode */
  orderId?: string;
  kitBarcode?: string;
  labPartner: LabPartner;
  resultStatus: ResultStatus;
  resultRef: string;
  reportUrl?: string;
  completedAt: string;
  flaggedValues?: string[];
}

/**
 * Processes an incoming lab result through the full pipeline.
 *
 * Steps:
 *   1. Validate and look up the kit order
 *   2. Insert lab_results record
 *   3. Update kit_orders.order_status
 *   4. Insert custody event
 *   5. Update GHL opportunity
 *   6. Push to VeriCense audit ledger
 *   7. Write internal audit log
 *   8. Log CloudWatch metric
 */
export async function processLabResult(payload: LabResultPayload): Promise<{
  success: boolean;
  labResultId?: string;
  error?: string;
}> {
  const supabase = createAdminClient();

  try {
    // Step 1: Look up kit order by barcode or external order ID
    let kitOrderQuery = supabase.from('kit_orders').select('id, provider_id, ghl_opportunity_id, order_status');

    if (payload.kitBarcode) {
      kitOrderQuery = kitOrderQuery.eq('kit_barcode', payload.kitBarcode);
    } else if (payload.orderId) {
      kitOrderQuery = kitOrderQuery.eq('firstsource_order_id', payload.orderId);
    } else {
      return { success: false, error: 'No order identifier provided (orderId or kitBarcode).' };
    }

    const { data: kitOrder, error: lookupError } = await kitOrderQuery.single();

    if (lookupError || !kitOrder) {
      console.error('[ResultProcessor] Kit order not found', {
        orderId: payload.orderId,
        kitBarcode: payload.kitBarcode,
        error: lookupError?.message,
      });
      return { success: false, error: 'Kit order not found.' };
    }

    const kitOrderId = kitOrder.id as string;
    const providerId = kitOrder.provider_id as string;
    const ghlOpportunityId = kitOrder.ghl_opportunity_id as string | null;

    // Step 2: Insert lab_results record
    // Validate reportUrl before storage to prevent XSS and SSRF via stored URLs.
    const safeReportUrl = validateReportUrl(payload.reportUrl);

    const { data: labResult, error: insertError } = await supabase
      .from('lab_results')
      .insert({
        kit_order_id: kitOrderId,
        lab_partner: payload.labPartner,
        result_status: payload.resultStatus,
        result_received_at: payload.completedAt,
        report_url: safeReportUrl,
        raw_result_ref: payload.resultRef,
      })
      .select('id')
      .single();

    if (insertError || !labResult) {
      console.error('[ResultProcessor] Failed to insert lab result', {
        error: insertError?.message,
      });
      return { success: false, error: 'Failed to store lab result.' };
    }

    const labResultId = labResult.id as string;

    // Step 3: Update kit_orders status
    const newStatus: OrderStatus =
      payload.resultStatus === 'complete' || payload.resultStatus === 'flagged'
        ? 'report_ready'
        : 'resulted';

    await supabase
      .from('kit_orders')
      .update({ order_status: newStatus })
      .eq('id', kitOrderId);

    // Step 4: Insert custody event
    await supabase.from('custody_events').insert({
      kit_order_id: kitOrderId,
      event_type: 'result_uploaded',
      scanned_by: `${payload.labPartner}-system`,
      location: `${payload.labPartner} lab`,
      barcode: payload.kitBarcode || null,
    });

    // Step 5: Update GHL opportunity
    if (ghlOpportunityId) {
      try {
        await updateOpportunityStage(ghlOpportunityId, 'report_ready');
        await updateOpportunityFields(ghlOpportunityId, {
          preciso_order_status: newStatus,
          preciso_report_url: safeReportUrl || '',
          preciso_result_date: payload.completedAt,
          preciso_flagged: payload.flaggedValues && payload.flaggedValues.length > 0 ? 'true' : 'false',
        });
      } catch (ghlErr) {
        console.error('[ResultProcessor] GHL update failed (non-blocking)', ghlErr);
      }
    }

    // Step 6: Push to VeriCense audit ledger
    try {
      await logAuditEvent({
        eventType: 'lab_result_received',
        actorId: payload.labPartner,
        actorType: 'lab',
        resourceType: 'kit_orders',
        resourceId: kitOrderId,
        details: {
          labPartner: payload.labPartner,
          resultStatus: payload.resultStatus,
          // resultRef and reportUrl intentionally omitted — may contain PHI
        },
        timestamp: new Date().toISOString(),
      });
    } catch (vcErr) {
      console.error('[ResultProcessor] VeriCense audit push failed (non-blocking)', vcErr);
    }

    // Step 7: Write internal audit log
    await writeAuditLog({
      actorId: providerId,
      actorType: 'system',
      action: 'result.received',
      resourceType: 'lab_results',
      resourceId: labResultId,
    });

    // Step 8: CloudWatch metric
    console.warn('[Metric] lab_result_processed', {
      kitOrderId,
      labPartner: payload.labPartner,
      resultStatus: payload.resultStatus,
      flagged: payload.flaggedValues && payload.flaggedValues.length > 0,
    });

    return { success: true, labResultId };
  } catch (err) {
    console.error('[ResultProcessor] Unexpected error', err);
    return { success: false, error: 'Internal processing error.' };
  }
}
