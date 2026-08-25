"""Sample a small, stratified fixture from the nvidia/Nemotron-PII dataset.

This is a one-time developer tool. It draws a deterministic, stratified sample
from the public Nemotron-PII dataset and writes it to the committed JSONL
fixture that the `pii_detection.eval.ts` benchmark reads. The benchmark itself
does not depend on this script or on network access at run time; re-run this
only to regenerate or resize the fixture.

Nemotron-PII (https://huggingface.co/datasets/nvidia/Nemotron-PII) is a
synthetic, span-annotated NER dataset of 100k single documents (emails, forms,
invoices, notes) across 50+ domains and 55+ PII/PHI categories. It is ~99%
positive: nearly every document contains at least one real PII instance. We
therefore use it only as a binary DETECTION-RATE (recall) benchmark for the
session-level pii_detection evaluator: given realistic PII-bearing text, does
the evaluator score `pii_detected`? Fine-grained category scoring and negative
(no-PII) cases are deferred to a later, purpose-built dataset.

Usage:
    python scripts/benchmarks/pii_detection/sample_nemotron.py \
        --n 150 --seed 20250824 \
        --out js/benchmarks/evals-benchmarks/src/fixtures/pii_detection.nemotron.jsonl
"""

from __future__ import annotations

import argparse
import ast
import json
import math
from pathlib import Path

import pandas as pd
from huggingface_hub import hf_hub_download

REPO_ID = "nvidia/Nemotron-PII"
DATASET_FILE = "data/test-00000-of-00001.parquet"

# Dataset span labels that are NOT personal data on their own under the
# pii_detection rubric (organization-, generic-location-, or quasi-identifier
# level). A document whose spans are *all* drawn from this set is treated as
# having no rubric-level PII and is excluded, so every sampled document is an
# unambiguous positive (gold label `pii_detected`).
NON_PII_LABELS = {
    "company_name",
    "country",
    "city",
    "state",
    "county",
    "postcode",
    "url",
    "date",
    "time",
    "date_time",
    "occupation",
    "language",
    "age",
    "gender",
    "employment_status",
    "education_level",
}

# The four strata we balance the sample across.
STRATA = [(fmt, loc) for fmt in ("structured", "unstructured") for loc in ("us", "intl")]


def parse_spans(raw: str) -> list[dict]:
    """Parse the Python-repr `spans` string (single-quoted, not JSON)."""
    try:
        parsed = ast.literal_eval(raw)
        return parsed if isinstance(parsed, list) else []
    except (ValueError, SyntaxError):
        return []


def has_rubric_pii(spans: list[dict]) -> bool:
    """True if at least one span is a real PII category under the rubric."""
    labels = {s.get("label") for s in spans}
    return bool(labels) and not labels.issubset(NON_PII_LABELS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=150, help="Total records to sample.")
    parser.add_argument("--seed", type=int, default=20250824, help="Sampling seed.")
    parser.add_argument("--out", type=Path, required=True, help="Output JSONL path.")
    args = parser.parse_args()

    path = hf_hub_download(REPO_ID, DATASET_FILE, repo_type="dataset")
    df = pd.read_parquet(path)

    spans = df["spans"].map(parse_spans)
    df = df.assign(_spans=spans, _pii=spans.map(has_rubric_pii))
    positives = df[df["_pii"]]

    per_stratum = math.ceil(args.n / len(STRATA))
    picked: list[pd.DataFrame] = []
    for fmt, loc in STRATA:
        pool = positives[(positives["document_format"] == fmt) & (positives["locale"] == loc)]
        take = min(per_stratum, len(pool))
        picked.append(pool.sample(n=take, random_state=args.seed))

    sample = (
        pd.concat(picked)
        .sample(frac=1, random_state=args.seed)  # shuffle strata together
        .head(args.n)
        .reset_index(drop=True)
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        for _, row in sample.iterrows():
            categories = sorted({s.get("label") for s in row["_spans"]})
            record = {
                "uid": row["uid"],
                "domain": row["domain"],
                "document_type": row["document_type"],
                "document_format": row["document_format"],
                "locale": row["locale"],
                "text": row["text"],
                # Retained for the later category-level iteration; not scored now.
                "pii_categories": categories,
                "expected_label": "pii_detected",
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    counts = sample.groupby(["document_format", "locale"]).size().to_dict()
    print(f"Wrote {len(sample)} records to {args.out}")
    print(f"Strata (format, locale): {counts}")


if __name__ == "__main__":
    main()
