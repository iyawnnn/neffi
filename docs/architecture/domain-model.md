# Domain model

For current engineering milestone status, see [the roadmap](../roadmap.md). Column-level detail and constraints are in the generated [ERD](../database/erd.md); this document explains the concepts and state machines.

## Entities

| Entity | Meaning | Key relationships |
|---|---|---|
| **Account** | An authenticated person. Role `customer` or `owner` | Has auth identities and sessions. Owns Cards and Profiles |
| **Purchaser** | The commercial buyer on an Order. Not an Account | Has Orders |
| **Product** | The catalog entry for a kind (`dbc`, `grc`) with a price. One active per kind | Referenced by Order Items and Cards |
| **Order** | A confirmed sale with a human number (from 1001). A *normal* DBC order carries a permanent client key and payment method; other orders (GRC and historical DBC orders) do not ([orders](../specs/orders-and-fulfillment.md)) | Has Items, Payments, Refunds, Shipments, Activity |
| **Order Item** | A product line: quantity, price snapshot, optional agreed total (not on normal DBC orders); GRC lines may carry a label and review URL | Belongs to an Order. DBC Cards are allocated against it |
| **Payment / Refund** | Separate append-only money rows | Belong to an Order; may be voided |
| **Shipment** | A courier hand-off with tracking and actual courier cost | Belongs to an Order |
| **Stock Purchase** | A batch of cards received, with supplier, date and costs | Has Cards |
| **Card** | A physical card with a permanent inventory number (shown as `N-XXXX`). DBC cards have a permanent token | Order Item (while allocated or sold), owner Account, Profile (routing) |
| **Activation Credential** | The one-time code record for a DBC | Belongs to a Card. Keyed HMAC, plus an encrypted envelope while usable ([0016](../decisions/0016-retrievable-encrypted-activation-credentials.md)) |
| **Profile** | Shared identity and appearance | Owned by an Account; has Scenes and Forms |
| **Scene / Block** | A Scene is a context view of a Profile; Blocks are its ordered content | Scene belongs to a Profile |
| **Form / Submission** | A native form and the stored messages from visitors | Belong to a Profile |
| **Expense** | A manually entered cost | Optionally linked to an Order |
| **Activity Event** | Immutable history of meaningful actions and owner notes | Linked to an Order, Card, Account, Stock Purchase or Support Case |
| **Support Case** | Owner-side exception workspace | Optional Purchaser, Account and original Order; affected/replacement Cards; after-sale Refunds, support Shipments and Activity |

Separations that must hold: Purchaser ≠ Account; Card ownership (`owner_account_id`) ≠ Card routing (`profile_id`); DBC ≠ GRC ([0002](../decisions/0002-purchaser-account-card-profile.md)). Only DBC Cards have a token, owner, profile, disabled flag or credentials.

## State machines

**Card** (DBC unless a row says GRC). States: `blank`, `preparing`, `ready`, `reserved`, `released`, `retired`. This table is the canonical lifecycle; other documents link here.

| From | To | Trigger |
|---|---|---|
| blank (unused) | preparing | Allocation to a paid normal order item: issues token and credential |
| blank | ready | Provisioned stock card: NFC check, then package match |
| preparing | reserved | NFC check, then package match |
| ready | reserved | Allocation to an order item, or legacy manual reserve |
| blank (GRC) | reserved | Optional legacy GRC utility ([GRC spec](../specs/google-review-card.md)) |
| preparing | blank | Return to stock or order cancellation (token and credential kept) |
| reserved | ready | Return to stock or order cancellation |
| ready | blank | Replace credential |
| reserved | preparing | Replace credential |
| reserved | released | Hand over or ship from the Order |
| blank, ready, preparing, reserved GRC | retired | Retire |
| released | retired | Support retirement |

- **Preparing** is a DBC allocated to an order item while its physical preparation is pending. It already has its permanent token and a usable credential. NFC check plus package match moves it to Reserved.
- Allocation for an order takes Ready cards of the item's product first, then *unused* Blank cards (no token, no credential ever issued). A Blank card provisioned on its own, or returned from Preparing, keeps its token and credential and is shown as *in provisioning*; it becomes Ready stock through the NFC check and package match.
- Returning a card to stock (or cancelling its order) moves Preparing to Blank and Reserved to Ready, and unlinks the order item. Retiring a Preparing card re-runs allocation for that item.
- Ready requires `nfc_verified_at` and `package_matched_at`; Preparing → Reserved requires them and a usable credential (database guards). Issuing a new credential clears the package match.
- Only Released cards can be claimed. A claim sets the owner; it does not change the state. A Released card may be disabled or enabled and connected to an owned Profile.
- `released` can only become `retired`. `retired` is final and routes nowhere. Retiring requires revoking any usable credential first. Support retirement accepts an affected Released DBC and clears its owner, profile and disabled flag. Free replacement releases a Ready DBC against the original item, within the case allowance and item capacity.

**Activation credential:** `unused → used` (claim) or `unused → revoked`. It never goes back. At most one is usable per Card. The encrypted envelope exists only while unused and unrevoked; the database clears it on use or revocation ([0016](../decisions/0016-retrievable-encrypted-activation-credentials.md)).

**Order**

```
in_progress ──system, when eligible──▶ completed (final)
in_progress ──cancel (before DBC release or commercial delivery)──▶ cancelled (final)
```

Eligible means: at least one item; every DBC item has its full quantity Released; a delivery method is set; the shipping fee is not pending; delivery is recorded (a courier shipment with a shipped date, or a Hand over for pickup/local, which a GRC portion also needs); and settled paid (received minus sale refunds) equals the order total exactly.

**Payment / Refund:** recorded → voided (one way, with reason). Payments only while In Progress; refunds while In Progress or Cancelled; voids of payments while In Progress, of refunds while In Progress or Cancelled. An active linked Support Case adds Completed-order payment corrections and after-sale refunds/voids; sale refunds remain frozen after completion.

**Support Case:** `open ⇄ waiting_on_customer → resolved → open` (reopen). Resolved cases accept notes/reopen; controlled actions require an active case.

**Ownership correction:** a verified Support action clears a Released card’s owner/routing and issues a new credential; the former Account keeps its Profile and the permanent card URL stays unchanged.

**Shipment:** `in_transit ⇄ delivered | failed | returned | lost` (status only; never reopens the Order).

**Profile:** `draft → published ⇄ unpublished`. Publish needs a name, one contact method (phone, email or website) and a visible Block in the Default Scene. Profile appearance holds a layout (Classic, Editorial, Showcase) and a colour mode (Light, Dark), and a nullable recommendation-only Goal ([0013](../decisions/0013-universal-layouts-profile-appearance.md), [0014](../decisions/0014-guided-setup-and-goal.md)). An optional Showcase cover image (Cloudinary id, stored size and a 3:1 crop) is stored on the Profile, separately from the photo/logo ([0015](../decisions/0015-showcase-cover-image.md)).

## Derived values (never stored)

Order total (items plus shipping fee), received, refunded, net paid, balance, Paid/Unpaid, refund due, inventory counts by state, completion eligibility, discount shown on a line, unread message count. See [money and costs](../specs/money-and-costs.md).

## Limits

10 Profiles per Account, 5 Scenes per Profile, 20 Blocks per Scene, 5 Forms per Profile, 3 custom questions per Form.
