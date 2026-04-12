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

type PatientSummary = {
  patientRef: string;
  orderCount: number;
  latestStatus: string;
  latestOrderId: string;
  latestPanelType: string;
  lastUpdated: string;
};

export default async function PatientsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: orders } = await supabase
    .from('kit_orders')
    .select('id, patient_ref, order_status, panel_type, updated_at')
    .order('updated_at', { ascending: false });

  const typedOrders = (orders || []) as Pick<
    KitOrder,
    'id' | 'patient_ref' | 'order_status' | 'panel_type' | 'updated_at'
  >[];

  // Group by patient_ref — orders already sorted desc so first hit = latest
  const patientMap = new Map<string, PatientSummary>();
  for (const order of typedOrders) {
    const ref = order.patient_ref || '—';
    if (!patientMap.has(ref)) {
      patientMap.set(ref, {
        patientRef: ref,
        orderCount: 1,
        latestStatus: order.order_status,
        latestOrderId: order.id,
        latestPanelType: order.panel_type,
        lastUpdated: order.updated_at,
      });
    } else {
      patientMap.get(ref)!.orderCount += 1;
    }
  }

  const patients = Array.from(patientMap.values());

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Patients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Grouped by your internal patient reference IDs
          </p>
        </div>
        <Link
          href="/dashboard/order"
          className="rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
        >
          New Order
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="mb-4 text-gray-500">
            No patients yet. Once you place orders they will appear here, grouped by
            patient reference.
          </p>
          <Link
            href="/dashboard/order"
            className="inline-block rounded-lg bg-teal px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
          >
            Place Your First Order
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-500">
            {patients.length} unique patient reference{patients.length !== 1 ? 's' : ''}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Patient Reference</th>
                    <th className="px-6 py-3">Orders</th>
                    <th className="px-6 py-3">Latest Panel</th>
                    <th className="px-6 py-3">Latest Status</th>
                    <th className="px-6 py-3">Last Updated</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patients.map((patient) => (
                    <tr key={patient.patientRef} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-medium text-gray-800">
                          {patient.patientRef}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                          {patient.orderCount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
                          {patient.latestPanelType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[patient.latestStatus] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {patient.latestStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(patient.lastUpdated).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <Link
                            href={`/dashboard/orders?patient=${encodeURIComponent(patient.patientRef)}`}
                            className="text-sm font-medium text-teal hover:text-teal-700"
                          >
                            View Orders
                          </Link>
                          <Link
                            href={`/dashboard/orders/${patient.latestOrderId}`}
                            className="text-sm font-medium text-gray-400 hover:text-gray-600"
                          >
                            Latest
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
