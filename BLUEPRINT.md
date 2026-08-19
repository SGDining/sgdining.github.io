# SGDining — Singapore Dining Benefit Finder
## MASTER PROJECT BLUEPRINT v1.1

**Status date:** 19 August 2026 (Singapore)  
**Production site:** `https://sgdining.github.io/`  
**Primary repository:** `SGDining/sgdining.github.io`  
**Google Drive project folder:** `G:\My Drive\AI Projects and Commercialisation\SG Dining - LD-LifestyleCredit-Accor-GHA-Eatigo`

## Document purpose

This is the handover-grade technical, operational and deployment blueprint for the entire SGDining project. It is written so that a new developer, AI coding agent or future operator can take over the project without needing access to prior ChatGPT conversations.

## Source-of-truth rule

When this blueprint, README files, old conversations or old repository material disagree, inspect the current `main` branch of `SGDining/sgdining.github.io` and the latest successful GitHub Actions deployment first. Live code and validated production data are operationally authoritative. Update this blueprint after material architecture, source, credential, workflow or programme changes.

## 1. EXECUTIVE STATUS

SGDining is a public static web application that consolidates Singapore dining-benefit programmes into one searchable map and merchant list.

Current programme views:

- Love Dining (LD)
- Lifestyle Credit (LC)
- Both — LD + Lifestyle Credit
- GHA List
- Both GHA + Lifestyle Credit
- Accor List
- Both Accor + Lifestyle Credit
- Eatigo List
- Both Eatigo + Lifestyle Credit

The public site is hosted from the SGDining GitHub organisation at `https://sgdining.github.io/`.

The previous personal repository `wyattsingapore-ux/amex-sg-benefit-finder` is now **legacy only**. It is not part of the normal SGDining production data path. It may be retained temporarily for historical comparison or emergency archaeology, but production must not depend on it.

SGDining now owns:

- the front-end application;
- AMEX Love Dining/Lifestyle Credit parsers;
- GHA/Pan Pacific augmentation;
- Eatigo directory crawler;
- Eatigo current-day discount refresh;
- OneMap geocoding logic;
- Accor discovery/augmentation;
- official restaurant-link enrichment;
- validation/tests;
- all GitHub Pages deployment workflows.

## 2. PRODUCT PURPOSE

The product is designed to answer practical user questions such as:

- Which restaurants near me participate in Love Dining?
- Which merchants qualify for Lifestyle Credit?
- Which outlet is in both Love Dining and Lifestyle Credit?
- Which GHA/Pan Pacific restaurant is also an LC merchant?
- Which Accor/ALL Accor+ restaurant is also an LC merchant?
- Which Eatigo restaurants are also LC merchants?
- Which Eatigo branch has a strong remaining discount today?
- Which qualifying restaurants are within 1, 2, 5 or 10 km of my location or a Singapore place I enter?

SGDining is a discovery layer. It is not the programme owner, payment processor or booking system. Users should be sent back to the official programme/restaurant page for final verification and booking where possible.

## 3. PRODUCT PRINCIPLES

### 3.1 Official sources first
Programme membership, restaurant links, benefit descriptions and exclusions should come from official programme-owner or participating-hotel sources wherever practical.

### 3.2 No invented benefits
Do not guess programme eligibility, discount percentages, exclusions, price, booking rules or official URLs.

### 3.3 Outlet-level intersections
A brand appearing in two programmes does not automatically mean a specific outlet belongs to both. Intersections must be location-aware.

### 3.4 Conservative matching
A false positive is more damaging than a small number of false negatives. Ambiguous matches should be omitted or flagged rather than guessed.

### 3.5 Fail safely
A parser or source failure must not publish an empty or drastically truncated dataset. The current SGDining production dataset is used as the last-good fallback.

### 3.6 Mobile first
The map and filters must remain usable while a user is physically deciding where to eat.

### 3.7 Automation first
Routine data refresh and deployment should run automatically. Manual workflow dispatch is retained only for diagnostics/recovery.

### 3.8 Privacy by default
The site does not require login and should not store precise user location server-side.

## 4. PROJECT LOCATIONS AND OWNERSHIP

### 4.1 Primary GitHub organisation
Organisation: `SGDining`

### 4.2 Production repository
Repository: `SGDining/sgdining.github.io`  
Default branch: `main`  
Visibility: public  
GitHub Pages URL: `https://sgdining.github.io/`

