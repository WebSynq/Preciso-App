import { z } from 'zod';

// ─── Shared Enum Schemas ─────────────────────────────────────────────────────

export const AccountTypeSchema = z.enum(['individual_clinician', 'hospital_admin']);

export const PhinStatusSchema = z.enum(['pending', 'active', 'suspended']);

export const PanelTypeSchema = z.enum(['newborn', 'pediatric', 'adult', 'senior']);

export const OrderStatusSchema = z.enum([
  'pending',
  'submitted',
  'fulfilled',
  'in_transit',
  'delivered',
  'specimen_collected',
  'at_lab',
  'sequencing',
  'resulted',
  'report_ready',
  'cancelled',
]);

export const LabPartnerSchema = z.enum(['cenegenics', 'sampled']);

export const ResultStatusSchema = z.enum(['pending', 'processing', 'complete', 'flagged', 'failed']);

export const CustodyEventTypeSchema = z.enum([
  'ordered',
  'kit_shipped',
  'kit_delivered',
  'specimen_collected',
  'specimen_shipped',
  'lab_received',
  'sequencing_started',
  'sequencing_complete',
  'result_uploaded',
]);

export const ActorTypeSchema = z.enum(['provider', 'system', 'admin']);

// ─── Delivery Address ────────────────────────────────────────────────────────

export const DeliveryAddressSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required').max(200),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'State must be a 2-letter code'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  deliveryInstructions: z.string().max(500).optional(),
});

// ─── Kit Order Schemas ───────────────────────────────────────────────────────

/** Schema for creating a new kit order */
export const CreateKitOrderSchema = z.object({
  // Alphanumeric characters, hyphens, and underscores only.
  // Prevents special characters that could break downstream reporting systems
  // or be used in injection attacks.
  patientRef: z
    .string()
    .min(1, 'Patient reference is required')
    .max(100, 'Patient reference too long')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Patient reference may only contain letters, numbers, hyphens, and underscores',
    ),
  panelType: PanelTypeSchema,
  // clinicalNotes is stripped of leading/trailing whitespace; no HTML allowed.
  clinicalNotes: z
    .string()
    .max(2000, 'Clinical notes too long')
    .refine((v) => !/<[^>]+>/i.test(v), 'Clinical notes must not contain HTML tags')
    .optional()
    .transform((v) => v?.trim()),
  deliveryAddress: DeliveryAddressSchema,
});

export type CreateKitOrderInput = z.infer<typeof CreateKitOrderSchema>;

/** Schema for updating order status */
export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  status: OrderStatusSchema,
  trackingNumber: z.string().max(100).optional(),
  kitBarcode: z.string().max(100).optional(),
  firstsourceOrderId: z.string().max(100).optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

// ─── Provider Registration ───────────────────────────────────────────────────

/** Password: min 12 chars, 1 uppercase, 1 number, 1 special character */
const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/** NPI: exactly 10 digits */
const NpiSchema = z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits');

const BaseRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: PasswordSchema,
});

/** Individual clinician registration */
export const ClinicianRegistrationSchema = BaseRegistrationSchema.extend({
  accountType: z.literal('individual_clinician'),
  npiNumber: NpiSchema,
  specialty: z.string().min(1, 'Specialty is required').max(100),
  stateLicense: z.string().min(1, 'State license is required').max(50),
});

/** Hospital/enterprise registration */
export const HospitalRegistrationSchema = BaseRegistrationSchema.extend({
  accountType: z.literal('hospital_admin'),
  organization: z.string().min(1, 'Organization name is required').max(200),
  institutionType: z.string().min(1, 'Institution type is required').max(100),
  estimatedMonthlyVolume: z.number().int().min(1).max(100000),
});

/** Discriminated union for provider registration */
export const ProviderRegistrationSchema = z.discriminatedUnion('accountType', [
  ClinicianRegistrationSchema,
  HospitalRegistrationSchema,
]);

export type ProviderRegistrationInput = z.infer<typeof ProviderRegistrationSchema>;
export type ClinicianRegistrationInput = z.infer<typeof ClinicianRegistrationSchema>;
export type HospitalRegistrationInput = z.infer<typeof HospitalRegistrationSchema>;

// ─── Custody Event ───────────────────────────────────────────────────────────

/** Schema for recording a custody scan event */
export const CustodyEventSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required').max(100),
  eventType: CustodyEventTypeSchema,
  location: z.string().min(1, 'Location is required').max(200),
  scannedBy: z.string().min(1, 'Scanner identity is required').max(200),
});

export type CustodyEventInput = z.infer<typeof CustodyEventSchema>;
