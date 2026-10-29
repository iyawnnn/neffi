// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CommandPalette } from "./command-palette";

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<><input aria-label="Customer name" /><CommandPalette useSearch={() => ({ loading: false, hits: [], failed: false, done: false })} /></>);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function isOpen() {
  return document.body.textContent?.includes("Search and commands") ?? false;
}

async function keydown(options: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...options });
  await act(async () => window.dispatchEvent(event));
  return event;
}

test("ordinary typing and keyless programmatic events do not throw or open the palette", async () => {
  const input = host.querySelector<HTMLInputElement>("input")!;
  const errors: ErrorEvent[] = [];
  const onError = (event: ErrorEvent) => { errors.push(event); event.preventDefault(); };
  window.addEventListener("error", onError);
  await act(async () => input.focus());
  const typing = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
  await act(async () => input.dispatchEvent(typing));

  const keyless = new Event("keydown", { bubbles: true, cancelable: true });
  await act(async () => input.dispatchEvent(keyless));

  const malformed = new Event("keydown");
  Object.defineProperty(malformed, "ctrlKey", { value: true });
  await act(async () => window.dispatchEvent(malformed));
  window.removeEventListener("error", onError);

  expect(typing.defaultPrevented).toBe(false);
  expect(keyless.defaultPrevented).toBe(false);
  expect(errors).toHaveLength(0);
  expect(isOpen()).toBe(false);
});

test("Control and Command K toggle the palette without modified variants", async () => {
  expect((await keydown({ key: "K", ctrlKey: true })).defaultPrevented).toBe(true);
  expect(isOpen()).toBe(true);
  expect((await keydown({ key: "k", ctrlKey: true })).defaultPrevented).toBe(true);
  expect(isOpen()).toBe(false);

  expect((await keydown({ key: "k", metaKey: true })).defaultPrevented).toBe(true);
  expect(isOpen()).toBe(true);
  expect((await keydown({ key: "k", metaKey: true })).defaultPrevented).toBe(true);
  expect(isOpen()).toBe(false);

  expect((await keydown({ key: "k", ctrlKey: true, altKey: true })).defaultPrevented).toBe(false);
  expect((await keydown({ key: "k", ctrlKey: true, shiftKey: true })).defaultPrevented).toBe(false);
  expect(isOpen()).toBe(false);
});
