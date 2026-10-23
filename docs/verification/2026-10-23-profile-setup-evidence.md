# Profile layouts and setup implementation evidence ? 2026-10-23

This dated summary preserves reported local evidence; it is not a fresh test run or Production physical acceptance. Current implementation status belongs in [roadmap](../roadmap.md), behavior in the [profile/setup spec](../specs/profile-customization-onboarding.md).

## Traceable implementation

[PR #30](https://github.com/iyawnnn/neffi/pull/30), merged as `397707a878b305ca9118f6f20c445d396cbb0813`, completes T11?T15. Commit `bd982de1f6d95ca0954a74757e7d793c7862635e` marks layouts/setup implemented. The PR describes category-first inline Links, bounded real-renderer Look/Colours previews, Review with the product-card artwork and truthful summaries, grouped editor cleanup and no schema/dependency changes in that PR. The earlier layout/cover work is linked from its historical plan and ADRs 0013?0015.

## Reported local checks

The PR #30 verification record reports synthetic environment/PGlite checks, without shared Neon or live Cloudinary access:

- `vitest run`: 226 files / 2,432 tests passed.
- `eslint .`: zero errors; TypeScript clean; `db:check` clean.
- `next build` and `check:bundle`: passed; no server secret values in 333 public files.
- Browser sweep of setup and all layouts in both modes at 320/390/430/768/1024/1440px: no horizontal overflow or page errors reported.

These are attributed PR results at that implementation stage, not new measurements for every later commit. PR #30 also recorded a then-open Next.js upgrade requirement; subsequent [PR #31](https://github.com/iyawnnn/neffi/pull/31) upgraded the application to Next.js 16.4.2 before the recorded Production baseline. Do not read that older release-blocker note as the installed version today. No new advisory analysis was performed here.

## Limits

The PR explicitly deferred real-phone keyboard behavior, NFC tap, touch crop dragging and live Cloudinary. A browser sweep does not prove exhaustive accessibility or physical geometry. The [post-live Production record](2026-10-23-production-acceptance.md) carries subsequent auth/infrastructure results and identifies the still-unverified physical/card-dependent scenarios. Historical M11 counts must not be presented as current suite totals.
