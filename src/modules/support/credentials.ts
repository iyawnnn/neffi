import { normalizeActivationCode } from "../activation/code";

export function containsActivationCode(body: string): boolean {
  const candidates = body.match(/(?<![a-z0-9])(?:[0-9a-tv-z]{8}|[0-9a-tv-z]{4}-[0-9a-tv-z]{4})(?![a-z0-9])/gi) ?? [];
  return candidates.some((value) => /\d/.test(value) && /[g-hj-km-np-tv-z]/i.test(value) && normalizeActivationCode(value) !== null);
}

// shortcut: space-separated or embedded codes are not detected; revisit if support starts accepting those formats.
export const containsStoredCredential = (body: string) => containsActivationCode(body) || /\b\d{8}\b/.test(body);
