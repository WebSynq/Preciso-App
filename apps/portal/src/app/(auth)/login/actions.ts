'use server';

import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface LoginState {
  error?: string;
}

/**
 * Server action for email/password login.
 * On success, redirects to /dashboard (or original destination).
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirect') as string) || '/dashboard';

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic error — never reveal whether email exists or if locked out
    return { error: 'Invalid email or password. Please try again.' };
  }

  redirect(redirectTo);
}

/**
 * Server action for password reset request.
 * Always shows success message — never reveals if email exists.
 */
export async function resetPasswordAction(
  _prevState: { success?: boolean; error?: string },
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Please enter your email address.' };
  }

  const supabase = await createServerSupabaseClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.PORTAL_URL || 'http://localhost:3000'}/auth/callback?next=/dashboard/settings`,
  });

  // Always return success — never reveal if email exists
  return { success: true };
}
