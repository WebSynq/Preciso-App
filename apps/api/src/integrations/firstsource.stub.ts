/**
 * FirstSource Kit Fulfillment — STUB IMPLEMENTATION
 *
 * This is a typed stub that matches the expected FirstSource API interface.
 * Replace with live implementation in Phase 6 when API docs arrive from Jason.
 *
 * TODO — Confirm with FirstSource:
 *   - Expected endpoint URL
 *   - Auth method (API key header? OAuth2?)
 *   - Exact payload field names and required/optional fields
 *   - Response shape and status codes
 *   - Webhook callback URL for order status updates
 *   - Error codes (out of stock, invalid address, etc.)
 *   - Rate limits
 *   - Sandbox/test environment URL
 */

import { v4 as uuidv4 } from 'uuid';

export interface FirstSourceOrderPayload {
  providerNpi: string;
  panelType: 'newborn' | 'pediatric' | 'adult' | 'senior';
  deliveryAddress: {
    recipientName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zip: string;
    deliveryInstructions?: string;
  };
  internalRef: string;
  clinicalNotes?: string;
}

export interface FirstSourceOrderResponse {
  orderId: string;
  kitBarcode: string;
  estimatedShipDate: string;
  trackingNumber?: string;
}

/**
 * Submits a kit order to FirstSource.
 * STUB: Returns mock data. Logs full payload for documentation.
 */
export async function submitOrder(
  payload: FirstSourceOrderPayload,
): Promise<FirstSourceOrderResponse> {
  // Log the full payload for future reference when building live integration
  console.warn('[FirstSource STUB] Order submitted — payload logged for documentation', {
    label: 'FIRSTSOURCE_ORDER_PAYLOAD',
    payload,
    timestamp: new Date().toISOString(),
  });

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 200));

  const mockResponse: FirstSourceOrderResponse = {
    orderId: `FS-${uuidv4().slice(0, 8).toUpperCase()}`,
    kitBarcode: `KIT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    estimatedShipDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
  };

  console.warn('[FirstSource STUB] Mock response generated', {
    label: 'FIRSTSOURCE_ORDER_RESPONSE',
    response: mockResponse,
  });

  return mockResponse;
}

/**
 * Checks the status of an existing order with FirstSource.
 * STUB: Always returns "processing".
 */
export async function getOrderStatus(
  orderId: string,
): Promise<{ orderId: string; status: string }> {
  console.warn('[FirstSource STUB] Status check', { orderId });
  return { orderId, status: 'processing' };
}
