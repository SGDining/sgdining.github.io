#!/usr/bin/env python3
"""Enrich SGDining merchant rows with official programme venue URLs.

Sources are deliberately conservative:
- AMEX Love Dining Hotels / Restaurants: only anchors explicitly labelled
  "Visit Website" on the official AMEX pages.
- Pan Pacific DISCOVERY (GHA): only venue anchors published in the Singapore
  section of the official Pan Pacific participating restaurant page.

No search-engine guessing or inferred domains are used.
"""
from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "merchants.json"
LD_HOTELS_URL = "https://www.americanexpress.com/sg/benefits/love-dining/love-dining-hotels.html"
LD_RESTAURANTS_URL = "https://www.americanexpress.com/sg/benefits/love-dining/love-restaurants.html"
GHA_URL = "https://www.panpacific.com/en/dining/pphg-fb.html"
UA = "Mozilla/5.0 (compatible; SGDining/1.0)"
POSTAL_RE = re.compile(r"(?<!\d)(\d{6})(?!\d)")

GHA_HOTELS = {
    "pan pacific orchard": "Pan Pacific Orchard",
    "pan pacific orchard singapore": "Pan Pacific Orchard",
    "pan pacific singapore": "Pan Pacific Singapore",
    "parkroyal collection marina bay": "PARKROYAL COLLECTION Marina Bay",
    "parkroyal collection marina bay singapore": "PARKROYAL COLLECTION Marina Bay",
    "parkroyal collection pickering": "PARKROYAL COLLECTION Pickering",
    "parkroyal collection pickering singapore": "PARKROYAL COLLECTION Pickering",
    "parkroyal on beach road": "PARKROYAL on Beach Road",
    "parkroyal on beach road singapore": "PARKROYAL on Beach Road",
    "top of uob plaza": "TOP of UOB Plaza",
}


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\u00a0", " ")).strip(" \t\r\n|,-")


def key(value: str | None) -> str:
    s = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode("ascii").lower()
    s = s.replace("&", " and ")
    s = re.sub(r"\b(the|restaurant|restaurants|cafe|bar|bars|lounge)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def score(a: str | None, b: str | None) -> float:
    aa, bb = key(a), key(b)
    if not aa or not bb:
        return 0.0
    if aa == bb:
        return 1.0
    if aa in bb or bb in aa:
        return 0.93
    return SequenceMatcher(None, aa, bb).ratio()


def get(url: str) -> bytes:
    r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "en-SG,en;q=0.9"}, timeout=60)
    r.raise_for_status()
    return r.content


def valid_ld_name(text: str) -> bool:
    low = clean(text).lower()
    if not low or len(low) > 120:
        return False
    if low in {"details", "terms and conditions", "visit website", "find on map"}:
        return False
    if low.startswith(("address", "tel:", "telephone:", "cuisine:", "opening hours", "advanced reservations")):
        return False
    return True


