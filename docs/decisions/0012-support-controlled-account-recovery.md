# 0012 — Support-controlled recovery with new-inbox proof

**Status:** Accepted. For current engineering milestone status, see [the roadmap](../roadmap.md).

## Decision

Recovery keeps the existing Account id. An owner verifies a linked customer Account through an active recovery case, confirms the claim and records a short note. An unused new inbox receives an eight-digit HMAC-stored proof valid for 24 hours. The customer completes at `/support/recover`; only then does email change and sessions/optional Google revoke. No waiting period is added.

Completion locks case → Account `FOR UPDATE` → recovery and rechecks case, customer role, proof status/expiry/attempts, old-email snapshot and unused address. Wrong attempts commit; the third cancels. Pending recovery prevents case resolution. Terminal proof history is immutable. Owner Accounts and occupied addresses are refused without merge, deletion or Profile moves.

## Consequences

Self-service sign-in followed by **Change sign-in email** in `/app/account` is the primary recovery path when the customer still controls the current inbox; support-assisted recovery is the lost-inbox fallback. Both self-service email-change actions require a session created within 15 minutes. New-email verification succeeds before notices are scheduled and other active sessions revoked; the current verified session remains. A revoke failure leaves the email changed and the notice scheduled, with guidance to sign out everywhere. HMAC-keyed change-email quotas allow 3 sends per Account and target per 10 minutes and 10 each per 24 hours. `/support` hosts the two-way choice and links existing code holders to `/support/recover`; no new route or OTP purpose is introduced.

Do not sign in with the proposed address before completing: email OTP signup can create an Account that blocks recovery. Secure the Account first if compromise is suspected. Code delivery has no resend; cancel and re-initiate after failure. Old-address start notices and both-address completion notices reveal neither the other address nor codes. Activation codes are never emailed.

Owner MFA/step-up, a waiting period, Account restrictions and retention/deletion policy remain later decisions. There is no outbox or automatic retry. Live acceptance requires a verified Resend domain and two inboxes; shared migrations, Preview and integration have explicit approval gates.
