# Post-live Production acceptance ? 2026-10-23

This is the successor to the [initial gated infrastructure record](2026-10-23-production-readiness.md). It records later evidence at deployed baseline `7a75627be4f6b1a6917f79732d33eee18ba1adfd`. It is **not full launch acceptance**. Current gate status belongs only in [roadmap](../roadmap.md); operating procedures belong in [operations](../operations.md).

## Evidence provenance

The maintainer supplied the live acceptance results below during Production readiness and the approved documentation cleanup. This documentation pass did not repeat logins, issue email, query databases, inspect provider dashboards, upload media or run a security review. Repository sources establish implementation; the initial record establishes the observed migration, while maintainer confirmations establish later live checks. Where the conversation did not retain a deployment ID or timestamp, none is invented.

The completed external review artifacts are `C:\SecurityAudits\neffi\focused-review-01\REPORT.md` and `VALIDATION-ROUND-1.md`. These local paths identify evidence provenance, not a required runtime dependency. Forwarded-IP validation used vendor documentation and observed deployment metadata, not a spoofing attack. Its conclusion applies to the observed direct Vercel ingress; a proxy/topology change requires reassessment.

## Results at the recorded baseline

| Surface | Recorded result | Evidence and limits |
|---|---|---|
| Domain / HTTPS | Passed | `https://getneffi.com` live with valid HTTPS; `https://www.getneffi.com` redirects 308 to apex. Cloudflare remains DNS provider with DNS-only Vercel routing. Vercel URL is fallback/debug only. |
| Production database isolation | Passed | Separate `neffi-production` project; project/branch/endpoint identities and restore point are in the initial record. No development data copied. Source isolation registers only the Production endpoint. |
| Initial committed migrations | Passed | 19 entries from 0000 through `0018_concerned_patch`; second run no-op; initial schema checks passed. This is carried-forward evidence, not a new database query. |
| Better Auth health / login | Passed | `/api/auth/ok`, Google OAuth login and authorized-inbox email OTP delivery/login confirmed. Google callback: `https://getneffi.com/api/auth/callback/google`. No OTP or token retained. |
| Production email sender | Passed | Maintainer triggered OTP interactively and inspected Resend: `Neffi <hello@getneffi.com>`, on verified `getneffi.com`. Runtime reads `AUTH_EMAIL_FROM`; the sandbox sender is not current Production configuration. |
| Google sign-out / session revocation | Passed | Maintainer-confirmed interactive sign-out/revocation. |
| OTP sign-out / session revocation | Passed | Maintainer-confirmed interactive sign-out/revocation. |
| Anonymous protected-route behavior | Passed | Maintainer-confirmed; streamed shells can have initial HTTP 200 while withholding protected data and returning the auth flow. Do not equate that status with authorization success. |
| Sentry delivery | Passed | Existing controlled Production event `f9789d6e686247e88286271207cbed06`; no new exception generated for documentation. |
| Processed Sentry privacy | Passed | Maintainer confirmed the processed controlled event contained no cookies, session identifiers, Authorization/sensitive headers, OTPs, activation codes, provider/auth tokens, request bodies, sensitive query parameters or SQL parameter values. This confirms that event, not every possible future event. |
| Public smoke / headers | Passed, carried forward | Maintainer reported public smoke, HTTPS and security-header checks passed; no new crawl or header request in this pass. |
| Forwarded-IP trust | Validated for observed topology | Targeted review validated Vercel replacement of trusted forwarding headers under the observed direct ingress. No Production spoofing or rate-limit test. |
| Focused security review | Completed | Zero confirmed Critical, High, Medium or Low vulnerabilities. This is a scoped review result, not a warranty or full launch approval; outstanding provider validation is separate. |

Session cookie policy and private-data boundaries are implemented and documented in [accounts and access](../specs/accounts-and-access.md) and [system architecture](../architecture/system.md#caching). Sign-out confirmation alone does not establish comprehensive authenticated cache/privacy E2E. This record does not claim that every private page/cache combination or every cookie observation was independently captured.

## Implemented versus live acceptance

The source implements three layouts, guided setup, signed photo and Showcase cover uploads, crop/reposition, replacement/removal, Publish, token-based public profiles and vCards. [Local implementation evidence](2026-10-23-profile-setup-evidence.md) is distinct from live provider and physical-card acceptance.

At this snapshot, the following remained unverified:

- Effective Cloudinary provider-side resource-type restrictions and original-asset metadata handling. Application-side signing/confirmation does not establish the complete provider policy.
- Operational confirmation that Vercel Production and Preview use distinct credentials/resources where required. Separate scoped records and the database host guard do not prove secret-value separation.
- Genuine engineering-card NFC write/read/tap and package-code match, followed by supported release and claim. No evidence may be fabricated or bypassed.
- Card-dependent Production guided setup, all layouts, photo/cover upload/crop/replace/remove, Publish/Done, real `/c/{token}`, links, Save Contact/vCard, public/privacy behavior and final physical NFC acceptance.

No customer NFC card was provisioned by these software checks. No new internal card, seed data or media was created by this documentation pass. Legal/commercial approval and other launch decisions are not implied by infrastructure or security-review completion.
