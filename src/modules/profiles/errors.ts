import type { PublishGap } from "./rules";

export type ProfileErrorCode = "not_found" | "limit_reached" | "not_ready" | "has_cards" | "default_scene" | "invalid";

// A rule refusal the customer can act on. Carries only a code (and publish gaps), never customer data.
export class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    readonly gaps: PublishGap[] = [],
  ) {
    super(code);
    this.name = "ProfileError";
  }
}
