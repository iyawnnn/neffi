import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("@/auth/access", () => ({ getViewer: async () => null }));
vi.mock("./sign-in-form", () => ({ SignInForm: () => <form /> }));
import Page from "./page";
test("sign-in help reaches public support without an auth next parameter", async () => {
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  expect(html).toContain('href="/support"');
  expect(html).not.toContain("/support?next");
});
