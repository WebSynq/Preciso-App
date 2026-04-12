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

  // Email confirmation required — show a success/holding screen
  if (state.awaitingConfirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
              <svg className="h-8 w-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-navy">Check your email</h1>
          <p className="mb-6 text-gray-600">
            We sent a confirmation link to your email address. Click the link to activate
            your account and sign in.
          </p>
          <p className="text-sm text-gray-400">
            Didn&apos;t receive it? Check your spam folder, or{' '}
            <Link href="/register" className="font-medium text-teal hover:text-teal-700">
              try again
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

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
