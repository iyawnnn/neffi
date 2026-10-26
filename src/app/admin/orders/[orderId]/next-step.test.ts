import { expect, test } from "vitest";
import { orderNextStep, type NextStepInput } from "./next-step";

const dest = { recipientName: "Ana", recipientContact: "0917", address: "1 Street" };
const card = (state: string, ownerAccountId: string | null = null, id = `card-${state}`) => ({ id, state, ownerAccountId });
const base = (over: Partial<NextStepInput> = {}): NextStepInput => ({
  status: "in_progress", clientKey: "key", deliveryMethod: "local_handoff", shippingFeePending: false,
  items: [{ productKind: "dbc", quantity: 1, allocatedCount: 1, preparedCount: 1, releasedCount: 0 }],
  cards: [card("reserved")], shipment: null, ...over,
});
const kind = (over: Partial<NextStepInput>) => orderNextStep(base(over)).key;

test("stock shortage with nothing to prepare waits for stock and says how many are missing", () => {
  const step = orderNextStep(base({ items: [{ productKind: "dbc", quantity: 3, allocatedCount: 1, preparedCount: 1, releasedCount: 0 }] }));
  expect(step).toMatchObject({ key: "waiting_for_stock", remaining: 2 });
});

test("an allocated card still being prepared is the task, with progress and a direct card link target", () => {
  const step = orderNextStep(base({ items: [{ productKind: "dbc", quantity: 3, allocatedCount: 3, preparedCount: 1, releasedCount: 0 }], cards: [card("reserved"), card("preparing", null, "p1"), card("preparing", null, "p2")] }));
  expect(step).toMatchObject({ key: "prepare_card", cardId: "p1", progress: "1 of 3 prepared" });
  // preparation can continue while the rest of the quantity is waiting for stock
  expect(orderNextStep(base({ items: [{ productKind: "dbc", quantity: 3, allocatedCount: 2, preparedCount: 1, releasedCount: 0 }], cards: [card("reserved"), card("preparing", null, "p1")] })).key).toBe("prepare_card");
});

test("in person gives the card once every quantity is prepared", () => {
  expect(kind({})).toBe("give_card");
  expect(kind({ deliveryMethod: "pickup" })).toBe("give_card");
});

test("J&T asks for missing destination details first, then Mark as shipped, whether or not the fee is known", () => {
  const jnt = { deliveryMethod: "courier" as const };
  expect(kind({ ...jnt, shippingFeePending: true, shipment: { ...dest, address: null } })).toBe("complete_jnt");
  expect(kind({ ...jnt, shipment: null })).toBe("complete_jnt");
  expect(kind({ ...jnt, shippingFeePending: true, shipment: dest })).toBe("mark_shipped");
  expect(kind({ ...jnt, shipment: dest })).toBe("mark_shipped");
});

test("J&T preparation still comes before details", () => {
  expect(kind({ deliveryMethod: "courier", items: [{ productKind: "dbc", quantity: 1, allocatedCount: 1, preparedCount: 0, releasedCount: 0 }], cards: [card("preparing")] })).toBe("prepare_card");
});

test("a released order waits for activation until every card has an owner", () => {
  const released = { status: "completed" as const, items: [{ productKind: "dbc" as const, quantity: 2, allocatedCount: 2, preparedCount: 2, releasedCount: 2 }] };
  expect(kind({ ...released, cards: [card("released", "acct", "a"), card("released", null, "b")] })).toBe("waiting_for_activation");
  expect(orderNextStep(base({ ...released, cards: [card("released", "acct", "a"), card("released", "acct2", "b")] }))).toMatchObject({ key: "activated" });
});

test("cancelled and legacy orders do not get the guided task", () => {
  expect(kind({ status: "cancelled", cards: [] })).toBe("cancelled");
  expect(kind({ clientKey: null })).toBe("legacy");
});

test("exactly one primary task and no payment or handover step exists for J&T", () => {
  const keys = ["waiting_for_stock", "prepare_card", "give_card", "complete_jnt", "mark_shipped", "waiting_for_activation", "activated", "cancelled", "legacy"];
  expect(keys).toContain(orderNextStep(base({ deliveryMethod: "courier", shipment: dest })).key);
});
