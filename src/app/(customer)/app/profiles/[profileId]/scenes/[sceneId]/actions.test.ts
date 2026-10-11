import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
const m = vi.hoisted(() => ({ authorize: vi.fn(), rename: vi.fn(), deleteScene: vi.fn(), add: vi.fn(), update: vi.fn(), move: vi.fn(), visible: vi.fn(), remove: vi.fn(), form: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/forms", () => ({ updateForm: m.form }));
vi.mock("@/modules/profiles/scenes", () => ({ renameScene: m.rename, deleteScene: m.deleteScene }));
vi.mock("@/modules/profiles/blocks", () => ({ addBlock: m.add, updateBlock: m.update, moveBlock: m.move, setBlockVisible: m.visible, deleteBlock: m.remove }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { addBlockAction, deleteSceneAction, moveBlockAction, removeBlockAction, renameSceneAction, toggleBlockAction, updateBlockAction, updateFormAction } from "./actions";
const PROFILE = "11111111-1111-4111-8111-111111111111";
const SCENE = "22222222-2222-4222-8222-222222222222";
const BLOCK = "33333333-3333-4333-8333-333333333333";
const data = (values: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ profileId: PROFILE, sceneId: SCENE, blockId: BLOCK, ...values })) form.set(key, value);
  return form;
};
const destination = `REDIRECT:/app/profiles/${PROFILE}/scenes/${SCENE}`;
beforeEach(() => { vi.resetAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); });
test("rename calls the owned service and redirects", async () => {
  await expect(renameSceneAction(undefined, data({ name: "Events" }))).rejects.toThrow(destination);
  expect(m.rename).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, sceneId: SCENE, name: "Events" });
});
test.each(["about", "project", "link", "contact", "booking", "form"])("add %s sends only its allowed content fields", async type => {
  const content = { about: { text: "Hi" }, project: { title: "Site", description: "", url: "site.test" }, link: { kind: "github", label: "", url: "github.com/ana" }, contact: { saveContact: "on" }, booking: { label: "", url: "cal.com/ana" }, form: {} }[type];
  const fields = { text: "Hi", title: "Site", description: "", url: type === "project" ? "site.test" : type === "link" ? "github.com/ana" : "cal.com/ana", kind: "github", label: "", saveContact: "on", secretExtra: "ignored" };
  await expect(addBlockAction(undefined, data({ ...fields, type, preset: "contact" }))).rejects.toThrow(destination);
  expect(m.add).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, sceneId: SCENE, type, content, ...(type === "form" ? { preset: "contact" } : {}) });
});
test("update sends allowed fields and redirects", async () => {
  await expect(updateBlockAction(undefined, data({ type: "about", text: "Hi", unexpected: "ignored" }))).rejects.toThrow(destination);
  expect(m.update).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK, content: { text: "Hi" } });
});
test("move and toggle parse direction/visibility", async () => {
  await expect(moveBlockAction(undefined, data({ direction: "up" }))).rejects.toThrow(destination);
  expect(m.move).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK, direction: "up" });
  await expect(toggleBlockAction(undefined, data({ visible: "false" }))).rejects.toThrow(destination);
  expect(m.visible).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK, visible: false });
});
test("remove and delete require confirmation before mutation", async () => {
  expect(await removeBlockAction(undefined, data())).toEqual({ error: "Tick the box to confirm." });
  expect(await deleteSceneAction(undefined, data())).toEqual({ error: "Tick the box to confirm." });
  expect(m.remove).not.toHaveBeenCalled();
  expect(m.deleteScene).not.toHaveBeenCalled();
  await expect(removeBlockAction(undefined, data({ confirm: "on" }))).rejects.toThrow(destination);
  expect(m.remove).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK });
  await expect(deleteSceneAction(undefined, data({ confirm: "on" }))).rejects.toThrow(`REDIRECT:/app/profiles/${PROFILE}`);
  expect(m.deleteScene).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, sceneId: SCENE });
});
test.each([["invalid", "Check the highlighted fields and try again."], ["limit_reached", "You've reached the limit for this. Remove one first."], ["default_scene", "Your main scene can't be deleted."]] as const)("maps %s to customer copy", async (code, error) => {
  m.rename.mockRejectedValue(new ProfileError(code));
  expect(await renameSceneAction(undefined, data({ name: "Events" }))).toEqual({ error });
});
test("last-visible refusal returns publish gap copy", async () => {
  m.visible.mockRejectedValue(new ProfileError("not_ready", ["content"]));
  expect(await toggleBlockAction(undefined, data({ visible: "false" }))).toEqual({ error: "Your Neffi isn't ready to publish yet.", gaps: [PUBLISH_GAP_COPY.content] });
});
test("signed-out and malformed requests never call the domain", async () => {
  m.authorize.mockResolvedValue({ ok: false });
  await expect(addBlockAction(undefined, data({ type: "about", text: "Hi" }))).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  await expect(addBlockAction(undefined, data({ type: "unknown" }))).rejects.toThrow("NOT_FOUND");
  await expect(renameSceneAction(undefined, data({ sceneId: "bad" }))).rejects.toThrow("NOT_FOUND");
  expect(m.add).not.toHaveBeenCalled();
  expect(m.rename).not.toHaveBeenCalled();
});

const formData = (extra: Record<string, string> = {}) => data({ formId: BLOCK, title: "Enquiries", "field.name": "required", "field.email": "required", "field.phone": "optional", "field.company": "hidden", "field.message": "optional", ...extra });
test("form settings build fields, retain ids, drop blank questions and generate new ids", async () => {
  await expect(updateFormAction(undefined, formData({ "question.0.id": "abcdefgh", "question.0.label": " Old question ", "question.0.required": "on", "question.1.label": "New question", "question.2.label": " " }))).rejects.toThrow(destination);
  expect(m.form).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, formId: BLOCK, title: "Enquiries", config: { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "optional" }, questions: [{ id: "abcdefgh", label: "Old question", required: true }, { id: expect.stringMatching(/^[a-z0-9]{8}$/), label: "New question", required: false }] } });
});
test("more than three nonblank questions refuses without mutation", async () => {
  expect(await updateFormAction(undefined, formData({ "question.0.label": "One", "question.1.label": "Two", "question.2.label": "Three", "question.3.label": "Four" }))).toEqual({ error: "You can add up to 3 questions." });
  expect(m.form).not.toHaveBeenCalled();
});
