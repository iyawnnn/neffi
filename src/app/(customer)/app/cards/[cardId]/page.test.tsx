// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  account: vi.fn(),
  card: vi.fn(),
  profiles: vi.fn(),
  connectCard: vi.fn(),
  setDisabled: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { cardUrlOrigin: "https://tap.example.test" } }));
vi.mock("@/modules/cards/manage", () => ({ getOwnedCard: m.card }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.profiles }));
vi.mock("../actions", () => ({
  connectCardAction: m.connectCard,
  setCardDisabledAction: m.setDisabled,
  saveCardSettingsAction: m.saveSettings,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import CardPage from "./page";
import { CardEditor } from "./card-editor";

const token = "AAAAAAAAAAAAAAAAAAAAAAAAAA";

const defaultCard = {
  id: "c1",
  suffix: "AAAA",
  publicToken: token,
  profileId: "p1",
  profileName: "Ana",
  disabled: false,
};

const defaultProfiles = [
  { id: "p1", fullName: "Ana", status: "published" as const },
  { id: "p2", fullName: "Work", status: "draft" as const },
];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  m.account.mockResolvedValue({ accountId: "a1" });
  m.card.mockResolvedValue({ ...defaultCard });
  m.profiles.mockResolvedValue([...defaultProfiles]);
  m.connectCard.mockResolvedValue({ ok: true });
  m.setDisabled.mockResolvedValue({ ok: true });
  m.saveSettings.mockResolvedValue({ ok: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderStatic = async (extraCard = {}) => {
  m.card.mockResolvedValue({
    ...defaultCard,
    ...extraCard,
  });
  return renderToStaticMarkup(
    await CardPage({
      params: Promise.resolve({ cardId: "c1" }),
      searchParams: Promise.resolve({}),
    })
  );
};

async function renderClient(cardOverrides = {}) {
  const cardData = { ...defaultCard, ...cardOverrides };
  const url = `https://tap.example.test/c/${cardData.publicToken}`;
  const qr = cardData.profileId ? "data:image/svg+xml;utf8,<svg></svg>" : null;
  await act(async () => {
    root.render(
      <CardEditor
        card={cardData}
        profiles={defaultProfiles}
        url={url}
        qr={qr}
      />
    );
  });
}

// ----------------------------------------------------
// 1. HEADER & PAGE STRUCTURE (Static markup tests)
// ----------------------------------------------------

test("header renders masked card suffix, back link, and get help without a status badge", async () => {
  const html = await renderStatic();
  expect(html).toContain("Neffi •••• AAAA");
  expect(html).not.toContain(">Connected</span>");
  expect(html).toContain('href="/app/cards"');
  expect(html).toContain("Back to cards");
  expect(html).toContain('href="/support?cardId=c1"');
  expect(html).toContain("Get help");
  expect(html).toContain("Manage which profile this card opens.");
});

// ----------------------------------------------------
// 2. CONNECTED PROFILE & CARD STATUS (Static tests)
// ----------------------------------------------------

test("card settings renders connected profile, published status, switch, and pristine save", async () => {
  const html = await renderStatic();
  expect(html).toContain("Card settings");
  expect(html).toContain(
    "Choose what people see when they tap this Neffi and control its status."
  );
  expect(html).toContain("Connected profile");
  expect(html).toContain(
    "Select the profile that opens when this card is tapped or scanned."
  );
  expect(html).toContain("Ana");
  expect(html).toContain("Published");
  expect(html).toContain('name="profileId"');
  expect(html).toContain('value="p1"');

  // Card status row
  expect(html).toContain("Card status");
  expect(html).toContain(
    "Control whether tapping this card opens your profile."
  );
  expect(html).toContain("Active");
  expect(html).toContain(
    "When active, tapping or scanning this Neffi opens the connected profile."
  );
  expect(html).toContain('role="switch"');
  expect(html).toContain('aria-checked="true"');
  expect(html).toContain('aria-label="Card status"');
  expect(html).not.toContain('<input type="checkbox"');

  // Save changes button is disabled and neutral/quiet (outline) when pristine, not black
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*class="[^"]*border-border[^"]*bg-background[^"]*"[^>]*>[\s\S]*?Save changes[\s\S]*?<\/button>/
  );
  expect(html).not.toMatch(
    /<button[^>]*class="[^"]*bg-primary[^"]*"[^>]*>[\s\S]*?Save changes[\s\S]*?<\/button>/
  );
});

// ----------------------------------------------------
// 3. SHARE YOUR NEFFI SURFACE (Static tests)
// ----------------------------------------------------

test("share surface renders QR frame, shortened link, real URL, copy link, and download QR", async () => {
  const html = await renderStatic();
  expect(html).toContain("Share your Neffi");
  expect(html).toContain(
    "Anyone who scans this QR opens the same page as tapping your card."
  );
  expect(html).toContain('alt="QR code for your Neffi link"');
  expect(html).toContain('src="data:image/svg+xml');
  expect(html).toContain("Profile link");
  expect(html).toContain("Share this link or QR code with others.");
  // Real URL preserved
  expect(html).toContain(`https://tap.example.test/c/${token}`);
  // Shortened pretty display
  expect(html).toContain("tap.example.test/c/••••AAAA");
  // No raw plain underlined link
  expect(html).not.toContain(
    'class="inline-flex min-h-11 items-center break-all text-sm underline'
  );
  // Copy link (Vermilion primary: bg-action text-white) and Download QR code (secondary outline: border-border)
  expect(html).toMatch(
    /<button[^>]*class="[^"]*bg-action[^"]*text-white[^"]*"[^>]*>[\s\S]*?Copy link[\s\S]*?<\/button>/
  );
  expect(html).not.toMatch(
    /<button[^>]*class="[^"]*bg-primary[^"]*"[^>]*>[\s\S]*?Copy link[\s\S]*?<\/button>/
  );
  expect(html).toContain('download="neffi-qr.svg"');
  expect(html).toContain("Download QR code");
  expect(html).toMatch(
    /<a[^>]*download="neffi-qr\.svg"[^>]*>/
  );
  const downloadAnchor = html.match(/<a[^>]*download="neffi-qr\.svg"[^>]*>/)?.[0] ?? "";
  expect(downloadAnchor).toContain("border-border");
  expect(downloadAnchor).toContain("bg-background");
  expect(downloadAnchor).not.toContain("bg-action");
});

// ----------------------------------------------------
// 4. DISABLED CARD & UNCONFIGURED CARD (Domain tests)
// ----------------------------------------------------

test("disabled card renders Turned off copy and aria-checked false", async () => {
  const html = await renderStatic({ disabled: true });
  expect(html).toContain("Turned off");
  expect(html).toContain(
    "This card won’t open a profile until you turn it back on."
  );
  expect(html).toContain('role="switch"');
  expect(html).toContain('aria-checked="false"');
});

test("unconfigured card offers setup and hides the QR and Connected badge", async () => {
  const html = await renderStatic({
    profileId: null,
    profileName: null,
    disabled: false,
  });
  expect(html).toContain('href="/app/setup/c1"');
  expect(html).toContain("Set up this Neffi");
  expect(html).not.toContain("data:image/svg+xml");
  expect(html).not.toContain("Connected");
});

test("the Sharing QR shown and downloaded is the symbol of exactly this card's permanent URL, never /activate", async () => {
  const { qrSvgDataUri } = await vi.importActual<typeof import("@/modules/cards/qr")>("@/modules/cards/qr");
  const html = await renderStatic();
  const unescape = (value: string) => value.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
  const shown = unescape(html.match(/<img[^>]*alt="QR code for your Neffi link"[^>]*>/)![0].match(/src="([^"]*)"/)![1]);
  const downloaded = unescape(html.match(/<a[^>]*download="neffi-qr\.svg"[^>]*>/)![0].match(/href="([^"]*)"/)![1]);
  // uqr is deterministic, so an identical symbol means an identical encoded value.
  expect(shown).toBe(qrSvgDataUri(`https://tap.example.test/c/${token}`));
  expect(downloaded).toBe(shown);
  expect(shown).not.toBe(qrSvgDataUri("https://tap.example.test/activate"));
  expect(shown).not.toBe(qrSvgDataUri(`https://tap.example.test/c/${"B".repeat(26)}`));
});

test("unknown card is not found", async () => {
  m.card.mockResolvedValue(null);
  await expect(
    CardPage({
      params: Promise.resolve({ cardId: "c1" }),
      searchParams: Promise.resolve({}),
    })
  ).rejects.toThrow("NOT_FOUND");
});

// ----------------------------------------------------
// 5. INTERACTIVE CLIENT BEHAVIOR (DOM / happy-dom tests)
// ----------------------------------------------------

test("toggling switch on active card opens confirmation dialog; cancel keeps active, confirm turns off and enables save", async () => {
  await renderClient();

  const switchBtn = host.querySelector<HTMLButtonElement>(
    'button[role="switch"]'
  )!;
  const saveBtn = host.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  )!;

  expect(switchBtn.getAttribute("aria-checked")).toBe("true");
  expect(saveBtn.disabled).toBe(true);

  // Click switch -> dialog opens
  await act(async () => switchBtn.click());

  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  expect(dialog.textContent).toContain("Turn off this Neffi?");

  // Click Cancel in dialog
  const cancelBtn = [...dialog.querySelectorAll("button")].find(
    (b) => b.textContent === "Cancel"
  )!;
  await act(async () => cancelBtn.click());

  // Switch still active, save still disabled
  expect(switchBtn.getAttribute("aria-checked")).toBe("true");
  expect(saveBtn.disabled).toBe(true);

  // Click switch again -> dialog opens
  await act(async () => switchBtn.click());

  // Click Turn off card
  const confirmBtn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Turn off card"
  )!;
  await act(async () => confirmBtn.click());

  // Switch is now off, copy is Turned off, Save is dirty and enabled!
  expect(switchBtn.getAttribute("aria-checked")).toBe("false");
  expect(host.textContent).toContain("Turned off");
  expect(saveBtn.disabled).toBe(false);
  expect(saveBtn.className).toContain("bg-action");
});

