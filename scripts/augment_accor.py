#!/usr/bin/env python3
"""Add eligible Singapore ALL Accor+ Explorer dining venues to merchants.json.

Venue truth comes from the official Accor Restaurants & Bars Singapore search
feed. Benefit exclusions/variations follow the official ALL Accor+ Explorer
Singapore dining-benefit variations page.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MAP_URL = "https://restaurantsandbars.accor.com/en/singapore/singapore/map"
GRAPHQL_URL = "https://restaurantsandbars.accor.com/graphql/"
VARIATIONS_URL = "https://www.accorplus.com/sg/dining-benefit-variations/"
PERSISTED_HASH = "ced25e3bde4a0bcd363f4dd646fb8c87419a2cc6c2eb6cb9cc07be750881c75f"
UA = "Mozilla/5.0 (compatible; SGDining/1.0)"

# Current Singapore exclusions on the official ALL Accor+ Explorer page.
EXCLUDED_NAMES = {
    "long bar", "restaurant andre", "jaan by kirk westaway", "twg tea", "asia grand",
    "mama s kiss", "chara brasserie", "brunetti oro", "la table d emma",
    "l antica pizzeria da michele", "rolls handroll izakaya", "upward taproom", "ashino",
}

# Current Singapore venue-specific variations: 15% off both food and beverages.
FIFTEEN_PERCENT_NAMES = {
    "the grand lobby", "tiffin room", "writers bar", "yi by jereme leung",
    "iyasaka by hashida", "wooloomooloo steakhouse",
}


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\u00a0", " ")).strip(" \t\r\n|,-")


def norm(value: str | None) -> str:
    s = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode("ascii").lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def make_id(name: str, postal: str | None, accor_id: str | None) -> str:
    raw = f"accor|{accor_id or ''}|{norm(name)}|{postal or ''}".encode()
    return hashlib.sha1(raw).hexdigest()[:14]


def sg_date() -> str:
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("Asia/Singapore")).date().isoformat()


def fetch_search_restaurants() -> list[dict]:
    variables = {
        "citySlug": "singapore",
        "countrySlug": "singapore",
        "date": sg_date(),
        "groupSize": 2,
        "searchFilters": {
            "AVERAGE_RATING": [], "FOOD_PREFERENCES": [], "OFFER_AND_LOYALTY": [],
            "STYLE_OF_FOOD": [], "THEMATIC": [], "available": False,
            "includeFilters": True, "maxPrice": 10000, "minPrice": 0,
        },
    }
    extensions = {"persistedQuery": {"version": 1, "sha256Hash": PERSISTED_HASH}}
    r = requests.get(
        GRAPHQL_URL,
        params={
            "operationName": "SearchRestaurants",
            "variables": json.dumps(variables, separators=(",", ":")),
            "extensions": json.dumps(extensions, separators=(",", ":")),
        },
        headers={"User-Agent": UA, "Accept-Language": "en-SG,en;q=0.9", "Accept": "application/json"},
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    if data.get("errors"):
        raise RuntimeError(f"Accor GraphQL errors: {data['errors']!r}")
    return (((data.get("data") or {}).get("searchRestaurants") or {}).get("results") or [])


def load_offline_search(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if "search_restaurants" in data:
        payloads = data.get("search_restaurants") or []
        if not payloads:
            return []
        data = payloads[0].get("data") or {}
    return (((data.get("data") or {}).get("searchRestaurants") or {}).get("results") or [])


def candidate_label(m: dict) -> str:
    address = clean(m.get("address"))
    parts = re.split(r"(?=\b\d{1,4}\s)", address, maxsplit=1)
    return clean(parts[0] if parts else "")


def similarity(accor_name: str, m: dict, food_type: str | None) -> float:
    a = norm(accor_name)
    texts = [m.get("name"), m.get("brand"), candidate_label(m), m.get("address")]
    best = 0.0
    for text in texts:
        b = norm(text)
        if not a or not b:
            continue
        if a == b:
            best = max(best, 1.0)
        elif a in b or b in a:
            best = max(best, 0.94)
        else:
            best = max(best, SequenceMatcher(None, a, b).ratio())
    label = norm(candidate_label(m))
    # Resolve generic names such as SKAI: prefer the restaurant row over a bar row.
    if a and label.startswith(a):
        if "restaurant" in label and "bar" not in norm(food_type):
            best += 0.025
        if "bar" in label and "bar" not in norm(food_type):
            best -= 0.025
    return min(best, 1.0)


def find_lc_match(accor: dict, merchants: list[dict], used: set[int]) -> tuple[int | None, float]:
    pc = clean(accor.get("zipCode"))
    best_i, best_score = None, 0.0
    for i, m in enumerate(merchants):
        if i in used or not m.get("lc") or m.get("category") != "dining":
            continue
        if pc and clean(m.get("postal_code")) != pc:
            continue
        score = similarity(clean(accor.get("name")), m, accor.get("foodType"))
        if score > best_score:
            best_i, best_score = i, score
    return (best_i, best_score) if best_score >= 0.78 else (None, best_score)


def apply_fields(m: dict, r: dict, source_mode: str = "directory") -> None:
    name = clean(r.get("name"))
    n = norm(name)
    food_discount = 15 if n in FIFTEEN_PERCENT_NAMES else 30
    m["accor"] = True
    m["accor_id"] = clean(r.get("id")) or None
    m["accor_name"] = name or clean(m.get("name"))
    m["accor_url"] = (
        f"https://restaurantsandbars.accor.com/en/restaurant/{r['id']}" if r.get("id") else VARIATIONS_URL
    )
    m["accor_website_url"] = m["accor_url"]
    m["accor_source"] = MAP_URL if source_mode == "directory" else VARIATIONS_URL
    m["accor_food_type"] = clean(r.get("foodType")) or None
    m["accor_average_price"] = r.get("averagePrice") if isinstance(r.get("averagePrice"), (int, float)) else None
    m["accor_currency"] = clean(r.get("currency")) or "SGD"
    m["accor_food_discount"] = food_discount
    m["accor_beverage_discount"] = 15
    m["accor_benefit_note"] = (
        "15% off food and beverage" if food_discount == 15 else "30% off food · 15% off beverages"
    )
    m["accor_variation"] = food_discount != 30
    m["accor_match_note"] = None
    if r.get("lat") is not None and r.get("lon") is not None:
        m["lat"], m["lng"] = float(r["lat"]), float(r["lon"])
    if not m.get("postal_code") and r.get("zipCode"):
        m["postal_code"] = clean(r.get("zipCode"))


def promote_variation_only_existing(merchants: list[dict]) -> int:
    """Add explicit variation-page venues when they already exist in our base dataset."""
    promoted = 0
    for target in sorted(FIFTEEN_PERCENT_NAMES):
        if any(m.get("accor") and norm(m.get("accor_name") or m.get("name")) == target for m in merchants):
            continue
        candidates = []
        for m in merchants:
            if m.get("category") != "dining":
                continue
            hay = " | ".join(map(clean, [m.get("name"), m.get("brand"), m.get("address")]))
            if target in norm(hay):
                candidates.append(m)
        if len(candidates) != 1:
            continue
        m = candidates[0]
        apply_fields(
            m,
            {"name": target.title(), "id": None, "foodType": None, "averagePrice": None, "currency": "SGD"},
            "variation",
        )
        if target == norm(m.get("name")):
            m["accor_name"] = clean(m.get("name"))
        else:
            m["accor_name"] = target.title()
        m["accor_match_note"] = "Explicitly listed on official ALL Accor+ Explorer Singapore variations page"
        promoted += 1
    return promoted


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-json", type=Path, help="Offline Accor discovery JSON for tests")
    ap.add_argument("--merchants", type=Path, default=DATA / "merchants.json")
    args = ap.parse_args()

    payload = json.loads(args.merchants.read_text(encoding="utf-8"))
    merchants = payload.get("merchants", [])
    rows = load_offline_search(args.source_json) if args.source_json else fetch_search_restaurants()
    if not 20 <= len(rows) <= 100:
        raise RuntimeError(f"Unexpected Accor Singapore directory count: {len(rows)}")

    # SGDining starts from a mirrored base dataset on every build, so reset prior build-time Accor state.
    for m in merchants:
        for field in list(m):
            if field == "accor" or field.startswith("accor_"):
                m.pop(field, None)
        m["accor"] = False

    eligible = [r for r in rows if norm(r.get("name")) not in EXCLUDED_NAMES]
    excluded = [r for r in rows if norm(r.get("name")) in EXCLUDED_NAMES]
    used_lc: set[int] = set()
    matched_lc = 0
    appended = 0

    for r in eligible:
        i, score = find_lc_match(r, merchants, used_lc)
        if i is not None:
            m = merchants[i]
            used_lc.add(i)
            apply_fields(m, r)
            m["accor_match_note"] = f"Accor+LC outlet+postal match ({score:.2f})"
            matched_lc += 1
        else:
            pc = clean(r.get("zipCode")) or None
            name = clean(r.get("name"))
            m = {
                "name": name,
                "brand": name,
                "address": f"Singapore {pc}" if pc else "Singapore",
                "postal_code": pc,
                "category": "dining",
                "ld": False,
                "lc": False,
                "gha": False,
                "eatigo": False,
                "ld_source": None,
                "lc_section": None,
                "match_note": None,
                "gha_hotel": None,
                "gha_source": None,
                "gha_match_note": None,
                "gha_tiers": None,
                "eatigo_branch_id": None,
                "eatigo_url": None,
                "eatigo_location": None,
                "eatigo_match_note": None,
                "id": make_id(name, pc, clean(r.get("id"))),
                "lat": None,
                "lng": None,
            }
            apply_fields(m, r)
            merchants.append(m)
            appended += 1

    promoted = promote_variation_only_existing(merchants)
    accor_rows = [m for m in merchants if m.get("accor")]
    accor_lc = [m for m in accor_rows if m.get("lc")]
    ids = [m.get("accor_id") for m in accor_rows if m.get("accor_id")]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Accor merge produced duplicate restaurant IDs")
    if len(accor_rows) < 20:
        raise RuntimeError(f"Accor merge unexpectedly small: {len(accor_rows)}")

    payload.setdefault("sources", {})["accor_restaurants"] = MAP_URL
    payload["sources"]["accor_dining_variations"] = VARIATIONS_URL
    stats = payload.setdefault("stats", {})
    stats["accor_directory"] = len(rows)
    stats["accor_excluded"] = len(excluded)
    stats["accor"] = len(accor_rows)
    stats["accor_lc"] = len(accor_lc)
    stats["accor_variation15"] = sum(bool(m.get("accor_variation")) for m in accor_rows)
    payload["merchants"] = sorted(
        merchants,
        key=lambda x: (clean(x.get("name")).lower(), clean(x.get("postal_code")), clean(x.get("address")).lower()),
    )
    args.merchants.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "accor_directory": len(rows),
        "accor_excluded": [clean(r.get("name")) for r in excluded],
        "accor_eligible_from_directory": len(eligible),
        "accor_variation_only_promoted": promoted,
        "accor_total": len(accor_rows),
        "accor_lc": len(accor_lc),
        "accor_lc_names": sorted(clean(m.get("accor_name") or m.get("name")) for m in accor_lc),
        "accor_new_rows": appended,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
