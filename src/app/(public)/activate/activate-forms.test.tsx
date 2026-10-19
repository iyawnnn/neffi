// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  checkCode: vi.fn(),
  claim: vi.fn(),
  switchAccount: vi.fn(),
  startOver: vi.fn(),
}));

vi.mock("./actions", () => ({
  checkCodeAction: m.checkCode,
  claimAction: m.claim,
  switchAccountAction: m.switchAccount,
  startOverAction: m.startOver,
}));

import {
  ClaimForm,
  CodeForm,
  formatCodeInput,
  StartOverButton,
  SwitchAccountButton,
} from "./activate-forms";
import { normalizeActivationCode } from "@/modules/activation/code";

let host: HTMLDivElement;
let root: Root;

function changeInput(input: HTMLInputElement, value: string, inputType?: string, cursor?: number) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  nativeInputValueSetter.call(input, value);
  if (cursor !== undefined) input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType }));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

// ----------------------------------------------------
// 1. AUTO-FORMATTER LOGIC
// ----------------------------------------------------

test("formatCodeInput converts lowercase to uppercase and inserts one hyphen", () => {
  expect(formatCodeInput("n8kf42pq")).toBe("N8KF-42PQ");
  expect(formatCodeInput("abcd")).toBe("ABCD");
  expect(formatCodeInput("abcde")).toBe("ABCD-E");
  expect(formatCodeInput("abcd1234e")).toBe("ABCD-1234");
});

test("formatCodeInput strips separators and punctuation on paste", () => {
  expect(formatCodeInput("n8kf-42pq")).toBe("N8KF-42PQ");
  expect(formatCodeInput("n8kf 42pq")).toBe("N8KF-42PQ");
  expect(formatCodeInput("  n8kf – 42pq  ")).toBe("N8KF-42PQ");
});

test("formatCodeInput caps at 8 meaningful characters", () => {
  expect(formatCodeInput("123456789extra")).toBe("1234-5678");
  expect(formatCodeInput("")).toBe("");
});

test("client display output normalizes to the canonical server value", () => {
  expect(normalizeActivationCode(formatCodeInput("n8kf – 42pq"))).toBe("N8KF42PQ");
});

// ----------------------------------------------------
// 2. CODE FORM INTERACTION & ACCESSIBILITY
// ----------------------------------------------------

test("CodeForm starts disabled and enables at exactly 8 characters", async () => {
  await act(async () => {
    root.render(<CodeForm />);
  });

  const input = host.querySelector<HTMLInputElement>("input#code")!;
  const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = host.querySelector<HTMLLabelElement>('label[for="code"]')!;

  expect(input).not.toBeNull();
  expect(label.textContent).toBe("Activation code");
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe("Continue");
  expect(button.className).not.toContain("bg-action");

  // Incomplete code (7 chars): button stays disabled
  await act(async () => {
    changeInput(input, "N8KF42P");
  });
  expect(input.value).toBe("N8KF-42P");
  expect(button.disabled).toBe(true);

  // Complete code (8 chars): button enabled with bg-action
  await act(async () => {
    changeInput(input, "N8KF42PQ");
  });
  expect(input.value).toBe("N8KF-42PQ");
  expect(button.disabled).toBe(false);
  expect(button.className).toContain("bg-action");
});

test("inputType deletion across the separator removes the adjacent character", async () => {
  await act(async () => {
    root.render(<CodeForm />);
  });

  const input = host.querySelector<HTMLInputElement>("input#code")!;
  await act(async () => {
    changeInput(input, "N8KF4", "deleteContentBackward");
  });
  expect(input.value).toBe("N8KF-4");

  // Browser removed the separator before React receives the Android-safe input event.
  await act(async () => {
    changeInput(input, "N8KF4", "deleteContentBackward", 4);
  });
  expect(input.value).toBe("N8K4");

  await act(async () => { changeInput(input, "N8KF4"); });
  await act(async () => { changeInput(input, "N8KF4", "deleteContentForward", 4); });
  expect(input.value).toBe("N8KF");
});

test("CodeForm associates error with aria-invalid and aria-describedby", async () => {
  m.checkCode.mockResolvedValue({
    error: "We couldn't find that code. Check the label inside your package and try again.",
  });

  await act(async () => {
    root.render(<CodeForm />);
  });

  const input = host.querySelector<HTMLInputElement>("input#code")!;
  const form = host.querySelector<HTMLFormElement>("form")!;

  // Fill in complete code and submit
  await act(async () => {
    changeInput(input, "N8KF42PQ");
  });

  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  const alert = host.querySelector('[role="alert"]')!;
  expect(alert).not.toBeNull();
  expect(alert.textContent).toContain("We couldn't find that code");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe("code-error");
});

// ----------------------------------------------------
// 3. CLAIM, SWITCH ACCOUNT, & START OVER FORMS
// ----------------------------------------------------

test("ClaimForm renders Add to my account button with submit type and touch size", async () => {
  await act(async () => {
    root.render(<ClaimForm />);
  });
  const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(button).not.toBeNull();
  expect(button.textContent).toBe("Add to my account");
  expect(button.className).toContain("bg-action");
});

test("SwitchAccountButton renders Use a different account button", async () => {
  await act(async () => {
    root.render(<SwitchAccountButton />);
  });
  const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(button).not.toBeNull();
  expect(button.textContent).toBe("Use a different account");
});

test("StartOverButton renders Enter a different code button", async () => {
  await act(async () => {
    root.render(<StartOverButton />);
  });
  const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(button).not.toBeNull();
  expect(button.textContent).toBe("Enter a different code");
});
