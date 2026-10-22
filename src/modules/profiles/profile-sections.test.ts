import { expect, test } from "vitest";
import { buildSceneView, type SceneView, type ViewBlock } from "./scene-view";
import { LINK_KINDS } from "./block-options";
import { profileSections } from "./profile-sections";

const base = (blocks: ViewBlock[] = []): SceneView => ({
  identity: { fullName: "Ana", initials: "A", headline: null, company: null, bio: "My intro", phone: "+639171234567", email: "ana@example.test", website: "https://ana.example/", location: "Manila", accent: "#0C0C0D", onAccent: "#FFFFFF", image: null },
  appearance: { layout: "classic", mode: "light", accent: "#0C0C0D", cover: null },
  scene: { id: "main", name: "Main" }, blocks,
});
const link = (id: string, kind: "github" | "custom" = "custom"): Extract<ViewBlock, { type: "link" }> => ({ id, type: "link", kind, label: id, url: `https://example.test/${id}` });
const project = (id: string): Extract<ViewBlock, { type: "project" }> => ({ id, type: "project", title: id, description: null, url: null });
const booking = (id: string): Extract<ViewBlock, { type: "booking" }> => ({ id, type: "booking", label: id, url: `https://example.test/${id}` });
const contact = (id: string, saveContact: boolean): ViewBlock => ({ id, type: "contact", saveContact, phone: "+639171234567", email: "ana@example.test", website: "https://ana.example/", location: "Manila" });
const ids = (items: { id: string }[]) => items.map(item => item.id);

test.each(["classic", "editorial", "showcase"] as const)("%s keeps every supported item in its semantic role without mutating the view", layout => {
  const view = base([link("s1", "github"), project("p1"), booking("b1"), link("l1"), { id: "a1", type: "about", text: "About" }, contact("c1", true), project("p2"), link("l2"), booking("b2"), { id: "f1", type: "form", formId: "form1", title: "Message", fields: [] }, link("s2", "github")]);
  view.appearance.layout = layout;
  const before = structuredClone(view);
  const sections = profileSections(view);
  expect(sections.identity).toEqual(view.identity);
  expect(sections.intro).toBe("My intro");
  expect(ids(sections.socials)).toEqual(["s1", "s2"]);
  expect(ids(sections.links)).toEqual(["l1", "l2"]);
  expect(ids(sections.work)).toEqual(layout === "showcase" ? ["p2"] : ["p1", "p2"]);
  expect(sections.featured).toEqual(layout === "showcase" ? project("p1") : null);
  expect(ids(sections.about)).toEqual(["a1"]);
  expect(ids(sections.forms)).toEqual(["f1"]);
  expect(sections.contact).toEqual({ phone: view.identity.phone, email: view.identity.email, website: view.identity.website });
  expect(sections.contact).not.toHaveProperty("location");
  expect(sections.primary).toEqual([
    { id: "c1", type: "contact", label: "Save contact", filled: true },
    { ...booking("b1"), filled: false }, { ...booking("b2"), filled: false },
  ]);
  expect(view).toEqual(before);
});

test("stored positions are retained within groups and hidden blocks never reappear", () => {
  const view = buildSceneView({
    profile: { ...base().identity, accentColor: null, imageIsLogo: false, layout: "classic", colorMode: "light" },
    imageUrl: null, scene: base().scene, forms: [],
    blocks: [
      { id: "last", type: "link", position: 9, visible: true, formId: null, content: { kind: "custom", label: "A", url: "https://a.test/" } },
      { id: "hidden", type: "about", position: 0, visible: false, formId: null, content: { text: "My intro" } },
      { id: "first", type: "link", position: 1, visible: true, formId: null, content: { kind: "custom", label: "Z", url: "https://z.test/" } },
    ],
  });
  const sections = profileSections(view);
  expect(ids(sections.links)).toEqual(["first", "last"]);
  expect(sections.about).toEqual([]);
  expect(sections.intro).toBe("My intro");
});

