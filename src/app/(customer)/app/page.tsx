import Image from "next/image";
import { Suspense } from "react";
import { requireAccount } from "@/auth/access";
import { Skeleton } from "@/components/ui/skeleton";
import { Dashboard } from "./dashboard";

export const instant = false;

export default async function CustomerHome({ searchParams }: PageProps<"/app">) {
  const viewer = await requireAccount("/app");
  return (
    // data-canvas lets the layout paint the Snow canvas behind Home (and its bottom-bar clearance) only.
    <main data-canvas className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 pb-0 md:px-6 md:pt-8 md:pb-12">
      <header className="relative mb-6 overflow-hidden rounded-panel border border-border/60 bg-canvas md:mb-8">
        <div className="relative z-10 flex max-w-[64%] flex-col gap-1.5 px-5 py-6 sm:max-w-[480px] md:gap-2 md:px-10 md:py-14">
          <h1 className="text-title">Your Neffi</h1>
          <p className="max-w-[400px] text-body text-fg-secondary">Manage your cards and what people <br className="hidden md:block" />see when they tap.</p>
        </div>
        {/* The approved hero art, faded in from the left so it sits in the surface. Phones get a tight crop of the
            cards (about a third of the width); from md the whole composition fits the panel's height. Decorative. */}
        <div aria-hidden className="absolute inset-y-0 right-0 w-[38%] mix-blend-multiply [mask-image:linear-gradient(to_right,transparent,black_45%)] md:w-[48%] md:[mask-image:linear-gradient(to_right,transparent,black_30%)]">
          <Image src="/neffi-dashboard-hero.png" alt="" fill preload sizes="(min-width: 768px) 560px, 40vw" className="object-cover object-[80%_45%] md:object-right" />
        </div>
      </header>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard accountId={viewer.accountId} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your Neffi" className="flex flex-col gap-7 md:gap-8">
      <Skeleton className="h-80 rounded-panel bg-subtle md:h-64" />
      <Skeleton className="h-56 rounded-panel bg-subtle md:h-[4.5rem]" />
      <div className="grid gap-8 md:grid-cols-2 md:gap-6">
        <Skeleton className="h-36 rounded-panel bg-subtle" />
        <Skeleton className="h-36 rounded-panel bg-subtle" />
      </div>
    </div>
  );
}
