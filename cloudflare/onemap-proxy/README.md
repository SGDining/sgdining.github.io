# SGDining OneMap proxy

This Cloudflare Worker keeps OneMap credentials and access tokens out of the public GitHub Pages JavaScript.

## Public endpoints

- `GET /health`
- `GET /location-search?q=Orchard%20Towers`

`/location-search` returns only sanitized OneMap location fields. It never returns the OneMap access token, email, or password.

## Worker secrets

The Worker expects these secret bindings:

- `ONEMAP_API_EMAIL`
- `ONEMAP_API_PASSWORD`

Do **not** commit these values and do **not** paste them into source code.

The current authoritative copies are GitHub repository secrets. Do not attempt to display or read them back. Once Cloudflare write access is available, provision the Worker secrets through a secure deployment path (for example a GitHub Actions secret-to-`wrangler secret put` step or an authenticated Cloudflare secret-management action) so the values are never printed.

## CORS

`ALLOWED_ORIGINS` defaults to exactly:

`https://sgdining.github.io`

Additional origins must be explicitly configured as a comma-separated Worker variable. Requests without an `Origin` header remain available for server-side smoke tests such as `curl`; browser requests from unapproved origins receive HTTP 403.

## Token handling

The Worker authenticates to OneMap server-side, keeps the access token only in Worker memory, reuses it briefly, and refreshes/retries authentication if OneMap returns 401/403. Tokens are never sent to SGDining's browser.

## Frontend cutover

`smart-location.js` reads `window.SGDINING_ONEMAP_PROXY`. After deployment, set it to the Worker origin and load that configuration before `smart-location.js`. Production must not be switched until the Worker has passed the location tests in `BLUEPRINT.md`.
