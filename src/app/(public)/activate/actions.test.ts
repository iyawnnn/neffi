import { beforeEach, describe, expect, test, vi } from "vitest";
import { hmacHex } from "@/auth/otp-quota";

const SECRET = "s".repeat(40);
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const CREDENTIAL = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const CARD = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const CODE = "N8KF-42PQ";
const VIEWER = { accountId: ACCOUNT, email: "a@example.test", role: "customer" as const };
const DB = { sentinel: true };

const m = vi.hoisted(() => ({
  authorize: vi.fn(), getViewer: vi.fn(), signOut: vi.fn(), consumeQuota: vi.fn(), headers: vi.fn(),
  checkActivationCode: vi.fn(), claimCard: vi.fn(), readChallenge: vi.fn(), setChallenge: vi.fn(), clearChallenge: vi.fn(),
}));
vi.mock("@/auth/access", () => ({ authorize: m.authorize, getViewer: m.getViewer }));
vi.mock("@/auth/server", () => ({ auth: { api: { signOut: m.signOut } } }));
vi.mock("@/auth/otp-quota", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/auth/otp-quota")>()), consumeQuota: m.consumeQuota }));
vi.mock("@/db", () => ({ db: { sentinel: true } }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "s".repeat(40) } }));
vi.mock("next/headers", () => ({ headers: m.headers }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("./challenge-cookie", () => ({ readChallenge: m.readChallenge, setChallenge: m.setChallenge, clearChallenge: m.clearChallenge }));
vi.mock("@/modules/activation/claim", () => ({ checkActivationCode: m.checkActivationCode, claimCard: m.claimCard }));

const actions = await import("./actions");

const TOO_MANY = "Too many tries. Please wait a few minutes and try again.";
const form = (code?: string | Blob) => {
  const data = new FormData();
  if (code !== undefined) data.set("code", code);
  return data;
};
const expectRedirect = (promise: Promise<unknown>, url: string) => expect(promise).rejects.toMatchObject({ message: `REDIRECT:${url}` });

beforeEach(() => {
  vi.clearAllMocks();
  m.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));
  m.consumeQuota.mockResolvedValue(true);
  m.getViewer.mockResolvedValue(null);
  m.authorize.mockResolvedValue({ ok: true, viewer: VIEWER });
  m.readChallenge.mockResolvedValue(CREDENTIAL);
});

describe("checkCodeAction", () => {
  test("is limited per client IP before any lookup", async () => {
    m.consumeQuota.mockResolvedValue(false);
    expect(await actions.checkCodeAction(undefined, form(CODE))).toEqual({ error: TOO_MANY });
    expect(m.consumeQuota).toHaveBeenCalledWith(DB, hmacHex(SECRET, "activation-ip", "203.0.113.9"), 20);
    expect(m.checkActivationCode).not.toHaveBeenCalled();
  });

  test("consults IP, daily IP, then global quotas before lookup", async () => {
    m.checkActivationCode.mockResolvedValue({ status: "invalid" });
    await actions.checkCodeAction(undefined, form(CODE));
    expect(m.consumeQuota.mock.calls).toHaveLength(3);
    expect(m.consumeQuota.mock.calls[0].slice(0, 3)).toEqual([DB, hmacHex(SECRET, "activation-ip", "203.0.113.9"), 20]);
    expect(m.consumeQuota.mock.calls[1].slice(0, 3)).toEqual([DB, hmacHex(SECRET, "activation-ip-day", "203.0.113.9"), 50]);
    expect(m.consumeQuota.mock.calls[1][4]).toEqual({ windowMs: 24 * 60 * 60_000 });
    expect(m.consumeQuota.mock.calls[2].slice(0, 3)).toEqual([DB, hmacHex(SECRET, "activation-global", "checks"), 100]);
    expect(m.checkActivationCode).toHaveBeenCalledOnce();
  });

  test.each([0, 1, 2])("a refusal from quota %i skips lookup", async (refusal) => {
    m.consumeQuota.mockImplementation(() => Promise.resolve(m.consumeQuota.mock.calls.length !== refusal + 1));
    expect(await actions.checkCodeAction(undefined, form(CODE))).toEqual({ error: TOO_MANY });
    expect(m.checkActivationCode).not.toHaveBeenCalled();
  });

  test("prefers the platform IP header", async () => {
    m.headers.mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "198.51.100.7", "x-forwarded-for": "203.0.113.9" }));
    m.checkActivationCode.mockResolvedValue({ status: "invalid" });
    await actions.checkCodeAction(undefined, form(CODE));
    expect(m.consumeQuota).toHaveBeenCalledWith(DB, hmacHex(SECRET, "activation-ip", "198.51.100.7"), 20);
  });

  test("a claimable code sets the challenge and reloads /activate", async () => {
    m.checkActivationCode.mockResolvedValue({ status: "claimable", credentialId: CREDENTIAL });
    await expectRedirect(actions.checkCodeAction(undefined, form(CODE)), "/activate");
    expect(m.checkActivationCode).toHaveBeenCalledWith(DB, { secret: SECRET, code: CODE, accountId: undefined });
    expect(m.setChallenge).toHaveBeenCalledWith(CREDENTIAL);
  });

  test("the signed-in owner of a used code goes to their Neffi", async () => {
    m.getViewer.mockResolvedValue(VIEWER);
    m.checkActivationCode.mockResolvedValue({ status: "yours", cardId: CARD });
    await expectRedirect(actions.checkCodeAction(undefined, form(CODE)), "/app");
    expect(m.checkActivationCode).toHaveBeenCalledWith(DB, { secret: SECRET, code: CODE, accountId: ACCOUNT });
    expect(m.setChallenge).not.toHaveBeenCalled();
  });

  test.each([
    ["invalid", null, "We couldn't find that code. Check the label inside your package and try again. If it still doesn't work, please contact Neffi support."],
    ["unavailable", null, "This code can't be used. If you already added this Neffi, sign in to find it. Otherwise, please contact Neffi support for help."],
    ["unavailable", VIEWER, "This code can't be used. Please contact Neffi support for help."],
  ])("%s (viewer %#) returns generic copy and never echoes the code", async (status, viewer, error) => {
    m.getViewer.mockResolvedValue(viewer);
    m.checkActivationCode.mockResolvedValue({ status });
    const state = await actions.checkCodeAction(undefined, form(CODE));
    expect(state).toEqual({ error });
    expect(JSON.stringify(state)).not.toMatch(/N8KF|42PQ/);
    expect(m.setChallenge).not.toHaveBeenCalled();
  });

  test("oversized and non-text input are bounded before the lookup", async () => {
    m.checkActivationCode.mockResolvedValue({ status: "invalid" });
    await actions.checkCodeAction(undefined, form("A".repeat(500)));
    expect(m.checkActivationCode.mock.calls[0][1].code).toHaveLength(64);
    await actions.checkCodeAction(undefined, form(new Blob(["N8KF"])));
    expect(m.checkActivationCode.mock.calls[1][1].code).toBe("");
    await actions.checkCodeAction(undefined, form());
    expect(m.checkActivationCode.mock.calls[2][1].code).toBe("");
  });
});

