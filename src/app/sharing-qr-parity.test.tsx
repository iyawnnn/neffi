import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

// One physical card, three surfaces: the URL the OWNER writes to NFC, the Sharing QR the OWNER prints for the card
// back, and the Sharing QR the customer later sees must all be the same permanent /c/{token} address.
const { origin, token, cardId } = vi.hoisted(() => ({
  origin: "https://getneffi.com",
  token: "7M3K9QW2XRTV4BPZ6NDHJ8CFGA",
  cardId: "3f2b8f64-5717-4562-b3fc-2c963f66afa6",
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { cardUrlOrigin: origin } }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/auth/access", () => ({ requireOwner: vi.fn(), requireAccount: vi.fn().mockResolvedValue({ accountId: "a1" }) }));
vi.mock("@/modules/inventory/queries", () => ({
  getCardDetail: vi.fn().mockResolvedValue({
    id: cardId, kind: "dbc", state: "blank", publicToken: token, nfcVerifiedAt: null, packageMatchedAt: null,
    createdAt: new Date("2026-10-25"), usableCredentialId: cardId, credentialCount: 1, orderContext: null, activity: [],
  }),
}));
vi.mock("@/modules/cards/grc", () => ({ eligibleGrcItems: vi.fn().mockResolvedValue([]) }));
vi.mock("@/app/admin/inventory/forms", () => ({
  ProvisionForm: () => null, MatchPackageForm: () => null, ReplaceForm: () => null, ReserveForm: () => null, RetireForm: () => null,
  NfcCheckForm: ({ expectedUri }: { expectedUri: string }) => <output data-nfc-uri={expectedUri} />,
}));
vi.mock("@/modules/cards/manage", () => ({
  getOwnedCard: vi.fn().mockResolvedValue({ id: cardId, publicToken: token, suffix: token.slice(-4), profileId: "p1", profileName: "Ana", disabled: false }),
}));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: vi.fn().mockResolvedValue([{ id: "p1", fullName: "Ana", status: "published" }]) }));
vi.mock("@/app/(customer)/app/cards/actions", () => ({ connectCardAction: vi.fn(), setCardDisabledAction: vi.fn(), saveCardSettingsAction: vi.fn() }));

import AdminCardPage from "@/app/admin/inventory/cards/[cardId]/page";
import CustomerCardPage from "@/app/(customer)/app/cards/[cardId]/page";
import { qrSvgDataUri } from "@/modules/cards/qr";

const unescape = (value: string) => value.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
const attr = (html: string, tag: RegExp, name: string) => unescape(html.match(tag)?.[0].match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "");

test("admin Sharing QR, customer Sharing QR and the NFC URL are the same permanent card URL", async () => {
  const props = { params: Promise.resolve({ cardId }), searchParams: Promise.resolve({}) };
  const admin = renderToStaticMarkup(await AdminCardPage(props));
  const customer = renderToStaticMarkup(await CustomerCardPage(props));
  const nfcUrl = attr(admin, /<output[^>]*data-nfc-uri="[^"]*"[^>]*>/, "data-nfc-uri");

  expect(nfcUrl).toBe(`${origin}/c/${token}`);
  const adminQr = attr(admin, /<img[^>]*alt="Sharing QR for this card"[^>]*>/, "src");
  const adminDownload = attr(admin, /<a[^>]*download="neffi-sharing-qr-[^"]*\.svg"[^>]*>/, "href");
  const customerQr = attr(customer, /<img[^>]*alt="QR code for your Neffi link"[^>]*>/, "src");

  expect(adminQr).toBe(qrSvgDataUri(nfcUrl));
  expect(adminDownload).toBe(adminQr);
  expect(customerQr).toBe(adminQr);
  expect(admin).toContain(`download="neffi-sharing-qr-${token}.svg"`);
  expect(adminQr).not.toBe(qrSvgDataUri(`${origin}/activate`));
});
