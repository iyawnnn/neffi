import { expect, test } from "vitest";
import { parseBlockContent } from "./block-content";

test.each([
  ["about", { text: " Hello " }, { text: "Hello" }],
  ["project", { title: "Site", description: "", url: "site.test" }, { title: "Site", description: null, url: "https://site.test/" }],
  ["project", { title: "Site" }, { title: "Site", description: null, url: null }],
  ["link", { kind: "github", label: "", url: "github.com/ana" }, { kind: "github", label: null, url: "https://github.com/ana" }],
  ["contact", { saveContact: "on" }, { saveContact: true }],
  ["contact", {}, { saveContact: false }],
  ["booking", { label: "", url: "cal.com/ana" }, { label: null, url: "https://cal.com/ana" }],
  ["form", {}, {}],
] as const)("%s accepts valid input", (type, input, content) => {
  expect(parseBlockContent(type, input)).toEqual({ ok: true, content });
});

test.each([
  ["about", { text: "" }],
  ["about", { text: "x".repeat(1001) }],
  ["project", { title: "", url: "" }],
  ["link", { kind: "myspace", url: "https://e.test" }],
  ["link", { kind: "custom", url: "javascript:alert(1)" }],
  ["booking", { url: "" }],
] as const)("%s rejects %j", (type, input) => {
  expect(parseBlockContent(type, input)).toEqual({ ok: false });
});

test.each([
  ["about", { text: "Hello" }],
  ["project", { title: "Site" }],
  ["link", { kind: "github", url: "https://github.com/ana" }],
  ["contact", {}],
  ["booking", { url: "https://cal.com/ana" }],
  ["form", {}],
] as const)("%s rejects unknown content fields", (type, input) => {
  expect(parseBlockContent(type, { ...input, unexpected: "value" })).toEqual({ ok: false });
});
