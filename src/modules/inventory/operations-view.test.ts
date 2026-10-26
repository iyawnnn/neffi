import { expect, test } from "vitest";
import { activationCell, inventoryReference, toInventoryOperation, type InventoryOperationFacts } from "./operations-view";

const accountId = "00000000-0000-4000-8000-0000000000aa";
const base: InventoryOperationFacts = { id: "card-1", state: "blank", publicToken: null, ownerAccountId: null, orderId: null, deliveryMethod: null, hasShippedShipment: false, hasHandedOver: false };
const linked = { orderId: "order-1" };

test.each([
  ["virgin blank, no order or token", { state: "blank" }, "Available blank", "Create order"],
  ["token-bearing unlinked blank", { state: "blank", publicToken: "T" }, "Needs preparation", "Prepare card"],
  ["preparing", { state: "preparing", publicToken: "T", ...linked }, "Needs preparation", "Prepare card"],
  ["ready stock", { state: "ready", publicToken: "T" }, "Ready", "View preparation"],
  ["reserved for an order", { state: "reserved", publicToken: "T", ...linked }, "Assigned", "Give card to customer"],
  ["reserved for a J&T order", { state: "reserved", publicToken: "T", ...linked, deliveryMethod: "courier" }, "Assigned", "Mark as shipped"],
  ["released with shipment evidence", { state: "released", publicToken: "T", ...linked, deliveryMethod: "courier", hasShippedShipment: true }, "Shipped", "View shipment"],
  ["released with handover evidence", { state: "released", publicToken: "T", ...linked, deliveryMethod: "local_handoff", hasHandedOver: true }, "Given to customer", "View order"],
  ["released, claimed", { state: "released", publicToken: "T", ...linked, ownerAccountId: accountId }, "Activated", "View card"],
  ["retired", { state: "retired", publicToken: "T" }, "Retired", "View history"],
  ["retired outranks activated", { state: "retired", publicToken: "T", ownerAccountId: accountId }, "Retired", "View history"],
] as const)("%s", (_name, over, status, action) => {
  const result = toInventoryOperation({ ...base, ...over } as InventoryOperationFacts);
  expect([result.status, result.actionLabel]).toEqual([status, action]);
});

test("delivery labels need real evidence, not the intended method", () => {
  const released = { ...base, state: "released", publicToken: "T", ...linked } as InventoryOperationFacts;
  expect(toInventoryOperation({ ...released, deliveryMethod: "courier" }).status).toBe("Waiting for activation");
  expect(toInventoryOperation({ ...released, deliveryMethod: "pickup" }).status).toBe("Waiting for activation");
  expect(toInventoryOperation({ ...released, deliveryMethod: "courier", hasShippedShipment: true }).status).toBe("Shipped");
});

test("a legacy GRC without delivery evidence does not imply activation", () => {
  const card = { ...base, kind: "grc", state: "released", ...linked } as InventoryOperationFacts;
  expect(toInventoryOperation(card)).toMatchObject({ status: "Delivery to verify", actionLabel: "Check order" });
  expect(toInventoryOperation({ ...card, hasHandedOver: true }).status).toBe("Given to customer");
  expect(activationCell({ kind: "grc", ownerAccountId: null, usableCredential: false, retrievable: false, revoked: false, retired: false })).toEqual({ label: "Not applicable", href: false });
});

test("links go to the card, its order, or order creation", () => {
  expect(toInventoryOperation({ ...base, state: "preparing", publicToken: "T", ...linked }).href).toBe("/admin/inventory/cards/card-1");
  expect(toInventoryOperation({ ...base, state: "reserved", publicToken: "T", ...linked }).href).toBe("/admin/orders/order-1");
  expect(toInventoryOperation({ ...base }).href).toBe("/admin/orders/new");
});

test("the Admin reference is the stable inventory number, zero padded", () => {
  expect([inventoryReference(51), inventoryReference(1), inventoryReference(12345)]).toEqual(["N-0051", "N-0001", "N-12345"]);
});

test("the activation cell is a safe state, never a code", () => {
  expect(activationCell({ ownerAccountId: accountId, usableCredential: false, retrievable: false, revoked: true, retired: false })).toEqual({ label: "Activated", href: false });
  expect(activationCell({ ownerAccountId: null, usableCredential: true, retrievable: true, revoked: false, retired: false })).toEqual({ label: "Show code", href: true });
  expect(activationCell({ ownerAccountId: null, usableCredential: true, retrievable: false, revoked: false, retired: false })).toEqual({ label: "Existing package code needed", href: true });
  expect(activationCell({ ownerAccountId: null, usableCredential: false, retrievable: false, revoked: true, retired: false })).toEqual({ label: "Replaced or revoked", href: false });
  expect(activationCell({ ownerAccountId: null, usableCredential: true, retrievable: true, revoked: false, retired: true })).toEqual({ label: "Revoked", href: false });
  expect(activationCell({ ownerAccountId: null, usableCredential: false, retrievable: false, revoked: false, retired: false })).toEqual({ label: "Not issued", href: false });
});
