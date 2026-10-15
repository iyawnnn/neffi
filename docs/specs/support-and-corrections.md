# Spec: Support and corrections

**Status:** M9A merged; M9B locally implemented, acceptance pending. Related: [money and costs](money-and-costs.md), [orders](orders-and-fulfillment.md), [cards](cards-and-activation.md), [accounts](accounts-and-access.md).

## Cases

Both owners use `/admin/support`: a status-filtered queue with 25 cases per keyset page, case creation, and a case workspace. Type classifies a case; it does not grant permission for an action. A trimmed summary is required (500 characters maximum); assignment defaults to the creator and must name an owner.

Cases move between Open and Waiting on customer, then Resolved (optional resolution note); Reopen returns a resolved case to Open. Resolution sets `resolved_at`, reopening clears it. Resolved cases accept notes and reopening, while corrections, assignment and new links require an active case. Internal notes are limited to 500 characters. Every mutation updates the case and records immutable Activity with its case link.

Purchaser, Account and original Order links can each be filled once while empty and cannot be changed or cleared. Affected cards can be added, never removed. Record selectors search order numbers, names, Account emails and card suffixes; entry points prefill verified records. Account context uses the existing restricted read-only directory DTO.

## Completed-order corrections

The Order workspace remains terminal. Its **Open support case** action leads to corrections through an active case linked to that Order. Money corrections require a reason (1–200 characters) and confirmation:

- **After-sale refund:** greater than zero and no more than net cash kept. It links to the case, reduces Net paid and dated collections, and leaves settlement, Paid state, completion and balance unchanged.
- **Void after-sale refund:** only a refund belonging to this case and order. Sale refunds cannot be voided after completion.
- **Void payment:** keeps the original row and may expose **Balance due after correction**, also included in dashboard outstanding.
- **Record corrected payment:** greater than zero and capped at the current balance. It cannot overpay or add a payment to an already settled order.

Money is never deleted or rewritten beyond the one-way void metadata. Completed orders never reopen. Items, prices, shipping fee and delivery method stay locked. Methods remain cash, GCash and bank transfer; dates default to today in Asia/Manila. Sale refunds retain their M8 rules on In Progress/Cancelled orders.

## Card corrections

All card actions are DBC-only and transactional:

- **Retire affected Released card:** requires the case's original Order (In Progress or Completed), reason and confirmation. It revokes any usable credential, retires the card permanently, and clears owner, routing and disabled flag in one update. Activity preserves the former Account. The old card routes nowhere and disappears from that Account's cards.
- **Release free replacement:** uses a Ready DBC of the original item's product, with package match and usable credential. A card retired through this case provides one replacement allowance on that item; allowances cannot be reused across cases. Existing Reserved/Released cards must also remain within the item's quantity. The replacement is released directly against the original item and linked as `replacement`. There is no new Order Item, payment or price change. In Progress completion settles after replacement release. The customer claims the replacement and reconnects their Profile.
- **Issue new code:** only a linked Released, unclaimed DBC. Revoke any usable credential and issue a new one. The old credential stays revoked or used.
- **Reset ownership:** only a linked Released, claimed DBC. Clear owner, routing and disabled flag, keep the old used credential immutable, revoke any usable credential and issue a new one. The former Account keeps its Profile; no Account merge or Profile move occurs. The card remains offline until claimed and connected again.

Reissue and reset require **I verified the purchase and the requester's claim** and a verification note (1–500 characters). Notes describe the offline checks without copying identity documents or secrets. The new code is revealed once in the issuing action response for delivery outside Neffi. Copy it before closing the sheet or leaving the page. It is never stored raw, logged, placed in URLs or revalidation keys, or reconstructed on reload. Issuing it clears the package-match timestamp by the existing credential guard; claim does not depend on that timestamp. The card's permanent URL is unchanged through reset and reissue. A replacement is a different physical card with its own URL and code.

GRC replacements are a commercial case note and optional shipment, with no GRC Card workflow.

## Paid replacements and shipping exceptions

**New replacement order** opens ordinary order creation with the purchaser prefilled. Creation locks the active case first and writes `support_order_linked` Activity linking the case to the new Order. Revenue, payment and fulfillment are ordinary M8 behavior; the original order stays intact.

Support shipments require an active case linked to an In Progress or Completed order; Cancelled is refused. They record a replacement/re-send in transit, with shipped date defaulting to Manila today and optional recipient, address, courier, tracking and cost. Updates affect only that case's shipment and do not edit the shipped date. They never count toward commercial completion; courier cost appears once in Expenses. The original shipment's failed/returned/lost status is updated from its existing order workspace, including on Completed orders.

## Integrity and authorization

