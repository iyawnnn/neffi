"use client";

import { useActionState } from "react";
import type { Purpose } from "@/modules/profiles/purpose-options";
import { createProfileAction } from "./actions";
import { EssentialsFields } from "./setup-view";

export function EssentialsForm({ cardId, purpose, linkLabel, defaultEmail }: { cardId: string; purpose: Purpose; linkLabel: string; defaultEmail: string }) {
  const [state, action, pending] = useActionState(createProfileAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 sm:gap-[18px]">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="purpose" value={purpose} />
      <EssentialsFields purpose={purpose} linkLabel={linkLabel} defaultEmail={defaultEmail} state={state} disabled={pending} />
    </form>
  );
}
