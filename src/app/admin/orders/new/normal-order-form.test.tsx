// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../inventory/forms", () => ({ ActionForm: ({ children, submit }: { children: React.ReactNode; submit: string }) => <form>{children}<button type="submit">{submit}</button></form> }));
vi.mock("./actions", () => ({ createPaidOrderAction: vi.fn() }));
import { NormalOrderForm } from "./normal-order-form";

const key = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
let host: HTMLElement; let root: ReturnType<typeof createRoot>;
async function mount(props: Partial<React.ComponentProps<typeof NormalOrderForm>> = {}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<NormalOrderForm clientKey={key} {...props} />));
}
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const names = () => [...host.querySelectorAll<HTMLInputElement>("input,select,textarea")].map((el) => el.name).filter(Boolean);

test("shows the fixed product price, five payment methods and only two delivery choices", async () => {
  await mount();
  expect(host.textContent).toContain("Neffi Digital Business Card — ₱799");
  expect([...host.querySelectorAll('select[name="paymentMethod"] option')].map((o) => o.textContent)).toEqual(["GCash", "Maya", "MariBank", "GoTyme", "Bank transfer"]);
  expect([...host.querySelectorAll('select[name="delivery"] option')].map((o) => o.textContent)).toEqual(["In person", "J&T"]);
  expect(host.querySelector('input[type="checkbox"]')).toBeNull();
  expect(host.textContent).toContain("₱799 has already been received");
  expect(host.querySelector('button[type="submit"]')?.textContent).toBe("Create paid order");
  expect(host.querySelector('input[name="clientKey"]')?.getAttribute("value")).toBe(key);
});

test("exposes no price, paid, amount, courier or fee control", async () => {
  await mount();
  const all = names().join(" ");
  for (const forbidden of ["unitPrice", "agreedTotal", "paidNow", "paid", "paymentAmount", "amount", "courier", "shippingFee", "items"]) expect(names()).not.toContain(forbidden);
  expect(host.textContent).not.toMatch(/adjust price|negotiat|\bcash\b|pickup|local handoff/i);
  expect(all).toContain("quantity");
});

test("choosing J&T asks for recipient details, defaults them from the customer and never asks for a fee", async () => {
  await mount({ purchaser: { id: key, name: "Maria Santos-Reyes", contactNumber: "0917 123 4567" } });
  const select = host.querySelector<HTMLSelectElement>('select[name="delivery"]')!;
  await act(async () => { select.value = "jnt"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.querySelector<HTMLInputElement>('input[name="recipientName"]')?.value).toBe("Maria Santos-Reyes");
  expect(host.querySelector<HTMLInputElement>('input[name="recipientPhone"]')?.value).toBe("0917 123 4567");
  expect(host.querySelector('textarea[name="address"]')).not.toBeNull();
  expect(host.textContent).toContain("J&T Shipping — To be confirmed");
  expect(names()).not.toContain("shippingFee");
});

test("every field is labelled for keyboard and screen-reader use", async () => {
  await mount();
  for (const el of host.querySelectorAll("input:not([type=hidden]),select,textarea")) expect(el.closest("label"), el.getAttribute("name") ?? "").not.toBeNull();
});
