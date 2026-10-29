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
  expect(button).not.toBeNull();
  expect(button.disabled).toBe(true);
  expect(button.textContent).toContain("Continue");
  expect(button.className).toContain("bg-action");

  // Incomplete code (7 chars): button stays disabled and remains in document
  await act(async () => {
    changeInput(input, "N8KF42P");
  });
  expect(input.value).toBe("N8KF-42P");
  expect(host.querySelector('button[type="submit"]')).toBe(button);
  expect(button.disabled).toBe(true);

  // Complete code (8 chars): button enabled with bg-action and remains in document
  await act(async () => {
    changeInput(input, "N8KF42PQ");
  });
  expect(input.value).toBe("N8KF-42PQ");
  expect(host.querySelector('button[type="submit"]')).toBe(button);
  expect(button.disabled).toBe(false);
  expect(button.className).toContain("bg-action");
});

test("native character deletion reformats the remaining code", async () => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  await act(async () => changeInput(input, "N8KF42PQ"));
  await act(async () => changeInput(input, "N8K42PQ", "deleteContentBackward", 3));
  expect(input.value).toBe("N8K4-2PQ");
  await act(async () => changeInput(input, "N8K2PQ", "deleteContentForward", 3));
  expect(input.value).toBe("N8K2-PQ");
});

test.each([
  ["deleteContentBackward", "N8K4-2PQ", 3],
  ["deleteContentForward", "N8KF-2PQ", 4],
] as const)("%s across the automatic hyphen deletes the adjacent character", async (type, expected, caret) => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  input.focus();
  await act(async () => changeInput(input, "N8KF42PQ"));
  await act(async () => changeInput(input, "N8KF42PQ", type, 4));
  await new Promise(requestAnimationFrame);
  expect(input.value).toBe(expected);
  expect(input.selectionStart).toBe(caret);
});

test("selection paste preserves surrounding characters, caret and eight-character limit", async () => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  input.focus();
  await act(async () => changeInput(input, "N8KF42PQ"));
  input.setSelectionRange(3, 7);
  await act(async () => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "a!b" } });
    input.dispatchEvent(event);
  });
  await new Promise(requestAnimationFrame);
  expect(input.value).toBe("N8KA-BPQ");
  expect(input.selectionStart).toBe(6);
  await act(async () => changeInput(input, "ab!?cd123456"));
  expect(input.value).toBe("ABCD-1234");
});

test.each(["N", "N8", "N8K", "N8KF", "N8KF-4", "N8KF-42", "N8KF-42P", "N8KF-42PQ"])("formats typed progress %s", async (value) => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  await act(async () => changeInput(input, value.replace("-", "")));
  expect(input.value).toBe(value);
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
  expect(m.checkCode).toHaveBeenCalledTimes(1);
  expect((m.checkCode.mock.calls[0][1] as FormData).get("code")).toBe("N8KF42PQ");
});

test("activation has one labelled product-code input and no OTP slots", async () => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  expect(host.querySelectorAll("input")).toHaveLength(1);
  expect(host.querySelector('[data-code-slots]')).toBeNull();
  expect(input.placeholder).toBe("XXXX-XXXX");
  expect(input.maxLength).toBe(9);
  expect(input.labels?.[0].textContent).toBe("Activation code");
  expect(input.getAttribute("name")).toBe("code");
});

test.each(["N8KF42PQ", "N8KF-42PQ", "n8kf42pq", "n8kf-42pq", "  n8kf - 42pq!? extra  "])("pasting %s keeps completion and the existing posted value", async (text) => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  const form = host.querySelector<HTMLFormElement>("form")!;
  await act(async () => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
    input.dispatchEvent(event);
  });
  expect(input.value).toBe("N8KF-42PQ");
  expect(m.checkCode).not.toHaveBeenCalled();
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect((m.checkCode.mock.calls[0][1] as FormData).get("code")).toBe("N8KF42PQ");
  expect(normalizeActivationCode(new FormData(form).get("code") as string)).toBe("N8KF42PQ");
  expect(input.dataset.complete).toBe("true");
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(m.checkCode).toHaveBeenCalledTimes(1);
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
  expect(button.textContent).toContain("Add to my account");
  expect(button.className).toContain("bg-action");
});

test("SwitchAccountButton renders Use a different account button", async () => {
  await act(async () => {
    root.render(<SwitchAccountButton />);
  });
  const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(button).not.toBeNull();
  expect(button.textContent).toContain("Use a different account");
});

test("StartOverButton renders Enter a different code button", async () => {
  await act(async () => {
    root.render(<StartOverButton />);
  });
  const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(button).not.toBeNull();
  expect(button.textContent).toContain("Enter a different code");
});

test("activation disables input and Continue while the existing action is pending", async () => {
  let finish!: (state: { error: string }) => void;
  m.checkCode.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  await act(async () => changeInput(input, "N8KF42PQ"));
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(input.disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  const pendingButton = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(pendingButton.getAttribute("aria-busy")).toBe("true");
  expect(pendingButton.className).toContain("bg-action");
  expect(pendingButton.className).toContain("w-full");
  expect(pendingButton.querySelector('[aria-hidden="true"] + span')?.textContent).toBe("Checking…");
  await act(async () => finish({ error: "Try again." }));
  expect(input.disabled).toBe(false);
  expect(input.getAttribute("aria-invalid")).toBe("true");
});
