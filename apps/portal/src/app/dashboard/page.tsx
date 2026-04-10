import type { KitOrder, Provider } from '@preciso/types';
import Link from 'next/link';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('id', user!.id)
    .single();

  const typedProvider = provider as Provider | null;

  // Fetch stats
  const { count: totalOrders } = await supabase
    .from('kit_orders')
    .select('*', { count: 'exact', head: true });

  const { count: pendingResults } = await supabase
    .from('kit_orders')
    .select('*', { count: 'exact', head: true })
    .in('order_status', ['at_lab', 'sequencing']);

  const { count: reportsReady } = await supabase
    .from('kit_orders')
    .select('*', { count: 'exact', head: true })
    .eq('order_status', 'report_ready');

  const { count: activePatients } = await supabase
    .from('kit_orders')
    .select('patient_ref', { count: 'exact', head: true })
    .not('order_status', 'eq', 'cancelled');

  // Recent orders (last 5)
  const { data: recentOrders } = await supabase
    .from('kit_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  const typedOrders = (recentOrders || []) as KitOrder[];

  const stats = [
    { label: 'Total Orders', value: totalOrders ?? 0, color: 'bg-navy' },
    { label: 'Pending Results', value: pendingResults ?? 0, color: 'bg-amber-500' },
    { label: 'Reports Ready', value: reportsReady ?? 0, color: 'bg-teal' },
    { label: 'Active Patients', value: activePatients ?? 0, color: 'bg-blue-500' },
  ];

  const phinColor =
    typedProvider?.phin_status === 'active'
      ? 'bg-green-100 text-green-800'
      : typedProvider?.phin_status === 'suspended'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-800';

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            Welcome, {typedProvider?.first_name || 'Provider'}
          </h1>
          <p className="mt-1 text-gray-500">Here&apos;s an overview of your genomics orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${phinColor}`}>
            PHIN: {typedProvider?.phin_status || 'pending'}
          </span>
          <Link
            href="/dashboard/order"
            className="rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
          >
            Order a Kit
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-navy">{stat.value}</p>
            <div className={`mt-3 h-1 w-12 rounded-full ${stat.color}`} />
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-navy">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-sm font-medium text-teal hover:text-teal-700">
            View All
          </Link>
        </div>

        {typedOrders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No orders yet.</p>
            <Link
              href="/dashboard/order"
              className="mt-4 inline-block rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
            >
              Place Your First Order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Panel Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Ordered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {typedOrders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="text-sm font-medium text-teal hover:text-teal-700"
                      >
                        {order.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium capitalize text-navy">
                        {order.panel_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={order.order_status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    submitted: 'bg-blue-100 text-blue-800',
    fulfilled: 'bg-blue-100 text-blue-800',
    in_transit: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-purple-100 text-purple-800',
    specimen_collected: 'bg-amber-100 text-amber-800',
    at_lab: 'bg-amber-100 text-amber-800',
    sequencing: 'bg-orange-100 text-orange-800',
    resulted: 'bg-teal-100 text-teal-800',
    report_ready: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] || 'bg-gray-100 text-gray-800'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
