import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), ownedProfiles: vi.fn(), cardSummaries: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.ownedProfiles }));
vi.mock("@/modules/cards/manage", () => ({ cardSummaries: m.cardSummaries }));
import ProfilesPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.ownedProfiles.mockResolvedValue([]);
  m.cardSummaries.mockResolvedValue([]);
});

test("lists owned profiles with status, connected-card counts and separate edit/preview links", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft" }, { id: "p2", fullName: null, status: "published" }, { id: "p3", fullName: "Ben", status: "unpublished" }]);
  m.cardSummaries.mockResolvedValue([{ id: "c1", profileId: "p1", publicToken: "private-card-token" }, { id: "c2", profileId: "p1" }, { id: "c3", profileId: "p3" }]);
  const html = renderToStaticMarkup(await ProfilesPage());
  for (const text of ["Ana", "Untitled profile", "Ben", "Draft", "Published", "Unpublished", "Not published yet.", "Your profile is published.", "Not currently published.", "2 connected cards", "1 connected card", "No card connected", "3 profiles"]) expect(html).toContain(text);
  for (const id of ["p1", "p2", "p3"]) {
    expect(html).toContain(`href="/app/profiles/${id}"`);
    expect(html).toContain(`href="/app/profiles/${id}/preview"`);
  }
  const links = [...html.matchAll(/<a\b[^>]*>(.*?)<\/a>/g)];
  for (const [, content] of links) expect(content).not.toContain("<a ");
  for (const [, row] of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)) {
    expect([...row.matchAll(/<a\b/g)]).toHaveLength(2);
    expect(row).toContain('aria-label="Edit profile:');
    expect(row).toContain('aria-label="Preview profile:');
  }
  expect(html).not.toContain("Open profile:");
  expect(html).not.toContain("private-card-token");
  expect(m.ownedProfiles).toHaveBeenCalledWith({}, "a1");
  expect(m.cardSummaries).toHaveBeenCalledWith({}, "a1");
  expect(m.requireAccount).toHaveBeenCalledWith("/app");
  const published = html.match(/<span class="([^"]*)"><span aria-hidden="true"[^>]*><\/span>Published<\/span>/)![1];
  for (const token of ["bg-brand/5", "border-brand/20", "text-action-text"]) expect(published).toContain(token);
  expect(published).not.toContain("bg-foreground");
  const draft = html.match(/<span class="([^"]*)">Draft<\/span>/)![1];
  expect(draft).toContain("bg-canvas"); expect(draft).not.toContain("bg-brand");
});

test("approved layout retains right-hand count, outline row actions and large centered creation panel", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "published" }]);
  const html = renderToStaticMarkup(await ProfilesPage());
  const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
  expect(header).toContain("justify-between"); expect(header).toContain("rounded-full border bg-background");
  const row = html.match(/<li\b[\s\S]*?<\/li>/)![0];
  expect(row).toContain("gap-3 px-5 py-4"); expect(row).toContain("md:py-2");
  for (const link of row.matchAll(/<a\b[^>]*>/g)) expect(link[0]).toContain("border-border");
  expect(row).not.toContain("lucide-pencil");
  const panel = html.match(/<section aria-labelledby="create-profile"[\s\S]*?<\/section>/)![0];
  for (const token of ["text-center", "w-[240px]", "md:px-8", "md:py-8", "mx-auto mt-2", "bg-action"]) expect(panel).toContain(token);
  expect(panel).not.toContain("md:grid-cols-"); expect(panel).not.toContain("md:text-left");
});

test("creation has a single primary action without a duplicate list header or setup explanatory copy", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft" }]);
  const html = renderToStaticMarkup(await ProfilesPage());
  const createLinks = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(([, , content]) => /Create (?:another )?profile/.test(content));
  expect(createLinks).toHaveLength(1);
  expect(createLinks[0][1]).toContain("bg-action");
  expect(createLinks[0][2]).toContain("Create another profile");
  expect(html).not.toMatch(/<h2\b[^>]*>Profiles<\/h2>/);
  expect(html).not.toContain("New profiles start when");
  expect(html).not.toContain("A Neffi is ready to set up.");
});

test("the create action uses purpose selection for an owned card awaiting setup", async () => {
  m.cardSummaries.mockResolvedValue([{ id: "connected", profileId: "p1" }, { id: "waiting", profileId: null }]);
  const html = renderToStaticMarkup(await ProfilesPage());
  expect([...html.matchAll(/href="\/app\/setup\/waiting\?step=purpose"/g)]).toHaveLength(1);
  expect(html).not.toContain('href="/app/setup/connected');
});

test("an empty account gets an intentional empty state and starts creation through activation", async () => {
  const html = renderToStaticMarkup(await ProfilesPage());
  expect(html).toContain("No profiles yet");
  expect(html).toContain("Create your first profile");
  expect(html).toContain("0 profiles");
  expect([...html.matchAll(/href="\/activate"/g)]).toHaveLength(1);
  expect(html).toContain('src="/neffi-create-profile.svg"');
  expect(html).not.toContain("neffi-create-profile-cards.svg");
  expect(html).not.toContain("neffi-create-profile-cards.png");
});

test("requires the session before reading customer data", async () => {
  m.requireAccount.mockRejectedValue(new Error("sign-in required"));
  await expect(ProfilesPage()).rejects.toThrow("sign-in required");
  expect(m.ownedProfiles).not.toHaveBeenCalled();
  expect(m.cardSummaries).not.toHaveBeenCalled();
});
