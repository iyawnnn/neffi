// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PROFILE_INTRO_FLAG, ProfileIntro } from "./profile-intro";

const markup = renderToStaticMarkup(<ProfileIntro />);
const gate = /<script>([\s\S]*)<\/script>/.exec(markup)![1]!.replaceAll("&quot;", '"');
const css = readFileSync("src/app/(public)/c/[token]/profile-intro.css", "utf8");

let overlay: HTMLElement;
const runGate = () => new Function("document", gate)({ currentScript: { previousElementSibling: overlay } });
const seenAttribute = () => overlay.hasAttribute("data-seen");

beforeEach(() => { sessionStorage.clear(); overlay = document.createElement("div"); });
afterEach(() => vi.unstubAllGlobals());

test("the intro is part of the server HTML as a decorative, non-interactive Neffi layer", () => {
  expect(markup).toContain("data-profile-intro");
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain("pointer-events-none");
  expect(markup).toMatch(/<svg|<img/);
});

test("the first view records only a generic flag and leaves the intro to play", () => {
  runGate();
  expect(seenAttribute()).toBe(false);
  expect(Object.keys(sessionStorage)).toEqual([PROFILE_INTRO_FLAG]);
  expect(sessionStorage.getItem(PROFILE_INTRO_FLAG)).toBe("true");
});

test("a repeat view in the same session marks the document so CSS hides the intro before paint", () => {
  runGate();
  runGate();
  expect(seenAttribute()).toBe(true);
});

test("blocked session storage fails open without covering the Profile", () => {
  vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  runGate();
  expect(seenAttribute()).toBe(true);
});

test("the animation is CSS only, finishes inside one second and hides itself", () => {
  expect(css).toMatch(/animation:\s*neffi-profile-reveal\s+(\d+)ms/);
  expect(Number(/animation:\s*neffi-profile-reveal\s+(\d+)ms/.exec(css)![1])).toBeLessThanOrEqual(1000);
  expect(css).toMatch(/100%\s*\{[^}]*visibility:\s*hidden/);
  expect(css).toMatch(/\.neffi-profile-intro\[data-seen\]\s*\{\s*display:\s*none/);
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*\.neffi-profile-intro\s*\{\s*display:\s*none/);
});

test("the intro has no client component and no storage of identifiers", () => {
  const source = readFileSync("src/app/(public)/c/[token]/profile-intro.tsx", "utf8");
  expect(source).not.toContain('"use client"');
  expect(source).not.toMatch(/useEffect|useState/);
  expect(gate).not.toMatch(/token|account|code/i);
});
