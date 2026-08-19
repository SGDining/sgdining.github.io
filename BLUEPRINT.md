# SGDining — Singapore Dining Benefit Finder
## Project Blueprint v1.0

**Status date:** 19 August 2026 (Singapore time)  
**Primary production URL:** https://sgdining.github.io/  
**Primary repository:** `SGDining/sgdining.github.io`  
**Legacy/upstream data repository:** `wyattsingapore-ux/amex-sg-benefit-finder`  
**Project type:** Public, static, map-based Singapore dining-benefit discovery tool  
**Operating model:** Automated data ingestion + conservative programme intersection + GitHub Pages deployment

---

# 1. Purpose and product vision

SGDining is an independent Singapore dining-benefit finder designed to answer a practical question:

> “Which restaurants near me participate in the dining programmes/credits I have, and which restaurants let me stack or combine useful programme eligibility?”

The product consolidates several otherwise separate merchant/restaurant lists into a single searchable map and merchant list. It is intentionally conservative: an intersection such as `Love Dining + Lifestyle Credit` should only appear when the outlet/location can be matched with sufficient confidence. The system should prefer omitting an uncertain intersection over displaying a false positive.

The public product is not intended to replace the source programme websites. It acts as a discovery layer and sends users back to official merchant/programme pages for confirmation and, where possible, booking.

Core design principles:

1. **Official sources first.** Programme membership and venue links should come from the programme owner or an official participating-hotel source whenever possible.
2. **No invented benefits.** Do not infer eligibility, discount rates, booking rules or website URLs from search results when the programme source does not provide enough evidence.
3. **Outlet-level matching.** Intersections should be location-specific, not merely brand-level.
4. **Fail safely.** A source parser failure must not silently publish a severely truncated dataset.
5. **Mobile first.** The map must be usable on a phone while the user is deciding where to eat.
6. **Automate repetitive work.** Source refresh, Eatigo offer refresh, enrichment, validation and Pages deployment should run without manual workflow reruns.
7. **Keep source attribution visible.** Users should be able to reach official programme and venue pages easily.

---

# 2. Current production feature set

The production benefit selector currently contains these modes:

1. **Love Dining (LD)**
2. **Lifestyle Credit (LC)**
3. **Both — LD + Lifestyle Credit**
4. **GHA List**
5. **Both GHA + Lifestyle Credit**
6. **Accor List**
7. **Both Accor + Lifestyle Credit**
8. **Eatigo List**
9. **Both Eatigo + Lifestyle Credit**

The UI also provides:

- merchant / hotel / street / postal-code search;
- dining/fashion category selection where relevant;
- current-location support using browser geolocation;
- arbitrary Singapore place lookup, e.g. `Bedok Mall`, `Orchard`, or a postal code;
- distance filters of 1 km, 2 km, 5 km and 10 km;
- sort by A–Z or nearest;
- map-viewport-only filtering;
- cuisine filtering when reliable source cuisine metadata exists;
- Eatigo-specific minimum-discount and time-window filters;
- mobile filter drawer / bottom-sheet behaviour;
- clickable official programme/venue links on merchant cards;
- clickable map pins for programme venue pages where a verified official URL exists;
- clickable Eatigo percentage pins that open the corresponding Eatigo branch page.

---

# 3. Current validated production baseline

The following is the latest validated reference state as of 19 August 2026. Counts can change when programme owners change their lists, so these are operational baselines rather than permanent constants.

## 3.1 Main mirrored dataset

Recent validated production runs in the upstream repository contained approximately:

- **738 merchant/location rows before SGDining Accor augmentation**;
- **711 mapped rows**;
- **317 verified Singapore Eatigo branches**.

## 3.2 Love Dining

- Love Dining combines the AMEX Love Dining hotel and restaurant pages.
- Current SGDining link enrichment verified **87/87 Love Dining rows with official AMEX-published “Visit Website” links**.
- The website link comes from AMEX. SGDining does not guess a venue URL.

## 3.3 GHA / Pan Pacific DISCOVERY

- Current verified Singapore GHA/Pan Pacific participating set: **17 outlets**.
- Official venue/source links: **17/17**.
- Published tier display currently used by SGDining:
  - Silver: 10%
  - Gold: 15%
  - Platinum: 20%
  - Titanium: 25%

