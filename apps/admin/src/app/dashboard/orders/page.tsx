import { createClient as createAdminClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

import { requireAdmin } from '@/lib/auth/require-admin';
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
  // requireAdmin both gates the page AND gives us the user for the audit.
  // Layout already calls it, but calling again is idempotent and keeps
  // this file independently safe if layout assumptions change.
  const { user } = await requireAdmin();

  // SECURITY NOTE: Admin viewing orders = bulk PHI access. HIPAA requires
  // each such access be logged. Write an 'admin.orders.list' audit row
  // before the data is fetched so even if the SELECT later fails we have
  // a record of the attempt.
  void writeAdminReadAudit({
    userId: user.id,
    ip: headers().get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: headers().get('user-agent'),
  });

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

/**
 * Fire-and-forget audit log for admin bulk PHI reads. Uses the service
 * role client — admin-role JWTs cannot INSERT into audit_logs directly,
 * only SELECT (migration 00003 + 00004).
 */
async function writeAdminReadAudit(opts: {
  userId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[admin/orders] audit skipped: service role key missing');
    return;
  }
  try {
    const client = createAdminClient(url, key, { auth: { persistSession: false } });
    await client.from('audit_logs').insert({
      actor_id: opts.userId,
      actor_type: 'admin',
      action: 'admin.orders.list',
      resource_type: 'kit_orders',
      resource_id: opts.userId,
      ip_address: opts.ip,
      user_agent: opts.userAgent,
    });
  } catch (err) {
    console.error('[admin/orders] audit insert failed', err);
  }
}
