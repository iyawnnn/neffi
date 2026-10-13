import Link from "next/link";
import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { search } from "@/modules/search";
export const instant = false;
export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  await requireOwner(); await connection();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const results = await search(db, query);
  const groups = [
    ["Orders", results.orders.map((r) => ({ key: r.id, label: `Order ${r.number} · ${r.status.replaceAll("_", " ")}`, href: `/admin/orders/${r.id}` }))],
    ["Purchasers", results.purchasers.map((r) => ({ key: r.id, label: `${r.name} ${r.contactNumber ?? ""}`, href: `/admin/customers/purchasers/${r.id}` }))],
    ["Accounts", results.accounts.map((r) => ({ key: r.id, label: r.email, href: `/admin/customers/accounts/${r.id}` }))],
    ["Cards", results.cards.map((r) => ({ key: r.id, label: `${r.kind ?? "Unassigned"} · ${r.state} · ${r.publicToken ?? r.id}`, href: `/admin/inventory/cards/${r.id}` }))],
    ["Tracking", results.shipments.map((r) => ({ key: r.id, label: r.trackingNumber ?? "", href: `/admin/orders/${r.orderId}` }))],
  ] as const;
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8"><h1 className="text-2xl font-semibold">Search</h1><p className="break-words">Results for “{query}”</p>{groups.map(([title, rows]) => <section key={title}><h2 className="font-semibold">{title}</h2><ul>{rows.map((row) => <li key={row.key}><Link className="flex min-h-11 items-center break-all border-b py-3" href={row.href}>{row.label}</Link></li>)}</ul>{!rows.length ? <p className="text-sm text-muted-foreground">No matches.</p> : null}{rows.length === 8 ? <p className="text-sm">First 8 matches. Refine your search.</p> : null}</section>)}</main>;
}
