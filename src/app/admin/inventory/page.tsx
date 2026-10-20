import { connection } from "next/server";
import { Plus } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { cardStateCounts, countCards, listCards } from "@/modules/inventory/queries";
import { countStockPurchases, listStockPurchases } from "@/modules/inventory/stock-purchases";
import { pageWindow } from "@/modules/pagination";
import { ActionSheet } from "../orders/[orderId]/action-sheet";
import { StockForm } from "./forms";
import { InventoryView } from "./inventory-view";

export const instant = false;

const STATES = ["blank", "ready", "reserved", "released", "retired"] as const;
// Card rows are tall and carry a token, so inventory pages at 10; every other list uses the shared 20.
const PAGE_SIZE = 10;

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireOwner();
  await connection();
  const params = await searchParams;
  const kind = z.enum(["dbc", "grc", "none"]).safeParse(params.kind);
  const state = z.enum(STATES).safeParse(params.state);
  const stockView = params.view === "stock";
  const filters = { kind: kind.success ? kind.data : undefined, state: state.success ? state.data : undefined };
  const counts = await cardStateCounts(db);
  const paging = pageWindow(stockView ? await countStockPurchases(db) : await countCards(db, filters), params.page, PAGE_SIZE);
  const cardPage = stockView ? null : await listCards(db, { ...filters, limit: PAGE_SIZE, offset: paging.offset });
  const purchases = stockView ? await listStockPurchases(db, { limit: PAGE_SIZE, offset: paging.offset }) : [];

  return <InventoryView
    stockView={stockView}
    filters={filters}
    counts={counts}
    paging={paging}
    cardPage={cardPage}
    purchases={purchases}
    actions={<ActionSheet title="Receive stock" description="Log a delivery of blank cards." icon={<Plus aria-hidden />} variant="action"><StockForm /></ActionSheet>}
  />;
}
