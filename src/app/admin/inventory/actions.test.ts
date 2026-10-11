import { beforeEach, describe, expect, test, vi } from "vitest";
import { CardError } from "@/modules/cards/card";

const { authorize, revalidatePath, services } = vi.hoisted(() => ({
  authorize: vi.fn(),
  revalidatePath: vi.fn(),
  services: {
    receiveStock: vi.fn(),
    provisionDbc: vi.fn(),
    recordNfcCheck: vi.fn(),
    matchPackage: vi.fn(),
    replaceProvisioningCredential: vi.fn(),
    reserveGrc: vi.fn(),
    retireCard: vi.fn(),
  },
}));

vi.mock("@/auth/access", () => ({ authorize }));
vi.mock("@/db", () => ({ db: { sentinel: true } }));
vi.mock("@/config/env", () => ({ env: { activationCodeSecret: "s".repeat(40), cardUrlOrigin: "https://tap.example.test" } }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/modules/inventory/stock-intake", () => ({ receiveStock: services.receiveStock }));
vi.mock("@/modules/cards/dbc", () => ({
  provisionDbc: services.provisionDbc,
  matchPackage: services.matchPackage,
  replaceProvisioningCredential: services.replaceProvisioningCredential,
}));
vi.mock("@/modules/cards/grc", () => ({ reserveGrc: services.reserveGrc }));
vi.mock("@/modules/cards/card", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/cards/card")>()),
  recordNfcCheck: services.recordNfcCheck,
  retireCard: services.retireCard,
}));

const actions = await import("./actions");

const CARD = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const ITEM = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const OWNER = { ok: true, viewer: { accountId: "11111111-1111-4111-8111-111111111111", email: "o@example.test", role: "owner" } };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const without = (fields: Record<string, string>, key: string) => Object.fromEntries(Object.entries(fields).filter(([name]) => name !== key));

type Case = {
  name: Exclude<keyof typeof actions, never>;
  service: keyof typeof services;
  fields: Record<string, string>;
  bad: Record<string, string>[];
  reveal: Record<string, string> | null;
};

const NFC = { cardId: CARD, readBackUri: "https://tap.example.test/c/X", readBackMatched: "on", phoneOpenedUri: "on", tagLeftWritable: "on" };
const REPLACE = { cardId: CARD, credentialId: ITEM, reason: "lost", confirm: "on" };
const RETIRE = { cardId: CARD, reason: "failed", confirm: "on" };
const STOCK = { receivedOn: "2026-10-10", quantity: "3", intendedKind: "dbc" };

const CASES: Case[] = [
  {
    name: "receiveStockAction",
    service: "receiveStock",
    fields: STOCK,
    bad: [{ ...STOCK, quantity: "0" }, { ...STOCK, quantity: "501" }, { ...STOCK, quantity: "1.5" }, { ...STOCK, receivedOn: "2026-13-45" }, { ...STOCK, intendedKind: "other" }, without(STOCK, "receivedOn")],
    reveal: null,
  },
  { name: "provisionDbcAction", service: "provisionDbc", fields: { cardId: CARD }, bad: [{ cardId: "not-a-uuid" }, {}], reveal: { url: "https://tap.example.test/c/TOKEN", code: "ABCD-EFGH-JKMN-PQRS" } },
  {
    name: "recordNfcCheckAction",
    service: "recordNfcCheck",
    fields: NFC,
    bad: [without(NFC, "readBackMatched"), without(NFC, "phoneOpenedUri"), without(NFC, "tagLeftWritable"), without(NFC, "readBackUri"), { ...NFC, cardId: "x" }],
    reveal: null,
  },
  {
    name: "matchPackageAction",
    service: "matchPackage",
    fields: { cardId: CARD, activationCode: "ABCD-EFGH-JKMN-PQRS" },
    bad: [{ cardId: CARD }, { cardId: CARD, activationCode: "" }, { cardId: CARD, activationCode: "x".repeat(65) }, { cardId: "x", activationCode: "ABCD" }],
    reveal: null,
  },
  {
    name: "replaceCredentialAction",
    service: "replaceProvisioningCredential",
    fields: REPLACE,
    bad: [without(REPLACE, "confirm"), without(REPLACE, "reason"), { ...REPLACE, reason: "  " }, { ...REPLACE, reason: "x".repeat(201) }, { ...REPLACE, credentialId: "x" }],
    reveal: { code: "ABCD-EFGH-JKMN-PQRS" },
  },
  { name: "reserveGrcAction", service: "reserveGrc", fields: { cardId: CARD, orderItemId: ITEM }, bad: [{ cardId: CARD }, { cardId: CARD, orderItemId: "x" }], reveal: null },
  { name: "retireCardAction", service: "retireCard", fields: RETIRE, bad: [without(RETIRE, "confirm"), without(RETIRE, "reason"), { ...RETIRE, reason: "" }], reveal: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(services)) fn.mockReset();
  authorize.mockResolvedValue(OWNER);
  services.provisionDbc.mockResolvedValue({ publicToken: "TOKEN", credentialId: ITEM, activationCode: "ABCDEFGHJKMNPQRS" });
  services.replaceProvisioningCredential.mockResolvedValue({ credentialId: ITEM, activationCode: "ABCDEFGHJKMNPQRS" });
  services.receiveStock.mockResolvedValue({ stockPurchaseId: ITEM });
});

