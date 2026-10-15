import { normalizeActivationCode } from "../activation/code";

export function containsActivationCode(body: string): boolean {
  if (/[0-9a-tv-z]{16}/i.test(body.replaceAll("-", ""))) return true;
  const candidates = body.match(/(?<![a-z0-9])(?:[0-9a-tv-z][\s-]*){15}[0-9a-tv-z](?![a-z0-9])/gi) ?? [];
  return candidates.some((value) => normalizeActivationCode(value) !== null);
}

// shortcut: code-shaped filtering can reject references or long words; use a verified channel when legitimate evidence is blocked.
export const containsStoredCredential = (body: string) => containsActivationCode(body) || /\b\d{8}\b/.test(body);
