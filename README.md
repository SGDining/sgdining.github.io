# Singapore Dining Benefit Finder

SGDining is an independent static map/search app for Singapore dining and lifestyle benefits.

Production site: `https://sgdining.github.io/`

## Current programme views

- **Love Dining (LD)** — AMEX Love Dining hotel + restaurant partner pages.
- **Lifestyle Credit (LC)** — AMEX Platinum Fashion & Dining Credit participating merchants.
- **Both — LD + Lifestyle Credit** — strict outlet/location-level intersection.
- **GHA List** — Pan Pacific Hotels Group restaurants participating in Pan Pacific DISCOVERY / GHA DISCOVERY dining savings.
- **Both GHA + Lifestyle Credit** — location-level intersection.
- **Accor List** — eligible Singapore ALL Accor+ Explorer dining venues sourced from Accor’s official restaurant directory and benefit-variation rules.
- **Both Accor + Lifestyle Credit** — conservative outlet-level intersection.
- **Eatigo List** — verified Singapore Eatigo branches with direct branch links and current-day offer data.
- **Both Eatigo + Lifestyle Credit** — conservative branch/location-level intersection.

## Production ownership

The complete production pipeline now lives in **`SGDining/sgdining.github.io`**.

The former `wyattsingapore-ux/amex-sg-benefit-finder` repository is legacy/archive only and is **not a production dependency**.

SGDining itself now performs:

- AMEX Love Dining + Lifestyle Credit refresh;
- GHA/Pan Pacific augmentation;
- full Eatigo Singapore directory discovery;
- Eatigo hourly current-day offer refresh;
- OneMap geocoding/cache handling;
- Accor discovery/augmentation;
- official venue-link enrichment;
- validation/tests;
- GitHub Pages deployment.

See **`BLUEPRINT.md`** for the complete architecture, authentication, matching, deployment, fallback and takeover documentation.

## Main data sources

- Love Dining hotels: `https://www.americanexpress.com/sg/benefits/love-dining/love-dining-hotels.html`
- Love Dining restaurants: `https://www.americanexpress.com/sg/benefits/love-dining/love-restaurants.html`
- Lifestyle Credit PDF: `https://www.americanexpress.com/content/dam/amex/en-sg/benefits/platinum-credit-card-fashion-dining-credit-participating-merchants.pdf`
- Pan Pacific DISCOVERY dining: `https://www.panpacific.com/en/dining/pphg-fb.html`
- Pan Pacific DISCOVERY benefits: `https://www.panpacific.com/en/panpacific-discovery/benefits.html`
- Eatigo Singapore: `https://eatigo.com/en/regions/27/search`
- Accor Singapore restaurants: `https://restaurantsandbars.accor.com/en/singapore/singapore/map`
- Accor+ Singapore dining variations: `https://www.accorplus.com/sg/dining-benefit-variations/`

## Automation

### Full refresh

`.github/workflows/refresh-and-deploy.yml`

Runs daily at `17 2 * * *` UTC, approximately **10:17 AM Singapore time**, and also runs when the data pipeline changes.

It rebuilds programme data directly from official sources, enriches/geocodes it, validates it, runs tests and deploys GitHub Pages.

### Eatigo hourly refresh

`.github/workflows/eatigo-hourly.yml`

Runs at `23 * * * *` UTC. It restores the current SGDining merchant directory from `sgdining.github.io`, refreshes `eatigo_today.json`, validates coverage and redeploys.

### UI/code deploy

`.github/workflows/deploy.yml`

Deploys front-end/document/data changes while preserving and validating SGDining’s own current production datasets.

## OneMap geocoding

Recommended GitHub repository secrets:

```text
ONEMAP_API_EMAIL
ONEMAP_API_PASSWORD
```

Optional alternative supported by `scripts/geocode.py`:

```text
ONEMAP_TOKEN
```

If OneMap credentials are not present, the full refresh runs in **cache-only geocoding mode**, preserving verified coordinates from current SGDining production. For newly introduced addresses to be geocoded automatically, add the OneMap credentials to this SGDining repository.

GitHub secret values cannot be read back from another repository after creation, so legacy repository secret values cannot be automatically copied by the migration code.

## GitHub Pages authentication

No long-lived PAT is required for normal Pages deployment. Workflows use GitHub Actions runtime permissions including:

```text
contents: read
pages: write
id-token: write
```

Deployment is performed with `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages` through the `github-pages` environment.

## Main files

- `index.html`, `styles.css`, `app.js` — static UI/map.
- `program-links.js` — official Love Dining/GHA/Accor venue links.
- `accor-ui.js` — Accor programme UI extension.
- `scripts/refresh_data_fixed.py` — AMEX production refresh.
- `scripts/augment_gha.py` — GHA augmentation.
- `scripts/augment_eatigo_resilient_v2.py` — full Eatigo discovery.
- `scripts/refresh_eatigo_today.py` — current-day Eatigo offers.
- `scripts/geocode.py` — OneMap geocoding/cache.
- `scripts/augment_accor.py` — Accor production augmentation.
- `scripts/enrich_program_links.py` — official venue links.
- `scripts/validate_data.py` — data invariants.
- `tests/` — regression tests.
- `BLUEPRINT.md` — complete takeover document.

## Matching policy

Intersections are conservative and outlet/location-aware. Brand-name similarity alone is not sufficient when the location cannot be resolved confidently. False positives are considered more damaging than a small number of omitted ambiguous matches.

## Disclaimer

Unofficial community tool; not affiliated with American Express, GHA DISCOVERY, Pan Pacific Hotels Group, Accor, ALL Accor+ Explorer or Eatigo. Always verify current eligibility, discounts, participating outlets, exclusions and programme/card terms before spending.
