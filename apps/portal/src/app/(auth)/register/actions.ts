'use server';

import { ProviderRegistrationSchema } from '@preciso/schemas';
import { redirect } from 'next/navigation';

import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set when registration succeeded but email confirmation is required */
  awaitingConfirmation?: boolean;
}

/**
 * Server action for provider registration.
 *
 * Flow:
 *   1. Validate input with Zod
 *   2. Create Supabase auth user (may require email confirmation)
 *   3. Insert provider profile using admin client (bypasses RLS so it
 *      works whether or not the session exists yet)
 *   4. If session exists (email confirmation off): redirect to dashboard
 *   5. If no session (email confirmation on): return awaitingConfirmation=true
 */
export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const accountType = formData.get('accountType') as string;

  const rawData: Record<string, unknown> = {
    accountType,
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  if (accountType === 'individual_clinician') {
    rawData.npiNumber = formData.get('npiNumber');
    rawData.specialty = formData.get('specialty');
    rawData.stateLicense = formData.get('stateLicense');
  } else {
    rawData.organization = formData.get('organization');
    rawData.institutionType = formData.get('institutionType');
    const volume = formData.get('estimatedMonthlyVolume');
    rawData.estimatedMonthlyVolume = volume ? Number(volume) : undefined;
  }

  // Validate with Zod
  const parsed = ProviderRegistrationSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { fieldErrors };
  }

  const data = parsed.data;
  const supabase = await createServerSupabaseClient();

  // Step 1 — Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${process.env.PORTAL_URL || 'http://localhost:3000'}/auth/callback`,
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        account_type: data.accountType,
      },
    },
  });

  if (authError) {
    console.error('Registration auth error:', authError.message);
    // Generic message — never reveal whether an email already exists
    return { error: 'Unable to create account. Please try again or contact support.' };
  }

  if (!authData.user) {
    return { error: 'Unable to create account. Please try again or contact support.' };
  }

  // Step 2 — Insert provider record using admin client so it succeeds
  // regardless of whether email confirmation is required (no session yet).
  const adminSupabase = createAdminSupabaseClient();

  const providerRecord: Record<string, unknown> = {
    id: authData.user.id,
    email: data.email,
    first_name: data.firstName,
    last_name: data.lastName,
    account_type: data.accountType,
    phin_status: data.accountType === 'hospital_admin' ? 'pending' : 'active',
  };

  if (data.accountType === 'individual_clinician') {
    providerRecord.npi_number = data.npiNumber;
  } else {
    providerRecord.organization = data.organization;
  }

  const { error: insertError } = await adminSupabase
    .from('providers')
    .insert(providerRecord);

  if (insertError) {
    console.error('Provider insert error:', insertError.message);
    return { error: 'Account created but profile setup failed. Please contact support.' };
  }

  // TODO: Phase 3 — Fire GHL webhook to create contact
  // await createGhlContact({ email: data.email, firstName: data.firstName, ... });

  // Step 3 — If Supabase returned a session, email confirmation is disabled:
  // redirect immediately. Otherwise, ask the user to check their email.
  if (authData.session) {
    if (data.accountType === 'hospital_admin') {
      redirect('/dashboard/pending');
    }
    redirect('/dashboard');
  }

  // No session = email confirmation is required
  return { awaitingConfirmation: true };
}
