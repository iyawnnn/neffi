# Pre-launch human operations acceptance

A person performs every step: one Neffi owner and one "customer" (a person with their own Google account and phone). This is not an automated test. Only mark PASS for a step you actually did and saw. Record device, OS and browser in the notes.

**Ground rules.** No SQL, no database console, no dev commands, no external QR generator. The only tools outside Neffi are the NFC-writing app (for example NFC Tools) and the sticker printer. Never write an activation code, sign-in code or cookie into these notes. Use one real card and package that you will treat as an engineering unit unless you deliberately sell it afterwards.

**Before you start.**

| Prerequisite | How to confirm | PASS / FAIL |
|---|---|---|
| The build that includes the **Sharing QR on `/admin/inventory/cards/{id}`** is deployed to Production | Open any provisioned DBC on `/admin/inventory/cards/{id}`: a "Sharing QR" block with "Download QR (SVG)" is visible | |
| Your owner account opens the owner area | Sign in at `https://getneffi.com/sign-in`, open `/admin`: the dashboard loads, not "not found". Owner access is granted once, before launch, by the operator (see [operations](../operations.md)); it is not part of fulfilling an order | |
| A Digital Business Card product with the launch price exists | `/admin/settings` → Products & Pricing shows a Digital Business Card price (₱799 per locked pricing) | |
| The printed common package insert is on hand | The insert carries the one shared Package QR for `https://getneffi.com/activate` | |

## Owner provisioning

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 1 | `/admin/inventory` | Click **Receive stock**, set date and quantity (for example 1), Intended product **Digital Business Card**, then **Receive stock** | "Received 1 cards." and a **View stock purchase** link | |
| 2 | Stock purchase page → the new card | Open the Blank card | Card page shows "Blank" and the **Provision this card** next step | |
| 3 | `/admin/inventory/cards/{id}` | Click **Provision Digital Business Card**, then confirm **Provision card** | A box titled **Activation code — shown once** shows a code in `XXXX-XXXX` form with **Copy activation code**, plus the card URL `https://getneffi.com/c/…` | |
| 4 | Same box | Write or print the activation code onto the package's private code sticker **now**. Do not reload first | The code is on the sticker. It exists nowhere else visible | |
| 5 | Same page | Reload the page | The code is no longer shown anywhere. Progress shows "Card provisioned: Complete" and the next steps "Pending" | |
| 6 | Same page → Card details | Find **Card URL** and the **Copy URL** button | The URL is exactly `https://getneffi.com/c/` followed by 26 characters | |

## NFC writing

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 7 | Card page → **Physical NFC check** | Tap **Copy URL**. In NFC Tools: Write → Add a record → URL → paste → Write to the physical card. Do **not** lock the tag | NFC Tools reports a successful write | |
| 8 | NFC Tools | Read the card | The read-back URL is identical to the Card URL | |
| 9 | Phone | Tap the card on a phone (NFC on) | The phone offers to open `https://getneffi.com/c/…`. It shows "This Neffi isn't available right now", which is correct before sale | |
| 10 | Card page → NFC form | Paste the read-back URL, tick the three confirmations, click **Confirm NFC check** | "NFC check recorded." Progress: "NFC written/tested: Complete". The next step changes to **Match the activation package** | |

## Sharing QR printing

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 11 | Card page → Card details → **Sharing QR** | Click **Download QR (SVG)** | A file named `neffi-sharing-qr-<the same 26 characters>.svg` downloads | |
| 12 | Phone camera | Scan the QR shown on screen (or the downloaded file) | It opens the same `https://getneffi.com/c/…` URL as the NFC tag, never `/activate` | |
| 13 | Sticker printer | Print the SVG as the card-back sticker and apply it to the **same** card | The printed sticker scans to the same URL | |

## Packaging

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 14 | Physical | Put the card, the common insert (Package QR) and the private activation-code sticker from step 4 in one package | Exactly one card and its own code sticker in the package | |
| 15 | Phone camera | Scan the Package QR on the insert | It opens `https://getneffi.com/activate` and shows no code, card or profile | |

## Package verification

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 16 | Card page → **Match the activation package** | Type the code from the sticker **in the package**, click **Match package** | "Package matched. The card is Ready." | |
| 17 | Same | (Negative, optional on a second card) Type a wrong code | Refused; the card stays not Ready | |

