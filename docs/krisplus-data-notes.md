# Kris+ data integration notes

This document describes the production Kris+ v2 data path for SGDining.

## Active source

The outlet-level source is `krisplus_outlets_SGDining.csv`, extracted from the Kris+ app for SGDining and stored in the SGDining Google Drive project folder. It contains merchant, physical outlet, source category, address, postal code, latitude/longitude, earn rate (mpd), and geocode confidence.

The 2026-08-26 source contained 1,071 rows. SGDining removes 18 exact duplicates, producing 1,053 unique physical outlet records across 478 merchants.

For GitHub Pages delivery, the deduplicated source is stored compactly as `data/krisplus-v2/chunk-01.txt` through `chunk-07.txt`; `krisplus-ui.js` reconstructs and validates that dataset in the browser.

## Map-quality rule

Kris+ outlets remain searchable/listable even when location quality is uncertain. A Kris+ outlet is plotted only when its supplied geocode confidence is `high`, it has a valid six-digit Singapore postal code, and coordinates fall within Singapore bounds. Rows that fail this rule retain their source information for later correction but do not create a map pin.

## Categories

Kris+ is one main programme. Its secondary categories are: All, Dining, Retail, Activities, Services, and Wellness. An outlet may belong to more than one category. Dining cuisine is exposed only where the source category provides a reliable cuisine signal.

## Programme interaction

Kris+ never stacks with American Express Lifestyle Credit. Selecting Kris+ together with other programmes is a union: Kris+ outlets remain independent, while the existing Lifestyle Credit stacking option continues to apply only to supported dining programmes.

## Update process

When a refreshed Kris+ outlet CSV is supplied, re-run the same deduplication/category/geocode validation process and regenerate the seven compact data chunks. Do not fall back to a brand-only merchant list for map pins because Kris+ participation and earn rates can be outlet-specific.
