import { expect, test } from "vitest";
import { effectiveItemTotal, orderTotals, isCompletionEligible, type OrderFacts } from "./totals";

const facts: OrderFacts = {
  status: "in_progress", deliveryMethod: "pickup", shippingFee: 500,
  items: [{ quantity: 2, unitPrice: 10000, agreedTotal: null, activeCount: 2, releasedCount: 2 }],
  received: 20500, refunded: 0, hasShippedShipment: false,
};

test("effective item total uses the agreed total, including zero", () => {
  expect(effectiveItemTotal(facts.items[0])).toBe(20000);
  expect(effectiveItemTotal({ ...facts.items[0], agreedTotal: 17000 })).toBe(17000);
  expect(effectiveItemTotal({ ...facts.items[0], agreedTotal: 0 })).toBe(0);
});

test("partial payments remain Unpaid and refunds reduce netPaid", () => {
  expect(orderTotals({ ...facts, received: 10000, refunded: 1000 })).toEqual({ orderTotal: 20500, received: 10000, refunded: 1000, netPaid: 9000, balance: 11500, refundDue: 0, paymentState: "Unpaid" });
  expect(orderTotals(facts)).toMatchObject({ balance: 0, paymentState: "Paid" });
});

test("overpaid and cancelled orders show the required refund", () => {
  expect(orderTotals({ ...facts, received: 22000 })).toMatchObject({ balance: 0, refundDue: 1500, paymentState: "Paid" });
  expect(orderTotals({ ...facts, status: "cancelled", refunded: 500 })).toMatchObject({ refundDue: 20000 });
  expect(orderTotals({ ...facts, status: "completed" })).toMatchObject({ refundDue: 0 });
});

test.each([
  ["pickup", {}, true], ["local handoff", { deliveryMethod: "local_handoff" }, true],
  ["courier without shipment", { deliveryMethod: "courier" }, false],
  ["courier shipped", { deliveryMethod: "courier", hasShippedShipment: true }, true],
  ["support-only shipment", { deliveryMethod: "courier", hasShippedShipment: false }, false],
  ["no delivery", { deliveryMethod: null }, false], ["unpaid", { received: 1 }, false],
  ["overpaid", { received: 22000 }, false], ["no items", { items: [] }, false],
  ["unreleased", { items: [{ ...facts.items[0], releasedCount: 1 }] }, false],
  ["too many released", { items: [{ ...facts.items[0], releasedCount: 3 }] }, false],
  ["completed", { status: "completed" }, false], ["cancelled", { status: "cancelled" }, false],
] satisfies [string, Partial<OrderFacts>, boolean][])("completion: %s", (_name, changes, expected) => {
  expect(isCompletionEligible({ ...facts, ...changes })).toBe(expected);
});
