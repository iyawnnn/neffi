// One shared shell for every Neffi email. Tables and inline styles only: Outlook and Gmail ignore the rest.
// Light values come from the Snow/Ink/Vermilion tokens in globals.css. Dark mode is a progressive enhancement in
// the <style> block; the inline light styles stay the fallback for clients that drop it.

export type EmailMessage = {
  subject: string;
  preheader?: string;
  heading: string;
  // Escaped on output, so owner and visitor text is safe here. "\n" becomes a line break.
  paragraphs: string[];
  code?: string;
  details?: { label: string; value: string }[];
  action?: { label: string; path: `/${string}` };
  notes?: string[];
  // Shown in a quiet callout after the notes, for copy the recipient must not miss.
  securityNotes?: string[];
  reason?: string;
};

const t = {
  page: "#F7F8FA", surface: "#FFFFFF", raised: "#F7F8FA", border: "#E4E6EA", ink: "#111113", muted: "#62646A", action: "#D6402D", link: "#C93A29",
  sans: `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`,
  mono: `ui-monospace,SFMono-Regular,Menlo,Consolas,'Roboto Mono','Liberation Mono',monospace`,
};
const dark = { page: "#0D0E10", surface: "#17181B", raised: "#1D1F22", border: "#2B2D31", ink: "#F7F7F8", muted: "#A5A7AC" };
const DEFAULT_REASON = "You're receiving this because of activity on your Neffi account.";

