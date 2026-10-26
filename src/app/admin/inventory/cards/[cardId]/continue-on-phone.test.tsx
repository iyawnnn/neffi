import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ContinueOnPhone } from "./continue-on-phone";

const url = "https://getneffi.com/admin/inventory/cards/3f2b8f64-5717-4562-b3fc-2c963f66afa6";

test("shows the exact workspace route as a QR, a plain link and a copy control", () => {
  const html = renderToStaticMarkup(<ContinueOnPhone url={url} qrSrc="data:image/svg+xml;charset=utf-8,QR" />);
  expect(html).toContain("Continue on phone");
  expect(html).toContain(`href="${url}"`);
  expect(html).toContain('src="data:image/svg+xml;charset=utf-8,QR"');
  expect(html).toMatch(/alt="[^"]*opens this card workspace[^"]*"/i);
  expect(html).not.toMatch(/public profile|share this/i);
  expect(html).toContain("Copy link");
});

test("says no code, session or credential travels in the QR and never links to activation", () => {
  const html = renderToStaticMarkup(<ContinueOnPhone url={url} qrSrc="data:x" />);
  expect(html).toMatch(/sign in on your phone/i);
  expect(html).not.toContain("/activate");
});
