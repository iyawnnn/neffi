"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { updatePurchaser } from "@/modules/orders/purchasers";
import { OrderError } from "@/modules/orders/errors";
import type { ActionState } from "../inventory/actions";
export async function updatePurchaserAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(100), contactNumber: z.string().trim().max(50).optional() }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the purchaser name and contact." };
  try { await updatePurchaser(db, parsed.data); } catch (error) { if (error instanceof OrderError) return { error: "That purchaser was not found." }; throw error; }
  revalidatePath("/admin/customers"); revalidatePath(`/admin/customers/purchasers/${parsed.data.id}`); revalidatePath("/admin/orders");
  return { ok: "Purchaser saved." };
}
