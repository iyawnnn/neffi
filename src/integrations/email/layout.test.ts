import { expect, test } from "vitest";
import { renderEmail, type EmailMessage } from "./layout";
import { authCodeEmail, changeEmailCodeEmail } from "./resend";
import { recoveryCodeEmail } from "./support-templates";

const origin = "https://app.example.test";
const base: EmailMessage = { subject: "Your Neffi sign-in code", preheader: "Use it within 5 minutes.", heading: "Your sign-in code", paragraphs: ["Use this code to continue to Neffi."], code: "012345", notes: ["This code expires in 5 minutes."] };

test("the code is one unbroken text node and keeps its leading zero", () => {
  const { html, text } = renderEmail(base, origin);
  expect(html.match(/>(\d[\d\s]*)</g)).toEqual([">012345<"]);
  expect(text.split("\n")).toContain("012345");
});

test("the shell has the logo, a real heading, the support link and light-only colour scheme", () => {
  const { html } = renderEmail(base, origin);
  expect(html).toContain(`src="${origin}/email/neffi-logo.png"`);
  expect(html).toContain('alt="Neffi"');
  expect(html).toContain("<h1");
  expect(html).toContain(`href="${origin}/support"`);
  expect(html).toContain('name="color-scheme" content="light"');
  expect(html).toContain('name="format-detection"');
  expect(html).toContain("<title>Your Neffi sign-in code</title>");
});

test("user-supplied text is escaped in HTML and left verbatim in plain text", () => {
  const hostile = `<script>alert("x")</script> & 'q'\nnext line`;
  const { html, text } = renderEmail({ ...base, paragraphs: [hostile], details: [{ label: "<b>", value: hostile }], heading: "<h2>" }, origin);
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<h2>");
  expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;<br>next line");
  expect(text).toContain(hostile);
});

test("links are same-origin paths joined to the origin; the CTA appears in both bodies", () => {
  const { html, text } = renderEmail({ ...base, action: { label: "Complete recovery", path: "/support/recover" } }, `${origin}/`);
  expect(html).toContain(`href="${origin}/support/recover"`);
  expect(text).toContain(`Complete recovery: ${origin}/support/recover`);
  expect(() => renderEmail({ ...base, action: { label: "x", path: "//evil.example" as `/${string}` } }, origin)).toThrow();
});

test("the preheader is hidden and only present when given", () => {
  expect(renderEmail(base, origin).html).toContain("display:none");
  expect(renderEmail({ ...base, preheader: undefined }, origin).html).not.toContain("display:none");
});

test("plain text carries the heading, notes, details and the footer", () => {
  const { text } = renderEmail({ ...base, details: [{ label: "Case reference", value: "abcdef12" }], reason: "Because you asked." }, origin);
  for (const part of ["Your sign-in code", "Case reference: abcdef12", "This code expires in 5 minutes.", `Need help? Visit Support: ${origin}/support`, "Because you asked."]) expect(text).toContain(part);
});

test("no script and no copy button ever ship", () => {
  const { html } = renderEmail(base, origin);
  expect(html).not.toMatch(/<script|copy code/i);
});

test("the logo is centered and the footer is just the centered support block, with no standalone wordmark", () => {
  const { html, text } = renderEmail(base, origin);
  expect(html).toMatch(/<td align="center"><img [^>]*margin:0 auto/);
  const footer = html.slice(html.indexOf("Need help?"));
  expect(footer).not.toContain(">Neffi<");
  expect(html.match(/text-align:center[^>]*>Need help\?/g)).toHaveLength(1);
  expect(html).toContain("You&#39;re receiving this because of activity on your Neffi account.");
  expect(text.split("--\n")[1]).toBe(`Need help? Visit Support: ${origin}/support\nYou're receiving this because of activity on your Neffi account.`);
});

test("a code never appears in a subject, preheader, link or the document title", () => {
  const code = "739418";
  for (const message of [authCodeEmail(code, 5), changeEmailCodeEmail(code, 5), recoveryCodeEmail(code)]) {
    const { subject, html, text } = renderEmail(message, origin);
    const hrefs = [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map(match => match[1]);
    expect([subject, message.preheader ?? "", ...hrefs, ...(text.match(/https?:\/\/\S+/g) ?? [])].some(value => value.includes(code))).toBe(false);
    expect(html).toContain(`>${code}<`);
    expect(html.match(new RegExp(code, "g"))).toHaveLength(1);
  }
});

