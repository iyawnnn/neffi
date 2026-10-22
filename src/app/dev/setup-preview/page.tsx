import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SetupHeader } from "@/components/setup-header";
import { GoalFields, SetupPlaceholder, SetupView } from "@/app/(customer)/app/setup/[cardId]/setup-view";
import { previousStep, resolveStep } from "@/app/(customer)/app/setup/[cardId]/setup-steps";
import { isGoal } from "@/modules/profiles/goals";
import type { PublishGap } from "@/modules/profiles/rules";
import { SetupForm } from "@/app/(customer)/app/setup/[cardId]/setup-form";
import { PreviewForm } from "./preview-form";

export const metadata: Metadata = { title: "Setup preview — development only", robots: { index: false, follow: false } };
export const instant = false;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function SetupPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const query = await searchParams;
  const state = first(query.state) ?? "draft";
  const gaps: PublishGap[] = state === "name" ? ["name", "contact", "content"] : state === "ready" || state === "published" ? [] : ["contact", "content"];
  const profile = state === "new" ? null : { status: state === "published" ? "published" : "draft", gaps };
  const requested = first(query.step);
  const step = resolveStep(requested, profile);
  if (step !== requested) redirect(`?state=${state}&step=${step}`);
  const rawGoal = first(query.goal);
  const goal = isGoal(rawGoal) ? rawGoal : null;
  const previous = previousStep(step);
  return (
    <div className="app-type flex flex-1 flex-col bg-canvas">
      <SetupHeader preview />
      <nav aria-label="Setup preview states" className="mx-auto flex w-full max-w-[528px] flex-wrap gap-x-4 px-4 pt-3 text-meta text-fg-secondary sm:px-6">
        <p className="w-full">Development preview · synthetic data · submissions disabled</p>
        {[["new", "New setup"], ["name", "Missing name"], ["draft", "Missing contact/content"], ["ready", "Ready for review"]].map(([value, label]) => <Link key={value} href={`?state=${value}`} className="inline-flex min-h-11 items-center underline underline-offset-4">{label}</Link>)}
      </nav>
      <SetupView suffix="TEST" step={step} backHref={previous ? `?state=${state}&step=${previous}` : "?state=new"}>
        {step === "goal" ? (
          <SetupForm method="get" className="flex flex-col gap-5">
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="step" value="you" />
            <GoalFields goal={rawGoal !== undefined ? goal : undefined} />
          </SetupForm>
        ) : step === "you" && !profile ? <PreviewForm purpose="network" linkLabel="LinkedIn or main profile link" /> : <SetupPlaceholder step={step} profileId="synthetic-profile" sceneId="synthetic-scene" />}
      </SetupView>
    </div>
  );
}