Always retain the disclaimer that programme terms and exclusions can change.

## 3.4 Eatigo

- Current verified Singapore Eatigo directory baseline: **317 branches**.
- A separate `eatigo_today.json` snapshot stores same-day remaining offer times, percentages and cuisines.
- Production percentage pins display the best remaining matching discount for the selected time filter.
- The snapshot is refreshed regularly by automation; users must still confirm/book on Eatigo.

## 3.5 ALL Accor+ Explorer

Latest successful production validation:

- Official Accor Singapore directory rows discovered: **31**.
- Current directory rows excluded by published Accor+ Singapore rules in that run: **JAAN By Kirk Westaway (1)**.
- Eligible directory rows after that exclusion: **30**.
- Additional explicit variation venue promoted from existing merchant data: **Wooloomooloo Steakhouse (1)**.
- Final **Accor List: 31 venues**.
- **Both Accor + Lifestyle Credit: 11 venues**.
- Official/source links: **31/31**.
- Accor restaurant IDs: **30/30 unique** where an Accor restaurant ID is available.

Validated Accor + Lifestyle Credit intersection names in that run:

- ANTI:DOTE
- ASIAN MARKET CAFE
- CLOVE
- MADISON'S
- MOGA
- PREGO
- RACINES
- SKAI
- THE EIGHT
- The Stamford Brasserie
- Wooloomooloo Steakhouse

The Accor directory also exposes cuisine/style and average-price metadata. This creates a trustworthy path for a future price-range filter; price should not be fabricated for other programmes that do not provide comparable data.

---

# 4. Official data sources

## 4.1 American Express Love Dining — Hotels

Official source:

`https://www.americanexpress.com/sg/benefits/love-dining/love-dining-hotels.html`

Used for:

- participating hotel restaurants;
- venue/address information;
- official `Visit Website` links.

## 4.2 American Express Love Dining — Restaurants

Official source:

`https://www.americanexpress.com/sg/benefits/love-dining/love-restaurants.html`

Used for:

- participating standalone restaurant outlets;
- outlet/address information;
- official `Visit Website` links.

The two Love Dining sources are merged into a single `ld` programme flag in the normalized merchant dataset.

## 4.3 American Express Lifestyle Credit

Official source PDF:

`https://www.americanexpress.com/content/dam/amex/en-sg/benefits/platinum-credit-card-fashion-dining-credit-participating-merchants.pdf`

The parser keeps outlet/location records rather than collapsing every brand into one row. This is necessary for correct intersections.

A historically validated extraction baseline contained 363 outlet/location entries, split between fashion and dining. Treat that as a regression reference, not a permanent source count.

## 4.4 Pan Pacific DISCOVERY / GHA

Participating restaurant source:

`https://www.panpacific.com/en/dining/pphg-fb.html`

Benefit details:

`https://www.panpacific.com/en/panpacific-discovery/benefits.html`

SGDining calls this view `GHA List` for user convenience, while the participating restaurant source is Pan Pacific Hotels Group and the membership programme is Pan Pacific DISCOVERY / GHA DISCOVERY.

## 4.5 Eatigo

Singapore directory source:

`https://eatigo.com/en/regions/27/search`

The directory crawler discovers branch IDs, restaurant names, Singapore location data and direct branch URLs.

Today-offer collection opens/fetches the individual branch information necessary to populate `eatigo_today.json` with current remaining slots, discounts and cuisine metadata.

## 4.6 Accor Restaurants & Bars

Official Singapore map/directory:

`https://restaurantsandbars.accor.com/en/singapore/singapore/map`

The visible web page is JavaScript-driven. The implementation captures Accor's own `SearchRestaurants` structured response. The current feed supplies fields including:

- Accor restaurant ID;
- restaurant name;
- latitude / longitude;
- postal code;
- food/cuisine type;
- average price;
- currency.

A stable venue route is constructed from the official restaurant ID:

`https://restaurantsandbars.accor.com/en/restaurant/<ACCOR_ID>`

## 4.7 ALL Accor+ Explorer variations/exclusions

Official Singapore variations page:

`https://www.accorplus.com/sg/dining-benefit-variations/`

The standard display currently used for ordinary eligible venues is:

- **30% off food**;
- **15% off beverages**.

