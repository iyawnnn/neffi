import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/auth/client", () => ({ authClient: {} }));
// Render the OTP step without a browser or a real inbox; keep Button rendering real.
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => react.useState(initial === "email" ? "code" : initial),
  };
});

import { SignInForm } from "./sign-in-form";

test.each(["Send a new code", "Use a different email"])("%s has a 44px touch target in the OTP step", (label) => {
  const html = renderToStaticMarkup(<SignInForm next="/activate" />);
  const button = [...html.matchAll(/<button\b[^>]*>.*?<\/button>/g)]
    .map(([markup]) => markup)
    .find((markup) => markup.includes(label));
  expect(button).toBeDefined();
  expect(button).toMatch(/class="[^"]*\bh-11\b/);
  expect(button).not.toMatch(/class="[^"]*\bh-8\b/);
});
