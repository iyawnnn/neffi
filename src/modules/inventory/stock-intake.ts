import "server-only";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { activeProductId } from "../cards/card";
import type { Db } from "../db";
import { validateStockCosts } from "./stock-purchases";

export type ReceiveStockInput = {
  actorId: string;
  receivedOn: string;
  quantity: number;
  supplier?: string;
  reference?: string;
  notes?: string;
  intendedKind?: "dbc" | "grc";
  purchaseCost?: number | null;
  inboundShippingCost?: number | null;
};

export async function receiveStock(db: Db, input: ReceiveStockInput): Promise<{ stockPurchaseId: string }> {
  validateStockCosts(input);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 500) {
    throw new RangeError("quantity must be a whole number from 1 to 500");
  }

  return db.transaction(async (tx) => {
    const product = input.intendedKind ? { productId: await activeProductId(tx, input.intendedKind), kind: input.intendedKind } : {};
    const [purchase] = await tx
      .insert(schema.stockPurchases)
      .values({
        receivedOn: input.receivedOn,
        supplier: input.supplier,
        reference: input.reference,
        notes: input.notes,
        purchaseCost: input.purchaseCost,
        inboundShippingCost: input.inboundShippingCost,
        createdByAccountId: input.actorId,
      })
      .returning({ id: schema.stockPurchases.id });
    await tx.insert(schema.cards).values(Array.from({ length: input.quantity }, () => ({ stockPurchaseId: purchase.id, ...product })));
    await recordActivity(tx, {
      type: "stock_received",
      actorAccountId: input.actorId,
      stockPurchaseId: purchase.id,
      note: `${input.quantity} cards`,
    });
    return { stockPurchaseId: purchase.id };
  });
}
