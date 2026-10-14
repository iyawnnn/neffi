import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ fields: { email: "draft@example.test", name: "Draft name", message: "Keep my draft message", category: "activation" } }));
vi.mock("react", async original => ({ ...await original<object>(), useActionState: () => [{ error: "Check the fields" }, vi.fn(), false], useState: () => [state.fields, vi.fn()] }));
vi.mock("./actions", () => ({ submitSupportAction: vi.fn() }));
import { SupportForm } from "./support-form";
test("validation-error render keeps client drafts instead of resetting uncontrolled fields", () => {
  const html = renderToStaticMarkup(<SupportForm clientKey="00000000-0000-4000-8000-000000000001" topic="other" />);
  expect(html).toContain("Check the fields");
  expect(html).toContain("draft@example.test"); expect(html).toContain("Draft name"); expect(html).toContain("Keep my draft message");
});