Some named Singapore venues have different treatment. The Accor augmentation script maintains conservative exclusion and 15%-variation name sets based on the official page. When Accor changes the page, the lists must be revalidated rather than assumed to remain permanent.

---

# 5. Repository and hosting architecture

## 5.1 Primary public repository

`SGDining/sgdining.github.io`

This repository owns the clean GitHub Pages organization-root URL:

`https://sgdining.github.io/`

This is the URL intended for public sharing and branding.

## 5.2 Legacy/upstream repository

`wyattsingapore-ux/amex-sg-benefit-finder`

This remains an important temporary upstream data-generation system. It currently performs the complete AMEX/GHA/Eatigo refresh and OneMap geocoding, then serves:

- `data/merchants.json`
- `data/eatigo_today.json`

The SGDining root repository mirrors these deployed datasets and then performs its own SGDining-specific enrichment and deployment.

## 5.3 Why two repositories currently exist

The project was migrated to the `SGDining` GitHub organization to remove the personal `wyattsingapore-ux` branding from the public URL. The old production site was deliberately kept intact during migration as a safe fallback.

The current architecture is therefore transitional:

```text
Official AMEX / GHA / Eatigo sources
            |
            v
wyattsingapore-ux/amex-sg-benefit-finder
- refresh AMEX
- refresh GHA
- refresh Eatigo directory
- OneMap geocode
- refresh Eatigo today offers
            |
            | deployed JSON mirror
            v
https://wyattsingapore-ux.github.io/amex-sg-benefit-finder/
            |
            | hourly SGDining mirror
            v
SGDining/sgdining.github.io
- validate mirror
- augment Accor
- enrich LD/GHA links
- apply SGDining UI extensions
- deploy organization-root Pages
            |
            v
https://sgdining.github.io/
```

## 5.4 Target end-state

The preferred end-state is a single primary repository under `SGDining` that performs all source refreshes itself. When that migration is complete:

1. add OneMap secrets to the SGDining repository;
2. adapt the legacy full-refresh workflows for a root Pages repository;
3. move Eatigo directory/hourly refresh into SGDining;
4. validate several successful cycles;
5. remove the hourly dependency on the legacy Pages site;
6. retain/archive the old repository for history rather than production dependency.

Do not retire the legacy data pipeline until SGDining can independently regenerate and geocode the full dataset.

---

# 6. Main production files

## 6.1 `index.html`

Responsibilities:

- page layout;
- benefit selector;
- search controls;
- filter panel;
- map and merchant-list containers;
- programme source links in the footer;
- loading `app.js`, `program-links.js` and `accor-ui.js`.

Current visible programme labels include `Accor List` and `Both Accor + Lifestyle Credit`.

## 6.2 `styles.css`

Responsibilities:

- dark responsive visual theme;
- desktop/mobile grid layout;
- map sizing;
- merchant cards;
- programme badges;
- Eatigo percentage pins/tooltips;
- origin/current-location pin;
- mobile filter sheet.

## 6.3 `app.js`

Core front-end controller.

Responsibilities include:

- Leaflet map initialization;
- loading `data/merchants.json` and `data/eatigo_today.json`;
- programme matching for LD, LC, GHA and Eatigo;
- text/postal search;
- Nominatim place lookup;
- browser geolocation;
- distance calculation;
- current-map-viewport filtering;
- Eatigo discount/time filtering;
- cuisine filter population for Eatigo;
- result sorting;
- merchant-card rendering;
- Eatigo percentage map markers;
- Eatigo hover/touch details;
- direct Eatigo branch navigation.

## 6.4 `program-links.js`

A UI extension that attaches official venue links to map pins and merchant cards.

Programme URL selection:

- LD / LD+LC → `ld_website_url`
- GHA / GHA+LC → `gha_website_url`
- Accor / Accor+LC → `accor_website_url`

For a verified URL, the ordinary Leaflet popup is replaced by a click action that opens the official venue website. If no URL is present, the normal popup remains. This is deliberate: never substitute a guessed URL.

## 6.5 `accor-ui.js`

Accor-specific front-end extension layered on top of the base `app.js`.

Responsibilities:

- add `accor` and `accorlc` mode matching;
- render Accor/Accor+LC badges;
- show Accor benefit notes;
- display 15%-variation notices;
- expose Accor cuisine metadata in the common cuisine filter;
- display average-price metadata when provided by Accor;
- add Accor-specific list hints;
- keep existing generic search and distance filters working for Accor.