### 4.3 Google Drive project folder
Windows-synchronised path:

`G:\My Drive\AI Projects and Commercialisation\SG Dining - LD-LifestyleCredit-Accor-GHA-Eatigo`

Drive folder ID: `1h_ffFIIShqf6fgdx1YCPmc-YcXsieEL3`

### 4.4 Legacy repository
`wyattsingapore-ux/amex-sg-benefit-finder`

Status: legacy/archive only. No production workflow in SGDining should fetch data, code or artifacts from this repository.

## 5. CURRENT PRODUCTION ARCHITECTURE

### 5.1 High-level flow

```text
Official sources
  |
  +--> AMEX Love Dining hotel page
  +--> AMEX Love Dining restaurant page
  +--> AMEX Lifestyle Credit PDF
  +--> Pan Pacific / GHA participating restaurant pages
  +--> Eatigo Singapore directory and branch pages
  +--> Accor Restaurants & Bars Singapore directory
  +--> Accor+ Singapore variations page
  |
  v
SGDining/sgdining.github.io GitHub Actions
  |
  +--> parse / normalize
  +--> outlet-level matching
  +--> geocode/cache
  +--> dynamic Eatigo offer refresh
  +--> official-link enrichment
  +--> validation + tests
  |
  v
data/merchants.json
data/eatigo_today.json
  |
  v
GitHub Pages artifact
  |
  v
https://sgdining.github.io/
```

There is **no production hop through `wyattsingapore-ux`**.

### 5.2 Application style
The public site is a static browser application using HTML, CSS, JavaScript, Leaflet, OpenStreetMap tiles and JSON generated during GitHub Actions. There is no persistent application server and no user database.

## 6. OFFICIAL DATA SOURCES

### 6.1 American Express Love Dining — Hotels
Official source:
`https://www.americanexpress.com/sg/benefits/love-dining/love-dining-hotels.html`

Used for participating hotel restaurants, name/address context and AMEX-published `Visit Website` links.

### 6.2 American Express Love Dining — Restaurants
Official source:
`https://www.americanexpress.com/sg/benefits/love-dining/love-restaurants.html`

Used for participating standalone restaurants/outlets, address context and AMEX-published `Visit Website` links.

The hotel and restaurant lists are combined into the LD programme flag.

### 6.3 American Express Lifestyle Credit
Official source PDF:
`https://www.americanexpress.com/content/dam/amex/en-sg/benefits/platinum-credit-card-fashion-dining-credit-participating-merchants.pdf`

Important implementation rule: retain outlet/location rows. Do not collapse a multi-outlet brand into one global merchant record.

### 6.4 GHA / Pan Pacific DISCOVERY
Participating restaurant source:
`https://www.panpacific.com/en/dining/pphg-fb.html`

Benefit source:
`https://www.panpacific.com/en/panpacific-discovery/benefits.html`

The UI label is `GHA List` for convenience. The underlying participating set is the Pan Pacific Hotels Group dining list under Pan Pacific DISCOVERY/GHA DISCOVERY.

Current published tier display used by SGDining:

- Silver: 10%
- Gold: 15%
- Platinum: 20%
- Titanium: 25%

These values are not permanent constants; revalidate when source terms change.

### 6.5 Eatigo
Singapore discovery source:
`https://eatigo.com/en/regions/27/search`

The crawler discovers Singapore branch records and direct branch URLs. Current-day collection then fetches remaining time/discount information used by the dynamic Eatigo UI.

### 6.6 Accor Restaurants & Bars
Official Singapore directory:
`https://restaurantsandbars.accor.com/en/singapore/singapore/map`

The visible site is JavaScript-driven. The Accor integration first attempts the official structured restaurant response. If needed, Playwright loads the official map and captures Accor’s own `SearchRestaurants` network response.

Representative fields include Accor restaurant ID, restaurant name, latitude/longitude, postal code, cuisine/food type, average price and currency.

Stable venue route:
`https://restaurantsandbars.accor.com/en/restaurant/<ACCOR_ID>`

### 6.7 ALL Accor+ Explorer variations
Official Singapore variations source:
`https://www.accorplus.com/sg/dining-benefit-variations/`

SGDining uses the ordinary published benefit metadata where applicable and maintains conservative named exclusions/variations based on the source. Do not assume the restaurant directory and benefit eligibility are identical.

