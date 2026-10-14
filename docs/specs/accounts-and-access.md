# Spec: Accounts, sign-in and access

**Status:** implemented (M3, M6, M8). Related: [0002](../decisions/0002-purchaser-account-card-profile.md).

## Purpose

Identify people securely with the least friction, and keep customer data and owner tools separate.

## Sign-in

- Methods: **Google** or a **six-digit email code**. No passwords, no SMS. A correct code both verifies the address and signs in; no separate verification email.
- Codes expire after 5 minutes, work once, allow 3 wrong attempts, and are stored as keyed hashes. Sends are limited to 3 per email per 10 minutes and 10 per IP per minute; code submissions are limited per IP. Limits persist in PostgreSQL. Known and unknown emails get the same response.
- Sessions last 30 days and renew daily; authorization reads the current database role on every check.

## Identity rules

- The **Account** is the permanent identity, not an email string. A verified email resolves to its existing Account; a linked Google identity always resolves to its Account even if Google's email changes.
- A new Google identity that matches an existing Account's email is refused: sign in with an email code, then **Connect Google** from `/app`. A Google identity owned by another Account is refused. Google tokens are not stored.
- Different verified emails may be separate Accounts. Merging is a deferred support exception (not built, not in M9A).
- In `/app/account` the customer can connect or remove Google (only when another verified method remains), change the sign-in email (re-authenticated, new address confirmed by code), and sign out everywhere. Account deletion is not self-service; the page says to contact support.

## Roles and authorization

- Roles: `customer`, `owner`. New Accounts are always `customer`; the role is never accepted from the browser. Owners are set only by the guarded command `pnpm accounts:set-role <email> <owner|customer>`, which records an Activity event. Both owners have identical rights.
- `/app` requires a verified Account; `/admin` requires OWNER (non-owners get a not-found result). Every server action re-checks authorization; ownership of customer resources is checked explicitly, and OWNER does not grant access to a customer's private data through customer routes.
- Post-sign-in redirects are limited to `/app`, `/admin` and `/activate`.

## Owner view of Accounts (read-only)

Allow-listed only: email, role, created date, sign-in method kinds (`google` / `email`), owned cards (state, turned-off flag, last 4 characters of the token, connected Profile name and status), and Profile names and statuses. Never shown: form submissions, Profile content or contact fields, sessions, provider identifiers, tokens or secrets. No Account can be changed from the owner area.

## Non-goals (current)

OWNER MFA or step-up and CSP (M10); account deletion or restriction, account merge, Profile moves, and the account-recovery support path (deferred or **Planned: M9B**); security-notification emails.
