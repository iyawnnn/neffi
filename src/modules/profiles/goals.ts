import type { Layout } from "./appearance-options";

type Suggestion = "linkedin" | "messenger" | "whatsapp" | "custom" | "project" | "portfolio" | "instagram" | "behance" | "dribbble" | "booking" | "form" | "facebook" | "shop" | "menu" | "github" | { kind: "custom"; label: "Resume" };
type GoalDefinition = { label: string; helper: string; layout: Layout; sceneName: string; suggestions: Suggestion[] };

export const GOALS = {
  networking: { label: "Networking / Professional", helper: "Share your details and stay in touch.", layout: "classic", sceneName: "Networking", suggestions: ["linkedin", "messenger", "whatsapp", "custom"] },
  freelance: { label: "Freelance / Creative", helper: "Show your work and get new clients.", layout: "showcase", sceneName: "My work", suggestions: ["project", "portfolio", "instagram", "behance", "dribbble", "booking", "form"] },
  business: { label: "Business / Sales", helper: "Help customers reach you and take action.", layout: "editorial", sceneName: "Business", suggestions: ["booking", "facebook", "messenger", "shop", "menu", "form"] },
  student: { label: "Student / Job Seeking", helper: "Share your projects and make a great first impression.", layout: "classic", sceneName: "Main", suggestions: ["linkedin", "project", "portfolio", "github", { kind: "custom", label: "Resume" }] },
} satisfies Record<string, GoalDefinition>;

export type Goal = keyof typeof GOALS;

export const NO_GOAL = { label: "Not sure yet", helper: "You can change everything later.", layout: "classic", sceneName: "Main", suggestions: ["linkedin", "facebook", "instagram", "custom"] } satisfies GoalDefinition;

export const isGoal = (value: unknown): value is Goal => typeof value === "string" && Object.hasOwn(GOALS, value);
