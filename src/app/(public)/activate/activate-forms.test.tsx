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
  expect(button.textContent).toBe("Continue");
  expect(button.className).not.toContain("bg-action");

  // Incomplete code (7 chars): button stays disabled and remains in document
  await act(async () => {
    changeInput(input, "N8KF42P");
  });
  expect(input.value).toBe("N8KF42P");
  expect(host.querySelector('button[type="submit"]')).toBe(button);
  expect(button.disabled).toBe(true);

  // Complete code (8 chars): button enabled with bg-action and remains in document
  await act(async () => {
    changeInput(input, "N8KF42PQ");
  });
  expect(input.value).toBe("N8KF42PQ");
  expect(host.querySelector('button[type="submit"]')).toBe(button);
  expect(button.disabled).toBe(false);
  expect(button.className).toContain("bg-action");
});

test("native edits do not include a separator character", async () => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  await act(async () => changeInput(input, "N8KF42PQ"));
  await act(async () => changeInput(input, "N8K42PQ", "deleteContentBackward", 3));
  expect(input.value).toBe("N8K42PQ");
  await act(async () => changeInput(input, "N8K2PQ", "deleteContentForward", 3));
  expect(input.value).toBe("N8K2PQ");
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

test("activation code has eight decorative slots and one native input", async () => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  const groups = host.querySelector('[data-code-slots]')!;
  expect(host.querySelectorAll("input")).toHaveLength(1);
  expect(groups).not.toBeNull();
  expect(groups.getAttribute("aria-hidden")).toBe("true");
  expect(groups.children).toHaveLength(8);
  expect(groups.querySelectorAll("input, button, [tabindex]")).toHaveLength(0);
  expect(input.getAttribute("name")).toBe("code");
});

test("pasted input keeps formatting, completion feedback and the existing posted value", async () => {
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  const form = host.querySelector<HTMLFormElement>("form")!;
  await act(async () => changeInput(input, "  n8kf-42pq!? extra", "insertFromPaste"));
  expect(input.value).toBe("N8KF42PQ");
  expect(new FormData(form).get("code")).toBe("N8KF42PQ");
  expect(normalizeActivationCode(new FormData(form).get("code") as string)).toBe("N8KF42PQ");
  expect(host.querySelector('[data-complete="true"]')).not.toBeNull();
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(m.checkCode).not.toHaveBeenCalled();
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

test("activation disables input and Continue while the existing action is pending", async () => {
  let finish!: (state: { error: string }) => void;
  m.checkCode.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => root.render(<CodeForm />));
  const input = host.querySelector<HTMLInputElement>("input#code")!;
  await act(async () => changeInput(input, "N8KF42PQ"));
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(input.disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await act(async () => finish({ error: "Try again." }));
  expect(input.disabled).toBe(false);
  expect(input.getAttribute("aria-invalid")).toBe("true");
});
