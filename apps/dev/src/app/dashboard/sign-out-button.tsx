'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="rounded-md border border-ink-300 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-ink-200 disabled:opacity-50"
    >
      {pending ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
