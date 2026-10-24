import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), cardSummaries: vi.fn(), ownedProfiles: vi.fn(), getOwnedProfile: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.ownedProfiles, getOwnedProfile: m.getOwnedProfile }));
vi.mock("@/modules/cards/manage", () => ({ cardSummaries: m.cardSummaries }));
vi.mock("@/db", () => ({ db: {} }));

import { Dashboard } from "./dashboard";
import CustomerHome from "./page";

const TOKEN = "A".repeat(22) + "WXYZ";
const OTHER = "B".repeat(22) + "QRST";
const card = (id: string, publicToken: string, profileId: string | null, extra = {}) => ({ id, publicToken, suffix: publicToken.slice(-4), profileId, profileName: null, disabled: false, ...extra });
const render = async (search: Record<string, string> = {}) => renderToStaticMarkup(await Dashboard({ accountId: "a1", searchParams: Promise.resolve(search) }));
const draft = (gaps: string[]) => ({ id: "p1", fullName: "Ana", status: "draft", defaultSceneId: "s1", gaps, unread: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "a1", email: "a@example.test", role: "customer" });
  m.ownedProfiles.mockResolvedValue([]);
  m.getOwnedProfile.mockResolvedValue(null);
  m.cardSummaries.mockResolvedValue([]);
});

test("the page checks the session, then renders the dashboard stream behind a skeleton", async () => {
  const html = renderToStaticMarkup(await CustomerHome({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as Parameters<typeof CustomerHome>[0]));
  expect(html).toContain('aria-label="Loading your Neffi"');
  expect(m.requireAccount).toHaveBeenCalledWith("/app");
});

test("lists profiles and leads with the draft's next step", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft", unread: 0 }, { id: "p2", fullName: "Lee", status: "published", unread: 2 }]);
  m.getOwnedProfile.mockResolvedValue(draft(["contact"]));
  const html = await render();
  expect(m.getOwnedProfile).toHaveBeenCalledWith({}, "a1", "p1");
  expect(html).toContain("Your profiles");
  expect(html).toContain('href="/app/profiles/p1"');
  expect(html).toContain('href="/app/profiles/p2"');
  expect(html).toContain("Draft");
  expect(html).toContain("Published");
  expect(html).toContain("2 new");
  expect(html).toContain('aria-valuenow="2"');
  expect(html).toContain("Add a phone number, email or website so people can reach you.");
  expect(html).toContain('href="/app/profiles/p1/identity"');
  expect(html).toContain("Preview and publish");
  expect(html).toContain('href="/app/profiles/p1/publish"');
  expect(html).not.toContain('href="/app/profiles/p2/publish"');
});

test("a draft missing content continues in its main scene; a complete draft goes straight to publishing", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft", unread: 0 }]);
  m.getOwnedProfile.mockResolvedValue(draft(["content"]));
  expect(await render()).toContain('href="/app/profiles/p1/scenes/s1"');
  m.getOwnedProfile.mockResolvedValue(draft([]));
  const html = await render();
  expect(html).toContain('aria-valuenow="3"');
  expect(html).toContain("Profile readiness");
  expect(html).not.toContain("Continue setup");
  expect(html).toContain('href="/app/profiles/p1/publish"');
});

test("a draft's publish action resumes guided setup when a card already routes to it", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft", unread: 0 }]);
  m.getOwnedProfile.mockResolvedValue(draft(["contact"]));
  m.cardSummaries.mockResolvedValue([card("c1", TOKEN, "p1")]);
  const html = await render();
  expect(html).toContain('href="/app/setup/c1"');
  expect(html).not.toContain('href="/app/profiles/p1/publish"');
});

