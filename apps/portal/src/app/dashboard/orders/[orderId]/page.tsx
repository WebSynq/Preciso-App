import type { CustodyEvent, KitOrder, LabResult } from '@preciso/types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from '@/lib/supabase/server';

import { CancelOrderButton } from './cancel-button';
import { CustodyTimeline } from './custody-timeline';

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { success?: string };
}) {
  const supabase = createServerSupabaseClient();
  const { orderId } = params;

  const { data: order, error } = await supabase
    .from('kit_orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    redirect('/dashboard/orders');
  }

  const typedOrder = order as KitOrder;

  const { data: custodyEvents } = await supabase
    .from('custody_events')
    .select('*')
    .eq('kit_order_id', orderId)
    .order('created_at', { ascending: true });

  const { data: labResults } = await supabase
    .from('lab_results')
    .select('*')
    .eq('kit_order_id', orderId);

  const typedEvents = (custodyEvents || []) as CustodyEvent[];
  const typedResults = (labResults || []) as LabResult[];

  const canCancel = ['pending', 'submitted'].includes(typedOrder.order_status);
  const hasReport = typedOrder.order_status === 'report_ready';

  const statusColor: Record<string, string> = {
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
    <div className="mx-auto max-w-3xl">
      {searchParams.success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Order submitted successfully! Your kit will be shipped soon.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard/orders"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-navy">
            Order {typedOrder.id.slice(0, 8)}
          </h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${statusColor[typedOrder.order_status] || 'bg-gray-100 text-gray-800'}`}
        >
          {typedOrder.order_status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Order summary */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-navy">Order Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Panel Type" value={typedOrder.panel_type} capitalize />
          <Field label="Patient Reference" value={typedOrder.patient_ref || '—'} />
          <Field label="Kit Barcode" value={typedOrder.kit_barcode || 'Pending assignment'} />
          <Field label="Tracking Number" value={typedOrder.tracking_number || 'Not yet shipped'} />
          <Field label="Ordered" value={new Date(typedOrder.created_at).toLocaleString()} />
          <Field label="Last Updated" value={new Date(typedOrder.updated_at).toLocaleString()} />
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          {hasReport && (
            <a
              href="https://precisoreport.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-600"
            >
              Download Report
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
          {canCancel && <CancelOrderButton orderId={typedOrder.id} />}
        </div>
      </div>

      {/* Custody Timeline */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-navy">Chain of Custody</h2>
        <CustodyTimeline events={typedEvents} currentStatus={typedOrder.order_status} />
      </div>

      {/* Lab Results */}
      {typedResults.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-navy">Lab Results</h2>
          {typedResults.map((result) => (
            <div key={result.id} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-700 capitalize">{result.lab_partner}</p>
                <p className="text-xs text-gray-400">
                  {result.result_received_at
                    ? new Date(result.result_received_at).toLocaleString()
                    : 'Pending'}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  result.result_status === 'complete'
                    ? 'bg-green-100 text-green-800'
                    : result.result_status === 'flagged'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {result.result_status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-0.5 font-medium text-gray-800 ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
    </div>
  );
}
