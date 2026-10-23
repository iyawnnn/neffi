import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("./actions", () => ({ createSceneAction: vi.fn(), deleteProfileAction: vi.fn(), publishAction: vi.fn(), updateIdentityAction: vi.fn(), showSceneAction: vi.fn() }));
// Render portal contents on the server to test action availability and form payloads without a browser.
vi.mock("@base-ui/react/dialog", () => {
  const content = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return { Dialog: { Root: content, Portal: content, Popup: content, Title: content, Description: content, Backdrop: () => null, Trigger: () => null, Close: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button> } };
});

import type { OwnedProfile } from "@/modules/profiles/profiles";
import { AddModeDialog, DeleteProfileDialog, ManageModesDialog, ModeStatus } from "./editor-dialogs";

test("ModeStatus renders Currently showing and Default as quiet text metadata without pills or dots", () => {
  const activeDefault = renderToStaticMarkup(<ModeStatus isShown={true} isDefault={true} />);
  expect(activeDefault).toContain("Currently showing");
  expect(activeDefault).toContain("Default");
  expect(activeDefault).not.toContain("bg-action");
  expect(activeDefault).not.toContain("rounded-full bg-brand/10");
  expect(activeDefault).not.toContain("rounded-full bg-subtle");

  const shownOnly = renderToStaticMarkup(<ModeStatus isShown={true} isDefault={false} />);
  expect(shownOnly).toContain("Currently showing");
  expect(shownOnly).not.toContain("Default");

  const defaultOnly = renderToStaticMarkup(<ModeStatus isShown={false} isDefault={true} />);
  expect(defaultOnly).not.toContain("Currently showing");
  expect(defaultOnly).toContain("Default");

  const neither = renderToStaticMarkup(<ModeStatus isShown={false} isDefault={false} />);
  expect(neither).toBe("");
});

test("ManageModesDialog presents clean list of modes, ModeStatus, Edit actions, and Add profile mode button without per-row icons", () => {
  const profile = {
    id: "p1",
    fullName: "Ana",
    scenes: [
      { id: "s1", name: "Main", isDefault: true, isShown: true },
      { id: "s2", name: "Events", isDefault: false, isShown: false },
    ],
  } as unknown as OwnedProfile;
  const html = renderToStaticMarkup(<ManageModesDialog profile={profile} />);
  expect(html).toContain("Profile modes");
  expect(html).toContain("Main");
  expect(html).toContain("Currently showing");
  expect(html).toContain("Default");
  expect(html).toContain("Events");
  expect(html).toContain("Switch");
  expect(html).toContain('href="/app/profiles/p1/scenes/s1"');
  expect(html).toContain("Add profile mode");
});

test("ManageModesDialog in create view displays the Add Mode form seamlessly", () => {
  const profile = {
    id: "p1",
    fullName: "Ana",
    scenes: [{ id: "s1", name: "Main", isDefault: true, isShown: true }],
  } as unknown as OwnedProfile;
  const html = renderToStaticMarkup(<ManageModesDialog profile={profile} initialView="create" />);
  expect(html).toContain("Add a profile mode");
  expect(html).toContain("Mode name");
  expect(html).toContain("Start with");
  expect(html).toContain("Start blank");
  expect(html).toContain("Copy Main");
  expect(html).toContain("Create mode");
  expect(html).toContain("Cancel");
});

test("Add profile mode uses labeled existing blank/copy choices and a non-submit Cancel control", () => {
  const html = renderToStaticMarkup(<AddModeDialog profileId="p1" scenes={[{ id: "s1", name: "Networking", isDefault: true, isShown: true }]} currentSceneName="Networking" />);
  for (const text of ["Mode name", "e.g. Freelance, Portfolio, Event", "Start with", 'value="empty"', 'value="s1"', "Start blank", "Copy Networking", 'name="profileId" value="p1"', 'type="button">Cancel', "Create mode"]) expect(html).toContain(text);
  const nameInput = html.match(/<input\b[^>]*name="name"[^>]*>/)?.[0];
  expect(nameInput).toContain('required=""');
});

test("unconnected profile offers permanent-delete confirmation with the existing server confirmation payload", () => {
  const html = renderToStaticMarkup(<DeleteProfileDialog profileId="p1" name="Ana" cardCount={0} />);
  for (const text of ["Delete Ana?", "This permanently deletes this profile and its content.", "This action can’t be undone.", 'type="hidden" name="confirm" value="on"', 'name="profileId" value="p1"', "Delete profile", "Cancel"]) expect(html).toContain(text);
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain("Manage connected cards");
});

test("single connected card blocks deletion with specific card identifier and direct Vermilion card recovery action", () => {
  const html = renderToStaticMarkup(<DeleteProfileDialog profileId="p1" name="Ana" cards={[{ id: "c1", suffix: "FSM5" }]} />);
  expect(html).toContain("Move your card before deleting this profile");
  expect(html).toContain("Ana is still connected to Neffi •••• FSM5.");
  expect(html).toContain("Choose another profile for this card first. After that, you can return here and delete Ana.");
  expect(html).toContain('href="/app/cards/c1"');
  expect(html).toContain("Manage card");
  expect(html).toContain("bg-action");
  expect(html).not.toContain("Manage connected cards");
  expect(html).not.toContain("<form");
  expect(html).not.toContain('type="submit"');
});

test("multiple connected cards block deletion and offer card management recovery action", () => {
  const html = renderToStaticMarkup(
    <DeleteProfileDialog profileId="p1" name="Ana" cards={[{ id: "c1", suffix: "FSM5" }, { id: "c2", suffix: "AAAA" }]} />,
  );
  expect(html).toContain("Move your cards before deleting this profile");
  expect(html).toContain("2 cards are still connected to Ana.");
  expect(html).toContain("Connect them to another profile first. After that, you can return here and delete Ana.");
  expect(html).toContain('href="/app/cards"');
  expect(html).toContain("Manage connected cards");
  expect(html).toContain("bg-action");
  expect(html).not.toContain("<form");
  expect(html).not.toContain('type="submit"');
});

test("legacy add-mode form also uses customer terminology", async () => {
  const { AddSceneForm } = await import("./profile-forms");
  const html = renderToStaticMarkup(<AddSceneForm profileId="p1" scenes={[]} />);
  expect(html).toContain("Mode name");
  expect(html).toContain("Add mode");
  expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/\b(scene|block|theme)s?\b/i);
});