test("disabled card can be turned on without confirmation dialog", async () => {
  await renderClient({ disabled: true });

  const switchBtn = host.querySelector<HTMLButtonElement>(
    'button[role="switch"]'
  )!;
  const saveBtn = host.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  )!;

  expect(switchBtn.getAttribute("aria-checked")).toBe("false");
  expect(saveBtn.disabled).toBe(true);

  // Click switch -> directly turns on without dialog
  await act(async () => switchBtn.click());

  expect(switchBtn.getAttribute("aria-checked")).toBe("true");
  expect(host.textContent).toContain("Active");
  expect(saveBtn.disabled).toBe(false);
  expect(saveBtn.className).toContain("bg-action");
});

test("save changes calls action, disables button, and shows success toast", async () => {
  await renderClient({ disabled: true });

  const switchBtn = host.querySelector<HTMLButtonElement>(
    'button[role="switch"]'
  )!;
  const saveBtn = host.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  )!;

  // Turn card on
  await act(async () => switchBtn.click());
  expect(saveBtn.disabled).toBe(false);

  // Submit form
  await act(async () => saveBtn.click());

  expect(m.saveSettings).toHaveBeenCalledTimes(1);
  const formData = m.saveSettings.mock.calls[0][0] as FormData;
  expect(formData.get("cardId")).toBe("c1");
  expect(formData.get("disabled")).toBe("false");

  // Save button resets to disabled (pristine)
  expect(saveBtn.disabled).toBe(true);
  expect(document.body.textContent).toContain("Card updated");
});