def parse_ld_visit_links(html: bytes, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    records: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for a in soup.find_all("a", href=True):
        if clean(a.get_text(" ", strip=True)).lower() != "visit website":
            continue
        href = urljoin(source_url, a.get("href", "").strip())
        if not href.startswith(("http://", "https://")):
            continue

        previous = [clean(str(x)) for x in a.find_all_previous(string=True, limit=260)]
        previous = [x for x in previous if x]
        details_index = next((i for i, x in enumerate(previous) if x.lower() == "details"), None)
        if details_index is None:
            continue

        block = previous[:details_index]
        postals = sorted(set(POSTAL_RE.findall(" ".join(block))))
        name = next((x for x in previous[details_index + 1 : details_index + 30] if valid_ld_name(x)), "")
        if not name:
            continue

        dedupe = (key(name), href)
        if dedupe in seen:
            continue
        seen.add(dedupe)
        records.append({"name": name, "postals": postals, "url": href})
    return records


def dom_events(soup: BeautifulSoup) -> list[tuple[str, str, str | None]]:
    events: list[tuple[str, str, str | None]] = []
    for node in soup.descendants:
        if isinstance(node, NavigableString):
            parent = node.parent
            if parent and parent.name in {"script", "style", "noscript"}:
                continue
            if parent and parent.find_parent("a") is not None:
                continue
            text = clean(str(node))
            if text:
                events.append(("text", text, None))
        elif getattr(node, "name", None) == "a":
            text = clean(node.get_text(" ", strip=True))
            href = urljoin(GHA_URL, node.get("href", "").strip()) if node.get("href") else None
            if text:
                events.append(("link", text, href))
    return events


def parse_gha_singapore_links(html: bytes) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    events = dom_events(soup)
    start = None
    for i, (_, text, _) in enumerate(events):
        if key(text) != "singapore":
            continue
        nearby = " ".join(key(x[1]) for x in events[i + 1 : i + 120])
        if "mosella" in nearby and "pan pacific singapore" in nearby:
            start = i + 1
            break
    if start is None:
        raise RuntimeError("Could not locate the Singapore GHA dining section")

    current_hotel: str | None = None
    records: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for kind, text, href in events[start:]:
        if key(text) == "thailand":
            break
        hotel = GHA_HOTELS.get(key(text))
        if hotel:
            current_hotel = hotel
            continue
        if kind != "link" or not current_hotel or not href or not href.startswith(("http://", "https://")):
            continue
        n = key(text)
        if not n or n in {"singapore", "manage booking"}:
            continue
        item = (current_hotel, n)
        if item in seen:
            continue
        seen.add(item)
        records.append({"name": text, "hotel": current_hotel, "url": href})
    return records


def match_ld(merchant: dict, records: list[dict]) -> str | None:
    pc = str(merchant.get("postal_code") or "")
    best_url, best_score = None, 0.0
    for r in records:
        if pc and r["postals"] and pc not in r["postals"]:
            continue
        s = max(score(merchant.get("name"), r["name"]), score(merchant.get("brand"), r["name"]))
        if s > best_score:
            best_url, best_score = r["url"], s
    return best_url if best_score >= 0.72 else None


def match_gha(merchant: dict, records: list[dict]) -> str | None:
    mh = key(merchant.get("gha_hotel"))
    best_url, best_score = None, 0.0
    for r in records:
        if mh and mh != key(r["hotel"]):
            continue
        s = max(score(merchant.get("name"), r["name"]), score(merchant.get("brand"), r["name"]))
        if s > best_score:
            best_url, best_score = r["url"], s
    return best_url if best_score >= 0.72 else None


def main() -> int:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    merchants = payload.get("merchants", [])

    ld_records = parse_ld_visit_links(get(LD_HOTELS_URL), LD_HOTELS_URL)
    ld_records += parse_ld_visit_links(get(LD_RESTAURANTS_URL), LD_RESTAURANTS_URL)
    gha_records = parse_gha_singapore_links(get(GHA_URL))

    for m in merchants:
        m["ld_website_url"] = None
        m["gha_website_url"] = None
        if m.get("ld"):
            m["ld_website_url"] = match_ld(m, ld_records)
        if m.get("gha"):
            m["gha_website_url"] = match_gha(m, gha_records)

    stats = payload.setdefault("stats", {})
    ld_total = sum(bool(m.get("ld")) for m in merchants)
    ld_linked = sum(bool(m.get("ld")) and bool(m.get("ld_website_url")) for m in merchants)
    gha_total = sum(bool(m.get("gha")) for m in merchants)
    gha_linked = sum(bool(m.get("gha")) and bool(m.get("gha_website_url")) for m in merchants)
    accor_total = sum(bool(m.get("accor")) for m in merchants)
    accor_linked = sum(bool(m.get("accor")) and bool(m.get("accor_website_url")) for m in merchants)

    stats["ld_website_links"] = ld_linked
    stats["gha_website_links"] = gha_linked
    stats["accor_website_links"] = accor_linked

    if ld_total and ld_linked < max(10, int(ld_total * 0.50)):
        raise RuntimeError(f"Love Dining website-link coverage unexpectedly low: {ld_linked}/{ld_total}")
    if gha_total and gha_linked < max(5, int(gha_total * 0.70)):
        raise RuntimeError(f"GHA website-link coverage unexpectedly low: {gha_linked}/{gha_total}")

    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "ld_source_links": len(ld_records),
        "ld_linked": ld_linked,
        "ld_total": ld_total,
        "gha_source_links": len(gha_records),
        "gha_linked": gha_linked,
        "gha_total": gha_total,
        "accor_linked": accor_linked,
        "accor_total": accor_total,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
