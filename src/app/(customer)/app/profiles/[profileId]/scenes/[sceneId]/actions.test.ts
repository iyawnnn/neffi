import { beforeEach, expect, test, vi } from "vitest";
import { ProfileError } from "@/modules/profiles/errors";
import { PUBLISH_GAP_COPY } from "@/modules/profiles/rules";
const m = vi.hoisted(() => ({ authorize: vi.fn(), rename: vi.fn(), deleteScene: vi.fn(), add: vi.fn(), update: vi.fn(), move: vi.fn(), visible: vi.fn(), remove: vi.fn(), form: vi.fn(), block: vi.fn() }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/forms", () => ({ updateForm: m.form, parseFormTitle: (title: string) => title.trim() && title.trim().length <= 60 ? title.trim() : null }));
vi.mock("@/modules/profiles/scenes", () => ({ renameScene: m.rename, deleteScene: m.deleteScene }));
vi.mock("@/modules/profiles/blocks", () => ({ addBlock: m.add, updateBlock: m.update, moveBlock: m.move, setBlockVisible: m.visible, deleteBlock: m.remove }));
vi.mock("@/modules/profiles/editor", () => ({ blockForEditing: m.block }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { addBlockAction, deleteSceneAction, loadItemAction, moveBlockAction, mutateItemAction, removeBlockAction, renameSceneAction, toggleBlockAction, updateBlockAction, updateFormAction } from "./actions";
const PROFILE = "11111111-1111-4111-8111-111111111111";
const SCENE = "22222222-2222-4222-8222-222222222222";
const BLOCK = "33333333-3333-4333-8333-333333333333";
const data = (values: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ profileId: PROFILE, sceneId: SCENE, blockId: BLOCK, ...values })) form.set(key, value);
  return form;
};
const loaded = (type = "link") => ({ id: BLOCK, sceneId: SCENE, type, visible: true, content: {}, form: type === "form" ? { id: "44444444-4444-4444-8444-444444444444", title: "Contact", config: {}, useCount: 1 } : null });
const destination = `REDIRECT:/app/profiles/${PROFILE}/scenes/${SCENE}`;
beforeEach(() => { vi.resetAllMocks(); m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } }); m.add.mockResolvedValue({ blockId: BLOCK }); m.block.mockResolvedValue(loaded()); });
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
  m.block.mockResolvedValue(loaded("about"));
  await expect(updateBlockAction(undefined, data({ type: "about", text: "Hi", unexpected: "ignored" }))).rejects.toThrow(destination);
  expect(m.update).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK, content: { text: "Hi" } });
});
test("move and toggle parse direction/visibility", async () => {
  await expect(moveBlockAction(undefined, data({ direction: "up", section: "links" }))).rejects.toThrow(destination);
  expect(m.move).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK, direction: "up", among: ["link"] });
  expect(await moveBlockAction(undefined, data({ direction: "down", section: "content" }))).toEqual({ error: "Check the highlighted fields and try again." });
  expect(await moveBlockAction(undefined, data({ direction: "down", section: "toString" }))).toEqual({ error: "Check the highlighted fields and try again." });
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
test.each([["invalid", "Check the highlighted fields and try again."], ["limit_reached", "You've reached the limit for this. Remove one first."], ["default_scene", "Your main profile mode can't be deleted."]] as const)("maps %s to customer copy", async (code, error) => {
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
  await expect(mutateItemAction(data({ operation: "unknown" }))).rejects.toThrow("REDIRECT:/sign-in?next=/app");
  m.authorize.mockResolvedValue({ ok: true, viewer: { accountId: "a1" } });
  await expect(addBlockAction(undefined, data({ type: "unknown" }))).rejects.toThrow("NOT_FOUND");
  await expect(renameSceneAction(undefined, data({ sceneId: "bad" }))).rejects.toThrow("NOT_FOUND");
  expect(m.add).not.toHaveBeenCalled();
  expect(m.rename).not.toHaveBeenCalled();
});

