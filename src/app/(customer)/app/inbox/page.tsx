import { Inbox } from "lucide-react";
import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { EmptyState } from "@/components/app-ui";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { listInbox, unreadCount } from "@/modules/forms/submissions";
import { formatInboxDate } from "./inbox-date";

export const instant = false;

const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-](?:0\d|1[0-5])(:[0-5]\d)?)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export default async function InboxPage({ searchParams }: PageProps<"/app/inbox">) {
  const viewer = await requireAccount("/app");
  const { before: raw, filter } = await searchParams;
  const unreadOnly = filter === "unread";
  const cursor = typeof raw === "string" ? CURSOR.exec(raw) : null;
  const localTime = cursor?.[1].slice(0, 19).replace(" ", "T");
  const date = localTime ? new Date(`${localTime}Z`) : null;
  const valid = date && Number.isFinite(date.getTime()) && date.getUTCFullYear() > 0 && date.toISOString().slice(0, 19) === localTime;
  const before = cursor && valid ? { createdAt: cursor[1], id: cursor[4] } : undefined;
  const [{ items, next }, unread] = await Promise.all([listInbox(db, { accountId: viewer.accountId, before, ...(unreadOnly ? { unreadOnly: true } : {}) }), unreadCount(db, viewer.accountId)]);
  // The account's request-header read above keeps relative timestamps out of prerendering.
  const now = new Date();
  return (
    <main data-canvas className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-10 md:gap-8 md:px-6 md:pt-8 md:pb-12">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="order-1 shrink-0 text-title">Inbox</h1>
        <nav aria-label="Inbox filters" className="order-3 ml-auto flex shrink-0 gap-1 rounded-lg bg-subtle p-1 min-[375px]:order-2">
          <Link id="inbox-all" href="/app/inbox" aria-current={!unreadOnly ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md px-4 text-meta font-medium transition-colors duration-[220ms] hover:bg-background focus-visible:outline-2 focus-visible:outline-brand ${!unreadOnly ? "bg-background text-foreground" : "text-fg-secondary"}`}>All</Link>
          <Link href="/app/inbox?filter=unread" aria-current={unreadOnly ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-meta font-medium transition-colors duration-[220ms] hover:bg-background focus-visible:outline-2 focus-visible:outline-brand ${unreadOnly ? "bg-background text-foreground" : "text-fg-secondary"}`}>Unread{unread > 0 ? <span className="text-label tabular-nums">{unread}</span> : null}</Link>
        </nav>
        <p className="order-2 basis-full text-body text-fg-secondary min-[375px]:order-3">Messages people send through your Neffi profiles appear here.</p>
      </header>
      <section aria-label="Messages" className="overflow-hidden rounded-panel border bg-background">
        {items.length ? <ul className="divide-y">{items.map(item => {
          const sender = item.senderName || item.senderEmail || "Unknown sender";
          return <li key={item.id}>
            <Link href={`/app/inbox/${item.id}`} className={`grid min-h-11 min-w-0 cursor-pointer grid-cols-[6px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-3 py-3 transition-colors duration-[220ms] hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none sm:gap-x-3 sm:gap-y-0.5 sm:px-5 ${item.unread ? "bg-canvas/50" : ""}`}>
              <span className="row-span-3 flex h-5 items-center self-start">{item.unread ? <><span aria-hidden className="size-1.5 rounded-full bg-brand" /><span className="sr-only">Unread message</span></> : null}</span>
              <span className="flex min-w-0 items-baseline justify-between gap-2"><span className={`truncate text-body ${item.unread ? "font-semibold" : "font-normal"}`}>{sender}</span><time dateTime={item.createdAt.toISOString()} title={formatDateTime(item.createdAt)} className="shrink-0 text-label text-fg-secondary tabular-nums">{formatInboxDate(item.createdAt, now)}</time></span>
              <span className="col-start-2 line-clamp-2 text-meta wrap-anywhere text-fg-secondary">{item.messagePreview}</span>
              <span className="col-start-2 truncate text-label text-fg-secondary">{item.formTitle}</span>
            </Link>
          </li>;
        })}</ul> : <div className="flex flex-col justify-center sm:min-h-[300px]">
          <EmptyState icon={Inbox} title={unreadOnly ? "You're all caught up" : "No messages yet"} description={unreadOnly ? "You have no unread messages." : "When someone sends you a message through one of your Neffi contact forms, it will appear here."} />
        </div>}
      </section>
      {next ? <Link href={`?${unreadOnly ? "filter=unread&" : ""}before=${encodeURIComponent(`${next.createdAt}|${next.id}`)}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Show older</Link> : null}
    </main>
  );
}
