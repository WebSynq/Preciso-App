'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  changePasswordAction,
  updateProfileAction,
  type SettingsState,
} from './actions';

import { createClient } from '@/lib/supabase/client';

const profileInitial: SettingsState = {};
const passwordInitial: SettingsState = {};

export default function SettingsPage() {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    profileInitial,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    passwordInitial,
  );

  const [provider, setProvider] = useState<{
    first_name: string | null;
    last_name: string | null;
    organization: string | null;
    npi_number: string | null;
    email: string;
    account_type: string;
  } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('providers')
          .select('first_name, last_name, organization, npi_number, email, account_type')
          .eq('id', user.id)
          .single();

        if (data) setProvider(data);
      }
    }
    loadProfile();
  }, [profileState]);

  if (!provider) {
    return <div className="py-12 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-2xl font-bold text-navy">Account Settings</h1>

      {/* Profile section */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-navy">Profile Information</h2>

        {profileState.success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Profile updated successfully.
          </div>
        )}
        {profileState.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {profileState.error}
          </div>
        )}

        <form action={profileAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                defaultValue={provider.first_name || ''}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                defaultValue={provider.last_name || ''}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              value={provider.email}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
            />
          </div>

          <div>
            <label htmlFor="organization" className="mb-1 block text-sm font-medium text-gray-700">
              Organization
            </label>
            <input
              id="organization"
              name="organization"
              defaultValue={provider.organization || ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
            />
          </div>

          {provider.npi_number && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">NPI Number</label>
              <input
                value={provider.npi_number}
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                NPI cannot be changed after verification.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={profilePending}
            className="rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {profilePending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* Change password section */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-navy">Change Password</h2>

        {passwordState.success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Password updated successfully.
          </div>
        )}
        {passwordState.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {passwordState.error}
          </div>
        )}

        <form action={passwordAction} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
            />
            <p className="mt-1 text-xs text-gray-400">
              Min 12 characters, 1 uppercase, 1 number, 1 special character
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
            />
          </div>

          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-white transition hover:bg-navy-400 disabled:opacity-50"
          >
            {passwordPending ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* Notification preferences */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-navy">Notification Preferences</h2>
        <div className="space-y-4">
          <NotifToggle
            label="Order Confirmed"
            description="Receive a notification when your kit order is confirmed"
          />
          <NotifToggle
            label="Result Ready"
            description="Receive a notification when genomic results are available"
          />
        </div>
      </section>
    </div>
  );
}

function NotifToggle({ label, description }: { label: string; description: string }) {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  return (
    <div className="flex items-start justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEmailEnabled(!emailEnabled)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            emailEnabled ? 'bg-teal text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setSmsEnabled(!smsEnabled)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            smsEnabled ? 'bg-teal text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          SMS
        </button>
      </div>
    </div>
  );
}