test.each([
  ["Same intro", "Same intro", null],
  [" \nSame intro\t ", " Same intro\n", null],
  ["Two  spaces", "Two spaces", "Two  spaces"],
  ["Unique intro", "Different About", "Unique intro"],
  [null, "About", null],
  ["   ", "About", null],
])("intro dedupe trims only the ends: %j / %j", (bio, text, expected) => {
  const view = base([{ id: "about", type: "about", text: text! }]);
  view.identity.bio = bio;
  expect(profileSections(view).intro).toBe(expected);
  expect(profileSections(view).about).toEqual(view.blocks);
});

test("bio without an About block remains the intro", () => {
  expect(profileSections(base()).intro).toBe("My intro");
});

test("multiple Contact blocks yield one Save action and one shared Contact group", () => {
  const sections = profileSections(base([contact("c1", false), booking("b1"), contact("c2", true), contact("c3", true)]));
  expect(sections.primary).toEqual([{ id: "c2", type: "contact", label: "Save contact", filled: true }, { ...booking("b1"), filled: false }]);
  expect(sections.contact).toEqual({ phone: "+639171234567", email: "ana@example.test", website: "https://ana.example/" });
});

test("without Save contact the first Booking is filled; a legacy booking Link stays a normal link", () => {
  const view = base([booking("b1"), contact("c1", false), { id: "legacy", type: "link", kind: "booking", label: "Old booking", url: "https://cal.com/ana" }, booking("b2")]);
  const sections = profileSections(view);
  expect(sections.primary).toEqual([{ ...booking("b1"), filled: true }, { ...booking("b2"), filled: false }]);
  expect(ids(sections.links)).toEqual(["legacy"]);
  expect(profileSections(base([link("only")])).primary).toEqual([]);
});

test("Showcase features the first ordinary link when there is no Project, without duplication", () => {
  const view = base([link("social", "github"), link("first"), link("second")]);
  view.appearance.layout = "showcase";
  expect(profileSections(view).featured).toEqual(link("first"));
  expect(ids(profileSections(view).links)).toEqual(["second"]);
  expect(ids(profileSections(view).socials)).toEqual(["social"]);
});

test("a minimal profile has no fabricated actions or content", () => {
  const view = base();
  view.appearance.layout = "showcase";
  view.identity.bio = null;
  expect(profileSections(view)).toEqual({ identity: view.identity, intro: null, primary: [], featured: null, socials: [], links: [], work: [], about: [], contact: null, forms: [] });
  expect(profileSections({ ...view, blocks: [link("social", "github"), booking("book")] }).featured).toBeNull();
  expect(profileSections({ ...view, blocks: [contact("contact", false)] }).contact).not.toBeNull();
});

test("unsafe links/actions are dropped and optional Project/Contact URLs are blanked", () => {
  const view = base([
    { ...link("unsafe"), url: "javascript:alert(1)" }, { ...booking("unsafeBooking"), url: "http://example.test/" },
    { ...link("credentials"), url: "https://user:pass@example.test/" }, { ...project("project"), url: "data:text/html,hi" },
    contact("contact", false), link("safe"),
  ]);
  view.identity.website = "javascript:alert(1)";
  const sections = profileSections(view);
  expect(ids(sections.links)).toEqual(["safe"]);
  expect(sections.primary).toEqual([]);
  expect(sections.work[0].url).toBeNull();
  expect(sections.contact?.website).toBeNull();
  expect(sections.identity.website).toBeNull();
});

test("all 22 supported kinds remain available to every layout", () => {
  const blocks: ViewBlock[] = LINK_KINDS.map(kind => ({ id: kind, type: "link", kind, label: kind, url: `https://example.test/${kind}` }));
  for (const layout of ["classic", "editorial", "showcase"] as const) {
    const view = base(blocks);
    view.appearance.layout = layout;
    const sections = profileSections(view);
    const found = [...sections.socials, ...sections.links, ...(sections.featured ? [sections.featured] : [])];
    expect(ids(found).sort()).toEqual([...LINK_KINDS].sort());
    expect(new Set(ids(found)).size).toBe(22);
  }
});
