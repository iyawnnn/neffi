import type { ViewIdentity } from "./scene-view";

// RFC 2426 text escaping. Phone, email and https URL values are already validated and are not text-typed.
const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/([,;])/g, "\\$1");
const encoder = new TextEncoder();

// Lines longer than 75 octets continue on the next line after CRLF + space; never split inside a character.
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (parts.length ? 74 : 75)) { parts.push(current); current = ""; bytes = 0; }
    current += char;
    bytes += size;
  }
  return [...parts, current].join("\r\n ");
}

// Save contact: built only from the public identity a visitor already sees; never Account or sign-in data.
export function buildVCard(identity: ViewIdentity): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${text(identity.fullName)}`, `N:;${text(identity.fullName)};;;`];
  if (identity.company) lines.push(`ORG:${text(identity.company)}`);
  if (identity.headline) lines.push(`TITLE:${text(identity.headline)}`);
  if (identity.phone) lines.push(`TEL;TYPE=CELL:${identity.phone}`);
  if (identity.email) lines.push(`EMAIL;TYPE=INTERNET:${identity.email}`);
  if (identity.website) lines.push(`URL:${identity.website}`);
  lines.push("END:VCARD");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function vCardFilename(fullName: string): string {
  const ascii = fullName.normalize("NFKD").replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `${ascii || "contact"}.vcf`;
}
