import Link from "next/link";
import { Badge } from "@/src/components/ui/badge";

export type TimelineEvent = {
  id: string;
  at: Date;
  title: string;
  detail?: string;
  category: string;
  href?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
};

function formatTimelineDate(value: Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function ActivityTimeline({
  events,
  emptyTitle = "Nu exista evenimente",
  emptyDescription = "Activitatea va aparea aici dupa primele operatiuni.",
}: {
  events: TimelineEvent[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 text-sm">
        <p className="font-semibold text-[var(--foreground)]">{emptyTitle}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">{event.title}</p>
            <Badge tone={event.tone || "neutral"}>{event.category}</Badge>
          </div>
          {event.detail ? <p className="mt-1 text-xs text-[var(--muted-strong)]">{event.detail}</p> : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">{formatTimelineDate(event.at)}</p>
            {event.href ? (
              <Link className="text-xs font-semibold text-[#c6dbff] hover:underline" href={event.href}>
                Deschide
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