## 7. REPOSITORY STRUCTURE

Key top-level files:

- `index.html` — page structure and controls
- `styles.css` — responsive visual design
- `app.js` — primary map/search/filter controller
- `program-links.js` — official venue link behaviour
- `accor-ui.js` — Accor-specific UI extension
- `requirements.txt` — Python refresh dependencies
- `BLUEPRINT.md` — repository technical blueprint
- `README.md` — shorter project introduction
- `data/` — generated/deployed JSON
- `scripts/` — source ingestion, augmentation, geocoding and validation
- `tests/` — regression tests
- `experiments/` — diagnostics/source investigations
- `.github/workflows/` — CI/CD and refresh automation

## 8. FRONT-END ARCHITECTURE

### 8.1 index.html
Responsibilities include hero/header, benefit/category selectors, merchant/street/postal search, current-location button, filter drawer, cuisine filter, nearby-place input, distance filter, Eatigo discount/time filters, result statistics, map, merchant list, sort control, disclaimer/source footer and script load order.

### 8.2 styles.css
Responsibilities include dark visual theme, desktop/mobile layout, cards, map sizing, marker/tooltip treatment, mobile filter drawer, Eatigo percentage markers and merchant-list badges.

### 8.3 app.js
Core responsibilities:

- initialise Leaflet map;
- load `data/merchants.json`;
- load `data/eatigo_today.json`;
- match LD/LC/GHA/Eatigo modes;
- text/postal/street/hotel search;
- browser geolocation;
- arbitrary Singapore place lookup;
- great-circle distance calculation;
- radius and viewport filtering;
- sorting;
- common cuisine filtering where metadata is trustworthy;
- Eatigo discount/time filtering;
- merchant-card rendering;
- Eatigo percentage markers;
- desktop hover/mobile popup behaviour.

### 8.4 program-links.js
Programme URL routing:

- LD / LD+LC -> `ld_website_url`
- GHA / GHA+LC -> `gha_website_url`
- Accor / Accor+LC -> `accor_website_url` or `accor_url`

If a verified URL exists, the map pin becomes clickable, opens the official page in a new tab and the merchant card receives a `Website` link. If no verified URL exists, retain the normal popup and do not invent a URL.

### 8.5 accor-ui.js
Current responsibilities include Accor/Accor+LC matching, badges, benefit notes, variation notices, Accor cuisine values, average-price display and Accor list hints.

Technical debt: this is layered on top of `app.js`. Long-term, move programme behaviours into a formal adapter architecture.

## 9. NORMALIZED MERCHANT DATA MODEL

Primary generated source: `data/merchants.json`

Common fields may include:

```text
id
name
brand
address
postal_code
category
lat
lng
ld
lc
gha
eatigo
accor
```

Source/matching metadata may include:

```text
ld_source
lc_section
match_note
gha_hotel
gha_source
gha_match_note
gha_tiers
eatigo_branch_id
eatigo_url
eatigo_location
eatigo_match_note
```

Official-link fields:

```text
ld_website_url
gha_website_url
accor_website_url
```

Accor fields:

```text
accor_id
accor_name
accor_source
accor_food_type
accor_average_price
accor_currency
accor_food_discount
accor_beverage_discount
accor_benefit_note
accor_variation
accor_match_note
accor_url
```

Geocoding/search fields may include:

```text
geocode_address
geocode_postal
geocode_building
geocode_road
```

The schema is intentionally additive. One physical outlet can carry multiple programme flags.

## 10. PROGRAMME INTERSECTION RULES

### 10.1 LD + Lifestyle Credit
Must be outlet/location-level. Preferred evidence order:

1. same postal/location;
2. compatible normalized restaurant/brand name;
3. grouped-PDF handling where the AMEX LC document visually spans brand/location cells.

Regression example: Prego should appear in LD+LC when current source data still supports it.

### 10.2 GHA + Lifestyle Credit
Match restaurant + property/location context against LC dining rows. Hotel context matters because restaurant names can be non-unique.

### 10.3 Eatigo + Lifestyle Credit
Use verified Eatigo branch identity and location/property evidence where available. If a name maps to multiple LC outlets and branch evidence is insufficient, omit rather than guess.