Long-term refactor: merge this extension cleanly into the main app after the Accor feature is stable, rather than accumulating many monkey-patch extension files.

---

# 7. Data-processing scripts

## 7.1 `scripts/refresh_data.py`

Base AMEX extraction logic for Love Dining and Lifestyle Credit.

## 7.2 `scripts/refresh_data_fixed.py`

Production AMEX refresh wrapper/fix layer. This is the preferred production entry point because it contains corrections for grouped/outlet-specific LC parsing, including cases that previously caused known intersections such as Prego to be missed.

## 7.3 `scripts/augment_gha.py`

Adds GHA/Pan Pacific DISCOVERY restaurants to the normalized merchant dataset and finds conservative GHA+LC matches.

## 7.4 `scripts/augment_eatigo_resilient.py`

Main resilient Eatigo discovery implementation.

## 7.5 `scripts/augment_eatigo_resilient_v2.py`

Current production wrapper/variant for full Eatigo directory discovery. It was developed after earlier search-page instability and was validated against the full Singapore directory.

## 7.6 `scripts/refresh_eatigo_today.py`

Refreshes current-day Eatigo offer snapshots for all discovered Eatigo branches.

Expected output:

`data/eatigo_today.json`

Important output/monitoring fields include:

- `date_sg`
- `restaurants_attempted`
- `restaurants_with_future_slots`
- `restaurants_mapped_with_future_slots`
- `restaurants_with_cuisine`
- `restaurants_with_50pct_or_better`
- `request_errors`
- `refresh_seconds`
- `restaurants_per_second`
- `workers`

## 7.7 `scripts/geocode.py`

Uses Singapore OneMap for merchant geocoding and metadata enrichment.

Expected cached/normalized fields can include:

- latitude / longitude;
- `geocode_address`;
- `geocode_postal`;
- `geocode_building`;
- `geocode_road`.

## 7.8 `scripts/enrich_program_links.py`

Conservative official-link enrichment.

Love Dining:

- parses anchors explicitly labelled `Visit Website` on the official AMEX Love Dining pages;
- matches by postal/name where possible;
- permits exact grouped brand matching for cases such as Spizza where the AMEX block structure does not expose the outlet postal alongside every link;
- no search-engine guessing.

GHA:

- parses venue links from the official Singapore section of the Pan Pacific source;
- matches hotel + restaurant names conservatively.

The production safeguard rejects unexpectedly low link coverage.

## 7.9 `scripts/augment_accor.py`

Adds the ALL Accor+ Explorer programme.

Source transport strategy:

1. try Accor's official structured GraphQL `SearchRestaurants` response directly;
2. if protected/non-JSON, launch Playwright Chromium;
3. load the official Accor Singapore map page;
4. capture Accor's own `SearchRestaurants` network response;
5. reject an unexpectedly small/large Singapore directory count.

Accor+ processing:

- clear previous Accor fields before rebuilding;
- exclude names explicitly excluded by current Singapore variations rules;
- apply ordinary `30% food / 15% beverages` metadata;
- apply named 15%-variation metadata where applicable;
- construct the official Accor restaurant URL from the stable restaurant ID;
- use Accor coordinates and postal code;
- match against LC dining rows using postal + normalized name/address similarity;
- require a similarity threshold rather than broad brand guessing;
- append eligible Accor-only rows when no LC match exists;
- check for duplicate Accor IDs.

## 7.10 `scripts/validate_data.py`

General dataset integrity checks. Any future programme should add comparable count/duplicate/invariant checks rather than relying only on visual inspection.

---

# 8. Normalized merchant data model

The normalized source of truth used by the UI is `data/merchants.json`.

Representative common fields:

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

Representative source/match metadata:

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

Official website enrichment:

```text
ld_website_url
gha_website_url
accor_website_url
```

Accor-specific metadata:

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

Geocoding/search metadata may include:

```text
geocode_address
geocode_postal
geocode_building
geocode_road
```

The schema is intentionally additive so one physical outlet can carry multiple programme flags.

---

# 9. Programme intersection rules

## 9.1 Love Dining + Lifestyle Credit

