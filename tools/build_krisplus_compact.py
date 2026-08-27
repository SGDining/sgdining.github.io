#!/usr/bin/env python3
"""Build SGDining's compact Kris+ browser dataset from krisplus_outlets_SGDining.csv.

This is the ONLY supported way to replace data/krisplus-v2/chunk-*.txt.
It validates the source before writing, generates all chunks in one pass, writes a
manifest, reconstructs the chunks, and verifies the final SHA-256.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_COLUMNS = [
    "merchant", "outlet", "category", "address", "postal", "lat", "lng",
    "earn_rate_mpd", "geocode_conf",
]

# Regression records discovered during the Bedok/Chai Chee production incident.
# If Kris+ genuinely removes one of these outlets, verify in the app first and
# deliberately update this list; never delete a regression just to make CI green.
REGRESSION_OUTLETS = {
    ("Avocadoria Singapore", "Bedok Mall"),
    ("Skechers", "Bedok Mall"),
    ("Canton Paradise", "Bedok Mall"),
    ("LeNu Chef Wai's Noodle Bar", "Bedok Mall"),
    ("SF Fruits & Juices", "Bedok Mall"),
    ("MODE AESTHETICS", "Bedok Mall"),
    ("Nailz Treats", "Bedok Mall"),
}


def parse_number(value: str | None) -> float | None:
    value = (value or "").strip()
    if not value:
        return None
    return float(value)


def make_indexer():
    values: list = []
    indexes: dict = {}

    def get(value):
        if value not in indexes:
            indexes[value] = len(values)
            values.append(value)
        return indexes[value]

    return values, get


def load_source(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"CSV missing required columns: {missing}")
        rows = [dict(row) for row in reader]

    if not rows:
        raise SystemExit("CSV contains no outlet rows")

    for i, row in enumerate(rows, start=2):
        for key in REQUIRED_COLUMNS:
            row[key] = (row.get(key) or "").strip()
        if not row["merchant"]:
            raise SystemExit(f"CSV row {i}: merchant is blank")
        if not row["category"]:
            raise SystemExit(f"CSV row {i}: category is blank")
        try:
            parse_number(row["lat"])
            parse_number(row["lng"])
            parse_number(row["earn_rate_mpd"])
        except ValueError as exc:
            raise SystemExit(f"CSV row {i}: invalid numeric value: {exc}") from exc

    keys = [(r["merchant"], r["outlet"]) for r in rows]
    duplicates = sorted({k for k in keys if keys.count(k) > 1})
    if duplicates:
        sample = duplicates[:10]
        raise SystemExit(f"Duplicate (merchant, outlet) rows found: {sample}"
                         + (" ..." if len(duplicates) > len(sample) else ""))

    present = set(keys)
    missing_regressions = sorted(REGRESSION_OUTLETS - present)
    if missing_regressions:
        raise SystemExit(f"Missing Kris+ regression outlets: {missing_regressions}")

    return rows


def guard_against_suspicious_drop(rows: list[dict[str, str]], output_dir: Path, min_ratio: float) -> None:
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        return
    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
    previous_rows = int(previous.get("source_rows") or 0)
    if previous_rows <= 0:
        return
    floor = int(previous_rows * min_ratio)
    if len(rows) < floor:
        raise SystemExit(
            f"Refusing suspicious Kris+ row-count drop: {len(rows)} rows vs previous "
            f"{previous_rows}; minimum allowed at ratio {min_ratio:.2f} is {floor}. "
            "Re-check the phone extraction before replacing production data."
        )


def build_compact(rows: list[dict[str, str]], generated_at: str) -> dict:
    merchants, merchant_index = make_indexer()
    outlets, outlet_index = make_indexer()
    categories, category_index = make_indexer()
    locations: list[list] = []
    location_index: dict[tuple, int] = {}

    def get_location(row: dict[str, str]) -> int:
        location = [
            row["address"],
            row["postal"],
            parse_number(row["lat"]),
            parse_number(row["lng"]),
            row["geocode_conf"],
        ]
        key = tuple(location)
        if key not in location_index:
            location_index[key] = len(locations)
            locations.append(location)
        return location_index[key]

    compact_rows = []
    for row in rows:
        compact_rows.append([
            merchant_index(row["merchant"]),
            outlet_index(row["outlet"]),
            category_index(row["category"]),
            get_location(row),
            parse_number(row["earn_rate_mpd"]),
        ])

    return {
        "v": 2,
        "generated_at": generated_at,
        "source_rows": len(rows),
        "duplicates_removed": 0,
        "merchants": merchants,
        "outlets": outlets,
        "categories": categories,
        "locations": locations,
        "rows": compact_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path, help="Path to krisplus_outlets_SGDining.csv")
    parser.add_argument("--output-dir", type=Path, default=Path("data/krisplus-v2"))
    parser.add_argument("--chunk-size", type=int, default=9585,
                        help="Maximum characters per chunk (default matches current production format)")
    parser.add_argument("--min-row-ratio", type=float, default=0.85,
                        help="Reject a new source with fewer than this fraction of the previous row count")
    args = parser.parse_args()

    if args.chunk_size < 1000:
        raise SystemExit("chunk-size is implausibly small")
    if not 0 < args.min_row_ratio <= 1:
        raise SystemExit("min-row-ratio must be > 0 and <= 1")

    rows = load_source(args.csv)
    guard_against_suspicious_drop(rows, args.output_dir, args.min_row_ratio)

    generated_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    compact = build_compact(rows, generated_at)
    raw = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    chunks = [raw[i:i + args.chunk_size] for i in range(0, len(raw), args.chunk_size)]
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    manifest = {
        "manifest_version": 1,
        "dataset_version": 2,
        "source_file": args.csv.name,
        "source_rows": len(rows),
        "duplicates_removed": 0,
        "unique_merchants": len(compact["merchants"]),
        "chunk_count": len(chunks),
        "char_count": len(raw),
        "byte_count": len(raw.encode("utf-8")),
        "sha256": digest,
        "generated_at": generated_at,
    }

    # Validate the complete proposed output BEFORE touching production files.
    rebuilt = "".join(chunks)
    assert rebuilt == raw
    decoded = json.loads(rebuilt)
    assert len(decoded["rows"]) == len(rows)
    assert decoded["source_rows"] == len(rows)
    assert hashlib.sha256(rebuilt.encode("utf-8")).hexdigest() == digest

    args.output_dir.mkdir(parents=True, exist_ok=True)
    wanted = set()
    for i, chunk in enumerate(chunks, start=1):
        path = args.output_dir / f"chunk-{i:02d}.txt"
        path.write_text(chunk, encoding="utf-8")
        wanted.add(path.name)

    # Remove stale chunks from a previously larger dataset so the manifest and
    # directory can never disagree about how many pieces are live.
    for path in args.output_dir.glob("chunk-*.txt"):
        if path.name not in wanted:
            path.unlink()

    (args.output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    # Final disk reconstruction check.
    disk_raw = "".join(
        (args.output_dir / f"chunk-{i:02d}.txt").read_text(encoding="utf-8")
        for i in range(1, manifest["chunk_count"] + 1)
    )
    assert disk_raw == raw
    assert hashlib.sha256(disk_raw.encode("utf-8")).hexdigest() == manifest["sha256"]

    print(
        f"Kris+ build OK: {manifest['source_rows']} rows, "
        f"{manifest['unique_merchants']} merchants, {manifest['chunk_count']} chunks, "
        f"sha256={manifest['sha256']}"
    )


if __name__ == "__main__":
    main()
