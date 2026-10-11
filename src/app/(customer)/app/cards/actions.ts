"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { connectCardToProfile, setCardDisabled } from "@/modules/cards/manage";
import { ProfileError } from "@/modules/profiles/errors";

type CardActionState = { error?: string };
const id = (value: FormDataEntryValue | null) => typeof value === "string" && z.uuid().safeParse(value).success ? value : notFound();
async function context(data: FormData) {
  const auth = await authorize("account");
  if (!auth.ok) redirect("/sign-in?next=/app");
  return { accountId: auth.viewer.accountId, cardId: id(data.get("cardId")) };
}
function failure(error: unknown): CardActionState {
  if (!(error instanceof ProfileError)) throw error;
  if (error.code === "not_found") notFound();
  return { error: "Check the highlighted fields and try again." };
}
export async function connectCardAction(_previous: CardActionState | undefined, data: FormData): Promise<CardActionState> {
  const input = await context(data);
  const profileId = id(data.get("profileId"));
  try { await connectCardToProfile(db, { ...input, profileId }); } catch (error) { return failure(error); }
  redirect(`/app/cards/${input.cardId}`);
}
export async function setCardDisabledAction(_previous: CardActionState | undefined, data: FormData): Promise<CardActionState> {
  const input = await context(data);
  const value = data.get("disabled");
  if (value !== "true" && value !== "false") return { error: "Check the highlighted fields and try again." };
  const disabled = value === "true";
  if (disabled && data.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  try { await setCardDisabled(db, { ...input, disabled }); } catch (error) { return failure(error); }
  redirect(`/app/cards/${input.cardId}`);
}
