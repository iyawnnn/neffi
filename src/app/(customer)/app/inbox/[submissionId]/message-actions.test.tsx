// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MessageActions } from "./message-actions";
import { AppHeader } from "../../app-nav";

const m = vi.hoisted(() => ({ update: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("../actions", () => ({ updateInboxAction: m.update }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace, refresh: m.refresh }), usePathname: () => "/app/inbox/test" }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => { vi.resetAllMocks(); m.update.mockResolvedValue({ ok: true, unread: 1 }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(unread = 0) { await act(async () => root.render(<><AppHeader unread={unread} account={{ name: "Owner", email: "owner@example.test" }} /><MessageActions submissionId="s1" sender="Test Sender" unread={unread} /></>)); }
const button = (text: string, container: ParentNode = document) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === text || node.getAttribute("aria-label") === text)!;
const item = (text: string) => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent === text)!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
async function openMenu() { await act(async () => button("Message actions for Test Sender").click()); }
async function choose(text: string) { await act(async () => item(text).click()); }

test("mark unread updates the bell from real action count and stays on page without reopening it", async () => {
  await render(); await openMenu(); expect(item("Mark as unread").className).toContain("min-h-11");
  expect(item("Mark as unread").querySelector("svg")?.classList.contains("lucide-mail-open")).toBe(true);
  expect(item("Delete message").querySelector("svg")?.classList.contains("lucide-trash-2")).toBe(true);
  expect(item("Delete message").getAttribute("data-variant")).toBe("destructive");
  await choose("Mark as unread");
  const data = m.update.mock.calls[0][0] as FormData;
  expect(data.get("submissionId")).toBe("s1"); expect(data.get("operation")).toBe("unread");
  expect(m.refresh).not.toHaveBeenCalled(); expect(m.replace).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Marked as unread");
  expect(host.querySelector('[aria-label="Inbox, 1 unread"]')).not.toBeNull();
  await render(2); expect(host.querySelector('[aria-label="Inbox, 2 unread"]')).not.toBeNull();
});

test("Delete opens a named confirmation, focuses Cancel, and cancellation makes no mutation", async () => {
  await render(); await openMenu(); await choose("Delete message");
  expect(dialog()?.textContent).toContain("Delete message?"); expect(dialog()?.textContent).toContain("This message will be permanently deleted.");
  expect(dialog()?.getAttribute("aria-labelledby")).toBeTruthy(); expect(dialog()?.getAttribute("aria-describedby")).toBeTruthy();
  expect(dialog()?.querySelector('input[type="checkbox"]')).toBeNull();
  await vi.waitFor(() => expect(document.activeElement).toBe(button("Cancel")));
  await act(async () => button("Cancel").click());
  await vi.waitFor(() => expect(dialog()).toBeNull()); expect(m.update).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(document.activeElement).toBe(button("Message actions for Test Sender")));
});

test("confirmed delete prevents duplicates and returns to Inbox", async () => {
  await render(); await openMenu(); await choose("Delete message");
  const pending = Promise.withResolvers<{ ok: true; unread: number }>(); m.update.mockReturnValue(pending.promise);
  await act(async () => button("Delete message", dialog()!).click());
  expect(button("Deleting…").disabled).toBe(true); expect(button("Cancel").disabled).toBe(true);
  await act(async () => button("Deleting…").click()); expect(m.update).toHaveBeenCalledOnce();
  expect((m.update.mock.calls[0][0] as FormData).get("operation")).toBe("delete");
  await act(async () => pending.resolve({ ok: true, unread: 0 }));
  expect(m.replace).toHaveBeenCalledExactlyOnceWith("/app/inbox"); expect(m.refresh).not.toHaveBeenCalled();
});

test("delete failure stays in confirmation with an accessible error and allows retry", async () => {
  m.update.mockResolvedValue({ error: "Couldn’t update message. Try again." });
  await render(); await openMenu(); await choose("Delete message"); await act(async () => button("Delete message", dialog()!).click());
  expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain("Try again."); expect(button("Delete message", dialog()!).disabled).toBe(false);
  expect(m.replace).not.toHaveBeenCalled();
});

test("mark unread network failures show toast feedback and prevent duplicate requests", async () => {
  await render(); const pending = Promise.withResolvers<never>(); m.update.mockReturnValue(pending.promise);
  await openMenu(); await choose("Mark as unread"); expect(button("Message actions for Test Sender").disabled).toBe(true);
  await act(async () => pending.reject(new Error("network")));
  expect(document.body.textContent).toContain("Couldn’t update message. Try again."); expect(m.replace).not.toHaveBeenCalled();
});

test("menu is labelled, uses touch targets and supports keyboard navigation", async () => {
  await render(); const trigger = button("Message actions for Test Sender"); expect(trigger.className).toContain("size-11"); trigger.focus();
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
  await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
  const first = item("Mark as unread"); first.focus();
  await act(async () => first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
  await vi.waitFor(() => expect(document.activeElement).toBe(item("Delete message")));
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull()); expect(m.update).not.toHaveBeenCalled();
});
