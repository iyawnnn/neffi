import type { PublishGap } from "@/modules/profiles/rules";

export const SETUP_STEPS = ["goal", "you", "photo", "contact", "links", "look", "style", "review", "done"] as const;
export type SetupStep = typeof SETUP_STEPS[number];
export const SKIPPABLE_STEPS: readonly SetupStep[] = ["photo", "links", "look", "style"];
export const STEP_TITLES: Record<SetupStep, string> = {
  goal: "Let's set up your Neffi", you: "Let's start with you", photo: "Add a photo or logo",
  contact: "How can people reach you?", links: "What should people find?", look: "Choose how your profile looks",
  style: "Make it yours", review: "Review your Neffi", done: "Your Neffi is live",
};

export function resumeStep(gaps: readonly PublishGap[] | null): SetupStep {
  if (gaps === null) return "goal";
  if (gaps.includes("name")) return "you";
  if (gaps.includes("contact") || gaps.includes("content")) return "contact";
  return "review";
}

export function resolveStep(requested: string | undefined, profile: { status: string; gaps: readonly PublishGap[] } | null): SetupStep {
  const resume = resumeStep(profile?.gaps ?? null);
  if (!SETUP_STEPS.includes(requested as SetupStep)) return resume;
  const step = requested as SetupStep;
  if (step === "goal" || step === "you") return step;
  if (step === "done") return profile?.status === "published" ? "done" : resume;
  return profile ? step : "goal";
}

export const previousStep = (step: SetupStep): SetupStep | null => SETUP_STEPS[SETUP_STEPS.indexOf(step) - 1] ?? null;
export const nextStep = (step: SetupStep): SetupStep | null => SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1] ?? null;
