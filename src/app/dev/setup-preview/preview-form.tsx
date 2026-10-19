"use client";

import { EssentialsFields } from "@/app/(customer)/app/setup/[cardId]/setup-view";
import type { Purpose } from "@/modules/profiles/starters";

export function PreviewForm({ purpose, linkLabel }: { purpose: Purpose; linkLabel: string }) {
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4 sm:gap-[18px]">
      <EssentialsFields purpose={purpose} linkLabel={linkLabel} defaultEmail="customer@example.invalid" disabled />
    </form>
  );
}