This must be an **outlet/location intersection**, not simply the same brand appearing somewhere in both lists.

Preferred evidence:

1. same postal code/location;
2. compatible restaurant/brand name;
3. grouped-table handling where official PDF formatting spans multiple rows/cells.

Known regression example: **Prego** should appear in the LD+LC intersection.

## 9.2 GHA + Lifestyle Credit

Match the GHA restaurant at its specific hotel/property against LC dining rows at the same location. Hotel/property context is important because restaurant names alone may not be globally unique.

## 9.3 Eatigo + Lifestyle Credit

Prefer verified branch identity and branch/property/location evidence.

Where multiple LC outlets share a similar restaurant name, do not claim a match unless the Eatigo branch/location can resolve it sufficiently.

The full Eatigo discovery implementation verifies Singapore addresses/branches rather than assuming every region search result is a Singapore outlet.

## 9.4 Accor + Lifestyle Credit

Current implementation requires:

- LC category = dining;
- matching postal code when Accor supplies a postal;
- normalized name/brand/address similarity;
- minimum accepted similarity score of approximately `0.78`.

The matching script records an `accor_match_note` for accepted matches.

Do not loosen the threshold casually. False intersection results reduce trust more than a small number of missed matches.

---

# 10. Map and location behaviour

## 10.1 Base map

Leaflet + OpenStreetMap tiles.

Default center:

Singapore (`1.3521, 103.8198`).

## 10.2 Current location

The `Use my location` button uses browser geolocation. The user's coordinates remain client-side in the map session; the static site does not maintain a user account or server-side location database.

The origin marker is visually distinct from restaurant markers.

## 10.3 Arbitrary nearby location

Users may enter a location such as:

- Bedok Mall
- Orchard
- Marina Bay
- postal code

The front end queries OpenStreetMap Nominatim with Singapore scoping and sets the returned point as the distance origin.

This is preferable to trying to store every Singapore mall name manually.

## 10.4 Distance filtering

Available radius options:

- any distance;
- 1 km;
- 2 km;
- 5 km;
- 10 km.

Distances are calculated client-side using great-circle distance.

## 10.5 Search

Search indexes merchant names plus available address/location metadata including hotel, building, road and postal information. Common Singapore address abbreviations are normalized where practical.

---

# 11. Programme-specific UI behaviour

## 11.1 Love Dining

- ordinary programme pins;
- pin/card official link uses AMEX-published `Visit Website` URL;
- LD+LC keeps the same official LD venue link.

## 11.2 GHA

- programme badge;
- displayed DISCOVERY tier savings;
- click-through to official Pan Pacific venue page;
- GHA+LC retains the same venue link.

## 11.3 Accor

- Accor / Accor+LC badges;
- programme note showing ordinary or variation discount treatment;
- cuisine metadata where available;
- Accor average-price metadata shown when supplied by Accor;
- official Accor restaurant link;
- `Both Accor + Lifestyle Credit` uses the same official venue link.

## 11.4 Eatigo

Eatigo is intentionally more dynamic than the other programme views.

For a branch with current matching slots:

- marker shows best remaining percentage;
- percentage colour bucket reflects discount range;
- desktop hover displays restaurant, address, cuisine, distance and slot table;
- mobile uses a popup rather than relying on hover;
- click opens the Eatigo branch page.

Eatigo-only controls:

- minimum discount: Any / 20%+ / 30%+ / 40%+ / 50%;
- time windows: any remaining, next 2 hours, lunch, dinner, late.

These controls must remain hidden for unrelated programmes so users do not assume Love Dining/GHA/Accor data has Eatigo-style time availability.

---

# 12. Automation and deployment

# 12.1 Legacy full refresh — upstream repository

Workflow:

`.github/workflows/refresh-and-deploy.yml`

Schedule:

`17 2 * * *` UTC = approximately **10:17 AM Singapore time daily**.

Key stages:

1. save current deployed merchant/Eatigo JSON as last-good fallback;
2. install Python dependencies and Playwright;
3. restore geocode/Eatigo caches;
4. run AMEX refresh;
5. augment GHA;
6. discover full Eatigo directory;
7. verify OneMap secrets;
8. geocode with OneMap;
9. refresh current-day Eatigo offers/cuisines;
10. validate row counts and mappings;
11. run `validate_data.py`;
12. run pytest;
13. deploy legacy Pages.

