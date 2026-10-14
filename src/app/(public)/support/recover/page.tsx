import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { RECOVERY_INSTRUCTION } from "@/modules/support/domain";
import { RecoveryForm } from "./recovery-form";
export const metadata: Metadata = { title: "Complete Neffi recovery", robots: { index: false, follow: false } };
export const instant = false;
export default async function RecoveryPage() {
  await connection();
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-8"><h1 className="text-2xl font-semibold">Complete Account recovery</h1><p>Use the new email and the code sent after Neffi support verified your request.</p><p>{RECOVERY_INSTRUCTION}</p><RecoveryForm /><Link href="/support" className="flex min-h-11 items-center underline">Contact Neffi support</Link></main>;
}
