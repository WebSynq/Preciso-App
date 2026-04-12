'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SettingsState {
  success?: boolean;
  error?: string;
}

/**
 * Server action to update provider profile fields.
 */
export async function updateProfileAction(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated.' };
  }

  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const organization = formData.get('organization') as string;

  if (!firstName?.trim() || !lastName?.trim()) {
    return { error: 'First name and last name are required.' };
  }

  const { error } = await supabase
    .from('providers')
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      organization: organization?.trim() || null,
    })
    .eq('id', user.id);

  if (error) {
    return { error: 'Failed to update profile. Please try again.' };
  }

  return { success: true };
}

/**
 * Server action to change password.
 */
export async function changePasswordAction(
  _prevState: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createServerSupabaseClient();
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!newPassword || newPassword.length < 12) {
    return { error: 'Password must be at least 12 characters.' };
  }

  if (!/[A-Z]/.test(newPassword)) {
    return { error: 'Password must contain at least one uppercase letter.' };
  }

  if (!/[0-9]/.test(newPassword)) {
    return { error: 'Password must contain at least one number.' };
  }

  if (!/[^A-Za-z0-9]/.test(newPassword)) {
    return { error: 'Password must contain at least one special character.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: 'Failed to update password. Please try again.' };
  }

  return { success: true };
}
