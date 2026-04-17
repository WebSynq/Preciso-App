import { createAggregateClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Health page. Pings the DB with a trivial aggregate query and reports
// latency. Surfaces environment info. No PHI.
export default async function DevHealthPage() {
  const db = createAggregateClient();

  const start = Date.now();
  let dbOk = false;
  let dbError: string | null = null;
  try {
    const { error } = await db.from('audit_logs').select('*', { count: 'exact', head: true });
    if (error) throw error;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }
  const dbLatency = Date.now() - start;

  const env = [
    { label: 'NODE_ENV', value: process.env.NODE_ENV || 'unknown' },
    {
      label: 'SUPABASE_URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 40)}…`
        : 'not configured',
    },
    {
      label: 'Service role key loaded',
      value: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'yes' : 'NO — reads will fail',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-mono text-xl text-teal-500">platform / health</h1>
        <p className="mt-1 text-sm text-gray-400">Live probes and environment.</p>
      </div>

      <div className="mb-6 rounded-lg border border-ink-200 bg-ink-100 p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-gray-500">Database</p>
        <div className="mt-2 flex items-center gap-3">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              dbOk ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="font-mono text-sm text-gray-200">
            {dbOk ? 'reachable' : 'unreachable'}
          </span>
          <span className="font-mono text-xs text-gray-500">· {dbLatency}ms round trip</span>
        </div>
        {dbError && (
          <p className="mt-2 font-mono text-xs text-red-400">{dbError}</p>
        )}
      </div>

      <div className="rounded-lg border border-ink-200 bg-ink-100 p-5">
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-gray-500">Environment</p>
        <dl className="divide-y divide-ink-200 text-sm">
          {env.map((row) => (
            <div key={row.label} className="flex justify-between py-2 font-mono">
              <dt className="text-gray-400">{row.label}</dt>
              <dd className="text-gray-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