Failure behaviour:

- merchant source refresh failure can fall back to the last live merchant dataset;
- Eatigo current-offer failure can fall back to the previous live snapshot;
- a completely missing fallback causes the workflow to fail rather than publishing bad/empty data.

# 12.2 Legacy Eatigo hourly refresh

Workflow:

`.github/workflows/eatigo-hourly.yml`

Schedule:

`23 * * * *` UTC — hourly.

It restores the current production merchant directory, verifies the Eatigo directory is sufficiently complete, refreshes `eatigo_today.json`, validates the snapshot, and deploys it.

# 12.3 SGDining root deployment

Workflow:

`.github/workflows/deploy.yml`

Triggers:

- push to `main` for production files;
- hourly schedule at `37 * * * *` UTC;
- optional workflow dispatch capability.

Important principle: normal operation should rely on push/schedule automation. A user should not have to manually rerun routine deployments.

Build stages:

1. checkout SGDining repo;
2. mirror current `merchants.json` and `eatigo_today.json` from the legacy deployed site;
3. validate mirror size/mapping/Eatigo coverage;
4. install Python, BeautifulSoup, Requests and Playwright;
5. run `scripts/augment_accor.py`;
6. validate Accor count, LC intersection, official links and unique IDs;
7. run `scripts/enrich_program_links.py` for Love Dining and GHA links;
8. ensure programme-link UI extension is included;
9. configure Pages;
10. upload Pages artifact;
11. deploy using `github-pages` environment;
12. report success/failure through a GitHub issue.

Deployment concurrency group:

`sgdining-pages`

`cancel-in-progress: true` is used so an older deployment does not overwrite a newer code/data revision.

# 12.4 Accor discovery experiment

Workflow:

`.github/workflows/accor-discovery.yml`

Purpose:

- isolated source investigation;
- verify the official Accor map/structured feed;
- capture diagnostic artifacts without modifying the production dataset.

Now that Accor production ingestion is working, this workflow can eventually be retained as a diagnostics tool or archived to reduce repository clutter.

---

# 13. Credentials and secrets

## 13.1 OneMap

Required by the full geocoding workflow:

```text
ONEMAP_API_EMAIL
ONEMAP_API_PASSWORD
```

At the current transitional stage these credentials are relied upon in the legacy repository's complete refresh pipeline.

Before eliminating the legacy dependency, recreate/verify these repository secrets under `SGDining/sgdining.github.io` and test the full pipeline there.

## 13.2 No client-side programme credentials

The public static UI should not expose private API tokens. Official public source pages and public map/search endpoints are used where possible.

---

# 14. Validation philosophy

Every source integration should have both semantic and numerical safeguards.

Examples currently used:

- mirrored merchant dataset must not be empty;
- mapped merchant count must not collapse to zero;
- Eatigo directory must remain above a reasonable lower bound;
- Eatigo live snapshot must attempt a sufficiently complete directory;
- Accor directory count must remain within a plausible range;
- Accor production set must not collapse below a minimum threshold;
- Accor+LC must not unexpectedly become almost empty;
- every Accor row must have an official/source link;
- Accor IDs must be unique;
- LD/GHA official-link coverage has minimum thresholds;
- parser/matching tests are run in the full upstream build.

When an official source changes structure, the correct response is to fail or fall back and fix the parser — not lower safeguards until the workflow turns green.

---

# 15. Testing

The `tests/` directory includes parser and matching regression tests, including coverage around:

- AMEX parsers;
- grouped Lifestyle Credit entries;
- GHA augmentation;
- Eatigo directory/current-day processing.

Accor should gain dedicated permanent unit/regression tests using captured fixture data so the production algorithm can be validated without opening Accor in a browser for every test.

Recommended test categories going forward:

1. source parser fixture tests;
2. normalization tests;
3. same-location intersection tests;
4. duplicate-ID tests;
5. known-positive regression merchants such as Prego;
6. known-negative ambiguous-brand tests;
7. UI mode/filter smoke tests;
8. data-count sanity checks.

---

# 16. Operational runbook

## 16.1 Normal feature/code change

1. inspect the current production repository before editing;
2. modify only required files;
3. push/commit to `main`;
4. allow the push-triggered SGDining workflow to run automatically;
5. confirm both build and deploy succeed;
6. review validation output/counts;
7. only then describe the change as deployed/live.

