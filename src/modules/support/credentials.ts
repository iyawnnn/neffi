import { normalizeActivationCode } from "../activation/code";

export function containsActivationCode(body: string): boolean {
  const candidates = body.match(/(?<![a-z0-9])(?:[0-9a-tv-z]{8}|[0-9a-tv-z]{4}-[0-9a-tv-z]{4})(?![a-z0-9])/gi) ?? [];
  return candidates.some((value) => /\d/.test(value) && /[g-hj-km-np-tv-z]/i.test(value) && normalizeActivationCode(value) !== null);
}

// shortcut: bare, spaced or code-before-word credentials are allowed; revisit if recovery controls change.
export const containsStoredCredential = (body: string) => containsActivationCode(body) || /\b(?:code|otp|pin|passcode)\b[^\d\n]{0,20}\b\d{6}\b/i.test(body);
