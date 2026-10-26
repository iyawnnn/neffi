"use client";

import Link, { useLinkStatus } from "next/link";
import { ArrowRight, LoaderCircle, Plus } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Choice = { id: string; fullName: string | null; headline: string | null; status: "draft" | "published" | "unpublished" };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join("") || "?";

function CreateIcon() {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Plus aria-hidden />;
}

export function ChooseProfile({ cardId, profiles, action }: { cardId: string; profiles: Choice[]; action: (data: FormData) => void | Promise<void> }) {
  return (
    <>
      <p className="text-body text-fg-secondary">The card will open this profile when someone taps it. You can switch later.</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="cardId" value={cardId} />
        <fieldset className="flex min-w-0 flex-col gap-2.5">
          <legend className="sr-only">Your profiles</legend>
          {profiles.map((profile, index) => {
            const name = profile.fullName ?? "Untitled profile";
            return (
              <label key={profile.id} data-profile-choice className="flex min-h-[72px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-border-strong has-[:checked]:border-brand has-[:checked]:bg-brand/[0.03] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand motion-reduce:transition-none">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-meta font-semibold text-fg-secondary">{initials(name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold">{name}</span>
                  <span className="mt-0.5 block truncate text-meta text-fg-secondary">{profile.headline || (profile.status === "draft" ? "Draft" : "Published")}</span>
                </span>
                <input type="radio" name="profileId" value={profile.id} required defaultChecked={index === 0} className="size-4 shrink-0 accent-brand" />
              </label>
            );
          })}
        </fieldset>
        <SubmitButton variant="action" size="touch" className="h-12 w-full gap-2 rounded-[10px] font-semibold" pendingText="Connecting…">
          Use this profile<ArrowRight aria-hidden />
        </SubmitButton>
      </form>
      <div aria-hidden className="flex items-center gap-3"><span className="h-px flex-1 bg-border/80" /><span className="text-xs text-fg-secondary">or</span><span className="h-px flex-1 bg-border/80" /></div>
      <Link href="?step=goal" className={cn(buttonVariants({ variant: "outline", size: "touch" }), "h-12 w-full gap-2 rounded-[10px] text-[0.875rem] font-medium")}>
        <CreateIcon />Create a new profile
      </Link>
    </>
  );
}
