import { createAggregateClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Audit summary. Groups audit_logs by action string and shows counts.
// Action strings are system-defined (order.created, custody.specimen_collected,
// etc.) and are not PHI. We deliberately do NOT return actor_id or
// resource_id to keep this page PHI-free.
export default async function DevAuditSummaryPage() {
  const db = createAggregateClient();

  // Pull the latest 1000 audit rows and aggregate in memory. For V1 we
  // rely on the Postgres aggregate via group-by in a view; here we do it
  // in JS for simplicity. At scale this moves to a SQL view / RPC.
  const { data, error } = await db
    .from('audit_logs')
    .select('action, actor_type, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  const rows = (data || []) as Array<{
    action: string;
    actor_type: string;
    created_at: string;
  }>;

  const byAction = new Map<string, number>();
  const byActor = new Map<string, number>();
  for (const r of rows) {
    byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1);
    byActor.set(r.actor_type, (byActor.get(r.actor_type) ?? 0) + 1);
  }
  const actionRows = Array.from(byAction.entries()).sort((a, b) => b[1] - a[1]);
  const actorRows = Array.from(byActor.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-mono text-xl text-teal-500">platform / audit summary</h1>
        <p className="mt-1 text-sm text-gray-400">
          Action counts aggregated from the latest {rows.length} audit events. No actor IDs,
          resource IDs, or user agents are rendered.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          Failed to load audit summary: {error.message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-ink-200 bg-ink-100 p-5">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-gray-500">
            By action
          </p>
          {actionRows.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-500">No audit events yet.</p>
          ) : (
            <table className="w-full font-mono text-sm">
              <tbody className="divide-y divide-ink-200">
                {actionRows.map(([action, count]) => (
                  <tr key={action}>
                    <td className="py-2 text-gray-200">{action}</td>
                    <td className="py-2 text-right text-teal-500">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-100 p-5">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-gray-500">
            By actor type
          </p>
          {actorRows.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-500">No audit events yet.</p>
          ) : (
            <table className="w-full font-mono text-sm">
              <tbody className="divide-y divide-ink-200">
                {actorRows.map(([actorType, count]) => (
                  <tr key={actorType}>
                    <td className="py-2 text-gray-200">{actorType}</td>
                    <td className="py-2 text-right text-teal-500">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
