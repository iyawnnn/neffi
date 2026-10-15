import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { inputClass } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format-date";
import { listCases } from "@/modules/support/queries";

export const instant = false;

export default async function SupportQueue({ searchParams }: Pick<PageProps<"/admin/support">, "searchParams">) {
  await requireOwner();
  await connection();
  const params = await searchParams;
  const status = z.enum(["open", "waiting_on_customer", "resolved"]).safeParse(params.status);
  const source = z.enum(["owner", "public", "account"]).safeParse(params.source);
  const filters = { before: typeof params.before === "string" ? params.before : undefined, status: status.success ? status.data : undefined, source: source.success ? source.data : undefined };
  const page = await listCases(db, filters);
  const next = new URLSearchParams();
  if (page.next) next.set("before", page.next);
  if (filters.status) next.set("status", filters.status);
  if (filters.source) next.set("source", filters.source);
  return <main data-admin-section="support" className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Support</h1><Link className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-primary-foreground" href="/admin/support/new">Open support case</Link></header>
    <form className="flex flex-wrap items-end gap-3"><label className="flex flex-col gap-1 text-sm">Status<select name="status" className={inputClass} defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="open">Open</option><option value="waiting_on_customer">Waiting on customer</option><option value="resolved">Resolved</option></select></label><label className="flex flex-col gap-1 text-sm">Source<select name="source" className={inputClass} defaultValue={filters.source ?? ""}><option value="">All sources</option><option value="owner">Owner</option><option value="public">Public</option><option value="account">Account</option></select></label><button className="min-h-11 rounded-lg border px-4">Filter cases</button></form>
    <div>{page.cases.map((row) => <Link key={row.id} href={`/admin/support/${row.id}`} className="flex min-h-11 flex-col gap-1 border-b py-4"><p className="break-words font-medium">{row.summary}</p><p className="text-sm text-muted-foreground">{row.type.replaceAll("_", " ")} · {row.status.replaceAll("_", " ")} · {formatDateTime(row.createdAt)}</p></Link>)}{!page.cases.length ? <p>No support cases match these filters.</p> : null}</div>
    {page.next ? <Link className="flex min-h-11 items-center underline" href={`/admin/support?${next}`}>Older cases</Link> : null}
  </main>;
}
