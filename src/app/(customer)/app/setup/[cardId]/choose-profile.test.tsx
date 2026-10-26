import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("next/link", async () => {
  const actual = await vi.importActual<typeof import("next/link")>("next/link");
  return { ...actual, useLinkStatus: () => ({ pending: false }) };
});
import { ChooseProfile } from "./choose-profile";

const profiles = [
  { id: "p1", fullName: "Ana Cruz", headline: "Designer", status: "published" as const },
  { id: "p2", fullName: null, headline: null, status: "draft" as const },
];

test("each profile is a selectable radio row, the first preselected, with one primary and an outline create action", () => {
  const html = renderToStaticMarkup(<ChooseProfile cardId="c1" profiles={profiles} action={() => {}} />);
  expect(html.match(/type="radio"[^>]*name="profileId"/g)).toHaveLength(2);
  expect(html).toMatch(/name="profileId" checked="" value="p1"/);
  expect(html).toContain("Ana Cruz");
  expect(html).toContain("Untitled profile");
  expect(html).toContain("Use this profile");
  expect(html).toContain('href="?step=goal"');
  expect(html).toContain("Create a new profile");
  expect(html).not.toContain("underline");
});