test("published summary has one unified action row with Preview, QR, and Manage profile", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p2", fullName: "Lee", status: "published", unread: 0 }]);
  m.cardSummaries.mockResolvedValue([card("c2", OTHER, "p2", { profileName: "Lee" })]);
  const html = await render();
  expect(m.getOwnedProfile).not.toHaveBeenCalled();
  expect(html).toContain("Manage profile");
  expect(html).toContain('href="/app/profiles/p2/preview"');
  expect(html).toContain('href="/app/cards/c2"');
  expect(html).toContain("Live on 1 card");
  expect(html).not.toContain("Continue setup");
  expect(html).not.toContain(OTHER);
  const summary = html.match(/<section aria-label="Next step"[\s\S]*?<\/section>/)![0];
  expect(summary).toContain('role="group"');
  expect(summary).toContain('aria-label="Profile actions"');
  const actionGroup = summary.match(/<div role="group" aria-label="Profile actions"[\s\S]*?<\/div>/)![0];
  const actions = [...actionGroup.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)];
  expect(actions).toHaveLength(3);

  // Desktop action order: 1. Preview, 2. Share QR, 3. Manage profile
  // 1. Preview: icon-only square button with tooltip and aria-label
  const preview = actions[0][0];
  expect(preview).toContain('href="/app/profiles/p2/preview"');
  expect(preview).toContain('aria-label="Preview profile"');
  expect(preview).toContain('title="Preview profile"');
  expect(preview).toContain("lucide-eye");
  expect(preview).not.toContain(">Preview</a>");
  for (const token of ["size-11", "rounded-[10px]", "border-border", "bg-background", "text-foreground", "duration-[220ms]"]) {
    expect(preview).toContain(token);
  }

  // 2. Share QR: icon-only square button with tooltip and aria-label
  const qr = actions[1][0];
  expect(qr).toContain('href="/app/cards/c2"');
  expect(qr).toContain('aria-label="Share QR code"');
  expect(qr).toContain('title="Share QR code"');
  expect(qr).toContain("lucide-qr-code");
  expect(qr).not.toContain(">Share QR code</a>");
  for (const token of ["size-11", "rounded-[10px]", "border-border", "bg-background", "text-foreground", "duration-[220ms]"]) {
    expect(qr).toContain(token);
  }

  // 3. Manage profile: Vermilion primary with icon + text, flex-1 on mobile, auto on desktop
  const manage = actions[2][0];
  expect(manage).toContain('href="/app/profiles/p2"');
  for (const token of [
    "Manage profile",
    "bg-action",
    "text-white",
    "lucide-pencil",
    "h-11",
    "rounded-[10px]",
    "duration-[220ms]",
    "order-first",
    "flex-1",
    "md:order-last",
    "md:flex-initial",
    "md:w-auto",
  ]) {
    expect(manage).toContain(token);
  }

  // No separate secondary grid / no duplicate text-only row
  expect(summary).not.toContain("grid-cols-2");
  expect(actions.filter(([link]) => link.includes("bg-action"))).toHaveLength(1);
  expect(summary).toContain("flex-wrap");

  // Unrelated Home sections remain unchanged
  const quick = html.match(/<section aria-labelledby="quick-actions"[\s\S]*?<\/section>/)![0];
  for (const text of ["Activate another Neffi", "Preview profile", "Manage cards"]) expect(quick).toContain(text);
  for (const href of ["/activate", "/app/profiles/p2/preview", "/app/cards"]) expect(quick).toContain(`href="${href}"`);
  for (const title of ["Your profiles", "Your cards", "1 connected card", "Connected to Lee"]) expect(html).toContain(title);
  const badges = [...html.matchAll(/<span class="([^"]*)"><span aria-hidden="true"[^>]*><\/span>Published<\/span>/g)];
  expect(badges).toHaveLength(2);
  expect(badges[0][1]).toBe(badges[1][1]);
  for (const badge of badges) {
    for (const token of ["border-brand/20", "bg-brand/5", "text-action-text", "rounded-md"]) expect(badge[1]).toContain(token);
    expect(badge[1]).not.toContain("bg-foreground");
  }
});