### 10.4 Accor + Lifestyle Credit
Current algorithm uses LC dining category, matching postal when available, normalized restaurant/brand/address similarity, a conservative similarity threshold and `accor_match_note` for accepted matches.

Do not loosen the threshold simply to increase intersection count.

## 11. MAP, SEARCH AND LOCATION

### 11.1 Base map
Leaflet with OpenStreetMap tiles. Default Singapore centre is approximately `1.3521, 103.8198`.

### 11.2 Current location
`Use my location` invokes browser geolocation permission. Coordinates are used client-side for distance filtering. The static app does not intentionally store user location history.

### 11.3 Arbitrary nearby location
Users can enter a mall, district, street, postal code or another Singapore place. The browser uses a public geocoding/search endpoint with Singapore scoping and sets the returned point as the distance origin.

### 11.4 Radius options
Any distance, 1 km, 2 km, 5 km and 10 km.

### 11.5 Search index
Search uses merchant/restaurant name plus available address, hotel/building, road and postal metadata.

## 12. EATIGO DYNAMIC DATA

Primary snapshot: `data/eatigo_today.json`

Representative monitoring fields:

```text
date_sg
restaurants_attempted
restaurants_with_future_slots
restaurants_mapped_with_future_slots
restaurants_with_cuisine
restaurants_with_50pct_or_better
request_errors
refresh_seconds
restaurants_per_second
workers
```

UI behaviour:

- marker shows best remaining qualifying discount;
- minimum-discount filter;
- time-window filter;
- desktop hover details;
- mobile popup/touch behaviour;
- click opens Eatigo branch page.

Users must still confirm actual booking availability on Eatigo.

## 13. DATA-PROCESSING SCRIPTS

### 13.1 scripts/refresh_data.py
Base AMEX LD/LC extraction.

### 13.2 scripts/refresh_data_fixed.py
Preferred production AMEX entry point. Includes grouped/outlet-specific LC parsing corrections.

### 13.3 scripts/augment_gha.py
Adds Pan Pacific/GHA restaurants and conservative GHA+LC intersections.

### 13.4 scripts/augment_eatigo_resilient.py
Resilient Eatigo Singapore discovery implementation.

### 13.5 scripts/augment_eatigo_resilient_v2.py
Current production wrapper/variant for robust full-directory discovery.

### 13.6 scripts/refresh_eatigo_today.py
Refreshes current-day Eatigo offers/cuisine snapshot.

### 13.7 scripts/geocode.py
OneMap build-time geocoding and cache enrichment.

Authentication order:

1. `ONEMAP_TOKEN` if supplied;
2. `ONEMAP_API_EMAIL` / `ONEMAP_API_PASSWORD`;
3. `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` aliases;
4. cache-only mode if no credential is available.

### 13.8 scripts/enrich_program_links.py
Adds conservative official links. Love Dining uses official AMEX `Visit Website` links; GHA uses official Pan Pacific venue links. No search-engine guessing.

### 13.9 scripts/augment_accor.py
Accor production augmentation.

Transport strategy:

1. attempt official structured response;
2. fallback to Playwright;
3. load official Singapore Accor map;
4. capture `SearchRestaurants` response;
5. validate plausible Singapore result count.

Processing rebuilds Accor fields, applies exclusions/variations, builds stable venue URLs, uses Accor coordinates/postal, matches LC conservatively, appends eligible Accor-only rows and verifies unique IDs.

### 13.10 scripts/validate_data.py
General data invariants.

## 14. DEPLOYMENT AND CI/CD

All production workflows live in `.github/workflows/` under `SGDining/sgdining.github.io`.

### 14.1 deploy.yml — UI/code deployment
Purpose: deploy front-end/document/data changes while preserving the current SGDining live datasets.

Triggers:

- `workflow_dispatch`;
- pushes to `main` for selected front-end/data/document paths.

Important behaviour:

- fetches current last-good datasets from `https://sgdining.github.io/` itself;
- never fetches from `wyattsingapore-ux`;
- validates merchant, mapped, Eatigo and Accor lower bounds;
- uploads a Pages artifact;
- deploys through the `github-pages` environment.

### 14.2 refresh-and-deploy.yml — complete official-source rebuild
Purpose: complete production rebuild from official sources.

Schedule:
`17 2 * * *` UTC = approximately **10:17 AM Singapore time daily**.

Also triggers when the data pipeline changes:

