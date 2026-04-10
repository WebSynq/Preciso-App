'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { registerAction, type RegisterState } from './actions';

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<'individual_clinician' | 'hospital_admin'>(
    'individual_clinician',
  );
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-navy">PRECISO</h1>
          <p className="mt-2 text-gray-600">Create your provider account</p>
        </div>

        {/* Account type toggle */}
        <div className="mb-6 flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setAccountType('individual_clinician')}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              accountType === 'individual_clinician'
                ? 'bg-navy text-white'
                : 'text-gray-600 hover:text-navy'
            }`}
          >
            Individual Clinician
          </button>
          <button
            type="button"
            onClick={() => setAccountType('hospital_admin')}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              accountType === 'hospital_admin'
                ? 'bg-navy text-white'
                : 'text-gray-600 hover:text-navy'
            }`}
          >
            Hospital / Enterprise
          </button>
        </div>

        <form action={formAction} className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <input type="hidden" name="accountType" value={accountType} />

          {state.error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          {/* Common fields */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <FieldInput name="firstName" label="First Name" errors={state.fieldErrors} required />
            <FieldInput name="lastName" label="Last Name" errors={state.fieldErrors} required />
          </div>

          <FieldInput name="email" label="Email Address" type="email" errors={state.fieldErrors} required />

          <FieldInput
            name="password"
            label="Password"
            type="password"
            errors={state.fieldErrors}
            required
            hint="Min 12 characters, 1 uppercase, 1 number, 1 special character"
          />

          {/* Clinician-specific fields */}
          {accountType === 'individual_clinician' && (
            <>
              <FieldInput name="npiNumber" label="NPI Number" errors={state.fieldErrors} required hint="10-digit NPI" />
              <FieldInput name="specialty" label="Specialty" errors={state.fieldErrors} required />
              <FieldInput name="stateLicense" label="State License Number" errors={state.fieldErrors} required />
            </>
          )}

          {/* Hospital-specific fields */}
          {accountType === 'hospital_admin' && (
            <>
              <FieldInput name="organization" label="Organization Name" errors={state.fieldErrors} required />
              <FieldInput name="institutionType" label="Institution Type" errors={state.fieldErrors} required />
              <FieldInput
                name="estimatedMonthlyVolume"
                label="Estimated Monthly Order Volume"
                type="number"
                errors={state.fieldErrors}
                required
              />
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Hospital/Enterprise accounts require manual review. You will receive access once
                your account is approved.
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-lg bg-teal px-4 py-3 font-medium text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-teal hover:text-teal-700">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

function FieldInput({
  name,
  label,
  type = 'text',
  errors,
  required,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  errors?: Record<string, string[]>;
  required?: boolean;
  hint?: string;
}) {
  const fieldErrors = errors?.[name];

  return (
    <div className="mb-4">
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal/50 ${
          fieldErrors ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      />
      {hint && !fieldErrors && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {fieldErrors?.map((err) => (
        <p key={err} className="mt-1 text-xs text-red-600">
          {err}
        </p>
      ))}
    </div>
  );
}
