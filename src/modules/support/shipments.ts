import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { lockOrder } from "../orders/order";
import { withCase, type CaseMutation } from "./case";
import { SupportError } from "./errors";

const text = (max: number) => z.string().trim().max(max).optional();
const cost = z.number().int().nonnegative().max(1_000_000_000).nullish();
const shippingInput = z.object({ shippedOn: z.iso.date().optional(), courier: text(100), trackingNumber: text(100), recipientName: text(100), recipientContact: text(100), address: text(500), courierCost: cost });
const updateInput = z.object({ status: z.enum(["in_transit", "delivered", "failed", "returned", "lost"]), trackingNumber: text(100), courier: text(100), courierCost: cost });

export async function recordSupportShipment(db: Db, input: CaseMutation & z.input<typeof shippingInput>) {
  const parsed = shippingInput.safeParse(input);
  if (!parsed.success) throw new SupportError("invalid_input");
  return withCase(db, input, async (tx, row) => {
    if (!row.orderId) throw new SupportError("order_required");
    const order = await lockOrder(tx, row.orderId);
    if (order.status === "cancelled") throw new SupportError("wrong_status");
    await tx.insert(s.shipments).values({ ...parsed.data, orderId: order.id, supportCaseId: row.id, status: "in_transit", shippedOn: parsed.data.shippedOn ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()) });
    await recordActivity(tx, { type: "shipment_recorded", actorAccountId: input.actorId, orderId: order.id, supportCaseId: row.id });
  });
}

export async function updateSupportShipment(db: Db, input: CaseMutation & { shipmentId: string } & z.input<typeof updateInput>) {
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) throw new SupportError("invalid_input");
  return withCase(db, input, async (tx, row) => {
    if (!row.orderId) throw new SupportError("order_required");
    const order = await lockOrder(tx, row.orderId);
    if (order.status === "cancelled") throw new SupportError("wrong_status");
    const updated = await tx.update(s.shipments).set(parsed.data).where(and(eq(s.shipments.id, input.shipmentId), eq(s.shipments.orderId, order.id), eq(s.shipments.supportCaseId, row.id))).returning({ id: s.shipments.id });
    if (!updated.length) throw new SupportError("not_found");
    await recordActivity(tx, { type: "shipment_updated", actorAccountId: input.actorId, orderId: order.id, supportCaseId: row.id });
  });
}