- `scripts/**`
- `tests/**`
- `requirements.txt`
- `.github/workflows/refresh-and-deploy.yml`

Build sequence:

1. checkout SGDining;
2. download current SGDining production data as last-good fallback;
3. seed OneMap geocode cache from current verified SGDining coordinates;
4. install Python dependencies and Chromium;
5. refresh AMEX Love Dining + Lifestyle Credit;
6. augment GHA;
7. discover full Eatigo directory;
8. geocode with OneMap when credentials exist, otherwise cache-only;
9. augment Accor;
10. enrich official links;
11. refresh today’s Eatigo offers;
12. validate counts/invariants;
13. run `validate_data.py`;
14. run pytest;
15. upload Pages artifact;
16. deploy.

Failure behaviour: if a full merchant rebuild fails, restore current SGDining live merchant data. If current Eatigo offer refresh fails, restore the previous SGDining live Eatigo snapshot where available.

### 14.3 eatigo-hourly.yml — hourly Eatigo refresh
Schedule: `23 * * * *` UTC.

Sequence:

1. checkout;
2. restore current merchant data from `https://sgdining.github.io/`;
3. validate Eatigo and Accor sets;
4. refresh `data/eatigo_today.json`;
5. validate snapshot coverage;
6. deploy.

This workflow has no dependency on the old personal repository.

### 14.4 accor-discovery.yml — diagnostic probe
Used for isolated investigation of the Accor Singapore source. It is not required for ordinary production when `augment_accor.py` is healthy.

### 14.5 Concurrency
Production Pages workflows share the `sgdining-pages` concurrency group with `cancel-in-progress: false` so routine refresh/deployment jobs are serialized rather than intentionally cancelling another production deployment.

## 15. AUTHENTICATION, CREDENTIALS AND PERMISSIONS

### 15.1 GitHub repository access
The SGDining organisation owns the production repository. Repository writes should be performed through an authorised GitHub account/app with appropriate admin/push permission.

### 15.2 GitHub Pages deployment authentication
No personal GitHub token is embedded in source.

Workflows use runtime permissions:

```text
contents: read
pages: write
id-token: write
```

Deployment uses `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages` through the `github-pages` environment and GitHub’s short-lived runtime/OIDC identity. Do not add a long-lived PAT merely to deploy Pages.

### 15.3 GITHUB_TOKEN
GitHub automatically creates `github.token` for a workflow run when needed. It is runtime-scoped and should not be hard-coded.

### 15.4 OneMap credentials
Recommended repository secrets in `SGDining/sgdining.github.io`:

```text
ONEMAP_API_EMAIL
ONEMAP_API_PASSWORD
```

Optional alternative:

```text
ONEMAP_TOKEN
```

Security rules:

- store as GitHub Actions secrets, never in JavaScript or committed files;
- authentication happens at build time;
- OneMap token must never be exposed to the public site;
- do not print passwords/tokens in logs.

Important migration note: GitHub does not expose secret values after creation, so values in the legacy repository cannot be read back and copied automatically. If SGDining does not yet contain these secrets, the workflow operates in **cache-only mode** using current verified coordinates. Add the same OneMap credentials to SGDining to support automatic geocoding of newly seen addresses.

### 15.5 Other programme credentials
AMEX, Pan Pacific/GHA, Eatigo and Accor integrations currently use public source material and do not store user/member credentials.

### 15.6 Browser geolocation
Uses the browser permission prompt. There is no SGDining account authentication.

## 16. CREDENTIAL MATRIX

| Component | Custom secret? | Mechanism | Browser exposure |
|---|---:|---|---:|
| GitHub Pages deploy | No | `pages:write` + `id-token:write` | No |
| Same-repo checkout | No | Actions runtime token | No |
| OneMap new lookups | Yes | `ONEMAP_API_EMAIL` + `ONEMAP_API_PASSWORD`, or `ONEMAP_TOKEN` | Never |
| AMEX | No | Public source | N/A |
| Pan Pacific/GHA | No | Public source | N/A |
| Eatigo | No | Public source | N/A |
| Accor | No | Public source | N/A |

## 17. VALIDATION AND SAFETY GUARDS

A source redesign should fail/fallback, not silently publish bad data.

Representative guards:

