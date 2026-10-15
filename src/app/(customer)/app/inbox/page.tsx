import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { listInbox } from "@/modules/forms/submissions";

export const instant = false;

const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export default async function InboxPage({ searchParams }: PageProps<"/app/inbox">) {
  const viewer = await requireAccount("/app");
  const { before: raw } = await searchParams;
  const cursor = typeof raw === "string" ? CURSOR.exec(raw) : null;
  const before = cursor ? { createdAt: cursor[1], id: cursor[4] } : undefined;
  const { items, next } = await listInbox(db, { accountId: viewer.accountId, before });
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        {items.length ? <ul className="flex flex-col gap-3">{items.map(item => <li key={item.id}><Link href={`/app/inbox/${item.id}`} className="flex min-h-11 flex-col gap-1 rounded-xl border p-4"><span className="break-words font-medium">{item.preview}</span><span className="text-sm text-muted-foreground">{item.profileName ?? "Untitled profile"} · {item.formTitle}</span><span className="text-sm text-muted-foreground">{formatDateTime(item.createdAt)}</span>{item.unread ? <span className="text-sm font-medium">New</span> : null}</Link></li>)}</ul> : <p className="text-sm text-muted-foreground">No messages yet. Messages people send from your Neffi appear here.</p>}
        {next ? <Link href={`?before=${encodeURIComponent(`${next.createdAt}|${next.id}`)}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Show older</Link> : null}
      </div>
    </main>
  );
}