test("copy link writes real URL to clipboard and triggers feedback", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });

  await renderClient();

  const copyBtn = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Copy link")
  )!;
  await act(async () => copyBtn.click());

  expect(writeText).toHaveBeenCalledWith(`https://tap.example.test/c/${token}`);
  expect(document.body.textContent).toContain("Link copied");
});

async function selectWorkProfile() {
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-labelledby="connected-profile-label"]')!.click());
  const option = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent?.includes("Work"))!;
  expect(option).toBeDefined();
  await act(async () => option.click());
}

test("saving profile and status together submits the complete state once", async () => {
  await renderClient({ disabled: true });
  await selectWorkProfile();
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  m.connectCard.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/app/cards/c1;303;" }));
  await act(async () => host.querySelector<HTMLButtonElement>('[type="submit"]')!.click());
  expect(m.saveSettings).toHaveBeenCalledTimes(1);
  const data = m.saveSettings.mock.calls[0][0] as FormData;
  expect(Object.fromEntries(data)).toEqual({ cardId: "c1", profileId: "p2", disabled: "false" });
  expect(m.connectCard).not.toHaveBeenCalled();
  expect(m.setDisabled).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Card updated");
});

test("a returned action error preserves dirty changes and never shows success", async () => {
  await renderClient({ disabled: true });
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  m.saveSettings.mockResolvedValue({ error: "Check the highlighted fields and try again." });
  await act(async () => host.querySelector<HTMLButtonElement>('[type="submit"]')!.click());
  expect(document.body.textContent).not.toContain("Card updated");
  expect(host.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
  expect(document.body.textContent).toContain("Check the highlighted fields and try again.");
});

test("profile-only save includes the unchanged status", async () => {
  await renderClient();
  await selectWorkProfile();
  await act(async () => host.querySelector<HTMLButtonElement>('[type="submit"]')!.click());
  expect(Object.fromEntries(m.saveSettings.mock.calls[0][0] as FormData)).toEqual({ cardId: "c1", profileId: "p2", disabled: "false" });
  expect(document.body.textContent).toContain("Card updated");
});

test("success waits for the save to complete", async () => {
  let complete!: (result: { ok: true }) => void;
  m.saveSettings.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await renderClient({ disabled: true });
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[type="submit"]')!.click());
  expect(m.saveSettings).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).not.toContain("Card updated");
  expect(host.textContent).toContain("Saving");
  await act(async () => complete({ ok: true }));
  expect(document.body.textContent).toContain("Card updated");
});

test.each([new Error("private database details"), Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/sign-in;303;" })])("thrown failures never become success feedback: %s", async error => {
  m.saveSettings.mockRejectedValue(error);
  await renderClient({ disabled: true });
  await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[type="submit"]')!.click());
  expect(document.body.textContent).not.toContain("Card updated");
  expect(document.body.textContent).not.toContain("private database details");
  expect(host.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
});

test("an unchanged form never saves", async () => {
  await renderClient();
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(m.saveSettings).not.toHaveBeenCalled();
});
