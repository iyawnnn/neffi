import { beforeEach, expect, test, vi } from "vitest";
const { authorize, saveExpense, deleteExpense } = vi.hoisted(() => ({ authorize: vi.fn(), saveExpense: vi.fn(), deleteExpense: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/expenses/manual", () => ({ saveExpense, deleteExpense }));
import { saveExpenseAction, deleteExpenseAction } from "./actions";
import { OrderError } from "@/modules/orders/errors";
const id = "11111111-1111-4111-8111-111111111111";
const data = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
beforeEach(() => { vi.clearAllMocks(); authorize.mockResolvedValue({ ok: true, viewer: { accountId: id } }); });
test("customer is denied before expense input/service", async () => {
  authorize.mockResolvedValue({ ok: false });
  expect(await saveExpenseAction(undefined, data({}))).toHaveProperty("error");
  expect(await deleteExpenseAction(undefined, data({ id, confirm: "on" }))).toHaveProperty("error");
  expect(saveExpense).not.toHaveBeenCalled(); expect(deleteExpense).not.toHaveBeenCalled();
});
test("money/date/category rejected and peso amount converted exactly", async () => {
  const fields = { spentOn: "2026-10-13", category: "other", amount: "1,000.50" };
  for (const change of [{ amount: "-1" }, { category: "courier" }, { spentOn: "2026-13-45" }]) expect(await saveExpenseAction(undefined, data({ ...fields, ...change }))).toHaveProperty("error");
  expect(saveExpense).not.toHaveBeenCalled();
  await saveExpenseAction(undefined, data(fields));
  expect(saveExpense).toHaveBeenCalledWith({}, expect.objectContaining({ amount: 100050, actorId: id, orderId: null }));
});
test("manual deletion requires confirmation", async () => {
  expect(await deleteExpenseAction(undefined, data({ id }))).toHaveProperty("error");
  expect(deleteExpense).not.toHaveBeenCalled();
  await deleteExpenseAction(undefined, data({ id, confirm: "on" }));
  expect(deleteExpense).toHaveBeenCalledWith({}, id);
});
test("unknown linked order returns form feedback", async () => {
  saveExpense.mockRejectedValueOnce(new OrderError("not_found"));
  expect(await saveExpenseAction(undefined, data({ spentOn: "2026-10-13", amount: "5", category: "other", orderId: id }))).toMatchObject({ error: expect.stringContaining("Order ID") });
});
