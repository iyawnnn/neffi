import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("./actions", () => ({ submitSupportAction: vi.fn() }));

test("loading and rendering the Support client form never probes runtime eval", async () => {
  vi.resetModules();
  const attempts: string[] = [];
  const original = globalThis.Function;
  vi.stubGlobal("Function", new Proxy(original, {
    apply() { attempts.push("Function"); throw new EvalError("CSP blocks eval"); },
    construct() { attempts.push("new Function"); throw new EvalError("CSP blocks eval"); },
  }));
  try {
    const { SupportForm } = await import("./support-form");
    const html = renderToStaticMarkup(<SupportForm clientKey="00000000-0000-4000-8000-000000000001" topic="activation" />);
    expect(html).toContain("Lost activation code");
    expect(html).toContain('name="message"');
    expect(attempts).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
  }
});