describe.each(CASES)("$name", ({ name, service, fields, bad, reveal }) => {
  const run = (data: FormData) => (actions[name] as (prev: unknown, data: FormData) => Promise<Record<string, unknown>>)(undefined, data);
  const anyServiceCalled = () => Object.values(services).some((fn) => fn.mock.calls.length > 0);

  test.each([
    ["unauthenticated", { ok: false, denial: { status: 401, error: "unauthenticated" } }],
    ["customer", { ok: false, denial: { status: 403, error: "forbidden" } }],
  ])("a %s caller gets an error and no service runs", async (_who, denial) => {
    authorize.mockResolvedValue(denial);
    expect((await run(form(fields))).error).toBeTruthy();
    expect(authorize).toHaveBeenCalledWith("owner");
    expect(anyServiceCalled()).toBe(false);
  });

  test("an unauthorized caller is refused before their input is even read", async () => {
    authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
    const data = form(fields);
    const read = vi.spyOn(data as unknown as Record<symbol, () => unknown>, Symbol.iterator as never);
    await run(data);
    expect(read).not.toHaveBeenCalled();
  });

  test.each(bad.map((fields, index) => [index, fields] as const))("rejects invalid input #%i before the service runs", async (_index, invalid) => {
    const result = await run(form(invalid));
    expect(result.error).toBeTruthy();
    expect(anyServiceCalled()).toBe(false);
  });

  test("runs the service as the signed-in owner", async () => {
    const result = await run(form(fields));
    expect(result.error).toBeUndefined();
    expect(services[service]).toHaveBeenCalledWith({ sentinel: true }, expect.objectContaining({ actorId: OWNER.viewer.accountId }));
    expect(revalidatePath).toHaveBeenCalled();
  });

  test(reveal ? "reveals the new code once in the response" : "never returns a code", async () => {
    const result = await run(form(fields));
    if (reveal) expect(result.reveal).toEqual(reveal);
    else expect(result).not.toHaveProperty("reveal");
  });

  test("maps a rule refusal to fixed owner-facing copy", async () => {
    services[service].mockRejectedValue(new CardError("wrong_state"));
    const result = await run(form(fields));
    expect(String(result.error)).toMatch(/current state/i);
    expect(JSON.stringify(result)).not.toContain("wrong_state");
  });

  test("lets unexpected failures surface instead of hiding them", async () => {
    services[service].mockRejectedValue(new Error("connection reset"));
    await expect(run(form(fields))).rejects.toThrow("connection reset");
  });
});

test("a revealed code is never logged", async () => {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
  await actions.provisionDbcAction(undefined, form({ cardId: CARD }));
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});
