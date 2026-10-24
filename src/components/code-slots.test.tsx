// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CodeSlots } from "./code-slots";

let host: HTMLDivElement;
let root: Root;
function Example({ activation = false }: { activation?: boolean }) {
  const [value, setValue] = useState("");
  return <CodeSlots value={value} onChange={setValue} label="Test code" length={activation ? 8 : 6} characterSet={activation ? "alphanumeric" : "numeric"} autoComplete={activation ? "off" : "one-time-code"} hasError describedBy="code-help" />;
}
function change(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function paste(input: HTMLInputElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
  input.dispatchEvent(event);
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
test("one semantic input, six decorative fluid cells, accessible error and native editing", async () => {
  await act(async () => root.render(<Example />));
  expect(host.querySelectorAll("input")).toHaveLength(1);
  const input = host.querySelector("input")!;
  expect(input.getAttribute("aria-label")).toBe("Test code");
  expect(input.getAttribute("aria-describedby")).toBe("code-help");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.inputMode).toBe("numeric");
  expect(input.autocomplete).toBe("one-time-code");
  expect(input.pattern).toBe("[0-9]{6}");
  expect(input.maxLength).toBe(6);
  const cells = host.querySelector<HTMLDivElement>('[aria-hidden="true"]')!;
  expect(cells.children).toHaveLength(6);
  expect(cells.style.gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
  await act(async () => input.focus());
  expect(cells.children[0].className).toContain("ring-destructive/20");
  await act(async () => paste(input, "12-34 56 78"));
  expect(input.value).toBe("123456");
  expect(cells.textContent).toBe("123456");
  // happy-dom does not edit text on keydown; apply the native edit's resulting input value.
  for (const [key, value] of [["Backspace", "12345"], ["Delete", "1234"]]) {
    expect(input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))).toBe(true);
    await act(async () => change(input, value));
    expect(input.value).toBe(value);
    expect(cells.textContent).toBe(value);
  }
  await act(async () => change(input, "12"));
  input.setSelectionRange(2, 2);
  await act(async () => paste(input, "34 56"));
  expect(input.value).toBe("123456");
  input.setSelectionRange(2, 4);
  await act(async () => paste(input, "98"));
  expect(input.value).toBe("129856");
  input.setSelectionRange(2, 2);
  await act(async () => paste(input, "00"));
  expect(input.value).toBe("129856");
});

test("activation uses eight uppercase alphanumeric slots, whole-code paste and cursor-aware editing", async () => {
  await act(async () => root.render(<Example activation />));
  const input = host.querySelector("input")!;
  const slots = host.querySelector('[aria-hidden="true"]')!;
  expect(host.querySelectorAll("input")).toHaveLength(1);
  expect(slots.children).toHaveLength(8);
  expect(input.inputMode).toBe("text");
  expect(input.autocomplete).toBe("off");
  expect(input.maxLength).toBe(8);
  await act(async () => { input.focus(); paste(input, "n8kf-42pq!? extra"); });
  expect(input.value).toBe("N8KF42PQ");
  expect(slots.textContent).toBe("N8KF42PQ");
  input.setSelectionRange(2, 4);
  await act(async () => paste(input, "xy"));
  expect(input.value).toBe("N8XY42PQ");
  await act(async () => {
    input.setSelectionRange(2, 2);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });
  expect(slots.querySelector('[data-active="true"]')).toBe(slots.children[2]);
  expect(slots.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  await act(async () => change(input, "ab!?cd12345"));
  expect(input.value).toBe("ABCD1234");
});
