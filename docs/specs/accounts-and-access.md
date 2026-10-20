# Spec: Accounts, sign-in and access

For current engineering milestone status, see [the roadmap](../roadmap.md). Related: [0002](../decisions/0002-purchaser-account-card-profile.md).

## Purpose

Identify people securely with the least friction, and keep customer data and owner tools separate.

## Sign-in

- Methods: **Google** or a **six-digit email code**. No passwords, no SMS. A correct code both verifies the address and signs in; no separate verification email.
- Codes expire after 5 minutes, work once, allow 3 wrong attempts, and are stored as keyed hashes. Sends are limited to 3 per email per 10 minutes, 10 per email per 24 hours, 50 per IP per 24 hours and 10 per IP per minute; code submissions are limited per IP. Limits persist in PostgreSQL. App per-IP keys normalize IPv6 to /64 and mapped IPv4 to plain IPv4. Known and unknown emails get the same response.
- Sessions last 30 days and renew daily; authorization reads the current database role on every check.

## Identity rules

- The **Account** is the permanent identity, not an email string. A verified email resolves to its existing Account; a linked Google identity always resolves to its Account even if Google's email changes.
- A new Google identity that matches an existing Account's email is refused: sign in with an email code, then **Connect Google** from `/app`. A Google identity owned by another Account is refused. Google tokens are not stored.
- Different verified emails may be separate Accounts. Merging is a deferred support exception (not built).
- In `/app/account` the customer can connect or remove Google (only when another verified method remains), change the sign-in email (re-authenticated, new address confirmed by code), and sign out everywhere. Account deletion is not self-service; the page says to contact support.

## Roles and authorization

- Roles: `customer`, `owner`. New Accounts are always `customer`; the role is never accepted from the browser. Owners are set only by the guarded command `pnpm accounts:set-role <email> <owner|customer>`, which records an Activity event. Both owners have identical rights.
- `/app` requires a verified Account; `/admin` requires OWNER (non-owners get a not-found result). Every server action re-checks authorization; ownership of customer resources is checked explicitly, and OWNER does not grant access to a customer's private data through customer routes.
- Post-sign-in redirects are limited to `/app`, `/admin` and `/activate`.

## Owner view of Accounts (read-only)

Allow-listed only: email, role, created date, sign-in method kinds (`google` / `email`), owned cards (state, turned-off flag, last 4 characters of the token, connected Profile name and status), and Profile names and statuses. Never shown: form submissions, Profile content or contact fields, sessions, provider identifiers, tokens or secrets. The directory stays read-only with its unchanged DTO. Owner Account mutations are limited to audited recovery and secure actions through a linked Support Case; role grants remain operator-only.

## Non-goals (current)

OWNER MFA or step-up (revisit when the trusted 2–3-person team grows or at Production setup); Turnstile on distributed-abuse evidence; Account deletion, freeze/restriction, merge and Profile moves. Static CSP/nosniff and daily caps are enforced.

## Recovery and notices

The primary recovery path for customers who still control their current email is `/sign-in?next=/app/account` using the existing email code or linked Google, followed by **Change sign-in email** and a code to verify the new address. Both requesting and confirming the change require a session created no more than 15 minutes ago; older sessions must sign in again. No new OTP purpose or `/recover` route is added.

Change-email sends retain the 3-per-Account/10-minute limit and add 10 per Account/24 hours, 3 per target email/10 minutes and 10 per target/24 hours across Accounts. Keys are domain-separated HMACs. An occupied address receives no email and the same generic response. Successful verification updates the email and verified status, schedules notices, then revokes other active sessions while preserving the current session. A revocation failure reports that the email already changed and directs the customer to sign out everywhere; it cannot undo the change or prevent the scheduled notice.

`/support` offers self-service for a controlled inbox and support assistance for a lost inbox, plus **Already have a recovery code? Complete recovery** at `/support/recover`. Support emails a code to the approved new address, not a recovery link. Self-service email change invalidates any pending support recovery through its existing old-email snapshot check; the owner then cancels that pending recovery.

See [support](support-and-corrections.md) and [0012](../decisions/0012-support-controlled-account-recovery.md) for owner verification followed by new-inbox proof. Owner Accounts and occupied new emails are refused. Do not sign in with a proposed address before completing `/support/recover`: email-code sign-in can create another Account and block recovery. Completion keeps Account id and business records, verifies the email and revokes sessions and optional Google.

Self-service email changes notify old (captured before the Better Auth call) and new addresses. Google removal and sign-out-everywhere notify the Account. Google identity create-after notifies only when added to a pre-existing Account, never on new Google signup. Notices run via `after()` following the committed mutation, are best effort, and record Activity results. Each event has its own subject (for example "Your Neffi sign-in email was changed"), and times appear in Philippine time. They reveal neither the other address, codes nor submitted support content.
