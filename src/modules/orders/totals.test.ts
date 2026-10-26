import { expect, test } from "vitest";
import { effectiveItemTotal, orderTotals, isCompletionEligible, type OrderFacts } from "./totals";

const facts: OrderFacts = {
  status: "in_progress", deliveryMethod: "pickup", shippingFee: 500,
  items: [{ productKind: "dbc", quantity: 2, unitPrice: 10000, agreedTotal: null, activeCount: 2, releasedCount: 2 }],
  received: 20500, refunded: 0, hasShippedShipment: false, hasHandedOver: false,
};

test("effective item total uses the agreed total, including zero", () => {
  expect(effectiveItemTotal(facts.items[0])).toBe(20000);
  expect(effectiveItemTotal({ ...facts.items[0], agreedTotal: 17000 })).toBe(17000);
  expect(effectiveItemTotal({ ...facts.items[0], agreedTotal: 0 })).toBe(0);
});

test("pending shipping has no final total or balance and cannot complete", () => {
  const pending = { ...facts, deliveryMethod: "courier" as const, shippingFee: 0, shippingFeePending: true, received: 20000, hasShippedShipment: true };
  expect(orderTotals(pending)).toMatchObject({ productSubtotal: 20000, shippingFeePending: true, orderTotal: null, balance: null, paymentState: "Unpaid" });
  expect(isCompletionEligible(pending)).toBe(false);
  expect(orderTotals({ ...pending, shippingFeePending: false, shippingFee: 500 })).toMatchObject({ orderTotal: 20500, balance: 500 });
});

test("GRC-only completion needs commercial delivery and exact payment, with no physical Card states", () => {
  const grc = { ...facts, items: [{ ...facts.items[0], productKind: "grc" as const, activeCount: 0, releasedCount: 0 }] };
  expect(isCompletionEligible(grc)).toBe(false);
  expect(isCompletionEligible({ ...grc, hasHandedOver: true })).toBe(true);
  expect(isCompletionEligible({ ...grc, deliveryMethod: "local_handoff", hasHandedOver: true })).toBe(true);
  expect(isCompletionEligible({ ...grc, deliveryMethod: "courier", hasShippedShipment: true })).toBe(true);
  expect(isCompletionEligible({ ...grc, deliveryMethod: "courier", hasHandedOver: true })).toBe(false);
  expect(isCompletionEligible({ ...grc, hasHandedOver: true, received: 1 })).toBe(false);
  expect(isCompletionEligible({ ...grc, hasHandedOver: true, received: 22000 })).toBe(false);
});

test("mixed completion requires released DBC quantities and commercial GRC delivery only", () => {
  const mixed = { ...facts, received: 40500, items: [facts.items[0], { ...facts.items[0], productKind: "grc" as const, activeCount: 0, releasedCount: 0 }] };
  expect(isCompletionEligible(mixed)).toBe(false);
  expect(isCompletionEligible({ ...mixed, hasHandedOver: true })).toBe(true);
  expect(isCompletionEligible({ ...mixed, deliveryMethod: "courier", hasShippedShipment: true })).toBe(true);
  expect(isCompletionEligible({ ...mixed, hasHandedOver: true, items: [{ ...facts.items[0], releasedCount: 1 }, mixed.items[1]] })).toBe(false);
});

test("partial payments remain Unpaid and refunds reduce netPaid", () => {
  expect(orderTotals({ ...facts, received: 10000, refunded: 1000 })).toMatchObject({ orderTotal: 20500, received: 10000, refunded: 1000, netPaid: 9000, balance: 11500, refundDue: 0, paymentState: "Unpaid" });
  expect(orderTotals(facts)).toMatchObject({ balance: 0, paymentState: "Paid" });
});

test("after-sale concessions reduce cash kept without changing settlement", () => {
  expect(orderTotals({ ...facts, status: "completed", afterSaleRefunded: 3000 })).toMatchObject({
    saleRefunded: 0, afterSaleRefunded: 3000, settledPaid: 20500, netPaid: 17500,
    balance: 0, refundDue: 0, paymentState: "Paid",
  });
});

test("a completed payment correction exposes a balance but never a refund due", () => {
  expect(orderTotals({ ...facts, status: "completed", received: 10000, afterSaleRefunded: 1000 })).toMatchObject({
    settledPaid: 10000, netPaid: 9000, balance: 10500, refundDue: 0, paymentState: "Unpaid",
  });
});

test("completion uses settlement and cancelled refunds use cash kept", () => {
  expect(isCompletionEligible({ ...facts, afterSaleRefunded: 1000 })).toBe(true);
  expect(orderTotals({ ...facts, status: "cancelled", refunded: 500, afterSaleRefunded: 1000 })).toMatchObject({ refundDue: 19000 });
});

test.each(["in_progress", "completed", "cancelled"] as const)("zero after-sale refunds preserve M8 totals for %s", (status) => {
  expect(orderTotals({ ...facts, status, afterSaleRefunded: 0 })).toEqual(orderTotals({ ...facts, status }));
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
