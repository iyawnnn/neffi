// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  sendVerificationOtp: vi.fn(),
  signInEmailOtp: vi.fn(),
  signInSocial: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: m.replace, refresh: m.refresh }),
}));

vi.mock("@/auth/client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: m.sendVerificationOtp },
    signIn: { emailOtp: m.signInEmailOtp, social: m.signInSocial },
  },
}));

import { SignInForm } from "./sign-in-form";

let host: HTMLDivElement;
let root: Root;

function changeInput(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  m.sendVerificationOtp.mockResolvedValue({ error: null });
  m.signInEmailOtp.mockResolvedValue({ error: null });
  m.signInSocial.mockResolvedValue({ error: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. Email Step & Copy
// ---------------------------------------------------------------------------

test("renders Continue to Neffi heading, Google button, and email input", async () => {
  await act(async () => {
    root.render(<SignInForm next="/app" />);
  });

  expect(host.textContent).toContain("Continue to Neffi");
  expect(host.textContent).toContain(
    "Sign in or create your account to manage your profiles and cards."
  );
  expect(host.textContent).toContain("Continue with Google");
  expect(host.textContent).toContain("Email address");

  const emailInput = host.querySelector<HTMLInputElement>("input#email");
  expect(emailInput).not.toBeNull();
  expect(emailInput?.getAttribute("type")).toBe("email");
  expect(emailInput?.getAttribute("autocomplete")).toBe("email");
  expect(emailInput?.getAttribute("inputmode")).toBe("email");
});

test("Google button calls authClient.signIn.social with safe next callback", async () => {
  await act(async () => {
    root.render(<SignInForm next="/activate" />);
  });

  const googleBtn = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.includes("Continue with Google")
  );
  expect(googleBtn).toBeDefined();

  await act(async () => {
    googleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(m.signInSocial).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/activate",
    errorCallbackURL: "/sign-in",
    newUserCallbackURL: "/activate",
  });
});

test("Continue with email button is disabled until a valid email is entered", async () => {
  await act(async () => {
    root.render(<SignInForm next="/app" />);
  });

  const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
  const submitBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  expect(submitBtn.disabled).toBe(true);

  // Invalid email
  await act(async () => {
    changeInput(emailInput, "invalid-email");
  });
  expect(submitBtn.disabled).toBe(true);

  // Valid email
  await act(async () => {
    changeInput(emailInput, "alex@example.test");
  });
  expect(submitBtn.disabled).toBe(false);
  expect(submitBtn.className).toContain("bg-action");
});

// ---------------------------------------------------------------------------
// 2. OTP Transition & Verification Step
// ---------------------------------------------------------------------------

test("requesting code transitions smoothly to 6-slot OTP verification step", async () => {
  await act(async () => {
    root.render(<SignInForm next="/app" />);
  });

  const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
  await act(async () => {
    changeInput(emailInput, "alex@example.test");
  });

  const form = host.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  expect(m.sendVerificationOtp).toHaveBeenCalledWith({
    email: "alex@example.test",
    type: "sign-in",
  });

  // Verify second step copy & email confirmation
  expect(host.textContent).toContain("Check your email");
  expect(host.textContent).toContain("We sent a 6-digit code to");
  expect(host.textContent).toContain("alex@example.test");
  expect(host.textContent).toContain("Verification code");

  // Real underlying input with one-time-code autocomplete
  const otpInput = host.querySelector<HTMLInputElement>("input#code");
  expect(otpInput).not.toBeNull();
  expect(otpInput?.getAttribute("autocomplete")).toBe("one-time-code");
  expect(otpInput?.getAttribute("inputmode")).toBe("numeric");
  expect(otpInput?.maxLength).toBe(6);
});

test.each(["Send a new code", "Use a different email"])(
  "%s has a 44px touch target in the OTP step",
  async (label) => {
    await act(async () => {
      root.render(<SignInForm next="/activate" />);
    });

    const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
    await act(async () => {
      changeInput(emailInput, "test@example.com");
    });
    const form = host.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.includes(label)
    );
    expect(button).toBeDefined();
    expect(button?.className).toMatch(/\bh-11\b/);
  }
);

test("Sign in button in OTP step requires 6 digits and invokes authClient.signIn.emailOtp", async () => {
  await act(async () => {
    root.render(<SignInForm next="/app/profiles" />);
  });

  // Transition to OTP step
  const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
  await act(async () => {
    changeInput(emailInput, "test@example.com");
  });
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  const otpInput = host.querySelector<HTMLInputElement>("input#code")!;
  const signInBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  // 3 digits: disabled
  await act(async () => {
    changeInput(otpInput, "123");
  });
  expect(signInBtn.disabled).toBe(true);

  // 6 digits: enabled with Vermilion background
  await act(async () => {
    changeInput(otpInput, "123456");
  });
  expect(signInBtn.disabled).toBe(false);
  expect(signInBtn.className).toContain("bg-action");

  // Submit code
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  expect(m.signInEmailOtp).toHaveBeenCalledWith({
    email: "test@example.com",
    otp: "123456",
  });
  expect(m.replace).toHaveBeenCalledWith("/app/profiles");
});

test("Use a different email returns to email step and resets code", async () => {
  await act(async () => {
    root.render(<SignInForm next="/app" />);
  });

  // Transition to OTP step
  const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
  await act(async () => {
    changeInput(emailInput, "alex@example.test");
  });
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  const diffEmailBtn = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.includes("Use a different email")
  );
  expect(diffEmailBtn).toBeDefined();

  await act(async () => {
    diffEmailBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // Back to email step
  expect(host.textContent).toContain("Continue to Neffi");
  expect(host.querySelector("input#email")).not.toBeNull();
});

test("invalid OTP verification renders with destructive styling and error accessibility attributes", async () => {
  m.signInEmailOtp.mockResolvedValueOnce({
    error: { message: "Invalid code", status: 400 },
  });

  await act(async () => {
    root.render(<SignInForm next="/app" />);
  });

  // Step 1: Request code
  const emailInput = host.querySelector<HTMLInputElement>("input#email")!;
  await act(async () => {
    changeInput(emailInput, "alex@example.test");
  });
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  // Initial code step: neutral info message with role="status"
  const infoNotice = host.querySelector('[role="status"]')!;
  expect(infoNotice).not.toBeNull();
  expect(infoNotice.textContent).toContain("A 6-digit code is on its way");
  expect(infoNotice.className).toContain("bg-subtle/50");
  expect(infoNotice.className).not.toContain("bg-destructive");

  const otpInput = host.querySelector<HTMLInputElement>("input#code")!;
  expect(otpInput.getAttribute("aria-invalid")).toBe("false");

  // Enter 6 digits and submit
  await act(async () => {
    changeInput(otpInput, "999999");
  });
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  // Verification failed: destructive error state
  const errorNotice = host.querySelector('[role="alert"]')!;
  expect(errorNotice).not.toBeNull();
  expect(errorNotice.id).toBe("code-error");
  expect(errorNotice.textContent).toContain("That code isn't valid. Check it or request a new one.");
  expect(errorNotice.className).toContain("bg-destructive/5");
  expect(errorNotice.className).toContain("text-destructive");
  expect(errorNotice.className).toContain("border-destructive");

  // Icon in error notice is destructive
  const errorIcon = errorNotice.querySelector("svg")!;
  expect(errorIcon).not.toBeNull();
  expect(errorIcon.className.baseVal || errorIcon.getAttribute("class")).toContain("text-destructive");

  // Input receives error attributes
  expect(otpInput.getAttribute("aria-invalid")).toBe("true");
  expect(otpInput.getAttribute("aria-describedby")).toBe("code-error");
});
