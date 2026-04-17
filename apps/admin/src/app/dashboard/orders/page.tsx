import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  provider_id: string;
  patient_ref: string | null;
  panel_type: string;
  order_status: string;
  kit_barcode: string | null;
  tracking_number: string | null;
  created_at: string;
}

export default async function AdminOrdersPage() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('kit_orders')
    .select(
      'id, provider_id, patient_ref, panel_type, order_status, kit_barcode, tracking_number, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const orders = (data || []) as OrderRow[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">All Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Showing the {orders.length} most recent kit order{orders.length === 1 ? '' : 's'}
          {' '}across every provider.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load orders.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-6 py-3">Order ID</th>
              <th className="px-6 py-3">Provider</th>
              <th className="px-6 py-3">Patient Ref</th>
              <th className="px-6 py-3">Panel</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Barcode</th>
              <th className="px-6 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="transition hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {o.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {o.provider_id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{o.patient_ref || '—'}</td>
                  <td className="px-6 py-3 text-sm capitalize">{o.panel_type}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                      {o.order_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {o.kit_barcode || '—'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(o.created_at).toLocaleDateString()}
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
