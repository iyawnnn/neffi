# Spec: Cards, inventory and activation

**Status:** implemented through M9A. Related: [0001](../decisions/0001-permanent-card-url.md), [0004](../decisions/0004-two-qr-codes.md), [0005](../decisions/0005-activation-credentials.md), [domain model](../architecture/domain-model.md).

## Purpose

Track physical cards as the inventory unit, prepare DBCs so they are safe to sell, and let the right customer claim exactly the card in their package.

## Actors

Owner (receives stock, provisions, tests, sells, releases); customer (activates); visitor (taps a card — see [profiles and the public card](profiles-and-public-card.md)).

## Inventory

- A **Stock Purchase** records a batch (supplier, reference, date, optional purchase and inbound-shipping cost). Receiving creates N Blank cards. Quantity and state breakdown are always counted from Card rows; nobody types totals.
- Card states: Blank, Ready, Reserved, Released, Retired. Cards are never deleted once past Blank.
- A card kind is decided when it is provisioned or reserved; "Decide later" stock is allowed.

## DBC provisioning (owner, independent of any order)

1. **Provision** a Blank card: it receives a permanent random token and a first activation credential; the raw code is shown once.
2. **Write and test the tag**: the NFC value is exactly `<CARD_URL_ORIGIN>/c/<token>`; the tag stays writable. **Record the NFC check** with the address read back from the tag. The server accepts it only if it equals the card's URL exactly.
3. **Match the package**: the owner types the code printed on the label sealed with the card; the server compares it with the card's usable credential. A match makes the card **Ready**.
4. **Replace credential** (before release only): revokes the unused code, issues a new one, returns a Ready card to Blank, and requires the package match again. A used or revoked credential is never restored.

Rules: a DBC cannot be Ready without both `nfc_verified_at` and `package_matched_at` (database constraint). Issuing any new usable credential clears the package match. Physical evidence is never recorded unless the check was really performed. Cards provisioned against a development origin are engineering units and must never be sold.

## Reserve and release (from an Order — see [orders and fulfilment](orders-and-fulfillment.md))

Reserve moves specific Ready DBCs of the item's product to Reserved against an order item. A Reserved card can return to Ready. Release moves Reserved to Released and requires the package match and a still-usable credential. Retire removes a Blank, Ready or reserved-GRC card that failed or must not be sold, revoking any unused credential first. Retired is final.

## Activation (customer)

1. `/activate`: enter the code. A valid, claimable code sets a 15-minute signed `neffi_activation` cookie holding only an opaque credential reference. The raw code is never stored in the cookie, URL or logs.
2. Sign in with Google or an email code if needed.
3. **Add to my account** claims the card in one transaction: lock the Card, mark the credential used (only if still unused and unrevoked), set `owner_account_id`, record Activity. Claim creates no Profile.

Code outcomes: *invalid* (unknown), *yours* (already your card; goes to `/app`), *claimable* (unused, unrevoked, DBC, Released, no owner), *unavailable* (anything else: used elsewhere, revoked, unsold, retired). Messages are generic and reveal nothing about other Accounts. Limits: 20 checks per IP and 10 claims per Account per 10 minutes.

After a claim, `/app` shows the card under **Ready to set up** until a Profile is connected. Setup can resume without the code.

## Ownership, routing and disable

Ownership is set only by claim. Routing (`profile_id`) can be set only to a Profile of the same Account (composite foreign key, also checked in code). The customer can turn a card off and on; a turned-off card shows the generic unavailable page and keeps its Profile.

## Failure behavior

Concurrent claims: one winner, the other gets *unavailable*. A failed claim leaves the Card and credential unchanged. Closing the browser before claiming leaves the code usable.

## Non-goals (current)

No customer transfer or unclaim button; no GRC activation; no printed per-card QR; no customer-visible support flow.

## Owner corrections after release (M9A)

An active Support Case permits retirement of an affected Released DBC and a verified free replacement against its original item. Retirement clears owner and routing; the old URL remains permanently unavailable. Reissue is for a linked unclaimed Released DBC; wrong-account reset clears a claimed card's owner/routing while leaving the former Account's Profile untouched. Both require offline purchase/claim verification, confirmation and a required note; the new code is revealed once for delivery outside Neffi. Old credentials stay used or revoked, and the same card keeps its permanent URL. See [support and corrections](support-and-corrections.md).