describe("claimAction", () => {
  test("signed out returns to /activate without claiming", async () => {
    m.authorize.mockResolvedValue({ ok: false, denial: { status: 401, error: "unauthenticated" } });
    await expectRedirect(actions.claimAction(undefined, form()), "/activate");
    expect(m.claimCard).not.toHaveBeenCalled();
  });

  test("an expired challenge asks for the code again", async () => {
    m.readChallenge.mockResolvedValue(null);
    await expectRedirect(actions.claimAction(undefined, form()), "/activate?notice=expired");
    expect(m.claimCard).not.toHaveBeenCalled();
  });

  test("is limited per account and keeps the challenge", async () => {
    m.consumeQuota.mockResolvedValue(false);
    expect(await actions.claimAction(undefined, form())).toEqual({ error: TOO_MANY });
    expect(m.consumeQuota).toHaveBeenCalledWith(DB, hmacHex(SECRET, "activation-claim", ACCOUNT), 10);
    expect(m.claimCard).not.toHaveBeenCalled();
    expect(m.clearChallenge).not.toHaveBeenCalled();
  });

  test("a new claim clears the challenge and starts guided setup", async () => {
    m.claimCard.mockResolvedValue({ status: "claimed", cardId: CARD });
    await expectRedirect(actions.claimAction(undefined, form()), `/app/setup/${CARD}`);
    expect(m.claimCard).toHaveBeenCalledWith(DB, { credentialId: CREDENTIAL, accountId: ACCOUNT });
    expect(m.clearChallenge).toHaveBeenCalledOnce();
  });

  test("an existing owner clears the challenge and returns to the dashboard", async () => {
    m.claimCard.mockResolvedValue({ status: "already_yours", cardId: CARD });
    await expectRedirect(actions.claimAction(undefined, form()), "/app");
    expect(m.claimCard).toHaveBeenCalledWith(DB, { credentialId: CREDENTIAL, accountId: ACCOUNT });
    expect(m.clearChallenge).toHaveBeenCalledOnce();
  });

  test("unavailable clears the challenge and explains safely", async () => {
    m.claimCard.mockResolvedValue({ status: "unavailable" });
    await expectRedirect(actions.claimAction(undefined, form()), "/activate?notice=unavailable");
    expect(m.clearChallenge).toHaveBeenCalledOnce();
  });
});

test("switching account signs out but keeps the accepted code", async () => {
  await expectRedirect(actions.switchAccountAction(), "/activate");
  expect(m.signOut).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  expect(m.clearChallenge).not.toHaveBeenCalled();
});

test("starting over forgets the accepted code", async () => {
  await expectRedirect(actions.startOverAction(), "/activate");
  expect(m.clearChallenge).toHaveBeenCalledOnce();
});
