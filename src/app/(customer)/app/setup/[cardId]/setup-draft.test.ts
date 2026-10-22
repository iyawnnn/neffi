import { expect, test } from "vitest";
import { setupDraft } from "./setup-draft";

test("new preview has no public placeholders or starter content and follows Goal recommendation", () => {
  const view = setupDraft(null, { fullName: "", headline: "" }, "freelance");
  expect(view.identity.fullName).toBe("");
  expect(view.identity.headline).toBeNull();
  expect(view.appearance).toEqual({ layout: "showcase", mode: "light", accent: "#0C0C0D", cover: null });
  expect(view.blocks).toEqual([]);
});

test("identity overlay is pure, updates initials, and keeps saved appearance, cover and blocks", () => {
  const saved = setupDraft(null, { fullName: "Ana Reyes" });
  saved.appearance.cover = { src: "/cover.svg", srcSet: "/cover.svg 600w" };
  const edited = setupDraft(saved, { fullName: "Bea Cruz", bio: "Hello", company: "Studio" });
  expect(edited.identity).toMatchObject({ fullName: "Bea Cruz", initials: "BC", bio: "Hello", company: "Studio" });
  expect(saved.identity.fullName).toBe("Ana Reyes");
  expect(edited.appearance).toEqual(saved.appearance);
});

test("contact draft updates the existing contact once, normalizes safe URLs, and keeps other blocks", () => {
  const saved = setupDraft(null, { fullName: "Ana" });
  saved.blocks = [{ id: "contact-id", type: "contact", saveContact: false, phone: null, email: null, website: null, location: null }, { id: "work", type: "project", title: "Work", description: null, url: null }];
  const view = setupDraft(saved, { phone: "9171234567", email: "ana@example.test", website: "example.test", saveContact: true });
  expect(view.blocks[0]).toMatchObject({ id: "contact-id", phone: "+639171234567", email: "ana@example.test", website: "https://example.test/", saveContact: true });
  expect(view.blocks).toHaveLength(2);
  expect(setupDraft(saved, { website: "javascript:alert(1)" }).identity.website).toBeNull();
});

test("contact preview shows the new contact without writing; logo chooses whole-image URL", () => {
  const view = setupDraft(null, { email: "a@example.test", saveContact: true, imageIsLogo: true }, null, { photo: "/photo.svg", logo: "/logo.svg" });
  expect(view.blocks).toHaveLength(1);
  expect(view.identity.image).toEqual({ url: "/logo.svg", isLogo: true });
});

test("contact preview preserves an unchanged legacy number", () => {
  const saved = setupDraft(null, { fullName: "Ana" });
  saved.identity.phone = "+12025550123";
  expect(setupDraft(saved, { phone: "+12025550123" }).identity.phone).toBe("+12025550123");
});
