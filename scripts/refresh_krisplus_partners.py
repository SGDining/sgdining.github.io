#!/usr/bin/env python3
"""Refresh the partner-level Kris+ catalogue without pretending it is outlet data.

Mainly Miles is currently the most complete public Singapore list for Kris+ earn
partners. It is suitable for partner name, primary category and earn-rate
reference, but it does not provide the physical outlet layer SGDining needs for
mapping. This script therefore writes data/krisplus_partners.json only; it does
NOT merge records into data/merchants.json.

Physical outlets must be resolved and verified separately before they can be
shown on the SGDining map. Singapore Airlines also notes that earn rates can
vary between outlets of the same partner.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SOURCE_URL = "https://mainlymiles.com/kris-plus-earn/"
OFFICIAL_PARTNERS_URL = "https://www.singaporeair.com/en_UK/sg/ppsclub-krisflyer/use-miles/krisplus/partners-promotion-sg/"
OFFICIAL_FAQ_URL = "https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/use-miles/krisplus/faq/"
UA = "SGDining KrisPlus catalogue refresh/1.0 (+https://sgdining.github.io/)"
CATEGORIES = {
    "dining": "dining",
    "retail": "retail",
    "activities": "activities",
    "activity": "activities",
    "services": "services",
    "service": "services",
    "wellness": "wellness",
}


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\u00a0", " ")).strip()


def norm(value: str | None) -> str:
    s = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode("ascii").lower()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def partner_id(name: str, category: str) -> str:
    return hashlib.sha1(f"krisplus|{norm(name)}|{category}".encode()).hexdigest()[:14]


def category_from_text(text: str | None) -> str | None:
    n = norm(text)
    for token, category in CATEGORIES.items():
        if re.search(rf"\b{re.escape(token)}\b", n):
            return category
    return None


def infer_table_category(table: Tag) -> str | None:
    # First try stable HTML identifiers/classes if Mainly Miles adds them.
    attrs = " ".join([clean(table.get("id")), " ".join(table.get("class", []))])
    category = category_from_text(attrs)
    if category:
        return category

    # Then walk backwards through nearby headings. This works for the current
    # article layout and remains tolerant of wrappers/tabs inserted by WordPress.
    for heading in table.find_all_previous(["h2", "h3", "h4", "h5", "h6"], limit=12):
        text = clean(heading.get_text(" ", strip=True))
        category = category_from_text(text)
        if category:
            return category
        if "kris+ merchants by" in norm(text) or "latest lists" in norm(text):
            continue
    return None


def parse_rate(raw: str) -> tuple[float | None, float | None]:
    """Return (base/current table rate, promotional rate if visibly stated)."""
    text = clean(raw)
    rates = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*mpd\b", text, flags=re.I)]
    if not rates:
        # Be tolerant of 'miles / S$1' style wording, although Mainly Miles
        # normally normalises the table to mpd.
        m = re.search(r"(\d+(?:\.\d+)?)\s*miles?\s*/\s*S\$?\s*1\b", text, flags=re.I)
        return (float(m.group(1)), None) if m else (None, None)
    base = rates[0]
    promo = max(rates[1:]) if len(rates) > 1 else None
    return base, promo


def table_headers(table: Tag) -> list[str]:
    row = table.find("tr")
    if not row:
        return []
    return [norm(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]


def find_column(headers: list[str], *needles: str) -> int | None:
    for i, header in enumerate(headers):
        if all(needle in header for needle in needles):
            return i
    return None


def parse_partner_tables(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    found: dict[tuple[str, str], dict] = {}

    for table in soup.find_all("table"):
        headers = table_headers(table)
        if not headers:
            continue
        merchant_col = find_column(headers, "merchant")
        earn_col = find_column(headers, "earn")
        if merchant_col is None or earn_col is None:
            continue
        category_col = find_column(headers, "category")
        table_category = infer_table_category(table)

        rows = table.find_all("tr")
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if max(merchant_col, earn_col) >= len(cells):
                continue
            name = clean(cells[merchant_col].get_text(" ", strip=True))
            rate_text = clean(cells[earn_col].get_text(" ", strip=True))
            if not name or not rate_text:
                continue
            # Reject summary rows such as 'All', '9 mpd', or category labels.
            nn = norm(name)
            if nn in {"all", "merchant", "merchants"} or re.fullmatch(r"\d+(?:\.\d+)?\s*mpd", nn):
                continue

            category = table_category
            if category_col is not None and category_col < len(cells):
                category = category_from_text(cells[category_col].get_text(" ", strip=True)) or category
            category = category or "unknown"
            base_rate, promo_rate = parse_rate(rate_text)
            if base_rate is None:
                continue

            key = (norm(name), category)
            record = {
                "id": partner_id(name, category),
                "name": name,
                "category": category,
                "earn_rate_mpd": base_rate,
                "promo_rate_mpd": promo_rate,
                "earn_rate_text": rate_text,
                "source": SOURCE_URL,
                "outlets_verified": False,
                "outlet_count": None,
                "map_ready": False,
            }
            existing = found.get(key)
            if existing is None or len(record["earn_rate_text"]) > len(existing["earn_rate_text"]):
                found[key] = record

    return sorted(found.values(), key=lambda row: (row["category"], row["name"].casefold()))


def fetch_html(url: str = SOURCE_URL) -> str:
    response = requests.get(
        url,
        headers={"User-Agent": UA, "Accept-Language": "en-SG,en;q=0.9"},
        timeout=60,
    )
    response.raise_for_status()
    return response.text


def write_catalog(partners: list[dict], output: Path) -> None:
    counts = Counter(row["category"] for row in partners)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE_URL,
        "official_reference": OFFICIAL_PARTNERS_URL,
        "official_faq": OFFICIAL_FAQ_URL,
        "source_scope": "partner-level only; not a verified physical-outlet list",
        "map_merge_allowed": False,
        "stats": {"partners": len(partners), "categories": dict(sorted(counts.items()))},
        "partners": partners,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-html", type=Path, help="Parse saved HTML instead of downloading")
    parser.add_argument("--output", type=Path, default=DATA / "krisplus_partners.json")
    parser.add_argument("--min-partners", type=int, default=500)
    args = parser.parse_args()

    html = args.source_html.read_text(encoding="utf-8") if args.source_html else fetch_html()
    partners = parse_partner_tables(html)
    if len(partners) < args.min_partners:
        raise RuntimeError(
            f"Kris+ parser found only {len(partners)} partners; expected at least {args.min_partners}. "
            "Refusing to overwrite the catalogue because the source layout may have changed."
        )
    write_catalog(partners, args.output)
    counts = Counter(row["category"] for row in partners)
    print(f"Kris+ partner catalogue: {len(partners)} partners; categories={dict(counts)}")
    print("Physical outlets remain unverified and have not been merged into merchants.json.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
