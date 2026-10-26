import { expect, test } from "vitest";
import { NEW_PAYMENT_METHODS, NORMAL_DBC_UNIT_PRICE } from "./policy";

test("new DBC sales have one fixed price and five accepted payment methods", () => {
  expect(NORMAL_DBC_UNIT_PRICE).toBe(79_900);
  expect(NEW_PAYMENT_METHODS).toEqual(["gcash", "maya", "maribank", "gotyme", "bank_transfer"]);
});