- merchant row count above a plausible floor;
- mapped row count above a plausible floor;
- LD/GHA counts must not collapse unexpectedly;
- Eatigo directory remains above 200 rows;
- Eatigo current snapshot attempts a sufficiently complete directory;
- Accor set remains above a plausible floor;
- every Accor row retains an official/source link;
- duplicate Accor IDs rejected;
- parser/invariant tests run before full deployment.

Do not weaken thresholds just to turn a failing workflow green. Diagnose the source/parser first.

## 18. LAST-GOOD FALLBACK DESIGN

Before a full refresh, SGDining downloads its own current `merchants.json`. If the new source rebuild fails, that live file is restored. Before an Eatigo current-day refresh, the workflow preserves the current SGDining Eatigo snapshot and restores it on failure where available.

**Fallback source is SGDining’s own production site, not the legacy personal repository.**

## 19. TESTING STRATEGY

Existing tests cover parser/matching behaviour. Recommended permanent categories:

1. source fixture tests;
2. normalization tests;
3. grouped AMEX PDF cases;
4. same-location intersection tests;
5. ambiguous-brand negative tests;
6. known-positive cases such as Prego;
7. GHA property-context cases;
8. Eatigo branch matching;
9. Accor captured-response fixtures;
10. duplicate-ID checks;
11. UI smoke tests;
12. mobile filter behaviour;
13. link-routing tests;
14. count sanity checks.

## 20. CURRENT VALIDATED BASELINES

Counts are operational references, not contractual constants. Recent August 2026 rollout baselines included approximately:

- 738 merchant/location rows before SGDining Accor augmentation;
- 711 mapped rows;
- 317 verified Singapore Eatigo branches;
- Love Dining link coverage 87/87;
- GHA/Pan Pacific around 17 outlets;
- Accor around 31 venues;
- Accor + Lifestyle Credit around 11 venues.

Treat the latest successful workflow output as the current count source.

## 21. OPERATIONAL RUNBOOK

### 21.1 Normal UI feature change
1. inspect current `main`;
2. modify required front-end files;
3. commit/push to `main`;
4. allow `deploy.yml` to run;
5. confirm build/deploy success;
6. verify production;
7. only then call the feature live.

### 21.2 Data parser change
1. preserve fixtures/baselines;
2. update script;
3. add regression test;
4. push;
5. `refresh-and-deploy.yml` runs because pipeline files changed;
6. inspect validation output;
7. verify known merchants/intersections.

### 21.3 Add a new programme
Identify official source, document benefit caveats, build parser/adapter, add programme flags/source metadata, define outlet-level intersection rules, add official-link behaviour, count/duplicate safeguards, regression tests, selector/filter UI and update the disclaimer/source footer and blueprint.

### 21.4 Incorrect intersection report
Inspect exact source records, determine extraction/grouping/normalization/location/similarity cause, add a regression case and fix the generic parser/matcher where practical.

### 21.5 Failed deployment
A failed Pages build normally leaves the previous successful deployment available. Diagnose the failing step before rerunning.

## 22. DISASTER RECOVERY / TAKEOVER

If chat history is lost:

1. open `SGDining/sgdining.github.io`;
2. read `BLUEPRINT.md`;
3. read `refresh-and-deploy.yml`;
4. read `eatigo-hourly.yml`;
5. read `deploy.yml`;
6. inspect latest workflow runs;
7. inspect `data/merchants.json` and `data/eatigo_today.json`;
8. inspect `app.js`, `program-links.js`, `accor-ui.js`;
9. inspect source scripts;
10. verify OneMap secrets if authenticated new-address geocoding is required;
11. run tests before material parser changes.

Do not restore the legacy `wyattsingapore-ux` dependency as the first recovery option. SGDining is designed to operate independently.

## 23. SECURITY AND PRIVACY

- No SGDining user-account database is required for core functionality.
- Browser geolocation should remain client-side except requests inherently needed by map/search services.
- Do not add analytics that records exact coordinates.
- Never commit OneMap password/token, GitHub PAT or future private API keys.
- Treat third-party structured/scraped responses as untrusted and validate schema/counts.
- Keep dependency and GitHub Action versions reasonably current.

## 24. LEGAL / ACCURACY POSITIONING

The site should continue to state that it is an unofficial community tool and is not affiliated with American Express, GHA DISCOVERY, Pan Pacific Hotels Group, Accor, ALL Accor+ Explorer or Eatigo.

