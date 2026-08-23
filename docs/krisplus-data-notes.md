# Kris+ data integration notes

This file documents the clean v2 Kris+ integration approach.

## Source roles

- Mainly Miles: master Singapore Kris+ earn-partner list, category, and current earn-rate reference.
- Singapore Airlines/Kris+ official pages/app: authoritative confirmation, current partner availability, outlet-specific earn-rate differences, and partner details where exposed.
- Physical outlet layer: must be resolved separately because partner-level lists are not sufficient for a map.

## Important rule

Kris+ must never be presented as stacking with American Express Lifestyle Credit. Kris+ payments are routed through the Kris+ app / KrisPay merchant flow.

## Implementation order

1. Build partner-level Kris+ source data.
2. Resolve physical outlets separately.
3. Geocode each physical outlet and deduplicate against existing SGDining outlets.
4. Normalise Kris+ Dining cuisines into the SGDining cuisine taxonomy.
5. Add Kris+ UI only after usable outlet data exists.
