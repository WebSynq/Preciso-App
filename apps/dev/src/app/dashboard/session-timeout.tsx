'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * 15-minute idle timeout for the developer console.
 */

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;

interface SessionTimeoutContextValue {
  resetTimer: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextValue>({
  resetTimer: () => {},
});

export function useSessionTimeout() {
  return useContext(SessionTimeoutContext);
}

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningRef = useRef<ReturnType<typeof setTimeout>>();

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login?error=session_expired');
  }, [router]);

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    const handleActivity = () => resetTimer();
    events.forEach((event) => document.addEventListener(event, handleActivity));
    resetTimer();
    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      if (warningRef.current) clearTimeout(warningRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);

  return (
    <SessionTimeoutContext.Provider value={{ resetTimer }}>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-ink-200 bg-ink-100 p-6 shadow-2xl">
            <h3 className="mb-2 font-mono text-base font-semibold text-teal-500">
              session · expiring
            </h3>
            <p className="mb-6 text-sm text-gray-400">
              Signing out in 2 minutes due to inactivity.
            </p>
            <div className="flex gap-3">
              <button
                onClick={resetTimer}
                className="flex-1 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
              >
                Stay signed in
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-lg border border-ink-300 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-ink-200"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </SessionTimeoutContext.Provider>
  );
}
