import type { KitOrder } from '@preciso/types';
import Link from 'next/link';

import { createServerSupabaseClient } from '@/lib/supabase/server';

const STATUS_COLORS: Record<string, string> = {
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

const ALL_STATUSES = [
  'pending', 'submitted', 'fulfilled', 'in_transit', 'delivered',
  'specimen_collected', 'at_lab', 'sequencing', 'resulted', 'report_ready', 'cancelled',
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; patient?: string; status?: string; search?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const resolvedSearch = await searchParams;

  const page = Math.max(1, parseInt(resolvedSearch.page || '1'));
  const patientFilter = resolvedSearch.patient?.trim() || '';
  const statusFilter = resolvedSearch.status?.trim() || '';
  const searchQuery = resolvedSearch.search?.trim() || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Active filter = patient param OR search box
  const activeSearch = patientFilter || searchQuery;

  let query = supabase
    .from('kit_orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (activeSearch) {
    query = query.ilike('patient_ref', `%${activeSearch}%`);
  }
  if (statusFilter && ALL_STATUSES.includes(statusFilter)) {
    query = query.eq('order_status', statusFilter);
  }

  const { data: orders, count } = await query;

  const typedOrders = (orders || []) as KitOrder[];
  const totalPages = Math.ceil((count || 0) / limit);
  const hasFilters = !!(activeSearch || statusFilter);

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (activeSearch) params.set('search', activeSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (p > 1) params.set('page', String(p));
    const q = params.toString();
    return `/dashboard/orders${q ? `?${q}` : ''}`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">My Orders</h1>
        <Link
          href="/dashboard/order"
          className="rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
        >
          New Order
        </Link>
      </div>

      {/* Search + Filter bar */}
      <form method="GET" action="/dashboard/orders" className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            name="search"
            type="text"
            defaultValue={activeSearch}
            placeholder="Search by patient reference..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
          />
        </div>

        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal/50"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-400"
        >
          Search
        </button>

        {hasFilters && (
          <Link
            href="/dashboard/orders"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Active filter badge */}
      {patientFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <span>Showing orders for patient:</span>
          <span className="rounded-full bg-navy/10 px-3 py-0.5 font-mono font-medium text-navy">
            {patientFilter}
          </span>
          <Link href="/dashboard/orders" className="text-gray-400 hover:text-gray-600">
            ✕
          </Link>
        </div>
      )}

      {typedOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          {hasFilters ? (
            <>
              <p className="mb-4 text-gray-500">No orders match your search.</p>
              <Link
                href="/dashboard/orders"
                className="text-sm font-medium text-teal hover:text-teal-700"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <p className="mb-4 text-gray-500">You haven&apos;t placed any orders yet.</p>
              <Link
                href="/dashboard/order"
                className="inline-block rounded-lg bg-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
              >
                Place Your First Order
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Patient Ref</th>
                    <th className="px-6 py-3">Panel Type</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Ordered</th>
                    <th className="px-6 py-3">Last Updated</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {typedOrders.map((order) => (
                    <tr key={order.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">
                        {order.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4">
                        {order.patient_ref ? (
                          <Link
                            href={`/dashboard/orders?patient=${encodeURIComponent(order.patient_ref)}`}
                            className="font-mono text-sm text-navy hover:underline"
                          >
                            {order.patient_ref}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium capitalize text-navy">
                          {order.panel_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[order.order_status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {order.order_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-sm font-medium text-teal hover:text-teal-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({count} total orders)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageUrl(page - 1)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildPageUrl(page + 1)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
