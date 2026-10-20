import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const { response, effects, setters, state } = vi.hoisted(() => ({
  response: { current: undefined as unknown }, effects: [] as (() => () => void)[],
  setters: [] as ReturnType<typeof vi.fn>[], state: { visit: 0 },
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useActionState: () => [response.current, vi.fn(), false],
  useRef: (initial: unknown) => ({ current: initial }),
  useLayoutEffect: (effect: () => () => void) => effects.push(effect),
  useState: (initial: unknown) => {
    if (initial === 0) return [state.visit, (update: (value: number) => number) => { state.visit = update(state.visit); }];
    const setter = vi.fn(); setters.push(setter); return [initial, setter];
  },
}));
vi.mock("./actions", () => ({ provisionDbcAction: vi.fn(), replaceCredentialAction: vi.fn() }));
import { ProvisionForm } from "./forms";

type Component = (props: Record<string, unknown>) => ReactElement;
const invoke = (element: ReactElement) => (element.type as Component)(element.props as Record<string, unknown>);
beforeEach(() => { effects.length = 0; setters.length = 0; state.visit = 0; response.current = undefined; });
afterEach(() => vi.unstubAllGlobals());

test("navigation hiding remounts the action response holder, including Back restoration", () => {
  const wrapper = ProvisionForm({ cardId: "test-card", available: true });
  const before = invoke(wrapper);
  const cleanup = effects[0]();
  cleanup();
  expect(invoke(wrapper).key).not.toBe(before.key);
});

test("Copy activation code writes only to clipboard on explicit click", async () => {
  const code = "N8KF-42PQ";
  response.current = { reveal: { code, url: "http://localhost:3000/c/public-token" } };
  const wrapper = ProvisionForm({ cardId: "test-card", available: false });
  const form = invoke(invoke(wrapper));
  const revealElement = (form.props as { children: ReactElement[] }).children.at(-1)!;
  const reveal = invoke(revealElement);
  const children = (reveal.props as { children: ReactElement[] }).children;
  const copyButton = children.find((child) => child?.props && (child.props as { children?: string }).children === "Copy activation code")!;
  const writeText = vi.fn().mockResolvedValue(undefined);
  const storageWrite = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("localStorage", { setItem: storageWrite });
  vi.stubGlobal("sessionStorage", { setItem: storageWrite });
  expect(writeText).not.toHaveBeenCalled();
  await (copyButton.props as { onClick: () => Promise<void> }).onClick();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(code);
  expect(storageWrite).not.toHaveBeenCalled();
  expect(setters.at(-1)).toHaveBeenCalledWith("Activation code copied. Save it to the card's package now.");
});
