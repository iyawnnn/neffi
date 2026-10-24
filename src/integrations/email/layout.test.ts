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

test("the shell has both transparent wordmarks, a real heading, the support link and a light/dark colour scheme", () => {
  const { html } = renderEmail(base, origin);
  expect(html).toContain(`class="light-logo" src="${origin}/email/neffi-wordmark-light.png"`);
  expect(html).toContain(`src="${origin}/email/neffi-wordmark-dark.png"`);
  expect(html).not.toContain("neffi-logo.png");
  expect(html.match(/alt="Neffi"/g)).toHaveLength(2);
  expect(html).toContain("<h1");
  expect(html).toContain(`href="${origin}/support"`);
  expect(html).toContain('name="color-scheme" content="light dark"');
  expect(html).toContain('name="supported-color-schemes" content="light dark"');
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
  const hidden = '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">';
  expect(renderEmail(base, origin).html).toContain(`${hidden}Use it within 5 minutes.`);
  expect(renderEmail({ ...base, preheader: undefined }, origin).html).not.toContain(hidden);
});

test("plain text carries the heading, notes, details and the footer", () => {
  const { text } = renderEmail({ ...base, details: [{ label: "Case reference", value: "abcdef12" }], reason: "Because you asked." }, origin);
  for (const part of ["Your sign-in code", "Case reference: abcdef12", "This code expires in 5 minutes.", `Need help? Visit Support: ${origin}/support`, "Because you asked."]) expect(text).toContain(part);
});

test("no script and no copy button ever ship", () => {
  const { html } = renderEmail(base, origin);
  expect(html).not.toMatch(/<script|copy code/i);
});

test("dark mode is a progressive enhancement: the dark wordmark starts hidden and only the style block reveals it", () => {
  const { html } = renderEmail(base, origin);
  expect(html).toMatch(/<div class="dark-logo" style="display:none;max-height:0;overflow:hidden;mso-hide:all"><img /);
  const media = html.slice(html.indexOf("@media (prefers-color-scheme:dark)"));
  for (const rule of [".light-logo{display:none !important}", ".dark-logo{display:block !important", ".email-surface{background:#17181B !important", ".email-heading,.email-copy,.email-link{color:#F7F7F8 !important}"]) expect(media).toContain(rule);
  expect(html).toContain("[data-ogsc] .light-logo,[data-ogsb] .light-logo{display:none !important}");
  // Inline light colours stay the fallback for clients that drop <style>.
  expect(html).toMatch(/<body class="email-page" style="margin:0;padding:0;background:#F7F8FA">/);
  expect(html).not.toContain("var(--");
});

test("on narrow screens the CTA spans the card", () => {
  const { html } = renderEmail({ ...base, action: { label: "Open inbox", path: "/app/inbox" } }, origin);
  const mobile = html.slice(html.indexOf("@media (max-width:480px)"), html.indexOf("@media (prefers-color-scheme:dark)"));
  expect(mobile).toContain(".cta{width:100% !important}.cta a{display:block !important}");
  expect(html).toContain('class="cta"');
  // An align attribute on the button table floats it, letting the next note wrap beside the CTA.
  expect(html).not.toMatch(/<table[^>]*align=/);
});

test("code emails are centred; notices and support messages read left-aligned", () => {
  expect(renderEmail(base, origin).html).toMatch(/<h1 class="email-heading" style="[^"]*text-align:center/);
  const { html } = renderEmail({ ...base, code: undefined }, origin);
  expect(html).toMatch(/<h1 class="email-heading" style="[^"]*text-align:left/);
  expect(html).not.toContain('class="email-code"');
});

test("security notes render in one escaped callout after the notes, and stay in the plain text in order", () => {
  const { html, text } = renderEmail({ ...base, securityNotes: ["Don't share <this> code.", "Second"] }, origin);
  expect(html).toMatch(/class="email-callout"[^>]*>Don&#39;t share &lt;this&gt; code\.<div[^>]*>&nbsp;<\/div>Second<\/td>/);
  expect(html.indexOf("This code expires in 5 minutes.")).toBeLessThan(html.indexOf('class="email-callout"'));
  expect(text).toContain("This code expires in 5 minutes.\n\nDon't share <this> code.\n\nSecond\n\n--");
  expect(renderEmail(base, origin).html).not.toContain('class="email-callout"');
});

test("details render as a labelled, divided region", () => {
  const { html } = renderEmail({ ...base, details: [{ label: "Case reference", value: "abcdef12" }] }, origin);
  expect(html).toMatch(/class="email-details"[^>]*>.*Case reference.*abcdef12/);
});

test("the logo is centered and the footer is just the centered support block, with no standalone wordmark", () => {
  const { html, text } = renderEmail(base, origin);
  expect(html).toMatch(/<td align="center"><img class="light-logo" [^>]*margin:0 auto/);
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

test("the hidden preheader is padded with zero-width characters only, never spaces", () => {
  const { html } = renderEmail(base, origin);
  const hidden = html.match(/mso-hide:all">Use it within 5 minutes\.([^<]*)<\/div>/)![1];
  expect(hidden).toMatch(/^(&#847;&zwnj;)+$/);
  expect(html.slice(0, html.indexOf("<table"))).not.toMatch(/&nbsp;|&#160;| /);
});

test("the preview-only dark selector reuses the real dark rules and is inert without its attribute", () => {
  const { html } = renderEmail(base, origin);
  const media = html.slice(html.indexOf("@media (prefers-color-scheme:dark){") + 35).split("}\n")[0];
  for (const rule of media.split("}").filter(Boolean)) {
    const [selectors, body] = rule.split("{");
    expect(html).toContain(`${selectors.split(",").map(s => `html[data-email-preview-theme="dark"] ${s}`).join(",")}{${body}}`);
  }
  expect(html).not.toMatch(/<html[^>]*data-email-preview-theme/);
});
