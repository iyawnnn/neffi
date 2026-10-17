import { expect, test } from "vitest";
import { cn } from "./utils";

test.each(["title", "section", "entity", "body", "meta", "label", "nav"])("the %s type token survives a text colour", (token) => {
  expect(cn(`text-${token}`, "text-fg-secondary")).toBe(`text-${token} text-fg-secondary`);
});

test("type tokens still override each other and Tailwind sizes", () => {
  expect(cn("text-sm text-foreground", "text-body")).toBe("text-foreground text-body");
  expect(cn("h-11 px-4", "px-2")).toBe("h-11 px-2");
});
