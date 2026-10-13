import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { MoneyFields } from "./money-fields";

test("payment defaults to balance, offers allowed methods and hides reference for Cash", () => {
  const html = renderToStaticMarkup(<MoneyFields kind="payment" amount={40550} />);
  expect(html).toContain('value="405.50"');
  expect(html).toContain('name="paidOn"');
  expect(html).toContain("GCash");
  expect(html).toContain("Bank transfer");
  expect(html).not.toContain('name="reference"');
});

test("refund captures its date and optional reason", () => {
  const html = renderToStaticMarkup(<MoneyFields kind="refund" amount={5000} />);
  expect(html).toContain('name="refundedOn"');
  expect(html).toContain('name="reason"');
});
