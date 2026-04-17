import { createAggregateClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// SECURITY NOTE: Dev overview page. Every query on this page MUST be a
// pure aggregate (count, groupby-count). No row-level PHI may be read
// here under any circumstance. This file is on the audit list.
export default async function DevOverviewPage() {
  const db = createAggregateClient();

  const [
    { count: providersTotal },
    { count: ordersTotal },
    { count: ordersPending },
    { count: ordersInFlight },
    { count: ordersReportReady },
    { count: ordersCancelled },
    { count: custodyTotal },
    { count: labResultsTotal },
    { count: auditEventsTotal },
  ] = await Promise.all([
    db.from('providers').select('*', { count: 'exact', head: true }),
    db.from('kit_orders').select('*', { count: 'exact', head: true }),
    db
      .from('kit_orders')
      .select('*', { count: 'exact', head: true })
      .in('order_status', ['pending', 'submitted']),
    db
      .from('kit_orders')
      .select('*', { count: 'exact', head: true })
      .in('order_status', [
        'in_transit',
        'delivered',
        'specimen_collected',
        'at_lab',
        'sequencing',
      ]),
    db.from('kit_orders').select('*', { count: 'exact', head: true }).eq('order_status', 'report_ready'),
    db.from('kit_orders').select('*', { count: 'exact', head: true }).eq('order_status', 'cancelled'),
    db.from('custody_events').select('*', { count: 'exact', head: true }),
    db.from('lab_results').select('*', { count: 'exact', head: true }),
    db.from('audit_logs').select('*', { count: 'exact', head: true }),
  ]);

  const cards = [
    { label: 'Providers (total)', value: providersTotal ?? 0 },
    { label: 'Orders (total)', value: ordersTotal ?? 0 },
    { label: 'Orders — pending/submitted', value: ordersPending ?? 0 },
    { label: 'Orders — in flight', value: ordersInFlight ?? 0 },
    { label: 'Orders — report ready', value: ordersReportReady ?? 0 },
    { label: 'Orders — cancelled', value: ordersCancelled ?? 0 },
    { label: 'Custody events (lifetime)', value: custodyTotal ?? 0 },
    { label: 'Lab results (lifetime)', value: labResultsTotal ?? 0 },
    { label: 'Audit events (lifetime)', value: auditEventsTotal ?? 0 },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-mono text-xl text-teal-500">platform / overview</h1>
        <p className="mt-1 text-sm text-gray-400">
          Aggregate counts only. No PHI reachable from this console.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-ink-200 bg-ink-100 p-5"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-gray-500">{c.label}</p>
            <p className="mt-2 font-mono text-3xl text-teal-500">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-ink-200 bg-ink-100 p-5">
        <p className="font-mono text-xs uppercase tracking-wider text-gray-500">
          Non-PHI surface
        </p>
        <p className="mt-2 text-sm text-gray-300">
          The developer console exposes counts, system health, and audit-action histograms only.
          Individual provider, patient, order, and result records are never rendered here.
          For case-level investigation use the admin console with step-up MFA (V2).
        </p>
      </div>
    </div>
  );
}
