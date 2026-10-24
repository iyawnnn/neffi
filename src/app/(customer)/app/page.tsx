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
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard accountId={viewer.accountId} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your Neffi" className="flex flex-col gap-6 md:gap-8">
      <Skeleton className="h-32 rounded-panel bg-subtle md:h-28" />
      <Skeleton className="h-64 rounded-panel bg-subtle md:h-52" />
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <Skeleton className="h-36 rounded-panel bg-subtle" />
        <Skeleton className="h-36 rounded-panel bg-subtle" />
      </div>
    </div>
  );
}
