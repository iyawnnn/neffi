import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
const m = vi.hoisted(() => ({ authorize: vi.fn(), connect: vi.fn(), disable: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/manage", () => ({ connectCardToProfile: m.connect, setCardDisabled: m.disable }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { connectCardAction, setCardDisabledAction } from "./actions";
const CARD = "11111111-1111-4111-8111-111111111111";
const PROFILE = "22222222-2222-4222-8222-222222222222";
const data = (extra: Record<string, string> = {}) => { const form = new FormData(); for (const [key, value] of Object.entries({ cardId: CARD, profileId: PROFILE, ...extra })) form.set(key, value); return form; };
beforeEach(() => { vi.resetAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); });
test("connect calls the owned domain and redirects", async () => { await expect(connectCardAction(undefined, data())).rejects.toThrow(`REDIRECT:/app/cards/${CARD}`); expect(m.connect).toHaveBeenCalledWith({}, { accountId: "a1", cardId: CARD, profileId: PROFILE }); });
test("turning off requires confirmation; enabling requires none", async () => {
  expect(await setCardDisabledAction(undefined, data({ disabled: "true" }))).toEqual({ error: "Tick the box to confirm." }); expect(m.disable).not.toHaveBeenCalled();
  await expect(setCardDisabledAction(undefined, data({ disabled: "true", confirm: "on" }))).rejects.toThrow(`REDIRECT:/app/cards/${CARD}`);
  expect(m.disable).toHaveBeenLastCalledWith({}, { accountId: "a1", cardId: CARD, disabled: true });
  await expect(setCardDisabledAction(undefined, data({ disabled: "false" }))).rejects.toThrow(`REDIRECT:/app/cards/${CARD}`);
  expect(m.disable).toHaveBeenLastCalledWith({}, { accountId: "a1", cardId: CARD, disabled: false });
});
test("unowned mutation is not found", async () => { m.connect.mockRejectedValue(new ProfileError("not_found")); await expect(connectCardAction(undefined, data())).rejects.toThrow("NOT_FOUND"); });
test("signed-out or malformed requests never mutate", async () => {
  m.authorize.mockResolvedValue({ ok: false }); await expect(connectCardAction(undefined, data())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); await expect(connectCardAction(undefined, data({ cardId: "bad" }))).rejects.toThrow("NOT_FOUND");
  expect(await setCardDisabledAction(undefined, data({ disabled: "invalid" }))).toHaveProperty("error"); expect(m.connect).not.toHaveBeenCalled(); expect(m.disable).not.toHaveBeenCalled();
});
