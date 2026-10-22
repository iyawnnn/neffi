// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { profileFixture } from "@/dev/profile-fixture";
import { ProfileRenderer } from "./profile-renderer";

test.each(["classic", "editorial", "showcase"] as const)("%s Contact places each icon before its type label and keeps the value separate", layout => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={{ ...profileFixture, appearance: { ...profileFixture.appearance, layout } }} />);
  for (const [label, icon, value] of [["Mobile", "phone", "+63 917 000 0000"], ["Email", "mail", "ana@example.invalid"], ["Website", "globe", "example.invalid"]]) {
    const row = [...host.querySelectorAll(".pf-contact > div")].find(row => row.querySelector("dt")?.textContent === label)!;
    const link = row.querySelector("dd > a.pf-contact-value")!;
    expect(link, label).toBeTruthy();
    const type = row.querySelector("dt")!;
    expect(type.firstElementChild?.classList.contains(`lucide-${icon}`)).toBe(true);
    expect(type.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(type.querySelector("svg")?.getAttribute("width")).toBe("16");
    expect(type.querySelector("span")?.textContent).toBe(label);
    expect(link.querySelector("span")?.textContent).toBe(value);
    expect(link.querySelector("svg")).toBeNull();
  }
  expect(host.querySelector('.pf-contact a[href="https://example.invalid"]')?.textContent).toBe("example.invalid");
});

test.each(["classic", "editorial", "showcase"] as const)("%s Contact omits absent methods and retains long values without changing destinations", layout => {
  const email = `${"ana".repeat(40)}@example.invalid`;
  const website = `https://example.invalid/${"long-path".repeat(35)}`;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={{ ...profileFixture, appearance: { ...profileFixture.appearance, layout }, identity: { ...profileFixture.identity, phone: null, email, website } }} />);
  expect(host.querySelectorAll(".pf-contact > div")).toHaveLength(2);
  expect(host.querySelector(`a[href="mailto:${email}"] span`)?.textContent).toBe(email);
  expect(host.querySelector(`a[href="${website}"] span`)?.textContent).toBe(website.replace(/^https:\/\//, ""));
});

test.each(["classic", "editorial", "showcase"] as const)("%s never invents a missing contact row or an empty Contact section", layout => {
  for (const missing of ["phone", "email", "website"] as const) {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<ProfileRenderer view={{ ...profileFixture, appearance: { ...profileFixture.appearance, layout }, identity: { ...profileFixture.identity, [missing]: null } }} />);
    expect(host.querySelectorAll(".pf-contact > div")).toHaveLength(2);
    const labels = [...host.querySelectorAll(".pf-contact dt")].map(dt => dt.textContent);
    expect(labels).not.toContain({ phone: "Mobile", email: "Email", website: "Website" }[missing]);
  }
  const html = renderToStaticMarkup(<ProfileRenderer view={{ ...profileFixture, appearance: { ...profileFixture.appearance, layout }, identity: { ...profileFixture.identity, phone: null, email: null, website: null } }} />);
  expect(html).not.toContain('aria-label="Contact"');
});
