import type { CustodyEventType, OrderStatus } from '@preciso/types';

/**
 * Valid state transitions for the chain-of-custody flow.
 * Each key is the current order status, values are the allowed custody event types.
 *
 * Flow:
 *   ordered → kit_shipped (triggered by FirstSource)
 *   kit_shipped → kit_delivered (triggered by FedEx webhook)
 *   kit_delivered → specimen_collected (triggered by barcode scan)
 *   specimen_collected → specimen_shipped (triggered by barcode scan)
 *   specimen_shipped → lab_received (triggered by barcode scan or lab webhook)
 *   lab_received → sequencing_started (triggered by lab webhook)
 *   sequencing_started → sequencing_complete (triggered by lab webhook)
 *   sequencing_complete → result_uploaded (triggered by lab result webhook)
 */
const VALID_TRANSITIONS: Record<string, CustodyEventType[]> = {
  pending: ['ordered'],
  submitted: ['ordered', 'kit_shipped'],
  fulfilled: ['kit_shipped'],
  in_transit: ['kit_delivered'],
  delivered: ['specimen_collected'],
  specimen_collected: ['specimen_shipped'],
  at_lab: ['sequencing_started'],
  sequencing: ['sequencing_complete'],
  resulted: ['result_uploaded'],
  report_ready: [],
  cancelled: [],
};

/**
 * Maps custody event types to the resulting order status.
 */
const EVENT_TO_STATUS: Record<CustodyEventType, OrderStatus> = {
  ordered: 'submitted',
  kit_shipped: 'in_transit',
  kit_delivered: 'delivered',
  specimen_collected: 'specimen_collected',
  specimen_shipped: 'at_lab',
  lab_received: 'at_lab',
  sequencing_started: 'sequencing',
  sequencing_complete: 'resulted',
  result_uploaded: 'report_ready',
};

/**
 * Maps custody event types to GHL pipeline stages.
 */
const EVENT_TO_GHL_STAGE: Record<string, string> = {
  ordered: 'kit_ordered',
  kit_shipped: 'kit_in_transit',
  kit_delivered: 'kit_delivered',
  specimen_collected: 'specimen_collected',
  specimen_shipped: 'specimen_in_transit',
  lab_received: 'lab_received',
  sequencing_started: 'sequencing',
  sequencing_complete: 'results_received',
  result_uploaded: 'report_ready',
};

export interface ValidationResult {
  valid: boolean;
  newOrderStatus?: OrderStatus;
  ghlStage?: string;
  reason?: string;
}

/**
 * Validates whether a custody event type is a valid transition
 * from the current order status.
 *
 * Returns the new order status if valid, or a rejection reason if not.
 */
export function validateCustodyTransition(
  currentStatus: OrderStatus,
  eventType: CustodyEventType,
): ValidationResult {
  const allowedEvents = VALID_TRANSITIONS[currentStatus];

  if (!allowedEvents) {
    const reason = `Unknown order status: ${currentStatus}`;
    console.warn('[CustodyValidator] Rejected — unknown status', {
      currentStatus,
      eventType,
      reason,
    });
    return { valid: false, reason };
  }

  if (!allowedEvents.includes(eventType)) {
    const reason = `Invalid transition: cannot apply '${eventType}' when order status is '${currentStatus}'. Allowed events: [${allowedEvents.join(', ') || 'none'}]`;
    console.warn('[CustodyValidator] Rejected — invalid transition', {
      currentStatus,
      eventType,
      allowedEvents,
      reason,
    });
    return { valid: false, reason };
  }

  return {
    valid: true,
    newOrderStatus: EVENT_TO_STATUS[eventType],
    ghlStage: EVENT_TO_GHL_STAGE[eventType],
  };
}