Do not say a feature is complete merely because code was committed.

## 16.2 Source update or parser change

1. preserve current last-good data;
2. update parser on an isolated/diagnostic path when the source is unfamiliar;
3. verify source counts and sample rows;
4. validate intersections;
5. merge into production;
6. confirm deployment result;
7. inspect a few known restaurants manually if practical.

## 16.3 Failed deployment

A failed GitHub Pages deployment does not remove the previously deployed successful site. Investigate the failed build/run; do not ask the user to repeatedly click rerun without first diagnosing the failure.

## 16.4 Incorrect programme intersection

For a reported wrong/missing restaurant:

1. inspect the exact official programme source rows;
2. identify whether the problem is extraction, normalization, outlet grouping, postal matching or name similarity;
3. add a regression case;
4. fix the generic matcher/parser where possible instead of hardcoding only the reported restaurant.

---

# 17. Known technical debt / current risks

## 17.1 Transitional dependency on personal legacy repository

This is the most important architectural debt. `SGDining/sgdining.github.io` is publicly branded correctly, but the core AMEX/GHA/Eatigo datasets still originate from the legacy Pages deployment.

Priority: move complete data generation into SGDining.

## 17.2 README is behind production capability

The current README predates several production features and still describes older Eatigo behaviour. `BLUEPRINT.md` should be treated as the more complete takeover document until README is refreshed.

## 17.3 Accor UI extension is layered rather than fully integrated

`accor-ui.js` overrides/extends base functions in `app.js`. This was useful for safe rapid rollout, but long term the code should be consolidated into a cleaner programme-adapter architecture.

## 17.4 Deployment status issues create clutter

The SGDining workflow currently creates a new GitHub issue for each deployment result. This is useful while stabilizing migration but produces many issues. Replace this later with one persistent status issue, deployment summary, or cleaner monitoring mechanism.

## 17.5 Experimental Accor files/workflow

The isolated discovery workflow and experiment scripts were useful during source research. Decide whether to archive them under `experiments/` or retain only a lightweight diagnostic tool.

## 17.6 Programme rules change independently of directory membership

Accor is a concrete example: the general restaurant directory and Accor+ benefit eligibility are not identical. Similar care should be used for future programmes.

## 17.7 External-source fragility

AMEX page markup/PDF structure, Eatigo front-end discovery, Accor GraphQL identifiers, Pan Pacific pages and Nominatim behaviour can all change. Validation and last-good fallbacks are mandatory.

---

# 18. Recommended next development phases

## Phase A — finish repository consolidation

Highest priority.

- migrate OneMap secrets to SGDining;
- move full AMEX refresh into SGDining;
- move GHA refresh into SGDining;
- move full Eatigo directory + hourly offer refresh into SGDining;
- make root Pages fallback URL logic aware that the repo is named `sgdining.github.io`;
- run several successful cycles;
- stop SGDining mirroring the old site;
- archive/decommission legacy production only after verification.

## Phase B — clean programme-adapter architecture

Replace programme-specific monkey patches with a structured adapter model, for example:

```text
programme adapters
  loveDining
  lifestyleCredit
  gha
  accor
  eatigo

Each adapter provides:
  match(row)
  label
  badge
  officialUrl(row)
  benefitNote(row)
  cuisine(row)
  price(row)
  programmeSpecificFilters
```

This will make future additions easier and reduce risk of one programme breaking another.

## Phase C — price filter

Implement only where source data is trustworthy.

Accor currently supplies average-price metadata and is the strongest immediate candidate. Do not infer price bands for Love Dining/GHA/Eatigo without a reliable source.

Potential UI:

- Any price
- under S$30
- S$30–50
- S$50–80
- S$80+

Clearly label the basis, e.g. `Accor average price`, so it is not mistaken for a guaranteed bill amount.

## Phase D — richer benefit comparison

Potential future enhancements:

- show multiple programme badges on the same physical outlet;
- rank by useful intersections;
- “best benefit I can use here” summary;
- user-selectable card/programme ownership profile stored locally in the browser;
- no login required initially.

## Phase E — observability/analytics

Optional privacy-conscious analytics could help answer:

