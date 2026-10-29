// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../../profiles/[profileId]/image-upload", () => ({ ImageUpload: () => <div>Existing image uploader</div> }));
vi.mock("./actions", () => ({ createProfileAction: vi.fn() }));
import { SetupEditor } from "./setup-forms";
import { setupDraft } from "./setup-draft";

const profile = { id: "p1", fullName: "Ana", headline: null, company: null, bio: null, location: null, phone: null, email: null, website: null, imageIsLogo: false, imageAssetId: null };
afterEach(() => vi.unstubAllGlobals());
async function mount(step: "you" | "contact" | "photo", action = vi.fn().mockResolvedValue({ error: "Check your details.", fields: ["fullName"], messages: { fullName: "Enter your full name." } }), existing = true, contact: { saveContact: boolean } | null = null) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<SetupEditor step={step} suffix="TEST" cardId="c1" goal="freelance" profile={existing ? profile : null} view={existing ? setupDraft(null, { fullName: "Ana" }) : null} imageUrls={null} signInEmail="owner@example.test" contact={contact} action={action} />));
  return { host, action, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
test("You renders exact identity fields and optional labels, updates real preview without autosave", async () => {
  const { host, action, close } = await mount("you", undefined, false);
  try {
    for (const name of ["fullName", "headline", "company", "bio", "location"]) expect(host.querySelector(`[name="${name}"]`)).not.toBeNull();
    expect(host.querySelector('[name="email"]')).toBeNull();
    expect(host.querySelector('[name="fullName"]')?.hasAttribute("required")).toBe(true);
    const input = host.querySelector<HTMLInputElement>('[name="fullName"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Bea Cruz"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(host.querySelector('[data-layout="showcase"] h1')?.textContent).toBe("Bea Cruz");
    expect(action).not.toHaveBeenCalled();
    expect(host.textContent).toContain("0 / 300");
  } finally { await close(); }
});
test("Contact pre-fills sign-in email, defaults Save Contact on, has +63 and mobile preview dialog", async () => {
  const { host, close } = await mount("contact");
  try {
    expect(host.querySelector<HTMLInputElement>('[name="email"]')?.value).toBe("owner@example.test");
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
    expect(host.textContent).toContain("+63");
    expect(host.textContent).toContain("Clear it to keep your sign-in email private.");
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Preview")!.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Profile preview");
    expect(document.querySelector('[role="dialog"] [data-layout]')).not.toBeNull();
  } finally { await close(); }
});
test("Photo is optional, reuses uploader, exposes logo choice and Skip, no cover UI", async () => {
  const { host, close } = await mount("photo");
  try {
    expect(host.textContent).toContain("Existing image uploader");
    expect(host.textContent).toContain("This is a logo");
    expect([...host.querySelectorAll("a")].find(a => a.textContent === "Skip for now")?.getAttribute("href")).toBe("?step=contact");
    expect(host.textContent).not.toContain("Cover image");
  } finally { await close(); }
});
test("Continue invokes action once and failed validation preserves values and focuses field", async () => {
  const { host, action, close } = await mount("you");
  try {
    await act(async () => host.querySelector("form")!.requestSubmit(host.querySelector<HTMLButtonElement>('button[type="submit"]')!));
    expect(action).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLInputElement>('[name="fullName"]')?.value).toBe("Ana");
    expect(host.textContent).toContain("Enter your full name.");
    expect(document.activeElement).toBe(host.querySelector('[name="fullName"]'));
  } finally { await close(); }
});

test("Continue keeps its primary treatment and exposes one pending label while saving", async () => {
  let finish!: (state: { error: string }) => void;
  const action = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { host, close } = await mount("you", action);
  try {
    const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await act(async () => host.querySelector("form")!.requestSubmit(button));
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.className).toContain("bg-action");
    expect(button.querySelector('.inline-grid > span:not([aria-hidden="true"])')?.textContent).toBe("Saving…");
    await act(async () => finish({ error: "Try again." }));
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBeNull();
  } finally { await close(); }
});

test("Contact revisit preserves cleared public email and saved Save Contact preference", async () => {
  const { host, close } = await mount("contact", undefined, true, { saveContact: false });
  try {
    expect(host.querySelector<HTMLInputElement>('[name="email"]')?.value).toBe("");
    expect(host.querySelector<HTMLInputElement>('[role="switch"]')?.checked).toBe(false);
    expect(host.querySelector<HTMLInputElement>('[name="saveContact"]')?.value).toBe("false");
  } finally { await close(); }
});

test("Contact changes update the real preview while staying unsaved until Continue", async () => {
  const { host, action, close } = await mount("contact");
  try {
    const input = host.querySelector<HTMLInputElement>('[name="email"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "bea@example.test"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(host.querySelector('[data-layout] a[href="mailto:bea@example.test"]')).not.toBeNull();
    expect(action).not.toHaveBeenCalled();
  } finally { await close(); }
});

test("editing a hidden existing Contact block does not make it visible in the preview", async () => {
  const { host, close } = await mount("contact", undefined, true, { saveContact: true });
  try {
    const input = host.querySelector<HTMLInputElement>('[name="email"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "bea@example.test"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(host.querySelector('[data-layout] a[href="mailto:bea@example.test"]')).toBeNull();
  } finally { await close(); }
});

test("optional labels expose exact suffixes without changing requiredness", async () => {
  for (const step of ["you", "contact", "photo"] as const) {
    const { host, close } = await mount(step);
    try {
      const labels = [...host.querySelectorAll("label")].map(label => label.textContent);
      if (step === "you") {
        for (const name of ["Headline", "Company", "City / municipality", "Short intro"]) expect(labels).toContain(`${name} (optional)`);
        expect(labels).toContain("Full name");
        expect(host.querySelector('[name="fullName"]')?.hasAttribute("required")).toBe(true);
      } else if (step === "contact") {
        for (const name of ["Mobile number", "Public email", "Website"]) expect(labels).toContain(`${name} (optional)`);
        expect(host.querySelectorAll("input[required]")).toHaveLength(0);
        expect(labels).toContain("Save Contact");
        expect(host.textContent).toContain("Add at least one way for people to reach you.");
        expect(host.querySelector('[name="phone"]')?.getAttribute("aria-label")).toContain("(optional)");
      } else expect(host.textContent).toContain("Optional. A clear photo");
    } finally { await close(); }
  }
});
