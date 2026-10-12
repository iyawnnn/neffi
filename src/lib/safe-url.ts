// Customer-entered web links. Non-technical people paste "example.com", so a missing scheme becomes https://.
// Only https survives: no http, javascript:, data:, mailto: or credentials in the URL.
export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
  return url.href.length <= 2048 ? url.href : null;
}
