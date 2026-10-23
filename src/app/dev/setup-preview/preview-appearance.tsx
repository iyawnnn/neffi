"use client";
import { useState } from "react";
import { SetupAppearance } from "@/app/(customer)/app/setup/[cardId]/setup-appearance";
import type { SceneView } from "@/modules/profiles/scene-view";
import type { Goal } from "@/modules/profiles/goals";
export function PreviewAppearance({ step, goal, view }: { step: "look" | "style"; goal: Goal | null; view: SceneView }) {
 const [saved, setSaved] = useState(false);
 return <>{saved && <p role="status" className="mx-auto px-4 text-meta text-fg-secondary">Synthetic selection saved locally for review. Reload resets it.</p>}<SetupAppearance step={step} cardId="synthetic-card" suffix="TEST" goal={goal} view={view} action={async () => {setSaved(true); return {};}} /></>;
}
