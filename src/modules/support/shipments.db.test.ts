import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "@/db/schema";
import { insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { loadOrderFacts } from "../orders/order";
import { updateShipment } from "../orders/fulfillment";
import { expenseReport } from "../expenses/report";
import { openCase } from "./case";
import { recordSupportShipment, updateSupportShipment } from "./shipments";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test.each(["in_progress", "completed"] as const)("support shipment on %s changes no completion fact and costs once", (status) => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  await tx.update(s.orders).set({ status, deliveryMethod: "courier", completedAt: status === "completed" ? new Date() : null }).where(eq(s.orders.id, order.id));
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "shipping_issue", summary: "Resend", orderId: order.id });
  const base = { caseId, actorId: owner.id };
  const before = await loadOrderFacts(tx, order.id);
  await recordSupportShipment(tx, { ...base, courier: "Courier", courierCost: 15000, shippedOn: "2026-10-14" });
  const [shipment] = await tx.select().from(s.shipments);
  expect(shipment).toMatchObject({ supportCaseId: caseId, status: "in_transit", shippedOn: "2026-10-14" });
  expect(await loadOrderFacts(tx, order.id)).toEqual(before);
  expect(await expenseReport(tx, "2026-10")).toMatchObject({ total: 15000, rows: [{ id: shipment.id, source: "courier" }] });
  await updateSupportShipment(tx, { ...base, shipmentId: shipment.id, status: "returned", courierCost: 16000 });
  await expect(updateShipment(tx, { orderId: order.id, actorId: owner.id, shipmentId: shipment.id, status: "delivered" })).rejects.toMatchObject({ code: "not_found" });
  const other = await openCase(tx, { actorId: owner.id, type: "shipping_issue", summary: "Other", orderId: order.id });
  await expect(updateSupportShipment(tx, { ...base, caseId: other.caseId, shipmentId: shipment.id, status: "delivered" })).rejects.toMatchObject({ code: "not_found" });
  await recordSupportShipment(tx, base);
  const dates = await tx.select().from(s.shipments);
  expect(dates[1].shippedOn).toBe(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()));
}));

test("support shipping refuses unlinked/cancelled orders", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc");
  const { caseId } = await openCase(tx, { actorId: owner.id, type: "shipping_issue", summary: "Unlinked" });
  await expect(recordSupportShipment(tx, { actorId: owner.id, caseId })).rejects.toMatchObject({ code: "order_required" });
  await tx.update(s.supportCases).set({ orderId: order.id }).where(eq(s.supportCases.id, caseId));
  await tx.update(s.orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(s.orders.id, order.id));
  await expect(recordSupportShipment(tx, { actorId: owner.id, caseId })).rejects.toMatchObject({ code: "wrong_status" });
  expect(await tx.select().from(s.shipments)).toHaveLength(0);
}));