const darkRules = [
  `.email-page{background:${dark.page} !important}`,
  `.email-surface{background:${dark.surface} !important;border-color:${dark.border} !important}`,
  `.email-heading,.email-copy,.email-link{color:${dark.ink} !important}`,
  `.email-muted{color:${dark.muted} !important}`,
  `.email-code,.email-callout{background:${dark.raised} !important;border-color:${dark.border} !important;color:${dark.ink} !important}`,
  `.email-details,.email-details td,.email-divider{border-color:${dark.border} !important}`,
  `.light-logo{display:none !important}`,
  `.dark-logo{display:block !important;max-height:none !important;overflow:visible !important}`,
];
const scoped = (prefixes: string[]) => darkRules.map(rule => rule.replace(/^[^{]+/, selectors => selectors.split(",").flatMap(s => prefixes.map(prefix => `${prefix} ${s}`)).join(",")));
// Only /dev/email-preview sets this attribute, so sent email never matches it.
export const PREVIEW_THEME_ATTRIBUTE = "data-email-preview-theme";
// Outlook.com marks the containers it recolours with data-ogsc/data-ogsb instead of honouring the media query.
const styles = `:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (max-width:480px){.shell{padding:16px 12px !important}.pad{padding:28px 20px !important}.cta{width:100% !important}.cta a{display:block !important}.email-code{font-size:30px !important;letter-spacing:6px !important}}
@media (prefers-color-scheme:dark){${darkRules.join("")}}
${scoped(["[data-ogsc]", "[data-ogsb]"]).join("")}
${scoped([`html[${PREVIEW_THEME_ATTRIBUTE}="dark"]`]).join("")}`;

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const multiline = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

function url(origin: string, path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Email links must be same-origin paths");
  return `${origin.replace(/\/+$/, "")}${path}`;
}

type Align = "left" | "center";
const table = (style: string, rows: string, attrs = "") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${attrs} style="${style}">${rows}</table>`;
const heading = (value: string, align: Align) => `<h1 class="email-heading" style="margin:28px 0 12px;text-align:${align};font:700 24px/32px ${t.sans};letter-spacing:-0.3px;color:${t.ink}">${escapeHtml(value)}</h1>`;
const paragraph = (value: string, align: Align) => `<p class="email-copy" style="margin:0 0 16px;text-align:${align};font:400 16px/24px ${t.sans};color:${t.ink}">${multiline(value)}</p>`;
const note = (value: string, align: Align) => `<p class="email-muted" style="margin:0 0 12px;text-align:${align};font:400 14px/20px ${t.sans};color:${t.muted}">${multiline(value)}</p>`;
// One text node, so copying selects exactly the digits. The left padding balances the trailing letter-spacing.
const codeBlock = (code: string) => table("margin:8px 0 16px", `<tr><td align="center" class="email-code" bgcolor="${t.raised}" style="padding:24px 0 24px 8px;background:${t.raised};border:1px solid ${t.border};border-radius:12px;font:600 36px/44px ${t.mono};letter-spacing:8px;color:${t.ink}">${escapeHtml(code)}</td></tr>`);
const detailRows = (details: { label: string; value: string }[]) => table(`margin:8px 0 24px;border-top:1px solid ${t.border}`, details.map(({ label, value }) => `<tr><td style="padding:14px 0;border-bottom:1px solid ${t.border}"><div class="email-muted" style="margin:0 0 2px;font:500 13px/20px ${t.sans};color:${t.muted}">${escapeHtml(label)}</div><div class="email-copy" style="font:400 16px/24px ${t.sans};color:${t.ink};word-break:break-word">${multiline(value)}</div></td></tr>`).join(""), ' class="email-details"');
// Aligned by the wrapping cell, not the table's align attribute: that floats the table and lets the next note wrap beside it.
const button = (label: string, href: string, align: Align) => table("margin:8px 0 24px", `<tr><td align="${align}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta"><tr><td align="center" bgcolor="${t.action}" class="email-button" style="border-radius:10px;background:${t.action}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 28px;font:600 16px/20px ${t.sans};color:#FFFFFF;text-decoration:none;border-radius:10px">${escapeHtml(label)}</a></td></tr></table></td></tr>`);
const callout = (notes: string[]) => table("margin:8px 0", `<tr><td class="email-callout" bgcolor="${t.raised}" style="padding:16px 18px;background:${t.raised};border:1px solid ${t.border};border-radius:10px;font:400 14px/21px ${t.sans};color:${t.ink}">${notes.map(multiline).join('<div style="height:8px;line-height:8px;font-size:0">&nbsp;</div>')}</td></tr>`);
// The dark wordmark starts hidden (mso-hide for desktop Outlook) and is revealed only by the dark-mode rules.
const logo = (origin: string) => `<td align="center"><img class="light-logo" src="${escapeHtml(url(origin, "/email/neffi-wordmark-light.png"))}" width="103" height="40" alt="Neffi" style="display:block;margin:0 auto;border:0;width:103px;height:40px;font:700 20px/40px ${t.sans};color:${t.ink}"><div class="dark-logo" style="display:none;max-height:0;overflow:hidden;mso-hide:all"><img src="${escapeHtml(url(origin, "/email/neffi-wordmark-dark.png"))}" width="103" height="40" alt="Neffi" style="display:block;margin:0 auto;border:0;width:103px;height:40px"></div></td>`;

export function renderEmail(message: EmailMessage, origin: string): { subject: string; text: string; html: string } {
  const support = url(origin, "/support");
  const action = message.action ? { label: message.action.label, href: url(origin, message.action.path) } : null;
  const reason = message.reason ?? DEFAULT_REASON;
  // Zero-width filler only: keeps the client from pulling body text into the snippet. Spaces here surfaced as
  // a visible indent in Gmail iOS notifications.
  const pad = "&#847;&zwnj;".repeat(50);
  // Code emails are short and centred on the code, with their notes directly under it; everything else reads left-aligned.
  const align: Align = message.code ? "center" : "left";
  const notes = (message.notes ?? []).map(value => note(value, align)).join("\n");
  const securityNotes = message.securityNotes ?? [];

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><title>${escapeHtml(message.subject)}</title>
<style>${styles}</style></head>
<body class="email-page" style="margin:0;padding:0;background:${t.page}">${message.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(message.preheader)}${pad}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.page}" class="email-page" style="background:${t.page}"><tr><td align="center" class="shell" style="padding:32px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.surface}" class="email-surface" style="max-width:560px;background:${t.surface};border:1px solid ${t.border};border-radius:16px"><tr><td class="pad" style="padding:40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${logo(origin)}</tr></table>
${heading(message.heading, align)}
${message.paragraphs.map(value => paragraph(value, align)).join("\n")}
${message.code ? codeBlock(message.code) + notes : ""}${message.details?.length ? detailRows(message.details) : ""}${action ? button(action.label, action.href, align) : ""}${message.code ? "" : notes}${securityNotes.length ? callout(securityNotes) : ""}
<div class="email-divider" style="margin:32px 0 24px;border-top:1px solid ${t.border};font-size:0;line-height:0">&nbsp;</div>
<p class="email-muted" style="margin:0 0 6px;text-align:center;font:400 13px/20px ${t.sans};color:${t.muted}">Need help? <a href="${escapeHtml(support)}" class="email-link" style="color:${t.link};font-weight:600;text-decoration:underline">Visit Support</a></p>
<p class="email-muted" style="margin:0;text-align:center;font:400 12px/18px ${t.sans};color:${t.muted}">${escapeHtml(reason)}</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    "Neffi",
    message.heading,
    ...message.paragraphs,
    ...(message.code ? [message.code] : []),
    ...(message.details?.length ? [message.details.map(({ label, value }) => `${label}: ${value}`).join("\n")] : []),
    ...(action ? [`${action.label}: ${action.href}`] : []),
    ...(message.notes ?? []),
    ...securityNotes,
    `--\nNeed help? Visit Support: ${support}\n${reason}`,
  ].join("\n\n");

  return { subject: message.subject, text, html };
}