## Ready inventory

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 18 | Card page | Review progress | Provisioned, NFC, package match and **Ready for sale** are all Complete. Credential: "One unused credential" | |
| 19 | `/admin/inventory` | Filter or look for Ready DBCs | The card is counted as Ready | |
| 20 | Phone | Tap the card | Still "This Neffi isn't available right now" (not yet released) | |

## Order / release

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 21 | `/admin/orders/new` | **New order**: purchaser name, one Digital Business Card item, delivery method, shipping fee; tick **Paid now** if the test payment was received; **Create order** | Order page opens with the order number | |
| 22 | Order page | If not paid at creation: **Record payment** for the full total | The balance shows as settled | |
| 23 | Order page → DBC item | Choose the Ready card and click **Reserve selected DBCs** | The card shows as Reserved on the order and on its card page | |
| 24 | Customer `/activate` (customer's phone) | Before release, try the code | "This code can't be used…" (activation is not possible before release) | |
| 25 | Order page | **Record handover** (pickup or local) or **Record shipment** (courier, with tracking) | The card becomes Released. Once paid and released, the order completes itself | |

## Customer Google sign-in

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 26 | Customer phone: scan the Package QR → `/activate` | Enter the code from the package sticker → **Continue** | "Code accepted", with sign-in options | |
| 27 | Same | **Continue with Google**, choose the customer's Google account | Returns to Neffi at "Add this Neffi to your account" showing the customer's email | |

## Activation

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 28 | `/activate` | Click **Add to my account** | Guided setup opens at `/app/setup/{card}` ("1 of 7") | |
| 29 | `/activate` (any browser) | Enter the same code again | Owner of the card is taken to `/app`; anyone else sees "This code can't be used…" | |
| 30 | `/admin/inventory/cards/{id}` (owner) | Look at Card details | Owning Account shows the customer's email | |

## Real photo upload

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 31 | Setup step **Add a photo or logo** | **Choose image**, pick a real JPG/PNG/HEIC under 5 MB from the phone, adjust the crop, continue | Preview shows the photo; no error | |
| 32 | Later: profile hub → Appearance (Showcase only) | Add a cover image, then replace it, then remove it | Each change shows correctly; removal falls back to the accent band | |

## Profile setup / publish

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 33 | Setup: You → Contact → Links → Look → Style | Fill a real name; at least one contact method; add one link; pick a layout and colours, pressing **Continue** each time | Each step saves; **Back** keeps saved values | |
| 34 | Setup: **Review your Neffi** | Click **Publish** | "Your Neffi is live" with **View your page** | |
| 35 | View your page | Check the public page | Shows only what was entered. The Google sign-in email appears only if it was chosen as the public email. **Save contact** downloads a contact card | |

## iPhone NFC

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 36 | iPhone (XS or later), signed out of Neffi | Tap the card near the top of the phone | The banner opens the customer's published profile | |

## Android NFC

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 37 | Android, NFC on, signed out | Tap the card on the back of the phone | The same published profile opens | |
| 38 | Any phone with a thick or metal case | Tap through the case | Note the result per device; this is device-dependent | |

## Sharing QR

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 39 | Any phone camera | Scan the printed sticker on the card back | The same published profile as the tap | |
| 40 | Customer `/app/cards/{id}` | Compare the on-screen Sharing QR and **Download QR code** with the sticker | All open the same profile | |

## Card off / on

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 41 | Customer `/app/cards/{id}` | Switch the card off, confirm **Turn off card**, save | The card shows as off | |
| 42 | Phones | Tap the card and scan the sticker | Both show "This Neffi isn't available right now" | |
| 43 | Customer `/app/cards/{id}` | Switch the card on and save; tap and scan again | The profile opens again | |

## Profile edit without rewriting card

| # | Page / route | Action | Expected result | PASS / FAIL |
|---|---|---|---|---|
| 44 | Customer profile hub → Your details | Change the headline, **Save** | Saved | |
| 45 | Phones | Tap the card and scan the sticker (no NFC write) | The new headline shows | |
| 46 | Owner card page | Check the Card URL | Unchanged from step 6 | |

Sign-off: owner ________ customer ________ date ________
