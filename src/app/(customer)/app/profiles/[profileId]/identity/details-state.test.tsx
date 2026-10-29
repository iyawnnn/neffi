import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { DETAILS_TOASTS, detailsReducer, initialDetailsState } from "./details-state";
import { EditorFooter } from "./editor-footer";
import { identitySchema } from "@/modules/profiles/rules";
import { detailsDirty, identityPhone, type DetailsProfile } from "./identity-values";

const profile: DetailsProfile = { id: "p1", fullName: "Ana", headline: null, company: null, bio: null, phone: null, email: null, website: null, location: null };
const button = (html: string, label: string) => [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match => match[0]).find(markup => markup.includes(label))!;

test("pristine, dirty and saving footer states expose correct status and action availability", () => {
  const pristine = renderToStaticMarkup(<EditorFooter dirty={false} saving={false} onCancel={vi.fn()} />);
  expect(pristine).toContain("All changes saved");
  expect(button(pristine, "Save changes")).toContain("disabled");
  expect(button(pristine, "Save changes")).not.toContain("bg-action");
  const dirty = renderToStaticMarkup(<EditorFooter dirty saving={false} onCancel={vi.fn()} />);
  expect(dirty).toContain("Unsaved changes");
  expect(dirty).not.toContain('disabled=""');
  expect(button(dirty, "Save changes")).toContain("bg-action");
  const saving = renderToStaticMarkup(<EditorFooter dirty saving onCancel={vi.fn()} />);
  expect(saving).toContain("Saving changes…");
  expect(saving).toContain("Saving…");
  expect([...saving.matchAll(/ disabled=""/g)]).toHaveLength(2);
  expect(button(saving, "Saving…")).toContain("bg-action");
});

test("failed saves stop loading and preserve all entered values and the unsaved baseline", () => {
  const initial = initialDetailsState(profile);
  const edited = detailsReducer(initial, { type: "edit", key: "website", value: "example.com" });
  const saving = detailsReducer(edited, { type: "saving" });
  expect(saving.saving).toBe(true);
  const failed = detailsReducer(saving, { type: "settled" });
  expect(failed.saving).toBe(false);
  expect(failed.values).toEqual(edited.values);
  expect(failed.saved).toEqual(initial.saved);
  expect(detailsDirty(failed.values, failed.saved)).toBe(true);
});

test("successful save adopts normalized values as the pristine baseline", () => {
  const edited = detailsReducer(initialDetailsState(profile), { type: "edit", key: "website", value: "example.com" });
  const identity = identitySchema.parse(edited.values);
  const saved = detailsReducer(edited, { type: "saved", identity });
  expect(saved.values.website).toBe("https://example.com/");
  expect(detailsDirty(saved.values, saved.saved)).toBe(false);
});

test("field errors do not discard inputs and are cleared when the field is edited", () => {
  const state = detailsReducer(initialDetailsState(profile), { type: "errors", errors: { phone: "Enter a valid Philippine mobile number." } });
  const edited = detailsReducer(state, { type: "edit", key: "phone", value: "0917" });
  expect(edited.values.phone).toBe("0917");
  expect(edited.errors.phone).toBeUndefined();
  expect(identityPhone(edited.values.phone, null)).toBeNull();
});

test("save notifications use the requested success and recoverable failure copy", () => {
  expect(DETAILS_TOASTS.success).toEqual({ title: "Details updated" });
  expect(DETAILS_TOASTS.failure).toEqual({ title: "Couldn’t save changes", description: "Your changes are still here. Try again.", priority: "high" });
});

test("clearing a selected locality remains a valid optional-field change", () => {
  const selected = initialDetailsState({ ...profile, location: "San Fernando, Pampanga" });
  const cleared = detailsReducer(selected, { type: "edit", key: "location", value: "" });
  expect(detailsDirty(cleared.values, cleared.saved)).toBe(true);
  expect(identitySchema.parse(cleared.values).location).toBeNull();
});
