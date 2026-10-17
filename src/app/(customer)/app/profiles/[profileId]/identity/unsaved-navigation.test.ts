import { expect, test, vi } from "vitest";
import { guardHistoryNavigation, type HistoryNavigation } from "./unsaved-navigation";

const navigation = () => Object.assign(new Event("navigate", { cancelable: true }), { navigationType: "traverse", canIntercept: true, destination: { url: "https://example.com/app/profiles/p1", key: "history-key" } });

test("dirty browser Back/Forward pauses navigation and preserves the target history entry for confirmation", () => {
  const event = navigation();
  const requestLeave = vi.fn();
  guardHistoryNavigation(event, false, false, requestLeave);
  expect(event.defaultPrevented).toBe(true);
  expect(requestLeave).toHaveBeenCalledWith(event.destination.url, "history-key");
});

test("confirmed discard traverses normally; saving prevents navigation without opening another dialog", () => {
  const requestLeave = vi.fn();
  const discarded = navigation();
  guardHistoryNavigation(discarded, true, false, requestLeave);
  expect(discarded.defaultPrevented).toBe(false);
  const saving = navigation();
  guardHistoryNavigation(saving, false, true, requestLeave);
  expect(saving.defaultPrevented).toBe(true);
  expect(requestLeave).not.toHaveBeenCalled();
});

test("ordinary and non-interceptable navigations are left to the link/unload guards", () => {
  const requestLeave = vi.fn();
  for (const event of [{ ...navigation(), navigationType: "push", canIntercept: true }, { ...navigation(), navigationType: "traverse", canIntercept: false }]) {
    guardHistoryNavigation(event as HistoryNavigation, false, false, requestLeave);
  }
  expect(requestLeave).not.toHaveBeenCalled();
});
