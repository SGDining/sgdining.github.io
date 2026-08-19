# SGDining production migration

**Completed:** 19 August 2026

SGDining was migrated from the transitional `wyattsingapore-ux/amex-sg-benefit-finder` architecture to a self-contained production architecture in `SGDining/sgdining.github.io`.

## Production dependency status

The legacy personal repository is no longer part of the normal production data or deployment path.

SGDining now owns:

- AMEX Love Dining and Lifestyle Credit refresh;
- GHA/Pan Pacific augmentation;
- full Eatigo Singapore directory discovery;
- hourly Eatigo current-day offer refresh;
- OneMap geocoding/cache logic;
- Accor discovery/augmentation;
- official venue-link enrichment;
- validation and tests;
- GitHub Pages deployment.

## Production workflows

- `.github/workflows/deploy.yml` — front-end/code deploy using SGDining's own current live datasets as last-good baseline.
- `.github/workflows/refresh-and-deploy.yml` — complete daily rebuild directly from official programme sources.
- `.github/workflows/eatigo-hourly.yml` — hourly Eatigo offer refresh using current `sgdining.github.io` production data.
- `.github/workflows/accor-discovery.yml` — Accor diagnostic probe.

## OneMap credential note

GitHub does not allow existing repository secret values to be read back after creation. Therefore OneMap credentials from the old personal repository cannot be automatically copied by migration code.

The SGDining full-refresh workflow supports two modes:

1. authenticated geocoding when `ONEMAP_API_EMAIL` and `ONEMAP_API_PASSWORD` (or `ONEMAP_TOKEN`) are present in the SGDining repository;
2. cache-only mode using verified coordinates from current SGDining production when those credentials are absent.

The legacy repository is not required in either mode.
