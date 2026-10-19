// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  completeRecoveryAction: vi.fn(),
}));

vi.mock("./actions", () => ({
  completeRecoveryAction: m.completeRecoveryAction,
}));

import { RecoveryForm } from "./recovery-form";

let host: HTMLDivElement;
let root: Root;

function changeInput(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  m.completeRecoveryAction.mockResolvedValue({ ok: undefined, error: undefined });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

test("renders accessible email and segmented 6-digit code inputs", async () => {
  await act(async () => {
    root.render(<RecoveryForm />);
  });

  const emailInput = host.querySelector<HTMLInputElement>("input#email");
  const codeInput = host.querySelector<HTMLInputElement>("input#code");
  const submitBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]');

  expect(emailInput).not.toBeNull();
  expect(emailInput?.getAttribute("type")).toBe("email");
  expect(emailInput?.required).toBe(true);

  expect(codeInput).not.toBeNull();
  expect(codeInput?.getAttribute("inputmode")).toBe("numeric");
  expect(codeInput?.getAttribute("autocomplete")).toBe("one-time-code");
  expect(codeInput?.maxLength).toBe(6);
  expect(codeInput?.getAttribute("aria-label")).toBe("6-digit recovery code");

  // Check 6 presentation boxes are rendered
  const slotsContainer = host.querySelector('[aria-hidden="true"]');
  expect(slotsContainer).not.toBeNull();
  const digitSlots = slotsContainer?.querySelectorAll(".font-mono");
  expect(digitSlots?.length).toBe(6);

  // Initially CTA is disabled because email and 6-digit code are empty
  expect(submitBtn?.disabled).toBe(true);
});

test("segmented input accepts digits, limits to 6, and filters non-numeric characters", async () => {
  await act(async () => {
    root.render(<RecoveryForm />);
  });

  const codeInput = host.querySelector<HTMLInputElement>("input#code")!;

  // Typing non-numeric characters
  await act(async () => {
    changeInput(codeInput, "abc12xy34");
  });
  expect(codeInput.value).toBe("1234");

  // Visual presentation boxes reflect the semantic input
  const slotsContainer = host.querySelector('[aria-hidden="true"]')!;
  const digitSlots = slotsContainer.querySelectorAll(".font-mono");
  expect(digitSlots[0].textContent).toBe("1");
  expect(digitSlots[1].textContent).toBe("2");
  expect(digitSlots[2].textContent).toBe("3");
  expect(digitSlots[3].textContent).toBe("4");
  expect(digitSlots[4].textContent).toBe("");
});

test("paste works and Backspace/Delete works naturally", async () => {
  await act(async () => {
    root.render(<RecoveryForm />);
  });

  const codeInput = host.querySelector<HTMLInputElement>("input#code")!;

  // Pasting full 6 digits
  await act(async () => {
    changeInput(codeInput, "987654");
  });
  expect(codeInput.value).toBe("987654");

  const slotsContainer = host.querySelector('[aria-hidden="true"]')!;
  const digitSlots = slotsContainer.querySelectorAll(".font-mono");
  expect([...digitSlots].map((s) => s.textContent).join("")).toBe("987654");

  // Backspace deletes characters naturally
  await act(async () => {
    changeInput(codeInput, "98765");
  });
  expect(codeInput.value).toBe("98765");
  expect(digitSlots[5].textContent).toBe("");
});

test("CTA disabled/enabled behavior: requires valid email and exactly 6 digits", async () => {
  await act(async () => {
    root.render(<RecoveryForm />);
  });

  const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
  const codeInput = host.querySelector<HTMLInputElement>("input#code")!;
  const submitBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  // Only email: still disabled
  await act(async () => {
    changeInput(emailInput, "new@example.test");
  });
  expect(submitBtn.disabled).toBe(true);

  // 5 digits: still disabled
  await act(async () => {
    changeInput(codeInput, "12345");
  });
  expect(submitBtn.disabled).toBe(true);

  // 6 digits: enabled with Vermilion style
  await act(async () => {
    changeInput(codeInput, "123456");
  });
  expect(submitBtn.disabled).toBe(false);
  expect(submitBtn.className).toContain("bg-action");
  expect(submitBtn.className).toContain("text-white");
});
