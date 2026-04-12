/**
 * Tests for Zod schema validation rules, specifically the security-relevant ones.
 */
import { CreateKitOrderSchema } from '@preciso/schemas';

const VALID_ORDER = {
  patientRef: 'PAT-2024-001',
  panelType: 'adult' as const,
  deliveryAddress: {
    recipientName: 'Dr. Jane Smith',
    addressLine1: '123 Medical Center Dr',
    city: 'San Diego',
    state: 'CA',
    zip: '92101',
  },
};

describe('CreateKitOrderSchema — patientRef', () => {
  it('accepts alphanumeric, hyphens, and underscores', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      patientRef: 'PAT_2024-001_A',
    });
    expect(result.success).toBe(true);
  });

  it('rejects patientRef with spaces', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      patientRef: 'PAT 2024',
    });
    expect(result.success).toBe(false);
  });

  it('rejects patientRef with special injection characters', () => {
    for (const bad of ["PAT'DROP--", 'PAT<script>', 'PAT;rm -rf', 'PAT"']) {
      const result = CreateKitOrderSchema.safeParse({
        ...VALID_ORDER,
        patientRef: bad,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects empty patientRef', () => {
    const result = CreateKitOrderSchema.safeParse({ ...VALID_ORDER, patientRef: '' });
    expect(result.success).toBe(false);
  });

  it('rejects patientRef longer than 100 chars', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      patientRef: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateKitOrderSchema — clinicalNotes', () => {
  it('accepts plain text notes', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      clinicalNotes: 'Patient is 42 years old, no prior conditions.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects notes containing HTML tags', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      clinicalNotes: '<script>alert("xss")</script>',
    });
    expect(result.success).toBe(false);
  });

  it('rejects notes with <img> injection', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      clinicalNotes: '<img src=x onerror=alert(1)>',
    });
    expect(result.success).toBe(false);
  });

  it('accepts undefined (field is optional)', () => {
    const result = CreateKitOrderSchema.safeParse({ ...VALID_ORDER });
    expect(result.success).toBe(true);
  });

  it('rejects notes longer than 2000 chars', () => {
    const result = CreateKitOrderSchema.safeParse({
      ...VALID_ORDER,
      clinicalNotes: 'A'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateKitOrderSchema — deliveryAddress', () => {
  it('rejects invalid ZIP codes', () => {
    for (const bad of ['1234', 'ABCDE', '123456', '']) {
      const result = CreateKitOrderSchema.safeParse({
        ...VALID_ORDER,
        deliveryAddress: { ...VALID_ORDER.deliveryAddress, zip: bad },
      });
      expect(result.success).toBe(false);
    }
  });

  it('accepts valid 5-digit and 9-digit ZIP codes', () => {
    for (const good of ['92101', '92101-1234']) {
      const result = CreateKitOrderSchema.safeParse({
        ...VALID_ORDER,
        deliveryAddress: { ...VALID_ORDER.deliveryAddress, zip: good },
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects state codes that are not exactly 2 characters', () => {
    for (const bad of ['CAL', 'C', '']) {
      const result = CreateKitOrderSchema.safeParse({
        ...VALID_ORDER,
        deliveryAddress: { ...VALID_ORDER.deliveryAddress, state: bad },
      });
      expect(result.success).toBe(false);
    }
  });
});
