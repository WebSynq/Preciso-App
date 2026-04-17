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
      // Hard navigation to clear any client router state.
      window.location.assign('/login');
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="rounded-md border border-gray-500 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
    >
      {pending ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
