import { expect, test } from "vitest";
import { activityText, paymentMethodLabel, shipmentStatusLabel } from "./activity-text";

test("payment methods and shipment statuses read as owner words", () => {
  expect([["gcash"], ["maya"], ["maribank"], ["gotyme"], ["bank_transfer"], ["cash"]].map(([m]) => paymentMethodLabel(m))).toEqual(["GCash", "Maya", "MariBank", "GoTyme", "Bank transfer", "Cash"]);
  expect(["pending", "in_transit", "delivered", "failed", "returned", "lost"].map(shipmentStatusLabel)).toEqual(["Pending", "In transit", "Delivered", "Failed", "Returned", "Lost"]);
});

test.each([
  [{ type: "order_created", note: null }, "Order created"],
  [{ type: "payment_recorded", note: "79900 centavos; gcash" }, "Product payment received · ₱799.00 · GCash"],
  [{ type: "payment_recorded", note: "12000 centavos; bank_transfer; shipping" }, "Shipping payment received · ₱120.00 · Bank transfer"],
  [{ type: "card_provisioned", note: "token ABCDEF123456" }, "Card assigned and ready for NFC writing"],
  [{ type: "card_nfc_verified", note: "read back exactly, phone opened it, tag left writable" }, "NFC test confirmed"],
  [{ type: "card_reserved", note: null }, "Card prepared for this order"],
  [{ type: "card_released", note: null }, "Card released to the customer"],
  [{ type: "order_handed_over", note: null }, "Card given to customer"],
  [{ type: "shipment_recorded", note: null }, "Marked as shipped"],
  [{ type: "order_completed", note: null }, "Order completed"],
  [{ type: "card_returned", note: null }, "Card returned to stock"],
])("%j reads as %s", (event, text) => {
  expect(activityText(event).title).toBe(text);
  expect(activityText(event).detail ?? "").not.toMatch(/token|centavos/i);
});

test("owner notes and correction reasons stay visible; unknown events fall back to their name", () => {
  expect(activityText({ type: "note", note: "Called the customer" })).toEqual({ title: "Note", detail: "Called the customer" });
  expect(activityText({ type: "shipment_updated", note: "shipped date 2026-10-20 to 2026-10-21; Courier receipt" }).detail).toContain("Courier receipt");
  expect(activityText({ type: "order_cancelled", note: "Changed plans" })).toEqual({ title: "Order cancelled", detail: "Changed plans" });
  expect(activityText({ type: "stock_received", note: null }).title).toBe("Stock received");
});
