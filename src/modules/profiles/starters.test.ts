import { expect, test } from "vitest";
import { essentialsSchema, PURPOSES, starterBlocks } from "./starters";

const base = { fullName: "Ana", headline: null, bio: null, email: "ana@e.test", phone: null, link: null };

test("purposes use customer language", () => {
  expect(Object.keys(PURPOSES)).toEqual(["network", "get_clients", "show_my_work"]);
  expect(PURPOSES.network.label).toBe("Network");
  expect(PURPOSES.get_clients.label).toBe("Get Clients");
  expect(PURPOSES.show_my_work.label).toBe("Show My Work");
});

test("Network: contact first, optional link and intro, Connect form", () => {
  expect(starterBlocks("network", { ...base, bio: "Hi", link: "https://www.linkedin.com/in/ana" })).toEqual([
    { type: "contact", content: { saveContact: true } },
    { type: "link", content: { kind: "linkedin", label: null, url: "https://www.linkedin.com/in/ana" } },
    { type: "about", content: { text: "Hi" } },
    { type: "form", content: {}, preset: "connect" },
  ]);
  expect(starterBlocks("network", { ...base, link: "https://ana.example/" })[1]).toEqual({ type: "link", content: { kind: "custom", label: null, url: "https://ana.example/" } });
});

test("Get Clients: intro, booking, project inquiry, contact â€” nothing empty is seeded", () => {
  expect(starterBlocks("get_clients", { ...base, link: "https://cal.com/ana" })).toEqual([
    { type: "booking", content: { label: null, url: "https://cal.com/ana" } },
    { type: "form", content: {}, preset: "project_inquiry" },
    { type: "contact", content: { saveContact: true } },
  ]);
});

test("Show My Work: intro, portfolio link, contact", () => {
  expect(starterBlocks("show_my_work", { ...base, bio: "Work", link: "https://ana.example/" })).toEqual([
    { type: "about", content: { text: "Work" } },
    { type: "link", content: { kind: "portfolio", label: null, url: "https://ana.example/" } },
    { type: "contact", content: { saveContact: true } },
  ]);
});

test("essentials normalize like identity and require a name", () => {
  expect(essentialsSchema.parse({ fullName: " Ana ", headline: "", bio: "", email: "A@E.TEST", phone: "", link: "cal.com/ana" })).toEqual({
    fullName: "Ana", headline: null, bio: null, email: "a@e.test", phone: null, link: "https://cal.com/ana",
  });
  expect(essentialsSchema.safeParse({ ...base, fullName: "" }).success).toBe(false);
});