Programme eligibility, participation, discounts, blackout dates and terms can change. The official programme/restaurant remains authoritative for final spending/booking decisions.

## 25. KNOWN TECHNICAL DEBT

### 25.1 Accor UI layering
`accor-ui.js` extends `app.js` rather than using a formal common programme-adapter interface.

### 25.2 README drift
README may lag production features. `BLUEPRINT.md` and live code are more authoritative until README is refreshed.

### 25.3 Source fragility
AMEX markup/PDF structure, Eatigo front end, Pan Pacific pages and Accor network calls can change.

### 25.4 Public geocoder usage
Nearby-place search depends on a public geocoding endpoint and should respect reasonable usage.

### 25.5 OneMap cache-only mode
If SGDining repository secrets are absent, existing verified coordinates continue to work, but a newly introduced address may remain unmapped until credentials are added or cache is updated.

## 26. TARGET REFACTOR ARCHITECTURE

Move toward programme adapters:

```text
loveDining
lifestyleCredit
gha
accor
eatigo
```

Each adapter should expose concepts such as `matches(row)`, label, badge, `officialUrl(row)`, `benefitNote(row)`, cuisine, price and programme-specific filters.

## 27. FUTURE PRODUCT ROADMAP

### 27.1 Price filtering
Use only source-backed price metadata. Accor already exposes average-price data and is the strongest current candidate.

### 27.2 Benefit comparison
Potentially show multiple programme badges, rank intersections and provide a `best benefit I can use here` summary.

### 27.3 Local programme profile
Allow users to select programmes/cards they have and store only in browser local storage. No login is initially necessary.

### 27.4 Analytics
If added, prefer coarse metrics such as selected programme, broad district, official-link click and device class. Do not collect precise geolocation.

### 27.5 Custom domain
The organisation-root URL is clean and functional; a custom domain can be introduced later without changing the core architecture.

## 28. MIGRATION HISTORY

### 28.1 Original transitional state
SGDining initially used the clean organisation Pages URL while AMEX/GHA/Eatigo data continued to be generated by `wyattsingapore-ux/amex-sg-benefit-finder` and mirrored into SGDining.

### 28.2 Full repository migration — 19 August 2026
The production architecture was changed so SGDining owns the complete refresh/deploy logic.

Changes:

- `deploy.yml` stopped mirroring the legacy site;
- `refresh-and-deploy.yml` rebuilds programme data directly from official sources;
- `eatigo-hourly.yml` refreshes Eatigo entirely within SGDining;
- last-good fallback comes from `sgdining.github.io` itself;
- geocode cache is seeded from SGDining’s own verified production coordinates;
- legacy personal repo is no longer a production dependency.

### 28.3 Credential caveat
GitHub secret values cannot be retrieved from the old repository after creation. OneMap secrets must therefore exist independently in the SGDining repository for authenticated geocoding of new addresses. Without them, production remains functional in cache-only geocoding mode.

## 29. TAKEOVER CHECKLIST

Before modifying production, inspect:

1. this blueprint;
2. current production site;
3. latest `main` commit;
4. latest Actions results;
5. `deploy.yml`;
6. `refresh-and-deploy.yml`;
7. `eatigo-hourly.yml`;
8. `app.js`;
9. `program-links.js`;
10. `accor-ui.js`;
11. `refresh_data_fixed.py`;
12. `augment_gha.py`;
13. `augment_eatigo_resilient_v2.py`;
14. `refresh_eatigo_today.py`;
15. `geocode.py`;
16. `augment_accor.py`;
17. `enrich_program_links.py`;
18. `validate_data.py`;
19. `tests/`.

## 30. CHANGE-LOG POLICY

For each material change, update blueprint version/date, architecture, workflow names/schedules, authentication/secrets, source URLs, programme modes, matching rules, last validated counts where useful and known risks/status.

Do not turn historical counts into hard-coded guarantees.

### v1.1 — 19 August 2026

- Converted blueprint to a complete SGDining-owned architecture.
- Removed legacy `wyattsingapore-ux` repository from the normal production path.
- Documented self-contained daily full refresh and hourly Eatigo refresh.
- Added detailed deployment, authentication, secret, fallback and recovery documentation.
- Documented OneMap cache-only behaviour and the remaining repository-secret requirement for newly seen addresses.
