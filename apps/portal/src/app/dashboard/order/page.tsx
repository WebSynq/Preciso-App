'use client';

import type { CreateKitOrderInput } from '@preciso/schemas';
import type { DeliveryAddress, PanelType } from '@preciso/types';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { PaymentStep } from './payment-step';

type Step = 1 | 2 | 3 | 4;

const PANEL_INFO: Record<string, { title: string; description: string }> = {
  newborn: {
    title: 'Newborn',
    description: 'Whole-genome sequencing for newborns (0-28 days). Early detection panel.',
  },
  pediatric: {
    title: 'Pediatric',
    description: 'Comprehensive genomic analysis for children (1 month - 17 years).',
  },
  adult: {
    title: 'Adult',
    description: 'Full adult whole-genome sequencing with pharmacogenomic markers.',
  },
  senior: {
    title: 'Senior',
    description: 'Genomic screening optimized for patients 65+ with age-related markers.',
  },
};

export default function OrderPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populated by Step 3 confirmation; consumed by Step 4 (payment).
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderAmountCents, setOrderAmountCents] = useState<number>(0);

  // Step 1 fields
  const [patientRef, setPatientRef] = useState('');
  const [panelType, setPanelType] = useState<PanelType | ''>('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Step 2 fields
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    recipientName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    deliveryInstructions: '',
  });

  // Step 3
  const [termsAccepted, setTermsAccepted] = useState(false);

  function canAdvanceStep1() {
    return patientRef.trim().length > 0 && panelType !== '';
  }

  function canAdvanceStep2() {
    const a = deliveryAddress;
    return (
      a.recipientName.trim() &&
      a.addressLine1.trim() &&
      a.city.trim() &&
      a.state.trim().length === 2 &&
      /^\d{5}(-\d{4})?$/.test(a.zip)
    );
  }

  async function handleSubmit() {
    if (!termsAccepted || !panelType) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Session expired. Please sign in again.');
        return;
      }

      const idempotencyKey = `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const orderData: CreateKitOrderInput = {
        patientRef,
        panelType,
        clinicalNotes: clinicalNotes || undefined,
        deliveryAddress: {
          recipientName: deliveryAddress.recipientName,
          addressLine1: deliveryAddress.addressLine1,
          addressLine2: deliveryAddress.addressLine2 || undefined,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          zip: deliveryAddress.zip,
          deliveryInstructions: deliveryAddress.deliveryInstructions || undefined,
        },
      };

      // SECURITY NOTE: Use a relative path so the browser always hits the
      // portal's own Next.js API route on the same origin. Avoids
      // NEXT_PUBLIC_API_URL misconfiguration and keeps the auth cookie
      // scope intact.
      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to submit order. Please try again.');
        return;
      }

      // Order persisted in 'pending' status. Advance to Step 4 (payment);
      // the order is only forwarded to fulfilment after Stripe confirms.
      setOrderId(result.orderId);
      setOrderAmountCents(result.amountCents ?? 0);
      setStep(4);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-navy">Order a Kit</h1>
      <p className="mb-8 text-gray-500">Complete the steps below to submit a genomic testing order.</p>

      {/* Progress indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s < step
                  ? 'bg-teal text-white'
                  : s === step
                    ? 'bg-navy text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 4 && (
              <div className={`h-0.5 flex-1 ${s < step ? 'bg-teal' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Step 1: Patient Reference + Panel Type */}
        {step === 1 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-navy">Patient & Panel Selection</h2>

            <div className="mb-6">
              <label htmlFor="patientRef" className="mb-1 block text-sm font-medium text-gray-700">
                Internal Patient Reference <span className="text-red-500">*</span>
              </label>
              <input
                id="patientRef"
                value={patientRef}
                onChange={(e) => setPatientRef(e.target.value)}
                placeholder="e.g., PAT-2024-001"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
              <p className="mt-1 text-xs text-gray-400">
                Your internal patient ID. No patient PHI is stored here.
              </p>
            </div>

            <div className="mb-6">
              <p className="mb-3 text-sm font-medium text-gray-700">
                Panel Type <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(PANEL_INFO).map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPanelType(key as PanelType)}
                    className={`rounded-lg border p-4 text-left transition ${
                      panelType === key
                        ? 'border-teal bg-teal-50 ring-2 ring-teal/30'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-navy">{info.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{info.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="clinicalNotes" className="mb-1 block text-sm font-medium text-gray-700">
                Clinical Notes <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                id="clinicalNotes"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canAdvanceStep1()}
                onClick={() => setStep(2)}
                className="rounded-lg bg-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next: Delivery Address
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Delivery Address */}
        {step === 2 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-navy">Delivery Address</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="recipientName" className="mb-1 block text-sm font-medium text-gray-700">
                  Recipient Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="recipientName"
                  value={deliveryAddress.recipientName}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, recipientName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
              </div>

              <div>
                <label htmlFor="address1" className="mb-1 block text-sm font-medium text-gray-700">
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  id="address1"
                  value={deliveryAddress.addressLine1}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, addressLine1: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
              </div>

              <div>
                <label htmlFor="address2" className="mb-1 block text-sm font-medium text-gray-700">
                  Address Line 2 <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="address2"
                  value={deliveryAddress.addressLine2 || ''}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, addressLine2: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="city"
                    value={deliveryAddress.city}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="mb-1 block text-sm font-medium text-gray-700">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="state"
                    value={deliveryAddress.state}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="CA"
                    maxLength={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                  />
                </div>
                <div>
                  <label htmlFor="zip" className="mb-1 block text-sm font-medium text-gray-700">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="zip"
                    value={deliveryAddress.zip}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, zip: e.target.value })}
                    placeholder="92101"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="instructions" className="mb-1 block text-sm font-medium text-gray-700">
                  Delivery Instructions <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="instructions"
                  value={deliveryAddress.deliveryInstructions || ''}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, deliveryInstructions: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canAdvanceStep2()}
                onClick={() => setStep(3)}
                className="rounded-lg bg-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next: Review Order
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review + Confirm */}
        {step === 3 && (
          <div>
            <h2 className="mb-6 text-lg font-semibold text-navy">Review Your Order</h2>

            <div className="mb-6 space-y-4">
              <ReviewSection title="Patient & Panel">
                <ReviewField label="Patient Reference" value={patientRef} />
                <ReviewField label="Panel Type" value={PANEL_INFO[panelType]?.title || panelType} />
                {clinicalNotes && <ReviewField label="Clinical Notes" value={clinicalNotes} />}
              </ReviewSection>

              <ReviewSection title="Delivery Address">
                <ReviewField label="Recipient" value={deliveryAddress.recipientName} />
                <ReviewField
                  label="Address"
                  value={[
                    deliveryAddress.addressLine1,
                    deliveryAddress.addressLine2,
                    `${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.zip}`,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                />
                {deliveryAddress.deliveryInstructions && (
                  <ReviewField label="Instructions" value={deliveryAddress.deliveryInstructions} />
                )}
              </ReviewSection>
            </div>

            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal focus:ring-teal"
                />
                <span className="text-sm text-blue-800">
                  I acknowledge that this order involves the handling of protected health information
                  (PHI) under HIPAA regulations. I confirm that I have obtained appropriate patient
                  consent and that all data will be handled in compliance with applicable privacy
                  laws.
                </span>
              </label>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!termsAccepted || submitting}
                onClick={handleSubmit}
                className="rounded-lg bg-teal px-8 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Saving order...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Payment (Stripe Payment Element) */}
        {step === 4 && orderId && panelType && (
          <PaymentStep
            orderId={orderId}
            amountCents={orderAmountCents}
            panelTitle={PANEL_INFO[panelType]?.title || panelType}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-navy">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-medium text-gray-500">{label}:</span>
      <span className="whitespace-pre-line text-sm text-gray-800">{value}</span>
    </div>
  );
}
