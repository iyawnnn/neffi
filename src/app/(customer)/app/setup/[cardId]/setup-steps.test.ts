import { expect, test } from "vitest";
import { resumeStep, resolveStep, nextStep, previousStep, SKIPPABLE_STEPS } from "./setup-steps";

test.each([
  [null, "goal"], [["name", "contact", "content"], "you"],
  [["name"], "you"], [["contact"], "contact"], [["content"], "contact"],
  [["contact", "content"], "contact"], [[], "review"],
] as const)("resume derives from gaps %j", (gaps, step) => {
  expect(resumeStep(gaps)).toBe(step);
});

test.each(["photo", "contact", "links", "look", "style", "review"])("%s requires a Profile", step => {
  expect(resolveStep(step, null)).toBe("goal");
  expect(resolveStep(step, { status: "draft", gaps: ["name", "contact"] })).toBe(step);
});

test("goal and you are accessible before creation; unknown and absent steps resume", () => {
  expect(resolveStep("goal", null)).toBe("goal");
  expect(resolveStep("you", null)).toBe("you");
  expect(resolveStep("unknown", { status: "draft", gaps: ["content"] })).toBe("contact");
  expect(resolveStep(undefined, { status: "draft", gaps: [] })).toBe("review");
});

test("done requires publication", () => {
  expect(resolveStep("done", null)).toBe("goal");
  expect(resolveStep("done", { status: "draft", gaps: ["name"] })).toBe("you");
  expect(resolveStep("done", { status: "published", gaps: [] })).toBe("done");
});

test("optional steps never block resume; navigation follows order without persistence", () => {
  expect(SKIPPABLE_STEPS).toEqual(["photo", "links", "look", "style"]);
  expect(resumeStep([])).toBe("review");
  expect(nextStep("photo")).toBe("contact");
  expect(previousStep("contact")).toBe("photo");
  expect(previousStep("goal")).toBeNull();
  expect(nextStep("style")).toBe("review");
});
