import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { countPurchasers, listPurchaserDirectory } from "@/modules/orders/purchasers";
import { countAccounts, listAccounts } from "@/modules/accounts/directory";
import { PAGE_SIZE, pageWindow } from "@/modules/pagination";
import { CustomersView } from "./customers-view";

export const instant = false;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireOwner(); await connection();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const accounts = params.view === "accounts";
  const paging = pageWindow(accounts ? await countAccounts(db, query) : await countPurchasers(db, query), params.page);
  const accountRows = accounts ? await listAccounts(db, query, { limit: PAGE_SIZE, offset: paging.offset }) : [];
  const purchaserRows = accounts ? [] : await listPurchaserDirectory(db, { query, limit: PAGE_SIZE, offset: paging.offset });
  return <CustomersView accounts={accounts} query={query} paging={paging} accountRows={accountRows} purchaserRows={purchaserRows} />;
}
