// Maps the machine codes Better Auth puts in ?error= to our own wording. Only known codes are shown: anything else
// (including a provider's free-text error_description) becomes the generic message, so the URL can never inject copy.
const MESSAGES: Record<string, string> = {
  account_not_linked:
    "An account with this email already exists. Sign in with an email code, then connect Google from your account.",
  unable_to_create_user: "We could not sign you in with Google. Make sure your Google email is verified, or use an email code.",
  email_does_not_match: "That Google account uses a different email, so it cannot be connected to this account.",
  account_already_linked_to_different_user: "That Google account is already connected to another account.",
};

export const GENERIC_AUTH_ERROR = "Something went wrong signing you in. Please try again.";

export function authErrorMessage(code: unknown): string | undefined {
  if (typeof code !== "string" || code === "") return undefined;
  return MESSAGES[code] ?? GENERIC_AUTH_ERROR;
}
