import { beforeEach, expect, test, vi } from "vitest";
const { authorize, saveProduct, revalidatePath } = vi.hoisted(() => ({ authorize: vi.fn(), saveProduct: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/orders/products", () => ({ saveProduct }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { saveProductAction } from "./actions";

const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: "owner" } }); });

test("customer denial (403) stops before catalog mutation", async () => {
  authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
  expect(await saveProductAction(undefined, form({ kind: "dbc", name: "DBC", price: "500" }))).toHaveProperty("error");
  expect(saveProduct).not.toHaveBeenCalled();
});

test("validates inputs and converts pesos on the server", async () => {
  for (const bad of [{ kind: "other", name: "DBC", price: "500" }, { kind: "dbc", name: "", price: "500" }, { kind: "dbc", name: "DBC", price: "-1" }, { kind: "dbc", name: "DBC", price: "1.001" }]) {
    expect(await saveProductAction(undefined, form(bad))).toHaveProperty("error");
  }
  expect(saveProduct).not.toHaveBeenCalled();
  expect(await saveProductAction(undefined, form({ kind: "dbc", name: "DBC", price: "1,500.50" }))).toHaveProperty("error");
  expect(await saveProductAction(undefined, form({ kind: "dbc", name: " DBC ", price: "799.00" }))).toHaveProperty("ok");
  expect(saveProduct).toHaveBeenCalledWith({}, { productId: undefined, kind: "dbc", name: "DBC", price: 79900 });
  expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
});
