import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const { requireOwner, getCardDetail, qrInputs } = vi.hoisted(() => ({ requireOwner: vi.fn(), getCardDetail: vi.fn(), qrInputs: [] as string[] }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { cardUrlOrigin: "https://getneffi.com" } }));
vi.mock("@/modules/inventory/queries", () => ({ getCardDetail }));
vi.mock("@/modules/cards/grc", () => ({ eligibleGrcItems: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/cards/qr", () => ({ qrSvgDataUri: (text: string) => { qrInputs.push(text); return `data:image/svg+xml,QR${qrInputs.length}`; } }));
vi.mock("../../actions", () => ({ revealActivationCodeAction: vi.fn(), saveExistingActivationCodeAction: vi.fn() }));
vi.mock("../../forms", () => ({
  ProvisionForm: ({ available }: { available: boolean }) => available ? <button>Provision Digital Business Card</button> : null,
  NfcCheckForm: ({ expectedUri }: { expectedUri: string }) => <div data-nfc-form data-uri={expectedUri}><button>Confirm NFC test</button></div>,
  MatchPackageForm: () => <button>Confirm package</button>,
  ReplaceForm: () => <button>Replace credential</button>,
  ReserveForm: () => <button>Reserve Google Review Card</button>,
  RetireForm: () => <button>Retire card</button>,
}));

import CardPage from "./page";

const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const credentialId = "5a2b8f64-5717-4562-b3fc-2c963f66afa7";
const token = "7M3K9QW2XRTV4BPZ6NDHJ8CFGA";
const order = { orderId: "9a2b8f64-5717-4562-b3fc-2c963f66afa8", orderNumber: 1005, label: null, reviewUrl: null, status: "in_progress" };
const base = {
  id, kind: "dbc", state: "preparing", publicToken: token, nfcVerifiedAt: null, packageMatchedAt: null, createdAt: new Date("2026-10-10"),
  usableCredentialId: credentialId, credentialCount: 1, credentialRetrievable: true, owningAccount: null, owningAccountId: null,
  purchaser: { id, name: "Maria Santos" }, orderContext: order, activity: [{ type: "card_provisioned", note: `token ${token}`, createdAt: new Date("2026-10-10") }],
};
const render = async () => renderToStaticMarkup(await CardPage({ params: Promise.resolve({ cardId: id }), searchParams: Promise.resolve({}) }));
const primary = (html: string) => { const start = html.indexOf("data-primary-task"); return start < 0 ? "" : html.slice(start, html.indexOf("</section>", start) + 10); };
beforeEach(() => { vi.clearAllMocks(); qrInputs.length = 0; getCardDetail.mockResolvedValue({ ...base }); });

test("a card in preparation answers: which card and customer, what is done, what is next, and offers one primary task", async () => {
  const html = await render();
  expect(html).toContain(`Card ${token.slice(-4)}`);
  expect(html).toContain("Maria Santos");
  expect(html).toContain("Order 1005");
  expect(html).toContain("Keep this card with you until preparation is complete.");
  expect(html.match(/data-primary-task/g)).toHaveLength(1);
  expect(primary(html)).toContain("Write and test the NFC card");
  expect(primary(html)).toContain("Confirm NFC test");
  expect(primary(html)).toContain(`data-uri="https://getneffi.com/c/${token}"`);
  for (const step of ["Write NFC", "Confirm NFC test", "Confirm package", "Ready for customer"]) expect(html).toContain(step);
  expect(html).not.toMatch(/N-\d{4}|sticker|inventory QR/i);
});

test("raw internal state names are not the primary presentation", async () => {
  const html = await render();
  expect(html).toContain("In preparation");
  expect(html).not.toMatch(/>(Preparing|Reserved|Released|Blank)</);
});

test("the initial page never contains an activation code and offers only the explicit reveal", async () => {
  const html = await render();
  expect(html).toContain("Show activation code");
  expect(html).not.toContain("tracking-wider");
  expect(html).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  expect(html).not.toContain("localStorage");
});

test("Continue on phone encodes only the trusted workspace route, kept separate from the Sharing QR", async () => {
  const html = await render();
  expect(qrInputs).toContain(`https://getneffi.com/admin/inventory/cards/${id}`);
  expect(qrInputs).toContain(`https://getneffi.com/c/${token}`);
  expect(qrInputs).not.toContain("https://getneffi.com/activate");
  expect(qrInputs.join(" ")).not.toMatch(new RegExp(`${credentialId}|code|session`, "i"));
  expect(html).toContain("Continue on phone");
  expect(html).toContain('alt="Sharing QR for this card"');
  expect(html).toContain(`download="neffi-sharing-qr-${token}.svg"`);
});

test("after the NFC test the one task is typing the code from the actual package", async () => {
  getCardDetail.mockResolvedValue({ ...base, nfcVerifiedAt: new Date() });
  const html = await render();
  expect(primary(html)).toContain("Confirm the package");
  expect(primary(html)).toContain("Confirm package");
  expect(primary(html)).not.toContain("data-nfc-form");
  expect(html.match(/data-primary-task/g)).toHaveLength(1);
});

test("a stock card that is not provisioned yet starts with provisioning and has no QR", async () => {
  getCardDetail.mockResolvedValue({ ...base, state: "blank", publicToken: null, usableCredentialId: null, credentialCount: 0, orderContext: null, purchaser: null });
  const html = await render();
  expect(html).toContain("Provision Digital Business Card");
  expect(html).not.toContain("Sharing QR");
  expect(html).not.toContain("Continue on phone");
  expect(html).not.toContain("Show activation code");
});

test("Ready stock skips completed preparation and offers no physical task", async () => {
  getCardDetail.mockResolvedValue({ ...base, state: "ready", nfcVerifiedAt: new Date(), packageMatchedAt: new Date(), orderContext: null, purchaser: null });
  const html = await render();
  expect(html).toContain("Ready for customer");
  expect(html).not.toContain("data-nfc-form");
  expect(html).not.toContain("<button>Confirm package");
  expect(html).toContain("Sharing QR");
});

test("an assigned card points to its order for the delivery action", async () => {
  getCardDetail.mockResolvedValue({ ...base, state: "reserved", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() });
  const html = await render();
  expect(primary(html)).toContain(`href="/admin/orders/${order.orderId}"`);
  expect(primary(html)).toContain("Open Order 1005");
});

test("a released card has no code controls or preparation task", async () => {
  getCardDetail.mockResolvedValue({ ...base, state: "released", nfcVerifiedAt: new Date(), packageMatchedAt: new Date() });
  const html = await render();
  expect(html).toContain("Given to the customer");
  expect(html).not.toContain("Show activation code");
  expect(html).not.toContain("Retire card");
  expect(html).not.toContain("Replace credential");
});

test("a retired card offers only history: no QR, code or mutation controls", async () => {
  getCardDetail.mockResolvedValue({ ...base, state: "retired", usableCredentialId: null });
  const html = await render();
  expect(html).toContain("cannot be sold");
  for (const gone of ["Sharing QR", "Continue on phone", "Show activation code", "Replace credential", "Retire card", "Confirm NFC test"]) expect(html).not.toContain(gone);
  expect(html).toContain("Recent activity");
});

test("a legacy credential keeps the honest adoption path", async () => {
  getCardDetail.mockResolvedValue({ ...base, nfcVerifiedAt: new Date(), credentialRetrievable: false });
  expect(await render()).toMatch(/older credential/i);
});

test("a cancelled order is called out and a long customer name wraps", async () => {
  getCardDetail.mockResolvedValue({ ...base, state: "blank", orderContext: { ...order, status: "cancelled" }, purchaser: { id, name: "Maria ".repeat(30) + "Supercalifragilisticexpialidocious".repeat(3) } });
  const html = await render();
  expect(html).toContain("This order was cancelled");
  expect(html).toContain("[overflow-wrap:anywhere]");
});

test("Google Review Cards keep their own NFC check against the review URL", async () => {
  getCardDetail.mockResolvedValue({ ...base, kind: "grc", state: "reserved", publicToken: null, usableCredentialId: null, credentialCount: 0, orderContext: { ...order, reviewUrl: "https://g.page/r/review" } });
  const html = await render();
  expect(html).toContain('data-uri="https://g.page/r/review"');
  expect(html).not.toContain("Continue on phone");
});

test("OWNER denial stops before reading inventory", async () => {
  requireOwner.mockRejectedValueOnce(new Error("denied"));
  await expect(render()).rejects.toThrow("denied");
  expect(getCardDetail).not.toHaveBeenCalled();
});

test("the exact canonical Card path is the sign-in return destination and guards the protected fetch", async () => {
  requireOwner.mockRejectedValueOnce(new Error("REDIRECT"));
  await expect(render()).rejects.toThrow("REDIRECT");
  expect(requireOwner).toHaveBeenCalledWith(`/admin/inventory/cards/${id}`);
  expect(getCardDetail).not.toHaveBeenCalled();
});

test("a malformed card id still passes the owner gate (without a custom destination) before 404", async () => {
  await expect(CardPage({ params: Promise.resolve({ cardId: "not-a-uuid" }), searchParams: Promise.resolve({}) })).rejects.toThrow();
  expect(requireOwner).toHaveBeenCalledWith(undefined);
  expect(getCardDetail).not.toHaveBeenCalled();
});
