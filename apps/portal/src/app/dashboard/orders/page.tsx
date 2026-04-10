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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createServerSupabaseClient();
  const page = Math.max(1, parseInt(searchParams.page || '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  const {
    data: orders,
    count,
  } = await supabase
    .from('kit_orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const typedOrders = (orders || []) as KitOrder[];
  const totalPages = Math.ceil((count || 0) / limit);

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

      {typedOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="mb-4 text-gray-500">You haven&apos;t placed any orders yet.</p>
          <Link
            href="/dashboard/order"
            className="inline-block rounded-lg bg-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
          >
            Place Your First Order
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Order ID</th>
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
                    href={`/dashboard/orders?page=${page - 1}`}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/dashboard/orders?page=${page + 1}`}
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
