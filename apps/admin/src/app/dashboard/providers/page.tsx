import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ProviderRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
  account_type: string;
  phin_status: string;
  created_at: string;
}

export default async function ProvidersPage() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('providers')
    .select('id, email, first_name, last_name, organization, account_type, phin_status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const providers = (data || []) as ProviderRow[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Providers</h1>
        <p className="mt-1 text-sm text-gray-500">
          {providers.length} active provider record{providers.length === 1 ? '' : 's'}.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load providers.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Organization</th>
              <th className="px-6 py-3">Account Type</th>
              <th className="px-6 py-3">PHIN</th>
              <th className="px-6 py-3">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {providers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                  No providers yet.
                </td>
              </tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id} className="transition hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-navy">
                    {p.first_name || ''} {p.last_name || ''}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{p.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{p.organization || '—'}</td>
                  <td className="px-6 py-3 text-xs capitalize text-gray-600">
                    {p.account_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        p.phin_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : p.phin_status === 'suspended'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.phin_status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
