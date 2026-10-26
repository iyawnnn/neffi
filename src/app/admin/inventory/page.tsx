import { connection } from "next/server";
import { Plus } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { countInventoryQueue, inventoryStatusCounts, listInventoryQueue, queueFilters, stockShortage } from "@/modules/inventory/queries";
import { countStockPurchases, listStockPurchases } from "@/modules/inventory/stock-purchases";
import { PAGE_SIZE, pageWindow } from "@/modules/pagination";
import { ActionSheet } from "../orders/[orderId]/action-sheet";
import { StockForm } from "./forms";
import { InventoryView } from "./inventory-view";

export const instant = false;

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireOwner();
  await connection();
  const params = await searchParams;
  const status = z.enum(queueFilters as [string, ...string[]]).safeParse(params.status);
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) || undefined : undefined;
  const stockView = params.view === "stock";
  const options = { filter: status.success ? (status.data as (typeof queueFilters)[number]) : undefined, search };
  const [counts, shortage] = await Promise.all([inventoryStatusCounts(db), stockShortage(db)]);
  const paging = pageWindow(stockView ? await countStockPurchases(db) : await countInventoryQueue(db, options), params.page, PAGE_SIZE);
  const queue = stockView ? null : await listInventoryQueue(db, { ...options, limit: PAGE_SIZE, offset: paging.offset });
  const purchases = stockView ? await listStockPurchases(db, { limit: PAGE_SIZE, offset: paging.offset }) : [];

  return <InventoryView
    stockView={stockView}
    filter={options.filter}
    search={search}
    counts={counts}
    shortage={shortage}
    paging={paging}
    queue={queue}
    purchases={purchases}
    actions={<ActionSheet title="Receive stock" description="Log a delivery of blank cards." icon={<Plus aria-hidden />} variant="action"><StockForm /></ActionSheet>}
  />;
}
