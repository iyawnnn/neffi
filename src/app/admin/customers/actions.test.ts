import { expect, test, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
const { authorize, updatePurchaser } = vi.hoisted(() => ({ authorize: vi.fn(), updatePurchaser: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize })); vi.mock("@/db", () => ({ db: {} })); vi.mock("next/cache", () => ({ revalidatePath: vi.fn() })); vi.mock("@/modules/orders/purchasers", () => ({ updatePurchaser }));
import { updatePurchaserAction } from "./actions";
test("purchaser mutation authorizes OWNER and rejects blank names", async () => {
  const f = new FormData(); f.set("id", "11111111-1111-4111-8111-111111111111"); f.set("name", "Buyer");
  authorize.mockResolvedValue({ ok: false });
  expect(await updatePurchaserAction(undefined, f)).toHaveProperty("error"); expect(updatePurchaser).not.toHaveBeenCalled();
  authorize.mockResolvedValue({ ok: true }); f.set("name", "  ");
  expect(await updatePurchaserAction(undefined, f)).toHaveProperty("error"); expect(updatePurchaser).not.toHaveBeenCalled();
  f.set("name", "Buyer"); await updatePurchaserAction(undefined, f);
  expect(updatePurchaser).toHaveBeenCalledWith({}, expect.objectContaining({ name: "Buyer" }));
});
test("Account directory has no mutation endpoint or form", () => {
  expect(existsSync("src/app/admin/customers/accounts/actions.ts")).toBe(false);
  const source = readFileSync("src/app/admin/customers/accounts/[id]/page.tsx", "utf8");
  expect(source).not.toMatch(/<form|ActionForm|Action\b/);
});
