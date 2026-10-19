"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { deleteSubmission, setSubmissionRead, unreadCount } from "@/modules/forms/submissions";
import { ProfileError } from "@/modules/profiles/errors";

export async function deleteSubmissionAction(_previous: { error?: string } | undefined, data: FormData): Promise<{ error?: string }> {
  const auth = await authorize("account");
  if (!auth.ok) redirect("/sign-in?next=/app");
  const parsed = z.uuid().safeParse(data.get("submissionId"));
  if (!parsed.success) notFound();
  if (data.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  try { await deleteSubmission(db, { accountId: auth.viewer.accountId, submissionId: parsed.data }); } catch (error) {
    if (error instanceof ProfileError && error.code === "not_found") notFound();
    throw error;
  }
  redirect("/app/inbox");
}

export async function updateInboxAction(data: FormData): Promise<{ ok: true; unread: number } | { error: string }> {
  const auth = await authorize("account");
  if (!auth.ok) redirect("/sign-in?next=/app");
  const parsed = z.object({ submissionId: z.uuid(), operation: z.enum(["read", "unread", "delete"]) }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Invalid message action." };
  const { submissionId, operation } = parsed.data;
  try {
    if (operation === "delete") await deleteSubmission(db, { accountId: auth.viewer.accountId, submissionId });
    else await setSubmissionRead(db, { accountId: auth.viewer.accountId, submissionId, read: operation === "read" });
  } catch (error) {
    if (error instanceof ProfileError && error.code === "not_found") return { error: "This message is no longer available." };
    return { error: "Couldn’t update message. Try again." };
  }
  if (operation === "delete") {
    revalidatePath("/app", "layout");
    redirect("/app/inbox");
  }
  // Any revalidation in this action rerenders the detail page and marks it read again.
  return { ok: true, unread: await unreadCount(db, auth.viewer.accountId) };
}
