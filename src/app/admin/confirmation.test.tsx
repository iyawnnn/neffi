// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
vi.mock("./confirm-dialog", () => ({ ConfirmDialog: ({ open, onConfirm, onOpenChange }: { open: boolean; onConfirm: () => void; onOpenChange: (open: boolean) => void }) => open ? <div><button type="button" onClick={onConfirm}>Accept</button><button type="button" onClick={() => onOpenChange(false)}>Dismiss</button></div> : null }));
import { ActionForm } from "./inventory/forms";
import { ActionSheet } from "./orders/[orderId]/action-sheet";

test("implicit submission cannot bypass confirmation; only acceptance sends the flag once", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const action = vi.fn(async () => ({}));
  try {
    await act(async () => root.render(<ActionForm action={action} submit="Retire" confirm={{ field: "confirm", title: "Retire?", description: "Permanent" }}><input name="reason" defaultValue="Damaged" required /></ActionForm>));
    const form = host.querySelector("form")!;
    // Exercise implicit submission and the explicit accepted submitter.
    const submit = (submitter: HTMLButtonElement | null = null) => {
      const event = new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter });
      form.dispatchEvent(event);
    };
    vi.spyOn(form, "requestSubmit").mockImplementation((button) => submit(button as HTMLButtonElement));
    await act(async () => submit());
    expect(action).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>("button:last-child")!.click());
    expect(action).not.toHaveBeenCalled();
    await act(async () => submit(host.querySelector<HTMLButtonElement>("button[hidden]")));
    expect(action).not.toHaveBeenCalled();
    await act(async () => Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Accept")!.click());
    expect(action).toHaveBeenCalledTimes(1); expect((action.mock.calls[0] as unknown as [unknown, FormData])[1].get("confirm")).toBe("on");
    await act(async () => submit());
    expect(action).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

test("action sheets retain their form state when dismissed", () => {
  const sheet = ActionSheet({ title: "Recovery", children: <p>One-time response</p> });
  expect(sheet.props.children[1].props.keepMounted).toBe(true);
});
