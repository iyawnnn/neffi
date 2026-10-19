import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupHeader } from "@/components/setup-header";
import { SetupView } from "@/app/(customer)/app/setup/[cardId]/setup-view";
import { isPurpose, PURPOSES } from "@/modules/profiles/starters";
import { PreviewForm } from "./preview-form";

export const metadata: Metadata = {
  title: "Setup preview — development only",
  robots: { index: false, follow: false },
};
export const instant = false;

export default async function SetupPreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const query = await searchParams;
  const purpose = Array.isArray(query.purpose) ? query.purpose[0] : query.purpose;

  return (
    <div className="app-type flex flex-1 flex-col bg-canvas">
      <SetupHeader preview />
      <nav aria-label="Setup preview states" className="mx-auto flex w-full max-w-[440px] md:max-w-[1080px] flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-6 pt-3 text-meta text-fg-secondary [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-sm [&_a]:underline-offset-4 [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-brand">
        <span>Development preview · TEST Neffi Card · submissions disabled</span>
        <Link href="?step=purpose" className="underline">Purpose selection</Link>
        {Object.entries(PURPOSES).map(([key, option]) => (
          <Link key={key} href={`?purpose=${key}`} className="underline">{option.label}</Link>
        ))}
      </nav>
      <SetupView suffix="TEST" purpose={purpose}>
        {isPurpose(purpose) ? <PreviewForm purpose={purpose} linkLabel={PURPOSES[purpose].linkLabel} /> : null}
      </SetupView>
    </div>
  );
}
