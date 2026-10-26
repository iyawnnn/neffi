import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { quietText } from "../../ui";

export type TimelineEntry = { id: string; title: string; detail?: string; at: Date };

function Entries({ entries, latest, connected }: { entries: TimelineEntry[]; latest?: boolean; connected: boolean }) {
  return (
    <ul>
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className={cn("relative ml-[3px] border-l pb-4 pl-5", last && !connected && "border-transparent pb-0")}>
            <span aria-hidden className={cn("absolute top-1.5 -left-[4px] size-[7px] rounded-full", latest && index === 0 ? "bg-foreground" : "bg-border-strong")} />
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <p className="min-w-0 break-words text-body font-medium">{entry.title}</p>
              <time dateTime={entry.at.toISOString()} className="shrink-0 text-label tabular-nums text-fg-secondary">{formatDateTime(entry.at)}</time>
            </div>
            {entry.detail ? <p className={cn(quietText, "break-words")}>{entry.detail}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

// Newest first. Only the latest few events show; the rest stay one click away so history never crowds the page.
export function ActivityTimeline({ entries, limit = 5 }: { entries: TimelineEntry[]; limit?: number }) {
  if (!entries.length) return <p className="px-4 py-4 text-meta text-fg-secondary sm:px-5">No activity yet.</p>;
  const recent = entries.slice(0, limit);
  const older = entries.slice(limit);
  return (
    <div className="flex flex-col px-4 py-4 sm:px-5">
      <Entries entries={recent} latest connected={older.length > 0} />
      {older.length ? (
        <details className="group/older">
          <summary className="mb-3 -mt-1 ml-[3px] flex min-h-9 w-fit cursor-pointer list-none items-center rounded-md pl-5 text-meta font-medium text-action-text hover:underline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
            <span className="group-open/older:hidden">Show all {entries.length} events</span>
            <span className="hidden group-open/older:inline">Show fewer</span>
          </summary>
          <Entries entries={older} connected={false} />
        </details>
      ) : null}
    </div>
  );
}
