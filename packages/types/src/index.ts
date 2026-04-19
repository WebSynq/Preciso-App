// ─── Enums ───────────────────────────────────────────────────────────────────

/** Provider account type */
export const AccountType = {
  INDIVIDUAL_CLINICIAN: 'individual_clinician',
  HOSPITAL_ADMIN: 'hospital_admin',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

/** Provider PHIN (network) status */
export const PhinStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;
export type PhinStatus = (typeof PhinStatus)[keyof typeof PhinStatus];

/** Genomic panel type */
export const PanelType = {
  NEWBORN: 'newborn',
  PEDIATRIC: 'pediatric',
  ADULT: 'adult',
  SENIOR: 'senior',
} as const;
export type PanelType = (typeof PanelType)[keyof typeof PanelType];

/** Kit order status — tracks full lifecycle */
export const OrderStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  FULFILLED: 'fulfilled',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  SPECIMEN_COLLECTED: 'specimen_collected',
  AT_LAB: 'at_lab',
  SEQUENCING: 'sequencing',
  RESULTED: 'resulted',
  REPORT_READY: 'report_ready',
  CANCELLED: 'cancelled',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Lab partner identifier */
export const LabPartner = {
  CENTOGENE: 'centogene',
  SAMPLED: 'sampled',
  /**
   * @deprecated Legacy value retained so historical rows tagged
   * 'cenegenics' still deserialise. All new code should emit
   * LabPartner.CENTOGENE. Removed from LabPartner enum only after
   * historical rows are migrated (no migration required at DB level
   * since Postgres keeps enum values permanently).
   */
  CENEGENICS: 'cenegenics',
} as const;
export type LabPartner = (typeof LabPartner)[keyof typeof LabPartner];

/** Lab result processing status */
export const ResultStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  FLAGGED: 'flagged',
  FAILED: 'failed',
} as const;
export type ResultStatus = (typeof ResultStatus)[keyof typeof ResultStatus];

/** Stripe payment status mirrored in our DB */
export const PaymentStatus = {
  NONE: 'none',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** Chain-of-custody event types */
export const CustodyEventType = {
  ORDERED: 'ordered',
  KIT_SHIPPED: 'kit_shipped',
  KIT_DELIVERED: 'kit_delivered',
  SPECIMEN_COLLECTED: 'specimen_collected',
  SPECIMEN_SHIPPED: 'specimen_shipped',
  LAB_RECEIVED: 'lab_received',
  SEQUENCING_STARTED: 'sequencing_started',
  SEQUENCING_COMPLETE: 'sequencing_complete',
  RESULT_UPLOADED: 'result_uploaded',
} as const;
export type CustodyEventType = (typeof CustodyEventType)[keyof typeof CustodyEventType];

/** Audit log actor type */
export const ActorType = {
  PROVIDER: 'provider',
  SYSTEM: 'system',
  ADMIN: 'admin',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

// ─── Database Row Interfaces ─────────────────────────────────────────────────

/** Delivery address stored as JSONB on kit_orders */
export interface DeliveryAddress {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  deliveryInstructions?: string;
}

/** providers table row */
export interface Provider {
  id: string;
  email: string;
  npi_number: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
  account_type: AccountType;
  phin_status: PhinStatus;
  ghl_contact_id: string | null;
  vericense_identity_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

/** kit_orders table row */
export interface KitOrder {
  id: string;
  provider_id: string;
  patient_ref: string | null;
  panel_type: PanelType;
  order_status: OrderStatus;
  firstsource_order_id: string | null;
  kit_barcode: string | null;
  tracking_number: string | null;
  delivery_address: DeliveryAddress | null;
  ghl_opportunity_id: string | null;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

/** payments table row — immutable ledger entry */
export interface Payment {
  id: string;
  kit_order_id: string;
  provider_id: string;
  stripe_payment_intent_id: string;
  stripe_charge_id: string | null;
  stripe_invoice_id: string | null;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  receipt_url: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
}

/** lab_results table row */
export interface LabResult {
  id: string;
  kit_order_id: string;
  lab_partner: LabPartner;
  result_status: ResultStatus;
  result_received_at: string | null;
  report_url: string | null;
  raw_result_ref: string | null;
  created_at: string;
}

/** custody_events table row */
export interface CustodyEvent {
  id: string;
  kit_order_id: string;
  event_type: CustodyEventType;
  scanned_by: string | null;
  location: string | null;
  barcode: string | null;
  vericense_audit_ref: string | null;
  created_at: string;
}

/** audit_logs table row */
export interface AuditLog {
  id: string;
  actor_id: string;
  actor_type: ActorType;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
