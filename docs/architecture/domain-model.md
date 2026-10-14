# Domain model

Current as of M8. Column-level detail and constraints are in the generated [ERD](../database/erd.md); this document explains the concepts and state machines.

## Entities

| Entity | Meaning | Key relationships |
|---|---|---|
| **Account** | An authenticated person. Role `customer` or `owner` | Has auth identities and sessions. Owns Cards and Profiles |
| **Purchaser** | The commercial buyer on an Order. Not an Account | Has Orders |
| **Product** | The catalog entry for a kind (`dbc`, `grc`) with a price. One active per kind | Referenced by Order Items and Cards |
| **Order** | A confirmed sale with a human number (from 1001) | Has Items, Payments, Refunds, Shipments, Activity |
| **Order Item** | A product line: quantity, price snapshot, optional agreed total; GRC lines may carry a label and review URL | Belongs to an Order. DBC Cards are reserved against it |
| **Payment / Refund** | Separate append-only money rows | Belong to an Order; may be voided |
| **Shipment** | A courier hand-off with tracking and actual courier cost | Belongs to an Order |
| **Stock Purchase** | A batch of cards received, with supplier, date and costs | Has Cards |
| **Card** | A physical card. DBC cards have a permanent token | Order Item (while sold), owner Account, Profile (routing) |
| **Activation Credential** | The one-time code record for a DBC | Belongs to a Card. HMAC only |
| **Profile** | Shared identity and appearance | Owned by an Account; has Scenes and Forms |
| **Scene / Block** | A Scene is a context view of a Profile; Blocks are its ordered content | Scene belongs to a Profile |
| **Form / Submission** | A native form and the stored messages from visitors | Belong to a Profile |
| **Expense** | A manually entered cost | Optionally linked to an Order |
| **Activity Event** | Immutable history of meaningful actions and owner notes | Linked to an Order, Card, Account or Stock Purchase |
| **Support Case** | Planned exception record (M9A) | **Schema exists (`support_cases`, `support_case_cards`, `support_case_id` on refunds, shipments and activity). No application behavior uses it yet** |

Separations that must hold: Purchaser ≠ Account; Card ownership (`owner_account_id`) ≠ Card routing (`profile_id`); DBC ≠ GRC ([0002](../decisions/0002-purchaser-account-card-profile.md)). Only DBC Cards have a token, owner, profile, disabled flag or credentials.

## State machines

**DBC Card**

```
blank ──provision, NFC check, package match──▶ ready ──reserve──▶ reserved ──release──▶ released ──(support, planned)──▶ retired
                                                ▲                    │
                                                └────return to stock─┘
blank / ready / reserved-GRC ──retire──▶ retired
```

- Ready requires `nfc_verified_at` and `package_matched_at`. Issuing a new credential clears the package match.
- Only Released cards can be claimed. A claim sets the owner; it does not change the state. A Released card may be disabled or enabled and connected to an owned Profile.
- `released` can only become `retired`. `retired` is final and routes nowhere. Retiring requires revoking any usable credential first. Today's retire action does not accept Released cards.

**Activation credential:** `unused → used` (claim) or `unused → revoked`. It never goes back. At most one is usable per Card.

**Order**

```
in_progress ──system, when eligible──▶ completed (final)
in_progress ──cancel (before DBC release or commercial delivery)──▶ cancelled (final)
```

Eligible means: at least one item; every DBC item has its full quantity Released; a delivery method is set; delivery is recorded (a courier shipment with a shipped date, or a Hand over for pickup/local, which a GRC portion also needs); and net paid equals the order total exactly.

**Payment / Refund:** recorded → voided (one way, with reason). Payments only while In Progress; refunds while In Progress or Cancelled; voids of payments while In Progress, of refunds while In Progress or Cancelled.

**Shipment:** `in_transit ⇄ delivered | failed | returned | lost` (status only; never reopens the Order).

**Profile:** `draft → published ⇄ unpublished`. Publish needs a name, one contact method (phone, email or website) and a visible Block in the Default Scene.

## Derived values (never stored)

Order total (items plus shipping fee), received, refunded, net paid, balance, Paid/Unpaid, refund due, inventory counts by state, completion eligibility, discount shown on a line, unread message count. See [money and costs](../specs/money-and-costs.md).

## Limits

10 Profiles per Account, 5 Scenes per Profile, 20 Blocks per Scene, 5 Forms per Profile, 3 custom questions per Form.
