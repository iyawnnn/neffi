import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { getStockPurchase } from "@/modules/inventory/stock-purchases";
import { StockPurchaseForm } from "../../forms";

export const instant = false;
export default async function StockPurchasePage({ params }: PageProps<"/admin/inventory/stock/[stockPurchaseId]">) {
  await requireOwner();
  await connection();
  const { stockPurchaseId } = await params;
  if (!z.uuid().safeParse(stockPurchaseId).success) notFound();
  const purchase = await getStockPurchase(db, stockPurchaseId);
  if (!purchase) notFound();
  return <main data-admin-section="inventory" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
    <Link className="underline" href="/admin/inventory?view=stock">Stock Purchases</Link><h1 className="text-2xl font-semibold">Stock purchase</h1>
    <p>{purchase.quantity} cards</p><ul className="flex flex-wrap gap-4">{Object.entries(purchase.states).map(([state, count]) => <li key={state}>{state}: {count}</li>)}</ul>
    <StockPurchaseForm purchase={purchase} />
  </main>;
}
