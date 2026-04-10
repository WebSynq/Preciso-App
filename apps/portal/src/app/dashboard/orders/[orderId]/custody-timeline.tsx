'use client';

import type { CustodyEvent, CustodyEventType } from '@preciso/types';

const ALL_STEPS: { type: CustodyEventType; label: string }[] = [
  { type: 'ordered', label: 'Order Placed' },
  { type: 'kit_shipped', label: 'Kit Shipped' },
  { type: 'kit_delivered', label: 'Kit Delivered' },
  { type: 'specimen_collected', label: 'Specimen Collected' },
  { type: 'specimen_shipped', label: 'Specimen Shipped' },
  { type: 'lab_received', label: 'Lab Received' },
  { type: 'sequencing_started', label: 'Sequencing Started' },
  { type: 'sequencing_complete', label: 'Sequencing Complete' },
  { type: 'result_uploaded', label: 'Result Uploaded' },
];

interface CustodyTimelineProps {
  events: CustodyEvent[];
  currentStatus: string;
}

/**
 * Vertical stepper showing all chain-of-custody events.
 * Completed steps show in teal, current in navy, pending in gray, flagged in red.
 */
export function CustodyTimeline({ events, currentStatus }: CustodyTimelineProps) {
  const completedTypes = new Set(events.map((e) => e.event_type));
  const eventMap = new Map(events.map((e) => [e.event_type, e]));
  const isCancelled = currentStatus === 'cancelled';

  return (
    <div className="relative">
      {ALL_STEPS.map((step, index) => {
        const event = eventMap.get(step.type);
        const isCompleted = completedTypes.has(step.type);
        const isLast = index === ALL_STEPS.length - 1;

        // Determine which step is "current" (first non-completed step)
        const firstIncompleteIdx = ALL_STEPS.findIndex(
          (s) => !completedTypes.has(s.type),
        );
        const isCurrent = index === firstIncompleteIdx && !isCancelled;

        let dotColor = 'bg-gray-300';
        let lineColor = 'bg-gray-200';
        let textColor = 'text-gray-400';

        if (isCompleted) {
          dotColor = 'bg-teal';
          lineColor = 'bg-teal';
          textColor = 'text-gray-800';
        } else if (isCurrent) {
          dotColor = 'bg-navy';
          textColor = 'text-navy';
        }

        if (isCancelled) {
          dotColor = isCompleted ? 'bg-teal' : 'bg-gray-300';
        }

        return (
          <div key={step.type} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical line */}
            {!isLast && (
              <div
                className={`absolute left-[11px] top-6 h-full w-0.5 ${
                  isCompleted ? lineColor : 'bg-gray-200'
                }`}
              />
            )}

            {/* Dot */}
            <div className="relative z-10 flex-shrink-0">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${dotColor}`}
              >
                {isCompleted && (
                  <svg
                    className="h-3.5 w-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isCurrent && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-sm font-medium ${textColor}`}>{step.label}</p>
              {event && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.location && (
                    <p className="text-xs text-gray-400">Location: {event.location}</p>
                  )}
                  {event.scanned_by && (
                    <p className="text-xs text-gray-400">By: {event.scanned_by}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isCancelled && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          This order has been cancelled.
        </div>
      )}
    </div>
  );
}