test("QR sharing remains conditional on a published profile with a connected card", async () => {
  m.ownedProfiles.mockResolvedValue([{ id: "p2", fullName: "Lee", status: "published", unread: 0 }]);
  expect(await render()).not.toContain("Share QR code");
  m.ownedProfiles.mockResolvedValue([{ id: "p2", fullName: "Lee", status: "unpublished", unread: 0 }]);
  m.cardSummaries.mockResolvedValue([card("c2", OTHER, "p2")]);
  const html = await render(); expect(html).not.toContain("Share QR code");
  expect(html).toContain("Unpublished"); expect(html).toContain("Preview"); expect(html).toContain("Manage profile");
});

test.each([0, 2])("a profile row shows its own unread messages only when nonzero (%s)", async unread => {
  m.ownedProfiles.mockResolvedValue([{ id: "p2", fullName: "Lee", status: "published", unread }]);
  const html = await render();
  expect(html.includes(`${unread} new`)).toBe(unread > 0);
  // The account-wide Inbox entry point is the header bell (see app-nav.test.tsx), not a dashboard shortcut.
  expect(html).not.toContain('href="/app/inbox"');
});

test("after a claim, confirms the Neffi was added", async () => {
  const html = await render({ added: "1" });
  expect(html).toMatch(/role="status"/);
  expect(html).toContain("Your Neffi has been added to your account. Next, you&#x27;ll set it up.");
});

test("leads with owned cards waiting for setup without exposing the full card address", async () => {
  m.cardSummaries.mockResolvedValue([card("c1", TOKEN, null), card("c2", OTHER, "p1", { profileName: "Ana", disabled: true })]);
  const html = await render();
  expect(html).toContain("Set up your Neffi");
  expect(html).toMatch(/Neffi ending in <span[^>]*>WXYZ</);
  expect(html).toContain('<span class="sr-only">ending in</span> WXYZ');
  expect(html).toContain('href="/app/setup/c1"');
  expect(html).toContain("Connected to Ana");
  expect(html).toContain("Turned off");
  expect(html).toContain("Activate another Neffi");
  expect(html).not.toContain(TOKEN);
  expect(html).not.toContain(OTHER);
  expect(m.cardSummaries).toHaveBeenCalledWith({}, "a1");
  expect(m.getOwnedProfile).not.toHaveBeenCalled();
});

test("with nothing yet, onboards to activation with dedicated zero-state experience", async () => {
  const html = await render();
  expect([...html.matchAll(/<h[12]\b[^>]*>(.*?)<\/h[12]>/g)].map(([, title]) => title)).toEqual([
    "Your Neffi",
    "Get your Neffi ready",
    "Your profiles",
    "Your cards",
  ]);
  expect(html).toContain('src="/neffi-dashboard-hero.svg"');
  expect(html).not.toContain("neffi-dashboard-hero.png");
  expect(html).toContain("Your Neffi");
  expect(html).toContain("Get your Neffi ready");
  expect(html).toContain("Activate my Neffi");
  expect(html).toContain("Activate");
  expect(html).toContain("Set up");
  expect(html).toContain("Ready");
  expect(html).toContain("Your profiles");
  expect(html).toContain("No profiles yet");
  expect(html).toContain("Your cards");
  expect(html).toContain("No cards activated yet");
  expect(html).not.toContain("What happens next");
  expect(html).not.toContain("Build your profile");
  expect(html).not.toContain("Make it yours");
  expect(html).not.toContain("Tap and share");
  expect(html).not.toContain("Quick actions");
  expect([...html.matchAll(/href="\/activate"/g)]).toHaveLength(1);
});

test.each([false, true])("activation navigation has a 44px touch target (owns cards: %s)", async (ownsCards) => {
  m.cardSummaries.mockResolvedValue(ownsCards ? [card("c1", TOKEN, null)] : []);
  const html = await render();
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag).filter((tag) => tag.includes('href="/activate"'));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toMatch(/\b(min-h-11|h-11|h-12)\b/);
});
