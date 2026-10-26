import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useActionState: () => [undefined, vi.fn(), true] }));
vi.mock("./actions", () => ({
  receiveStockAction: vi.fn(), provisionDbcAction: vi.fn(), recordNfcCheckAction: vi.fn(), matchPackageAction: vi.fn(),
  replaceCredentialAction: vi.fn(), reserveGrcAction: vi.fn(), retireCardAction: vi.fn(), updateStockPurchaseAction: vi.fn(),
}));
import { MatchPackageForm, NfcCheckForm, StockForm } from "./forms";

test("a running action disables its button, announces busy and swaps in the verb-specific pending label", () => {
  for (const [html, pending] of [
    [renderToStaticMarkup(<StockForm />), "Receiving…"],
    [renderToStaticMarkup(<NfcCheckForm cardId="c" expectedUri="https://example.test/c" />), "Confirming…"],
    [renderToStaticMarkup(<MatchPackageForm cardId="c" />), "Confirming…"],
  ] as const) {
    expect(html).toContain(pending);
    expect(html).toMatch(/<button[^>]*aria-busy="true"/);
    expect(html).toMatch(/<button[^>]*disabled/);
  }
});
