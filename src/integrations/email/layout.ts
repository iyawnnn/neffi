// One shared shell for every Neffi email. Tables and inline styles only: Outlook and Gmail ignore the rest.
// All values come from the existing Snow/Ink/Vermilion tokens in globals.css.

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
  reason?: string;
};

const t = {
  page: "#F7F8FA", surface: "#FFFFFF", border: "#E5E5E5", ink: "#111113", muted: "#62646A", action: "#D6402D", link: "#C93A29",
  sans: `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`,
  mono: `ui-monospace,SFMono-Regular,Menlo,Consolas,'Roboto Mono','Liberation Mono',monospace`,
};
const DEFAULT_REASON = "You're receiving this because of activity on your Neffi account.";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const multiline = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

function url(origin: string, path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Email links must be same-origin paths");
  return `${origin.replace(/\/+$/, "")}${path}`;
}

const paragraph = (value: string) => `<p style="margin:0 0 16px;font:400 16px/24px ${t.sans};color:${t.ink}">${multiline(value)}</p>`;
const note = (value: string) => `<p style="margin:0 0 12px;font:400 14px/20px ${t.sans};color:${t.muted}">${multiline(value)}</p>`;
// One text node, so copying selects exactly the digits. The left padding balances the trailing letter-spacing.
const codeBlock = (code: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td align="center" style="padding:20px 0 20px 8px;background:${t.page};border:1px solid ${t.border};border-radius:10px;font:600 32px/40px ${t.mono};letter-spacing:8px;color:${t.ink}">${escapeHtml(code)}</td></tr></table>`;
const detailRows = (details: { label: string; value: string }[]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">${details.map(({ label, value }) => `<tr><td style="padding:0 0 12px"><div style="font:500 13px/20px ${t.sans};color:${t.muted}">${escapeHtml(label)}</div><div style="font:400 16px/24px ${t.sans};color:${t.ink};word-break:break-word">${multiline(value)}</div></td></tr>`).join("")}</table>`;
const button = (label: string, href: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta" style="margin:8px 0 24px"><tr><td align="center" bgcolor="${t.action}" style="border-radius:10px;background:${t.action}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 24px;font:600 16px/20px ${t.sans};color:#FFFFFF;text-decoration:none;border-radius:10px">${escapeHtml(label)}</a></td></tr></table>`;

export function renderEmail(message: EmailMessage, origin: string): { subject: string; text: string; html: string } {
  const support = url(origin, "/support");
  const action = message.action ? { label: message.action.label, href: url(origin, message.action.path) } : null;
  const reason = message.reason ?? DEFAULT_REASON;
  const pad = "&#847;&zwnj;&nbsp;".repeat(40);

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><title>${escapeHtml(message.subject)}</title>
<style>:root{color-scheme:light}@media (max-width:480px){.pad{padding:24px !important}.cta,.cta td,.cta a{display:block !important;width:100% !important;box-sizing:border-box}}</style></head>
<body style="margin:0;padding:0;background:${t.page}">${message.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(message.preheader)}${pad}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.page}" style="background:${t.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${t.surface};border:1px solid ${t.border};border-radius:12px"><tr><td class="pad" style="padding:32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><img src="${escapeHtml(url(origin, "/email/neffi-logo.png"))}" width="96" height="24" alt="Neffi" style="display:block;margin:0 auto;border:0;width:96px;height:24px;font:600 20px/24px ${t.sans};color:${t.ink}"></td></tr></table>
<h1 style="margin:32px 0 12px;font:600 24px/32px ${t.sans};letter-spacing:-0.2px;color:${t.ink}">${escapeHtml(message.heading)}</h1>
${message.paragraphs.map(paragraph).join("\n")}
${message.code ? codeBlock(message.code) : ""}${message.details?.length ? detailRows(message.details) : ""}${action ? button(action.label, action.href) : ""}${(message.notes ?? []).map(note).join("\n")}
<div style="margin:32px 0 24px;border-top:1px solid ${t.border};font-size:0;line-height:0">&nbsp;</div>
<p style="margin:0 0 6px;text-align:center;font:400 13px/20px ${t.sans};color:${t.muted}">Need help? <a href="${escapeHtml(support)}" style="color:${t.link};font-weight:600;text-decoration:underline">Visit Support</a></p>
<p style="margin:0;text-align:center;font:400 13px/20px ${t.sans};color:${t.muted}">${escapeHtml(reason)}</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    "Neffi",
    message.heading,
    ...message.paragraphs,
    ...(message.code ? [message.code] : []),
    ...(message.details?.length ? [message.details.map(({ label, value }) => `${label}: ${value}`).join("\n")] : []),
    ...(action ? [`${action.label}: ${action.href}`] : []),
    ...(message.notes ?? []),
    `--\nNeed help? Visit Support: ${support}\n${reason}`,
  ].join("\n\n");

  return { subject: message.subject, text, html };
}
