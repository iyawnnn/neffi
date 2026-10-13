"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { parsePesos } from "@/lib/money";
import { OrderError } from "@/modules/orders/errors";
import { addOrderNote, assignOrder, updateOrderDetails } from "@/modules/orders/order";
import type { ActionState } from "../../inventory/actions";

const id = z.uuid();

async function run<S extends z.ZodType>(schema: S, data: FormData, act: (input: z.output<S>, actorId: string) => Promise<unknown>): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the form and try again." };
  try {
    await act(parsed.data, auth.viewer.accountId);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${data.get("orderId")}`);
    return { ok: "Saved." };
  } catch (error) {
    if (error instanceof RangeError) return { error: "Check the amount. Use pesos with at most two decimal places." };
    if (error instanceof OrderError) return { error: error.code === "delivery_locked" ? "Delivery method is locked after a card is released." : error.code === "wrong_status" ? "This action isn't available for the order's current status. Reload the order." : "Check the order details and try again." };
    throw error;
  }
}

export async function assignOrderAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, assignedToAccountId: id }), data, (input, actorId) => assignOrder(db, { ...input, actorId }));
}

export async function addOrderNoteAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, note: z.string().trim().min(1).max(500) }), data, (input, actorId) => addOrderNote(db, { ...input, actorId }));
}

export async function updateOrderDetailsAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, deliveryMethod: z.enum(["pickup", "local_handoff", "courier"]), shippingFee: z.string().trim().max(30), notes: z.string().trim().max(500) }), data, (input, actorId) => updateOrderDetails(db, { ...input, actorId, shippingFee: input.shippingFee ? parsePesos(input.shippingFee) : 0 }));
}
