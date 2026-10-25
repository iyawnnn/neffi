# Pre-launch physical acceptance (manual hardware)

Every check below is **MANUAL HARDWARE**. Only a person holding a real Neffi card and a real phone can mark one passed. Automated and browser checks cannot emulate an NFC tap or a printed QR, and they never count as these results. Record who ran each check, the date, the device and OS, and the card's last four token characters. Never record activation codes, OTPs or cookies.

Use a card that was provisioned against `https://getneffi.com`, passed the [NFC check and package match](../operations.md), and was released to and claimed by a test Account you control. Do not use a customer card.

| # | Check | Expected result | Result |
|---|---|---|---|
| 1 | Tap the card on a compatible iPhone (XS or later) | The banner opens `https://getneffi.com/c/<token>` | |
| 2 | Tap the card on an NFC-enabled Android phone with NFC on | The same URL opens | |
| 3 | Compare the opened page with the Account's published Profile | The correct Production profile is shown, not another Account's | |
| 4 | Scan the Sharing QR printed on the back of the card | It opens the same `/c/<token>` page as the tap | |
| 5 | Scan the Package QR on the package insert | It opens `/activate`, never a profile, and shows no code | |
| 6 | Edit the profile (for example the headline), then tap again | The edit appears with no NFC rewrite | |
| 7 | Turn the card off in `/app/cards`, then tap and scan | Both show "This Neffi isn't available right now" | |
| 8 | Turn the card back on, then tap and scan | The profile opens again | |
| 9 | Tap through a thick or metal phone case | Note the outcome per device. It is device-dependent, not a defect | |
| 10 | On a phone without NFC (or with NFC off), scan the Sharing QR | The profile opens, so sharing still works without NFC | |

Supporting software evidence lives in [the pre-launch audit](prelaunch-production-audit.md): the Sharing QR on the card page is identical to the QR symbol of the exact `/c/<token>` URL, and turning a card off makes that URL unavailable. The physical results above are still required.
