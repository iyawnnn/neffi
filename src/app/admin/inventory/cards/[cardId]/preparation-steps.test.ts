import { expect, test } from "vitest";
import { preparationSteps, type StepCard } from "./preparation-steps";

const card = (over: Partial<StepCard> = {}): StepCard => ({ kind: "dbc", state: "blank", publicToken: null, nfcVerifiedAt: null, packageMatchedAt: null, ...over });
const done = (c: StepCard) => preparationSteps(c).steps.filter((s) => s.done).map((s) => s.label);

test("an untouched stock card needs provisioning first", () => {
  expect(preparationSteps(card())).toMatchObject({ current: "provision" });
});

test("progress runs Write NFC, Confirm NFC test, Confirm package, Ready for customer, one current step at a time", () => {
  const token = { publicToken: "T".repeat(26) };
  expect(preparationSteps(card(token)).current).toBe("nfc");
  expect(done(card(token))).toEqual([]);
  const nfc = card({ ...token, nfcVerifiedAt: new Date() });
  expect(preparationSteps(nfc).current).toBe("package");
  expect(done(nfc)).toEqual(["Write NFC", "Confirm NFC test"]);
  const preparing = card({ ...token, state: "preparing", nfcVerifiedAt: new Date() });
  expect(preparationSteps(preparing).current).toBe("package");
  const ready = card({ ...token, state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() });
  expect(preparationSteps(ready).current).toBe("ready");
  expect(done(ready)).toEqual(["Write NFC", "Confirm NFC test", "Confirm package", "Ready for customer"]);
});

test("assigned, released and retired cards have no preparation task", () => {
  const base = { publicToken: "T".repeat(26), nfcVerifiedAt: new Date(), packageMatchedAt: new Date() };
  expect(preparationSteps(card({ ...base, state: "reserved" })).current).toBe("ready");
  expect(preparationSteps(card({ ...base, state: "released" })).current).toBe("released");
  expect(preparationSteps(card({ ...base, state: "retired" })).current).toBe("retired");
  expect(preparationSteps(card({ ...base, state: "retired" })).steps.find((s) => s.label === "Ready for customer")?.done).toBe(false);
});

test("GRC cards are not a DBC preparation", () => {
  expect(preparationSteps(card({ kind: "grc", state: "reserved" })).current).toBe("none");
});