Every Support page requires OWNER and every action authorizes OWNER before Zod validation and service execution. Services re-read state under locks: case (`NO KEY UPDATE`) → Order (`NO KEY UPDATE`) → item (`NO KEY UPDATE`) → former-owner Account (`KEY SHARE`, if claimed) → DBC card (`UPDATE`) → credential. Reset locks the former-owner Account before Card, matching Profile setup; unclaimed reissue uses case → card → credential. Retirement/reset refuse a changed owner snapshot after locking Card. Support item locks still serialize writers but allow recovery's foreign-key checks, preventing a Card/item cycle. Nested services share the transaction through savepoints. Losers in races receive domain errors with no partial writes.

Migration `0013_support_guards` freezes refund sale/support classification, requires a nonblank reason on a support refund, and makes case-card links immutable. Existing final-order, permanent-URL, retired-routing, append-only money, one-way void and credential guards remain intact. After-sale refunds being Completed-only and replacement allowances are service rules under locks.

## Deferred

No customer portal or visible case status, Account merge, Profile move, customer deletion/restriction, inbound email, outbox, automatic retry or commerce email. OWNER MFA/step-up is deferred until team growth or Production setup; Turnstile is deferred until evidence of distributed abuse. Partial payments still have no idempotency key; balance caps and reasoned voids remain the correction path. M9A UX findings 1–9 remain deferred to the UI overhaul.

## Public intake and email (M9B)

`/support` accepts contact email, optional name (100 characters), category and message (2,000 characters), with inline privacy notice. Public intake performs no Account lookup, auto-links nothing and creates unassigned cases with null actor/opener and a category-label summary. Signed-in intake derives identity from the verified session and links a supplied Card only if owned; unknown or foreign Cards are ignored. It does not reuse owner-only `openCase` or unrestricted `linkCaseCard`.

The client UUID dedupes case creation. A honeypot silently drops bots. HMAC quotas cap 10-minute intake at 5/IP, 3/email and 100 globally, plus 20/IP per 24 hours. Per-IP keys use IPv6 /64; mapped IPv4 shares its plain IPv4 key. IP, daily IP and email quotas are charged before the global quota, so a refused source cannot exhaust it. Cleanup skips locked expired rows before the transaction; quota upserts inside it do not prune. A prior public case at the address in the previous 24 hours suppresses acknowledgement; signed-in acknowledgement is keyed on Account. The indexed query runs in the same transaction as quota upserts and insertion. Persist first, then best-effort acknowledgement; duplicate, quota and bot drops have the same public success. Ack never repeats the submitted name/message.

Reply recipient is requester email when present, otherwise the linked Account's current email, otherwise unavailable. Linking an Account does not change public contact. Replies set Waiting; resolution may send a notice. Bodies are capped at 2,000 characters and activation-code-shaped credentials are blocked server-side. Delivery uses `case-<caseId>-<kind>-<attemptId>` and exactly one result Activity per attempt, with no body or provider error. Resend uses a fresh attempt; reply/resolution bodies are re-entered because they are not stored.

## Account recovery and security (M9B)

Recovery requires an active `account_recovery` case linked to a customer Account, owner confirmation and a 10–300-character verification note without secrets. New email is lowercased and must be unused case-insensitively (N1). Live pending recovery for the Account or address requires explicit cancellation; expired rows may be cancelled during initiation. Google removal defaults on. If compromise is suspected, Secure account first.

Initiate/secure lock case → Account `FOR UPDATE`; completion looks up without locking then locks case → Account `FOR UPDATE` → recovery. Completion rechecks case, proof status/expiry/attempts, customer role, old-email snapshot and unused address. Wrong attempts return rather than throw so increments commit; the third cancels. Unique-email races roll back with the same public failure. Success verifies the new email, revokes sessions and optional Google, marks terminal completion and writes anonymous Activity while preserving business records. Pending recovery blocks resolution; resolved cases cannot complete.

Proof is HMAC-only, eight digits and valid for 24 hours. Code is emailed only to the new address, once, without a resend path; failed delivery requires cancellation and fresh initiation. Started notice goes to the old address, completion notices to both. Customers must not sign in at the proposed address beforehand: email-code signup may create an occupied Account, which recovery refuses without merging or deleting.

Intake free text and recovery/secure verification notes reject activation-shaped credentials and standalone eight-digit recovery-shaped strings before persistence. The any-16-character-run filter can also reject numeric references or long words composed of the accepted code alphabet; provide blocked evidence through the owner's verified channel without pasting codes into Neffi.

Secure account uses the same verification on any active linked customer case, revokes sessions and optionally removes Google only when verified email remains. It changes no email or business records. Recovery notices retry from saved address snapshots; secure notices target Account email rather than public contact. Notices contain only event, time, optional case reference and support guidance, never the other address, codes or submitted support text. Delivery failure never undoes committed changes. Recovery routes are dynamic and noindex.

Migration `0014` freezes intake fields on UPDATE only, with no DELETE-blocking case trigger (N2). Recovery history is immutable after terminal status and cannot be deleted. Public-data retention and full privacy/terms pages remain deferred.
