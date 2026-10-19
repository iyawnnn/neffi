import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, expect, test, vi } from "vitest";

const { responses, provision, replace, readCard } = vi.hoisted(() => ({
  responses: new Map<unknown, unknown>(), provision: vi.fn(), replace: vi.fn(), readCard: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useActionState: (action: unknown) => [responses.get(action), action, false],
}));
vi.mock("./actions", () => ({
  provisionDbcAction: provision, replaceCredentialAction: replace,
  receiveStockAction: vi.fn(), recordNfcCheckAction: vi.fn(), matchPackageAction: vi.fn(),
  reserveGrcAction: vi.fn(), retireCardAction: vi.fn(),
}));
vi.mock("@/auth/access", () => ({ requireOwner: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { cardUrlOrigin: "http://localhost:3000" } }));
vi.mock("@/modules/inventory/queries", () => ({ getCardDetail: readCard }));
vi.mock("@/modules/cards/grc", () => ({ eligibleGrcItems: vi.fn().mockResolvedValue([]) }));

import CardPage from "./cards/[cardId]/page";
import { NfcCheckForm, ProvisionForm } from "./forms";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const initial = { id, kind: "dbc", state: "blank", publicToken: null, createdAt: new Date("2026-10-10"),
  nfcVerifiedAt: null, packageMatchedAt: null, usableCredentialId: null, credentialCount: 0, orderContext: null, activity: [] };
const issued = { ...initial, publicToken: "A".repeat(26), usableCredentialId: id, credentialCount: 1 };
const reveal = { code: "N8KF-42PQ", url: "http://localhost:3000/c/" + "A".repeat(26) };
const page = () => CardPage({ params: Promise.resolve({ cardId: id }), searchParams: Promise.resolve({}) });
beforeEach(() => {
  responses.clear(); vi.clearAllMocks(); readCard.mockResolvedValue(initial);
  provision.mockResolvedValue({ reveal }); replace.mockResolvedValue({ reveal: { code: "PQR8-JKMN" } });
});

test("provision response remains visible after persisted card update, and fresh page never retrieves it", async () => {
  const before = await page();
  expect(renderToStaticMarkup(before)).toContain("Provision Digital Business Card");
  const data = new FormData(); data.set("cardId", id);
  responses.set(provision, await provision(undefined, data));
  readCard.mockResolvedValue(issued);
  const after = await page();
  const holder = (tree: ReactElement) => (tree.props as { children: ReactElement[] }).children.find((child) => child?.type === ProvisionForm);
  // Revalidation must preserve the response owner's identity, not unmount it when the token appears.
  expect(holder(before)?.type).toBe(ProvisionForm);
  expect(holder(after)?.type).toBe(ProvisionForm);
  expect(holder(before)?.key).toBe(holder(after)?.key);
  const html = renderToStaticMarkup(after);
  expect(html).toContain("Activation code");
  expect(html).toContain(reveal.code);
  expect(html).toContain(reveal.url);
  expect(html.indexOf(reveal.code)).toBeLessThan(html.indexOf("Physical NFC check"));
  expect(html).not.toContain("Provision Digital Business Card");
  // A reload has no action response, only the persisted token and credential summary.
  responses.clear();
  const refreshed = renderToStaticMarkup(await page());
  expect(refreshed).not.toContain(reveal.code);
  expect(refreshed).not.toContain("shown once");
  expect(refreshed).toContain(reveal.url);
  expect(refreshed).toContain("One unused credential");
  expect(refreshed).toContain("1 issued");
  expect(refreshed).toContain("In provisioning");
  expect(refreshed.match(/>Pending</g)).toHaveLength(3);
});

test("physical check uses plain labels, retains required confirmations, and omits optional device input", () => {
  const html = renderToStaticMarkup(<NfcCheckForm cardId={id} expectedUri={reveal.url} />);
  for (const text of [
    "Complete this only when you have the physical card.", "Copy URL",
    "Write this URL to the card using NFC Tools.", "Scan the card again using NFC Tools → Read.",
    "Paste the URL you read from the card below.", "URL read from the card",
    "The URL on the card matches the Card URL above.", "Tapping the card on a phone opens the correct URL.",
    "The card is still writable.", "Confirm NFC check", reveal.url,
  ]) expect(html).toContain(text);
  for (const name of ["readBackUri", "readBackMatched", "phoneOpenedUri", "tagLeftWritable"]) {
    expect(html).toMatch(new RegExp(`<input[^>]*required=""[^>]*name="${name}"`));
  }
  expect(html).not.toContain('name="device"');
  expect(html).not.toContain("Phone / device");
  expect(html).not.toContain("Address read back from the tag");
  expect(html).not.toContain("Record NFC check");
});

test("replacement response reveals independently of the initial provisioning response", async () => {
  readCard.mockResolvedValue({ ...issued, credentialCount: 2 });
  const data = new FormData(); data.set("cardId", id);
  responses.set(replace, await replace(undefined, data));
  const html = renderToStaticMarkup(await page());
  expect(html).toContain("PQR8-JKMN");
  expect(html).not.toContain(reveal.code);
  expect(html.indexOf("Credential recovery")).toBeLessThan(html.indexOf("PQR8-JKMN"));
  responses.clear();
  expect(renderToStaticMarkup(await page())).not.toContain("PQR8-JKMN");
});
vi.mock("next/server", () => ({ connection: vi.fn() }));
