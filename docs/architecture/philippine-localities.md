# Philippine locality snapshot

PSA's Philippine Standard Geographic Code (PSGC) is canonical. The identity editor searches only a committed city/municipality snapshot; it never requests PSA, a location service, GPS, or barangay data in the browser.

## Import an official release

Provide the current official [PSA PSGC publication](https://psa.gov.ph/classification/psgc), with its release date. Download the publication datafile through PSA's normal access flow and export its `PSGC` sheet as **UTF-8 CSV**, preserving code strings and headers. Automated access to the download page is currently challenged by PSA; no API credential is configured in this repository. Source workbooks are git-ignored (`*.xlsx`); never place them under `public/`.

```sh
node --import tsx scripts/sync-psgc-localities.ts path/to/official-PSGC.csv https://psa.gov.ph/classification/psgc YYYY-MM-DD
```

Replace the date with the release's actual as-of date. The importer reads `10-digit PSGC`, `Geographic Name`, `Geographic Level`, and `Correspondence Code` columns. Explicit `Province` and `Region` columns are also supported. Include the full region/province hierarchy. Missing or ambiguous parent references stop the import rather than guessing a province. Nine-digit correspondence codes are used only for geographic province lookup, never to fabricate current codes.

Only City/Mun rows are emitted (not regions, provinces, sub-municipalities or barangays). The display province is resolved in this order:

- NCR entries use **Metro Manila**.
- Isabela City uses **Basilan**, per PSGC Notes A.2 (special province code, geographically in Basilan). This is the only explicit mapping.
- Otherwise the `Prov` row sharing the code's first five digits.
- HUCs, which carry their own province-level code, use the province matched by their correspondence code (for example Angeles City → Pampanga).
- Units under an unlabelled province-level parent use that parent's official name (the BARMM **Special Geographic Area** municipalities).

Display names drop PSA footnote markers (such as Lucena's `a/`) and the `(Capital)` annotation, and render `City of X` as `X City`.

Review and commit these generated files together:

- `public/data/philippine-localities.json`: `psgcCode`, `name`, `province`, `region`, `displayName`.
- `public/data/philippine-localities.source.json`: official source URL, as-of date, nationwide entry count and input SHA-256.

The current snapshot comes from the **PSGC 3Q 2026 Publication Datafile** (masterlist as of 30 September 2026, workbook SHA-256 `8aad47f84e4f6317dc4222b9fe35d36b5d71f2b74ad8f0c7622289c131dc9a59`). It holds 1,642 entries (149 cities and 1,493 municipalities), matching the publication's National Summary. Do not substitute a handpicked city list or an unverified third-party mirror.

## Enforcement and runtime

`pnpm build` first runs `scripts/check-psgc-localities.ts`, refusing a missing, malformed or incomplete snapshot/provenance manifest. Run that check independently with `node --import tsx scripts/check-psgc-localities.ts`.

The UI loads the same-origin snapshot once when opened, then filters it locally by locality and province words. Localities whose own name matches are listed before province-only matches. Failed development loads log an actionable configuration error. If loading fails, customers see "Locations are unavailable right now." with no retry control. "No locations found." is reserved for a genuine no-match search. Customers cannot create free-text locations. Existing profile location strings remain intact unless explicitly cleared or replaced by a valid selection.
