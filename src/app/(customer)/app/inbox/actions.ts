"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { deleteSubmission } from "@/modules/forms/submissions";
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
