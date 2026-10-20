import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { getStockPurchase } from "@/modules/inventory/stock-purchases";
import { adminPage, cardTone, label, PageHeader, Panel, Section, Status } from "../../../ui";
import { StockPurchaseForm } from "../../forms";

export const instant = false;
export default async function StockPurchasePage({ params }: PageProps<"/admin/inventory/stock/[stockPurchaseId]">) {
  await requireOwner();
  await connection();
  const { stockPurchaseId } = await params;
  if (!z.uuid().safeParse(stockPurchaseId).success) notFound();
  const purchase = await getStockPurchase(db, stockPurchaseId);
  if (!purchase) notFound();
  return (
    <main data-admin-section="inventory" className={adminPage}>
      <PageHeader back={{ href: "/admin/inventory?view=stock", label: "Stock purchases" }} title="Stock purchase" description={`${purchase.quantity} cards`} />
      <Section title="Card states" description="Where the cards from this delivery are now.">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {Object.entries(purchase.states).map(([state, count]) => <li key={state}><Status tone={cardTone(state)}>{label(state)}: {count}</Status></li>)}
        </ul>
      </Section>
      <Section title="Details">
        <Panel padded className="max-w-xl"><StockPurchaseForm purchase={purchase} /></Panel>
      </Section>
    </main>
  );
}
