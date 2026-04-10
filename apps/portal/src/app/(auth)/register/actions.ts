'use server';

import { ProviderRegistrationSchema } from '@preciso/schemas';
import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Server action for provider registration.
 * Creates Supabase auth user + inserts provider record.
 * Fires GHL contact creation webhook (Phase 3 wiring).
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
  const supabase = createServerSupabaseClient();

  // Create Supabase auth user
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
    // Generic error — never reveal if email exists
    return { error: 'Unable to create account. Please check your email for verification.' };
  }

  if (!authData.user) {
    return { error: 'Unable to create account. Please check your email for verification.' };
  }

  // Insert provider record using service role would be ideal,
  // but with RLS insert policy allowing inserts, we can use the session client.
  // The provider ID must match the auth user ID for RLS to work.
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

  const { error: insertError } = await supabase.from('providers').insert(providerRecord);

  if (insertError) {
    console.error('Provider insert error:', insertError.message);
    return { error: 'Account created but profile setup failed. Please contact support.' };
  }

  // TODO: Phase 3 — Fire GHL webhook to create contact
  // await createGhlContact({ email: data.email, firstName: data.firstName, ... });

  // Redirect based on account type
  if (data.accountType === 'hospital_admin') {
    redirect('/dashboard/pending');
  }

  redirect('/dashboard');
}
