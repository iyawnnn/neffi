import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
const m = vi.hoisted(() => ({ authorize: vi.fn(), connect: vi.fn(), disable: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/manage", () => ({ connectCardToProfile: m.connect, setCardDisabled: m.disable, saveCardSettings: m.save }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { connectCardAction, setCardDisabledAction, saveCardSettingsAction } from "./actions";
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

test("settings save awaits all mutations before revalidation and explicit success", async () => {
  let complete!: () => void;
  m.save.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  const saving = saveCardSettingsAction(data({ disabled: "true", confirm: "on" }));
  await vi.waitFor(() => expect(m.save).toHaveBeenCalledWith({}, { accountId: "a1", cardId: CARD, profileId: PROFILE, disabled: true }));
  expect(m.revalidate).not.toHaveBeenCalled();
  complete();
  expect(await saving).toEqual({ ok: true });
  expect(m.revalidate).toHaveBeenCalledWith(`/app/cards/${CARD}`);
});

test.each([
  { profileId: "bad", disabled: "false" },
  { profileId: "", disabled: "false" },
  { profileId: PROFILE, disabled: "invalid" },
  { profileId: PROFILE, disabled: "true" },
])("invalid settings never mutate or revalidate: %j", async extra => {
  expect(await saveCardSettingsAction(data(extra))).toHaveProperty("error");
  expect(m.save).not.toHaveBeenCalled();
  expect(m.revalidate).not.toHaveBeenCalled();
});

test("settings save can enable a card without confirmation", async () => {
  expect(await saveCardSettingsAction(data({ disabled: "false" }))).toEqual({ ok: true });
  expect(m.save).toHaveBeenCalledWith({}, { accountId: "a1", cardId: CARD, profileId: PROFILE, disabled: false });
});

test("settings save authenticates and hides unowned resources", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(saveCardSettingsAction(data({ disabled: "false" }))).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  expect(m.save).not.toHaveBeenCalled();
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  await expect(saveCardSettingsAction(data({ cardId: "bad", disabled: "false" }))).rejects.toThrow("NOT_FOUND");
  expect(m.save).not.toHaveBeenCalled();
  m.save.mockRejectedValue(new ProfileError("not_found"));
  await expect(saveCardSettingsAction(data({ disabled: "false" }))).rejects.toThrow("NOT_FOUND");
  expect(m.revalidate).not.toHaveBeenCalled();
});

test("database failures return a safe error without success or revalidation", async () => {
  m.save.mockRejectedValue(new Error("private database details"));
  const result = await saveCardSettingsAction(data({ disabled: "false" }));
  expect(result).toEqual({ error: "Couldn't update card. Try again." });
  expect(m.revalidate).not.toHaveBeenCalled();
});
test("unowned mutation is not found", async () => { m.connect.mockRejectedValue(new ProfileError("not_found")); await expect(connectCardAction(undefined, data())).rejects.toThrow("NOT_FOUND"); });
test("signed-out or malformed requests never mutate", async () => {
  m.authorize.mockResolvedValue({ ok: false }); await expect(connectCardAction(undefined, data())).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); await expect(connectCardAction(undefined, data({ cardId: "bad" }))).rejects.toThrow("NOT_FOUND");
  expect(await setCardDisabledAction(undefined, data({ disabled: "invalid" }))).toHaveProperty("error"); expect(m.connect).not.toHaveBeenCalled(); expect(m.disable).not.toHaveBeenCalled();
});
