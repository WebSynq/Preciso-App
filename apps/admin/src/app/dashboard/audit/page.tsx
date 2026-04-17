import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// SECURITY NOTE: audit_logs is append-only at the DB level (migration 00004).
// This page only reads — no mutation UI will ever be added here.
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { action?: string; resource?: string };
}) {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from('audit_logs')
    .select('id, actor_id, actor_type, action, resource_type, resource_id, ip_address, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (searchParams.action) {
    query = query.eq('action', searchParams.action);
  }
  if (searchParams.resource) {
    query = query.eq('resource_type', searchParams.resource);
  }

  const { data, error } = await query;
  const rows = (data || []) as AuditRow[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Append-only record of every system and user action. Showing the latest {rows.length}.
        </p>
      </div>

      <form className="mb-6 flex flex-wrap gap-3 text-sm">
        <input
          name="action"
          defaultValue={searchParams.action || ''}
          placeholder="Filter by action (e.g. order.created)"
          className="min-w-[260px] flex-1 rounded-lg border border-gray-300 px-3 py-2"
        />
        <input
          name="resource"
          defaultValue={searchParams.resource || ''}
          placeholder="Filter by resource (e.g. kit_orders)"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-navy px-4 py-2 font-medium text-white hover:bg-navy-600"
        >
          Apply
        </button>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load audit entries.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                  No audit entries match.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="font-mono text-gray-600">{row.actor_id.slice(0, 8)}</div>
                    <div className="text-gray-400">{row.actor_type}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{row.action}</td>
                  <td className="px-4 py-2 text-xs">
                    <div className="text-gray-700">{row.resource_type}</div>
                    <div className="font-mono text-gray-400">{row.resource_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">
                    {row.ip_address || '—'}
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
