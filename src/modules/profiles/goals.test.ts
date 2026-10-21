import { expect, test } from "vitest";
import { COLOR_MODES, LAYOUTS, type ColorMode, type Layout } from "./appearance-options";
import { GOALS, NO_GOAL, isGoal, type Goal } from "./goals";
import { profileColorMode, profileGoal, profileLayout } from "@/db/schema";

test("goal definitions and appearance domains match the approved persisted values", () => {
  expect(LAYOUTS).toEqual(["classic", "editorial", "showcase"] satisfies Layout[]);
  expect(COLOR_MODES).toEqual(["light", "dark"] satisfies ColorMode[]);
  expect(LAYOUTS).toEqual(profileLayout.enumValues);
  expect(COLOR_MODES).toEqual(profileColorMode.enumValues);
  expect(Object.keys(GOALS)).toEqual(profileGoal.enumValues);
  expect(GOALS).toEqual({
    networking: { label: "Networking / Professional", helper: "Share your details and stay in touch.", layout: "classic", sceneName: "Networking", suggestions: ["linkedin", "messenger", "whatsapp", "custom"] },
    freelance: { label: "Freelance / Creative", helper: "Show your work and get new clients.", layout: "showcase", sceneName: "My work", suggestions: ["project", "portfolio", "instagram", "behance", "dribbble", "booking", "form"] },
    business: { label: "Business / Sales", helper: "Help customers reach you and take action.", layout: "editorial", sceneName: "Business", suggestions: ["booking", "facebook", "messenger", "shop", "menu", "form"] },
    student: { label: "Student / Job Seeking", helper: "Share your projects and make a great first impression.", layout: "classic", sceneName: "Main", suggestions: ["linkedin", "project", "portfolio", "github", { kind: "custom", label: "Resume" }] },
  } satisfies Record<Goal, unknown>);
  expect(NO_GOAL).toEqual({ label: "Not sure yet", helper: "You can change everything later.", layout: "classic", sceneName: "Main", suggestions: ["linkedin", "facebook", "instagram", "custom"] });
});

test("isGoal accepts only persisted Goal keys", () => {
  for (const goal of Object.keys(GOALS)) expect(isGoal(goal)).toBe(true);
  for (const value of [null, "", "network", "get_clients", "show_my_work", "unknown", 1]) expect(isGoal(value)).toBe(false);
});