const formData = (extra: Record<string, string> = {}) => data({ formId: BLOCK, title: "Enquiries", "field.name": "required", "field.email": "required", "field.phone": "optional", "field.company": "hidden", "field.message": "optional", ...extra });
test("form settings build fields, retain ids, drop blank questions and generate new ids", async () => {
  m.block.mockResolvedValue(loaded("form"));
  await expect(updateFormAction(undefined, formData({ "question.0.id": "abcdefgh", "question.0.label": " Old question ", "question.0.required": "on", "question.1.label": "New question", "question.2.label": " " }))).rejects.toThrow(destination);
  expect(m.form).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, formId: "44444444-4444-4444-8444-444444444444", title: "Enquiries", config: { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "optional" }, questions: [{ id: "abcdefgh", label: "Old question", required: true }, { id: expect.stringMatching(/^[a-z0-9]{8}$/), label: "New question", required: false }] } });
});
test("more than three nonblank questions refuses without mutation", async () => {
  m.block.mockResolvedValue(loaded("form"));
  expect(await updateFormAction(undefined, formData({ "question.0.label": "One", "question.1.label": "Two", "question.2.label": "Three", "question.3.label": "Four" }))).toEqual({ error: "You can add up to 3 questions.", fields: { questions: "You can add up to 3 questions." } });
  expect(m.form).not.toHaveBeenCalled();
});

test("modal mutation adds without redirecting and returns the new item id", async () => {
  m.add.mockResolvedValue({ blockId: BLOCK });
  expect(await mutateItemAction(data({ operation: "add", type: "link", kind: "facebook", url: "facebook.com/neffi" }))).toEqual({ ok: true, blockId: BLOCK });
  expect(m.add).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, sceneId: SCENE, type: "link", content: { kind: "facebook", label: "", url: "facebook.com/neffi" } });
});

test("modal mutations load an item scoped to the route scene before changing it", async () => {
  m.block.mockResolvedValue(loaded("link"));
  expect(await mutateItemAction(data({ operation: "update", type: "about", kind: "github", label: "", url: "github.com/neffi" }))).toEqual({ ok: true, blockId: BLOCK });
  expect(m.block).toHaveBeenCalledWith({}, "a1", PROFILE, BLOCK, SCENE);
  expect(m.update).toHaveBeenCalledWith({}, { accountId: "a1", profileId: PROFILE, blockId: BLOCK, content: { kind: "github", label: "", url: "github.com/neffi" } });
});

test("modal validation marks only the invalid link field", async () => {
  m.block.mockResolvedValue(loaded("link"));
  expect(await mutateItemAction(data({ operation: "update", kind: "github", label: "Neffi", url: "javascript:alert(1)" }))).toEqual({
    error: "Check the highlighted fields and try again.", fields: { url: "Enter a valid link." },
  });
  expect(m.update).not.toHaveBeenCalled();
});

test("modal mutations do not change an item from another profile mode", async () => {
  m.block.mockResolvedValue(null);
  await expect(mutateItemAction(data({ operation: "visibility", visible: "false" }))).rejects.toThrow("NOT_FOUND");
  expect(m.visible).not.toHaveBeenCalled();
});

test("modal move rejects a block outside its submitted visual section", async () => {
  m.block.mockResolvedValue(loaded("link"));
  expect(await mutateItemAction(data({ operation: "move", section: "content", direction: "up" }))).toEqual({ error: "Check the highlighted fields and try again." });
  expect(m.move).not.toHaveBeenCalled();
});

test("modal form updates use the form attached to the route-scoped item", async () => {
  m.block.mockResolvedValue(loaded("form"));
  expect(await mutateItemAction(formData({ operation: "form" }))).toEqual({ ok: true, blockId: BLOCK });
  expect(m.form).toHaveBeenCalledWith({}, expect.objectContaining({ formId: "44444444-4444-4444-8444-444444444444" }));
});

test("modal contact form validation keeps errors inline", async () => {
  m.block.mockResolvedValue(loaded("form"));
  expect(await mutateItemAction(formData({ operation: "form", "field.email": "hidden", "field.phone": "hidden" }))).toEqual({
    error: "Check the highlighted fields and try again.", fields: { config: "Check your contact form settings." },
  });
  expect(m.form).not.toHaveBeenCalled();
});

test("modal contact form validation identifies the title", async () => {
  m.block.mockResolvedValue(loaded("form"));
  expect(await mutateItemAction(formData({ operation: "form", title: " " }))).toEqual({
    error: "Check the highlighted fields and try again.", fields: { title: "Enter a title up to 60 characters." },
  });
  expect(m.form).not.toHaveBeenCalled();
});

test("load action returns only the requested route-scoped item", async () => {
  m.block.mockResolvedValue(loaded("form"));
  await expect(loadItemAction(PROFILE, SCENE, BLOCK)).resolves.toEqual(loaded("form"));
  expect(m.block).toHaveBeenCalledWith({}, "a1", PROFILE, BLOCK, SCENE);
});
