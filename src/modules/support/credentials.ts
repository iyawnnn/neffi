import { normalizeActivationCode } from "../activation/code";

export function containsActivationCode(body: string): boolean {
  const candidates = body.match(/(?<![a-z0-9])(?:[0-9a-tv-z][\s-]*){15}[0-9a-tv-z](?![a-z0-9])/gi) ?? [];
  return candidates.some((value) => normalizeActivationCode(value) !== null);
}