- most selected programme modes;
- most searched districts;
- how often users click official venue links;
- mobile vs desktop usage.

Avoid collecting precise user geolocation in analytics.

## Phase F — branding/domain

Current clean URL is adequate:

`https://sgdining.github.io/`

A future custom domain can be added without changing product logic. If commercialized substantially, reassess whether GitHub Pages remains the preferred hosting platform.

---

# 19. Security, privacy and responsible data use

SGDining is currently a static public application with no user account system.

Privacy principles:

- browser geolocation is used to calculate nearby restaurants and is not intentionally stored server-side;
- do not add tracking of precise coordinates;
- do not expose OneMap credentials or private tokens to the browser;
- use official/public programme data for discovery;
- link users back to programme owners for final terms and booking.

Data collection should remain proportionate. There is no need to build a user identity database merely to provide nearby dining results.

---

# 20. Legal/accuracy disclaimer

The product must continue to state that it is an unofficial community tool and is not affiliated with American Express, GHA DISCOVERY, Pan Pacific Hotels Group, Accor / ALL Accor+ Explorer, or Eatigo.

Programme eligibility, discount percentages, blackout dates, merchant participation and card/member terms can change. SGDining should help users discover possibilities, but users should verify the current programme/restaurant terms before spending.

---

# 21. Takeover checklist for another developer/AI agent

Before changing production, a new operator should read:

1. `BLUEPRINT.md` — overall architecture and rules;
2. `.github/workflows/deploy.yml` — current SGDining deployment path;
3. `index.html` — current programme modes and script load order;
4. `app.js` — core map/search/filter logic;
5. `program-links.js` — official link behaviour;
6. `accor-ui.js` — current Accor UI extension;
7. `scripts/enrich_program_links.py` — LD/GHA official link extraction;
8. `scripts/augment_accor.py` — Accor programme generation/intersection;
9. legacy `.github/workflows/refresh-and-deploy.yml` — current full source generation;
10. legacy `.github/workflows/eatigo-hourly.yml` — current live Eatigo refresh.

Then verify the latest GitHub Pages deployment result before touching data-generation logic.

Never assume README text is current when code/workflows conflict with it; inspect the current production files and the latest successful workflow output.

---

# 22. Current status summary — 19 August 2026

**Production branding/migration**

- `https://sgdining.github.io/` is live under the SGDining organization.
- GitHub connector access to the SGDining organization is configured.
- Legacy production remains available as an upstream/fallback source during transition.

**Love Dining**

- hotels + restaurants included;
- LD+LC available;
- official AMEX venue links implemented;
- last verified coverage 87/87.

**Lifestyle Credit**

- dining/fashion merchant list integrated;
- used as the intersection base for LD, GHA, Eatigo and Accor modes.

**GHA / Pan Pacific DISCOVERY**

- GHA List implemented;
- Both GHA + Lifestyle Credit implemented;
- official venue links implemented;
- last verified link coverage 17/17.

**Eatigo**

- full Singapore directory baseline 317 branches;
- Eatigo List implemented;
- Both Eatigo + Lifestyle Credit implemented;
- current-day discount/time snapshot implemented;
- cuisine, discount and time filters implemented;
- direct branch click-through implemented.

**Accor**

- Accor List implemented and deployed;
- Both Accor + Lifestyle Credit implemented and deployed;
- official Accor restaurant links implemented;
- current Accor+ exclusions/variations applied;
- last successful production validation: 31 Accor venues, 11 Accor+LC intersections, 31/31 official/source links.

**Immediate architectural priority**

- remove SGDining's dependency on the legacy personal repository by moving the full AMEX/GHA/Eatigo/OneMap refresh pipeline into `SGDining/sgdining.github.io`.

---

# 23. Change-log policy

This blueprint is intended to be a living document.

For major changes, update:

- version/date at the top;
- current production modes;
- source architecture;
- workflow/schedule details;
- validated baseline counts where relevant;
- known technical debt;
- current status summary.

Do not update counts as hard guarantees; record them as last-validated baselines with a date.

## v1.0 — 19 August 2026

Initial comprehensive blueprint created after:

- migration to `SGDining/sgdining.github.io`;
- production Love Dining/GHA official website-link enrichment;
- full Eatigo live-discount integration;
- Accor / Accor+LC production rollout.
