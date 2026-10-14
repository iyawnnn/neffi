import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { getViewer } from "@/auth/access";
import { categories, RECOVERY_INSTRUCTION } from "@/modules/support/domain";
import { SupportForm } from "./support-form";

export const metadata: Metadata = { title: "Neffi support", robots: { index: false, follow: false } };
export const instant = false;

async function RequestForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  const params = await searchParams;
  const topic = typeof params.topic === "string" && Object.hasOwn(categories, params.topic) ? params.topic as keyof typeof categories : "other";
  const cardId = typeof params.cardId === "string" && z.uuid().safeParse(params.cardId).success ? params.cardId : undefined;
  return <SupportForm email={viewer?.email} clientKey={crypto.randomUUID()} topic={topic} cardId={cardId} />;
}

export default function SupportPage({ searchParams }: PageProps<"/support">) {
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Neffi support</h1>
    <p>You can ask for help without signing in. If one sign-in method still works, use Google or an email code, then update your access from your Account.</p>
    <p>{RECOVERY_INSTRUCTION}</p>
    <p className="text-sm text-muted-foreground">We collect your contact email, optional name and message to respond to your support request. Your contact email is unverified and does not prove Account or Card ownership.</p>
    <Suspense fallback={<p>Loading support form…</p>}><RequestForm searchParams={searchParams} /></Suspense>
    <Link href="/sign-in" className="flex min-h-11 items-center underline">Sign in</Link>
    <Link href="/support/recover" className="flex min-h-11 items-center underline">Complete an owner-initiated recovery</Link>
  </main>;
}
