import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { profileLinkType } from "@/db/schema/enums";
import { LinkKindIcon } from "@/components/social-icons";
import { SceneViewPreview } from "@/components/scene-view";
import { LINK_KINDS, LINK_KIND_LABELS } from "./block-options";
import { parseBlockContent } from "./block-content";
import { buildSceneView } from "./scene-view";
import { PLATFORM_GROUPS, PLATFORMS } from "./platform-registry";

const added = [
  { kind: "threads", label: "Threads" }, { kind: "discord", label: "Discord" },
  { kind: "reddit", label: "Reddit" }, { kind: "pinterest", label: "Pinterest" },
  { kind: "behance", label: "Behance" }, { kind: "dribbble", label: "Dribbble" },
] as const;

test("registry and client validation exactly cover the database enum", () => {
  expect(Object.keys(PLATFORMS).sort()).toEqual([...profileLinkType.enumValues].sort());
  expect([...LINK_KINDS].sort()).toEqual([...profileLinkType.enumValues].sort());
  expect(profileLinkType.enumValues).toHaveLength(22);
  for (const kind of ["spotify", "twitch", "snapchat"]) {
    expect(PLATFORMS).not.toHaveProperty(kind);
    expect(parseBlockContent("link", { kind, url: "https://example.com" })).toEqual({ ok: false });
  }
});

test("picker categories have the approved order and no duplicate or legacy Booking choice", () => {
  expect(PLATFORM_GROUPS).toEqual([
    { label: "Popular", kinds: ["facebook", "instagram", "tiktok", "linkedin", "youtube"] },
    { label: "Social & community", kinds: ["threads", "x", "discord", "reddit", "pinterest"] },
    { label: "Professional & creative", kinds: ["github", "behance", "dribbble"] },
    { label: "Messaging", kinds: ["messenger", "whatsapp", "viber", "telegram"] },
    { label: "Other links", kinds: ["portfolio", "shop", "menu", "custom"] },
  ]);
  const kinds = PLATFORM_GROUPS.flatMap(group => [...group.kinds]);
  expect(new Set(kinds).size).toBe(21);
  expect(kinds).not.toContain("booking");
});

test.each(added)("$label has metadata, branded icons, canonical validation and public/preview rendering", ({ kind, label }) => {
  expect(PLATFORMS[kind].label).toBe(label);
  expect(LINK_KIND_LABELS[kind]).toBe(label);
  expect(PLATFORMS[kind].brand?.path).toBeTruthy();
  expect(renderToStaticMarkup(<LinkKindIcon kind={kind} />)).toContain("<svg");
  expect(parseBlockContent("link", { kind, url: "example.com/you", label: "" })).toEqual({
    ok: true, content: { kind, url: "https://example.com/you", label: null },
  });
  for (const url of ["http://example.com", "javascript:alert(1)", "https://user:pass@example.com"]) {
    expect(parseBlockContent("link", { kind, url })).toEqual({ ok: false });
  }
  const view = buildSceneView({
    profile: { fullName: "Ana Cruz", headline: null, company: null, bio: null, phone: null, email: null, website: null, location: null, accentColor: null, imageIsLogo: false },
    imageUrl: null, scene: { id: "s1", name: "Main" }, forms: [],
    blocks: [{ id: "b1", type: "link", position: 0, visible: true, formId: null, content: { kind, label: null, url: "https://example.com/you" } }],
  });
  expect(view.blocks).toEqual([{ id: "b1", type: "link", kind, label, url: "https://example.com/you" }]);
  for (const visitorActions of [undefined, { saveContactHref: "/c/token/contact" }]) {
    const html = renderToStaticMarkup(<SceneViewPreview view={view} visitorActions={visitorActions} />);
    expect(html).toContain(label);
    expect(html).toContain(PLATFORMS[kind].brand!.path);
    expect(html).toContain('href="https://example.com/you"');
  }
});

test("existing fallback labels and Custom links stay compatible", () => {
  expect(LINK_KIND_LABELS.x).toBe("X");
  expect(LINK_KIND_LABELS.custom).toBe("Other");
  expect(LINK_KIND_LABELS.booking).toBe("Booking");
  expect(parseBlockContent("link", { kind: "custom", label: "Discord", url: "discord.gg/example" })).toEqual({
    ok: true, content: { kind: "custom", label: "Discord", url: "https://discord.gg/example" },
  });
});
