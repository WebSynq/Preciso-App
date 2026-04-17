import Link from 'next/link';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Admin overview — platform-wide counts and recent activity. All reads go
// through the user's JWT so RLS (providers_select_admin etc. from migration
// 00005) governs what comes back.
export default async function AdminOverviewPage() {
  const supabase = createServerSupabaseClient();

  const [providersCount, ordersPending, ordersInFlight, reportsReady, recentOrdersRes] =
    await Promise.all([
      supabase.from('providers').select('*', { count: 'exact', head: true }),
      supabase
        .from('kit_orders')
        .select('*', { count: 'exact', head: true })
        .in('order_status', ['pending', 'submitted']),
      supabase
        .from('kit_orders')
        .select('*', { count: 'exact', head: true })
        .in('order_status', ['in_transit', 'delivered', 'specimen_collected', 'at_lab', 'sequencing']),
      supabase
        .from('kit_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'report_ready'),
      supabase
        .from('kit_orders')
        .select('id, provider_id, panel_type, order_status, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  const stats = [
    { label: 'Providers', value: providersCount.count ?? 0, color: 'bg-navy' },
    { label: 'Orders: Pending / Submitted', value: ordersPending.count ?? 0, color: 'bg-amber-500' },
    { label: 'Orders: In Flight', value: ordersInFlight.count ?? 0, color: 'bg-blue-500' },
    { label: 'Reports Ready', value: reportsReady.count ?? 0, color: 'bg-teal' },
  ];

  const recentOrders = (recentOrdersRes.data || []) as Array<{
    id: string;
    provider_id: string;
    panel_type: string;
    order_status: string;
    created_at: string;
  }>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">Platform Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only administrative view. Every page load writes a READ audit log.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-navy">{stat.value}</p>
            <div className={`mt-3 h-1 w-12 rounded-full ${stat.color}`} />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-navy">Latest Orders (all providers)</h2>
          <Link href="/dashboard/orders" className="text-sm font-medium text-teal hover:text-teal-700">
            View all
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">No orders yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Provider</th>
                <th className="px-6 py-3">Panel</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <tr key={order.id} className="transition hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {order.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {order.provider_id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3 text-sm capitalize">{order.panel_type}</td>
                  <td className="px-6 py-3 text-sm capitalize">
                    {order.order_status.replace(/_/g, ' ')}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
