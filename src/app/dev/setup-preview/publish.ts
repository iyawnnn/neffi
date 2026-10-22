"use server";
import { notFound, redirect } from "next/navigation";
export async function previewPublishAction(_previous: {error?: string; gaps?: string[]} | undefined, data: FormData): Promise<{error?: string; gaps?: string[]}> {
 if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
 if (data.get("profileId") === "synthetic-failure") return { error: "Couldn't publish your Neffi. Your profile is still saved. Try again." };
 redirect("/dev/setup-preview?state=published&step=done");
}
