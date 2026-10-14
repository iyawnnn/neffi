"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { parsePesos } from "@/lib/money";
import { createOrder } from "@/modules/orders/create";
import { OrderError } from "@/modules/orders/errors";
import { SupportError } from "@/modules/support/errors";
import type { ActionState } from "../../inventory/actions";

export async function createOrderAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const optional = (max: number) => z.preprocess((v) => v === "" ? undefined : v, z.string().trim().max(max).optional());
  const parsed = z.object({
    supportCaseId: z.preprocess((v) => v === "" ? undefined : v, z.uuid().optional()),
    purchaserId: z.preprocess((v) => v === "" ? undefined : v, z.uuid().optional()),
    name: optional(100), contactNumber: optional(100), notes: optional(500),
    items: z.string().min(1).max(60000), deliveryMethod: z.enum(["pickup", "local_handoff", "courier"]),
    shippingFee: optional(30), paidNow: z.literal("on").optional(),
    method: z.enum(["gcash", "bank_transfer", "cash"]).optional(), paymentAmount: optional(30), reference: optional(100),
  }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the form and try again." };
  const input = parsed.data;
  let orderId: string;
  try {
    const decoded = z.array(z.object({ kind: z.enum(["dbc", "grc"]), quantity: z.number().int().min(1).max(500), agreedTotal: optional(30), label: optional(100), reviewUrl: optional(2048) })).min(1).max(50).safeParse(JSON.parse(input.items));
    if (!decoded.success) return { error: "Check the order items and try again." };
    const result = await createOrder(db, {
      actorId: auth.viewer.accountId,
      supportCaseId: input.supportCaseId,
      purchaserId: input.purchaserId, purchaser: input.purchaserId ? undefined : { name: input.name, contactNumber: input.contactNumber },
      items: decoded.data.map((line) => ({ ...line, agreedTotal: line.agreedTotal ? parsePesos(line.agreedTotal) : undefined })),
      deliveryMethod: input.deliveryMethod, shippingFee: input.shippingFee ? parsePesos(input.shippingFee) : 0, notes: input.notes,
      paidNow: input.paidNow ? { amount: input.paymentAmount ? parsePesos(input.paymentAmount) : undefined, method: input.method, reference: input.reference } : undefined,
    });
    orderId = result.orderId;
  } catch (error) {
    if (error instanceof SupportError) return { error: "That support case is unavailable or resolved. Reload the case before creating a replacement order." };
    if (error instanceof SyntaxError || error instanceof RangeError) return { error: "Check the amounts and order items." };
    if (error instanceof OrderError) return { error: error.code === "no_product" ? "Set up the active product in Settings before taking this order." : error.code === "balance_exceeded" ? "Payment exceeds this order's balance. Check the amount." : "Check the purchaser and order details, then try again." };
    throw error;
  }
  revalidatePath("/admin/orders");
  if (input.supportCaseId) revalidatePath(`/admin/support/${input.supportCaseId}`);
  redirect(`/admin/orders/${orderId}`);
}
