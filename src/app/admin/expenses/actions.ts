"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { parsePesos } from "@/lib/money";
import { expenseCategory } from "@/db/schema/enums";
import { deleteExpense, saveExpense } from "@/modules/expenses/manual";
import { OrderError } from "@/modules/orders/errors";
import type { ActionState } from "../inventory/actions";

const optionalId = z.preprocess((v) => v === "" ? undefined : v, z.uuid().optional());
const optionalText = (max: number) => z.string().trim().max(max).optional();
export async function saveExpenseAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = z.object({ id: optionalId, spentOn: z.iso.date(), amount: z.string().max(30), category: z.enum(expenseCategory.enumValues), payee: optionalText(100), note: optionalText(500), orderId: optionalId }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the expense fields." };
  let amount: number;
  try { amount = parsePesos(parsed.data.amount); } catch { return { error: "Enter a positive peso amount with at most two decimal places." }; }
  try {
    await saveExpense(db, { ...parsed.data, amount, actorId: auth.viewer.accountId, orderId: parsed.data.orderId ?? null, payee: parsed.data.payee || null, note: parsed.data.note || null });
    revalidatePath("/admin/expenses"); revalidatePath("/admin");
    return { ok: "Expense saved." };
  } catch (error) {
    if (error instanceof OrderError) return { error: "That expense or linked order was not found. Check the Order ID." };
    throw error;
  }
}
export async function deleteExpenseAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = z.object({ id: z.uuid(), confirm: z.literal("on") }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Confirm deletion of this manual expense." };
  try { await deleteExpense(db, parsed.data.id); } catch (error) { if (error instanceof OrderError) return { error: "That expense was not found." }; throw error; }
  revalidatePath("/admin/expenses"); revalidatePath("/admin");
  return { ok: "Manual expense deleted." };
}
