import Link from "next/link";
import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { listPurchasers } from "@/modules/orders/purchasers";
import { listAccounts } from "@/modules/accounts/directory";
import { inputClass } from "@/components/ui/input";
export const instant = false;
export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireOwner(); await connection();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const accounts = params.view === "accounts";
  const rows = accounts ? await listAccounts(db, query) : await listPurchasers(db, query);
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Customers</h1><nav className="flex gap-4"><Link className="min-h-11 py-2 underline" href="/admin/customers">Purchasers</Link><Link className="min-h-11 py-2 underline" href="/admin/customers?view=accounts">Neffi Accounts</Link></nav>
    <p className="text-sm text-muted-foreground">Purchasers are commercial buyers. Neffi Accounts are separate and read-only.</p>
    <form className="flex gap-2"><input type="hidden" name="view" value={accounts ? "accounts" : "purchasers"} /><label className="flex-1">{accounts ? "Account email" : "Purchaser name or contact"}<input className={inputClass} name="q" defaultValue={query} maxLength={100} /></label><button className="min-h-11 self-end rounded-lg border px-4">Search</button></form>
    <ul className="divide-y">{rows.map((row) => <li key={row.id}><Link className="flex min-h-11 flex-wrap justify-between gap-2 py-4" href={`/admin/customers/${accounts ? "accounts" : "purchasers"}/${row.id}`}>{"email" in row ? <><span className="break-all">{row.email}</span><span>{row.role}</span></> : <><span>{row.name}</span><span>{row.contactNumber}</span></>}</Link></li>)}</ul>
    {!rows.length ? <p>No matches.</p> : null}{rows.length === 50 ? <p className="text-sm">Showing the first 50. Refine your search.</p> : null}
  </main>;
}
