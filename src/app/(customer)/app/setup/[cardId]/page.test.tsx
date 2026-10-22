import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), ownedCards: vi.fn(), ownedProfiles: vi.fn(), getOwnedProfile: vi.fn(), view: vi.fn(), limit: vi.fn(), scene: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: m.limit }) }) }) } }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.ownedProfiles, getOwnedProfile: m.getOwnedProfile }));
vi.mock("./actions", () => ({ saveLookAction: vi.fn(), saveStyleAction: vi.fn(), saveYouAction: vi.fn(), savePhotoAction: vi.fn(), saveContactAction: vi.fn(), chooseProfileAction: vi.fn(), continueGoalAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/modules/profiles/view", () => ({ loadOwnerSceneView: m.view }));
vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "synthetic" } }));
vi.mock("@/modules/profiles/editor", () => ({ sceneForEditing: m.scene }));
import { setupDraft } from "./setup-draft";
import SetupPage from "./page";
const render = async (query: Record<string, string | string[]> = {}) => renderToStaticMarkup(await SetupPage({ params: Promise.resolve({ cardId: "c1" }), searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.resetAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1", email: "ana@example.test" });
  m.ownedCards.mockResolvedValue([{ id: "c1", publicToken: "A".repeat(22) + "WXYZ", profileId: null }]);
  m.ownedProfiles.mockResolvedValue([]);
  m.view.mockResolvedValue(null);
  m.limit.mockResolvedValue([]);
  m.scene.mockResolvedValue({ blocks: [] });
});
function draft(gaps: string[] = ["contact", "content"]) {
  m.ownedCards.mockResolvedValue([{ id: "c1", publicToken: "TESTWXYZ", profileId: "p1" }]);
  m.getOwnedProfile.mockResolvedValue({ id: "p1", status: "draft", goal: "freelance", fullName: "Ana", gaps, defaultSceneId: "s1" });
}
test("unowned card is not found before profile reads", async () => {
  m.ownedCards.mockResolvedValue([]);
  await expect(render()).rejects.toThrow("NOT_FOUND");
  expect(m.getOwnedProfile).not.toHaveBeenCalled();
});
test("new setup shows five canonical Goals and explicit Continue, no progress bar", async () => {
  const html = await render();
  for (const label of ["Let&#x27;s set up your Neffi", "Networking / Professional", "Freelance / Creative", "Business / Sales", "Student / Job Seeking", "Not sure yet", "Continue", "1 of 7"]) expect(html).toContain(label);
  expect(html).not.toContain('role="progressbar"');
  expect(html).not.toContain("A".repeat(22));
  expect(html).toContain("WXYZ");
});
test("existing-profile chooser is retained; explicit goal enters new setup", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana" }]);
  expect(await render()).toContain("Show one of your profiles on this card");
  expect(await render()).toContain('href="?step=goal"');
  expect(await render({ step: "goal" })).toContain("What will you use Neffi for?");
});
test("You shows canonical fields and carries goal without creating on GET", async () => {
  const html = await render({ step: "you", goal: "business" });
  expect(html).toContain("Let&#x27;s start with you");
  expect(html).toContain('name="goal" value="business"');
  expect(html).toContain("Full name");
  expect(html).toContain("2 of 7");
});
test.each([undefined, "unknown"])("draft resumes from persisted gaps for %s", async step => {
  draft();
  await expect(render(step ? { step } : {})).rejects.toThrow("REDIRECT:?step=contact");
  expect(m.getOwnedProfile).toHaveBeenCalled();
});
test.each([{ gaps: ["name"] }, { gaps: [] }])("resume handles %j", async ({ gaps }) => {
  draft(gaps);
  await expect(render()).rejects.toThrow(`REDIRECT:?step=${gaps.length ? "you" : "review"}`);
});
test.each(["photo", "contact", "links", "look", "style", "review", "done"])("direct %s without Draft is guarded", async step => {
  await expect(render({ step })).rejects.toThrow("REDIRECT:?step=goal");
});
test("optional steps and previous saved steps can be revisited without writes", async () => {
  draft();
  const html = await render({ step: "photo" });
  expect(html).toContain("Add a photo or logo");
  expect(html).toContain("Skip for now");
  expect(html).toContain('href="?step=contact"');
  expect(html).toContain('href="?step=you"');
  expect(await render({ step: "goal" })).toContain("What will you use Neffi for?");
});
test("published route redirects hub except explicit done shell", async () => {
  draft([]);
  m.getOwnedProfile.mockResolvedValue({ id: "p1", status: "published", gaps: [] });
  await expect(render()).rejects.toThrow("REDIRECT:/app/profiles/p1");
  expect(await render({ step: "done" })).toContain("Your Neffi is live");
});
test("Draft cannot enter done, and reload keeps explicit allowed step", async () => {
  draft(); m.view.mockResolvedValue(setupDraft(null, { fullName: "Ana" }));
  await expect(render({ step: "done" })).rejects.toThrow("REDIRECT:?step=contact");
  expect(await render({ step: "style" })).toContain("Make it yours");
  expect(await render({ step: "style" })).toContain("Make it yours");
});

test("Links loads the owned Default mode and real view without creating content", async () => {
  draft(); m.view.mockResolvedValue(setupDraft(null, { fullName: "Ana" }));
  const html = await render({ step: "links" });
  expect(html).toContain("Add something else");
  expect(html).toContain("Added to your profile");
  expect(html).toContain('href="?step=look"');
  expect(m.scene).toHaveBeenCalledWith(expect.anything(), "a1", "p1", "s1");
  expect(m.view).toHaveBeenCalledWith(expect.anything(), { accountId: "a1", profileId: "p1", sceneId: "s1" });
});

test.each(["look", "style"])("%s loads the real owner view instead of a placeholder", async step => {
 draft([]); m.view.mockResolvedValue(setupDraft(null, {fullName: "Ana"}));
 const html = await render({step}); expect(html).toContain('data-setup-appearance-preview');
 expect(html).not.toContain("editor is coming"); expect(m.view).toHaveBeenCalledWith(expect.anything(),{accountId:"a1",profileId:"p1",sceneId:"s1"});
});
