/**
 * GoHighLevel API v2 integration.
 * Manages contacts, opportunities, and workflow triggers.
 *
 * GHL Pipeline: "PRECISO Kit Orders"
 * Stages: Kit Ordered → Order Submitted to Fulfillment → Kit In Transit →
 *   Kit Delivered → Specimen Collected → Specimen In Transit → Lab Received →
 *   Sequencing → Results Received → Report Ready → Report Delivered
 *
 * Custom fields on Opportunity:
 *   preciso_panel_type, preciso_patient_ref, preciso_kit_barcode,
 *   preciso_order_status, preciso_firstsource_order_id, preciso_result_date,
 *   preciso_report_url, preciso_flagged
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

interface GhlRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

/**
 * Makes an authenticated request to the GHL API v2.
 */
async function ghlRequest<T>({ method, path, body }: GhlRequestOptions): Promise<T> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error('GHL_API_KEY not configured');
  }

  const response = await fetch(`${GHL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GHL API Error]', { status: response.status, path, body: errorText });
    throw new Error(`GHL API error: ${response.status}`);
  }

  return (await response.json()) as T;
}

// ─── Pipeline Stage Mapping ──────────────────────────────────────────────────

export const GHL_PIPELINE_STAGES = {
  kit_ordered: 'Kit Ordered',
  order_submitted: 'Order Submitted to Fulfillment',
  kit_in_transit: 'Kit In Transit',
  kit_delivered: 'Kit Delivered',
  specimen_collected: 'Specimen Collected',
  specimen_in_transit: 'Specimen In Transit',
  lab_received: 'Lab Received',
  sequencing: 'Sequencing',
  results_received: 'Results Received',
  report_ready: 'Report Ready',
  report_delivered: 'Report Delivered',
} as const;

export type GhlPipelineStage = keyof typeof GHL_PIPELINE_STAGES;

// ─── Contact Methods ─────────────────────────────────────────────────────────

interface CreateContactData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tags?: string[];
}

interface GhlContactResponse {
  contact: { id: string };
}

/**
 * Creates a contact in GHL. Used during provider registration.
 */
export async function createContact(data: CreateContactData): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error('GHL_LOCATION_ID not configured');
  }

  const result = await ghlRequest<GhlContactResponse>({
    method: 'POST',
    path: '/contacts/',
    body: {
      locationId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      tags: data.tags || ['preciso-provider'],
    },
  });

  return result.contact.id;
}

// ─── Opportunity Methods ─────────────────────────────────────────────────────

interface CreateOpportunityData {
  contactId: string;
  panelType: string;
  patientRef: string;
  orderDate: string;
}

interface GhlOpportunityResponse {
  opportunity: { id: string };
}

/**
 * Creates an opportunity in the PRECISO Kit Orders pipeline.
 */
export async function createOpportunity(
  providerId: string,
  data: CreateOpportunityData,
): Promise<string> {
  const pipelineId = process.env.GHL_PIPELINE_ID;
  if (!pipelineId) {
    throw new Error('GHL_PIPELINE_ID not configured');
  }

  const result = await ghlRequest<GhlOpportunityResponse>({
    method: 'POST',
    path: '/opportunities/',
    body: {
      pipelineId,
      locationId: process.env.GHL_LOCATION_ID,
      name: `Kit Order - ${data.panelType} - ${data.orderDate}`,
      stageId: GHL_PIPELINE_STAGES.kit_ordered,
      contactId: data.contactId,
      status: 'open',
      customFields: [
        { key: 'preciso_panel_type', value: data.panelType },
        { key: 'preciso_patient_ref', value: data.patientRef },
        { key: 'preciso_order_status', value: 'pending' },
      ],
    },
  });

  console.warn('[GHL] Opportunity created', {
    opportunityId: result.opportunity.id,
    providerId,
  });

  return result.opportunity.id;
}

/**
 * Advances an opportunity to a new pipeline stage.
 */
export async function updateOpportunityStage(
  opportunityId: string,
  stage: GhlPipelineStage,
): Promise<void> {
  await ghlRequest({
    method: 'PUT',
    path: `/opportunities/${opportunityId}`,
    body: {
      stageId: GHL_PIPELINE_STAGES[stage],
    },
  });

  console.warn('[GHL] Opportunity stage updated', { opportunityId, stage });
}

/**
 * Updates custom fields on an opportunity.
 */
export async function updateOpportunityFields(
  opportunityId: string,
  fields: Record<string, string>,
): Promise<void> {
  const customFields = Object.entries(fields).map(([key, value]) => ({
    key,
    value,
  }));

  await ghlRequest({
    method: 'PUT',
    path: `/opportunities/${opportunityId}`,
    body: { customFields },
  });

  console.warn('[GHL] Opportunity fields updated', { opportunityId, fieldCount: customFields.length });
}

/**
 * Triggers a GHL workflow for a given contact.
 */
export async function triggerWorkflow(
  workflowId: string,
  contactId: string,
  _data?: Record<string, unknown>,
): Promise<void> {
  await ghlRequest({
    method: 'POST',
    path: `/contacts/${contactId}/workflow/${workflowId}`,
    body: {},
  });

  console.warn('[GHL] Workflow triggered', { workflowId, contactId });
}
