import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const { requireOwner, getCardDetail } = vi.hoisted(() => ({ requireOwner: vi.fn(), getCardDetail: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { cardUrlOrigin: "http://localhost:3000" } }));
vi.mock("@/modules/inventory/queries", () => ({ getCardDetail }));
vi.mock("@/modules/cards/grc", () => ({ eligibleGrcItems: vi.fn().mockResolvedValue([]) }));
vi.mock("../../forms", () => ({
  ProvisionForm: ({ available }: { available: boolean }) => available ? <button>Provision Digital Business Card</button> : null,
  NfcCheckForm: () => <button>Confirm NFC check</button>,
  MatchPackageForm: () => <button>Match package</button>,
  ReplaceForm: () => <button>Replace credential</button>,
  ReserveForm: () => <button>Reserve Google Review Card</button>,
  RetireForm: () => <button>Retire card</button>,
}));

import CardPage from "./page";

const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const card = {
  id, kind: "dbc", state: "blank", publicToken: "A".repeat(26),
  nfcVerifiedAt: null, packageMatchedAt: null, createdAt: new Date("2026-10-10"),
  usableCredentialId: id, credentialCount: 2, orderContext: null, activity: [],
};
const render = async () => renderToStaticMarkup(await CardPage({ params: Promise.resolve({ cardId: id }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.clearAllMocks(); getCardDetail.mockResolvedValue({ ...card }); });

test("Blank DBC shows honest progress, physical next step, then details, activity, recovery and danger", async () => {
  const html = await render();
  expect(requireOwner).toHaveBeenCalledOnce();
  expect(html).toContain("In provisioning");
  expect(html).toContain(`/admin/support/new?cardId=${id}`);
  expect(html.match(/>Complete</g)).toHaveLength(1);
  expect(html.match(/>Pending</g)).toHaveLength(3);
  expect(html).toContain("Waiting for physical card");
  expect(html).toContain("You can leave this card here and continue when the NFC card is available.");
  const headings = ["Provisioning progress", "Next step", "Card details", "Recent activity", "Credential recovery", "Danger zone"];
  const positions = headings.map((heading) => html.indexOf(`>${heading}</h2>`));
  expect(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1]))).toBe(true);
  expect(html).toContain("Confirm NFC check");
  expect(html).not.toContain("<button>Match package");
});

test("recorded NFC check advances the displayed operation to package matching", async () => {
  getCardDetail.mockResolvedValue({ ...card, nfcVerifiedAt: new Date() });
  const html = await render();
  expect(html).toContain("Match the activation package");
  expect(html.match(/>Complete</g)).toHaveLength(2);
  expect(html).not.toContain("Confirm NFC check");
});

test("legacy Ready card does not fabricate missing physical checks in progress", async () => {
  getCardDetail.mockResolvedValue({ ...card, state: "ready" });
  const html = await render();
  expect(html.match(/>Pending</g)).toHaveLength(2);
  expect(html.match(/>Complete</g)).toHaveLength(2);
  expect(html).not.toContain(">Next step</h2>");
});

test("retired card has no recovery or mutation controls", async () => {
  getCardDetail.mockResolvedValue({ ...card, state: "retired", usableCredentialId: null });
  const html = await render();
  expect(html).toContain("cannot be sold");
  expect(html).not.toContain("<button>");
});

test("the card-back Sharing QR is available while provisioning, before any customer claim, and never for a retired card", async () => {
  const blank = await render();
  expect(blank).toContain('alt="Sharing QR for this card"');
  expect(blank).toContain(`download="neffi-sharing-qr-${card.publicToken}.svg"`);
  getCardDetail.mockResolvedValue({ ...card, state: "retired", usableCredentialId: null });
  expect(await render()).not.toContain("Sharing QR");
});

test("OWNER denial stops before reading inventory", async () => {
  requireOwner.mockRejectedValueOnce(new Error("denied"));
  await expect(render()).rejects.toThrow("denied");
  expect(getCardDetail).not.toHaveBeenCalled();
});
