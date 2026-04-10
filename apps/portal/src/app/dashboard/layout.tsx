import type { Provider } from '@preciso/types';

import { DashboardShell } from './components/dashboard-shell';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let provider: Provider | null = null;

  if (user) {
    const { data } = await supabase
      .from('providers')
      .select('*')
      .eq('id', user.id)
      .single();
    provider = data as Provider | null;
  }

  return (
    <DashboardShell provider={provider}>
      {children}
    </DashboardShell>
  );
}
