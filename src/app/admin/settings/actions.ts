"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { parsePesos } from "@/lib/money";
import { OrderError } from "@/modules/orders/errors";
import { saveProduct } from "@/modules/orders/products";
import { NORMAL_DBC_UNIT_PRICE } from "@/modules/orders/policy";
import type { ActionState } from "../inventory/actions";

export async function saveProductAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = z.object({ productId: z.preprocess((v) => v === "" ? undefined : v, z.uuid().optional()), kind: z.enum(["dbc", "grc"]), name: z.string().trim().min(1).max(100), price: z.string().max(30) }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the product name and price." };
  let price: number;
  try { price = parsePesos(parsed.data.price); } catch { return { error: "Enter a price greater than zero, with at most two decimal places." }; }
  if (parsed.data.kind === "dbc" && price !== NORMAL_DBC_UNIT_PRICE) return { error: "DBC price is fixed at ₱799." };
  try {
    await saveProduct(db, { ...parsed.data, price });
    revalidatePath("/admin/settings");
    return { ok: "Product saved. Existing orders keep their original price." };
  } catch (error) {
    if (error instanceof OrderError) return { error: error.code === "no_product" ? "An active product already exists. Reload and edit it." : error.code === "invalid_input" ? "DBC price is fixed at ₱799." : "That product was not found. Reload and try again." };
    throw error;
  }
}
