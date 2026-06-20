import type { NotificationChannel, OrderStatus } from "@prisma/client";
import { Mail, MessageCircle, Smartphone } from "lucide-react";

import { ORDER_STATUS } from "@/lib/constants";
import { formatDateTimeIST } from "@/lib/format";
import { StatusBadge } from "@/components/admin/status-badge";

/**
 * Order status-event timeline (docs/12 FR-30). Renders the append-only
 * `OrderStatusEvent` history newest-first, each entry showing the status badge,
 * human label, IST timestamp, the note (courier/tracking/`[Payment]` render as
 * plain text), the actor, and a notification indicator. RSC — presentational
 * only; the page serialises Dates to ISO strings before passing them in.
 */

export interface TimelineEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  /** ISO 8601 string (serialised from the DB `Date`). */
  createdAt: string;
  actorName: string | null;
  channelNotified: NotificationChannel | null;
  customerNotified: boolean;
}

const CHANNEL_META: Record<
  NotificationChannel,
  { label: string; Icon: typeof Mail }
> = {
  email: { label: "Emailed", Icon: Mail },
  sms: { label: "Texted", Icon: Smartphone },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
  system: { label: "System", Icon: Mail },
};

export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline events yet.</p>;
  }

  // Newest first (the DB returns ascending; reverse a shallow copy for display).
  const ordered = [...events].reverse();

  return (
    <ol className="space-y-4">
      {ordered.map((event, index) => {
        const meta = ORDER_STATUS[event.status];
        const channel = event.channelNotified
          ? CHANNEL_META[event.channelNotified]
          : null;
        const isLatest = index === 0;

        return (
          <li key={event.id} className="relative flex gap-3">
            {/* Connector + dot */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 size-2.5 rounded-full ${
                  isLatest ? "bg-primary" : "bg-border"
                }`}
                aria-hidden
              />
              {index < ordered.length - 1 ? (
                <span className="w-px flex-1 bg-border" aria-hidden />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={meta.tone} label={meta.label} />
                <time
                  dateTime={event.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {formatDateTimeIST(event.createdAt)}
                </time>
              </div>

              {event.note ? (
                <p className="mt-1 text-sm text-foreground">{event.note}</p>
              ) : null}

              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{event.actorName ?? "System"}</span>
                {channel && event.customerNotified ? (
                  <span className="inline-flex items-center gap-1">
                    <channel.Icon className="size-3" aria-hidden />
                    {channel.label}
                  </span>
                ) : channel ? (
                  <span className="inline-flex items-center gap-1">
                    <channel.Icon className="size-3" aria-hidden />
                    {channel.label} link
                  </span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
