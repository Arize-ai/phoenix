from __future__ import annotations

import csv
import json
from pathlib import Path

from evals.pxi.experiments.context_pruning.complexity_repricing import (
    load_rows,
    reprice_rows,
)


def test_load_rows_accepts_csv_json_and_jsonl(tmp_path: Path) -> None:
    rows = [
        {"strategy": "raw", "instance_id": "a", "input_tokens": 5000, "output_tokens": 10},
        {"strategy": "masking", "instance_id": "a", "input_tokens": 3000, "output_tokens": 10},
    ]
    csv_path = tmp_path / "rows.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    json_path = tmp_path / "rows.json"
    json_path.write_text(json.dumps({"rows": rows}), encoding="utf-8")
    jsonl_path = tmp_path / "rows.jsonl"
    jsonl_path.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")

    assert len(load_rows(csv_path)) == 2
    assert load_rows(json_path) == rows
    assert load_rows(jsonl_path) == rows


def test_reprice_rows_groups_trajectories_and_charges_summary_tokens() -> None:
    rows = [
        {
            "strategy": "raw",
            "instance_id": "a",
            "input_tokens": 5000,
            "output_tokens": 100,
            "prefix_tokens": 5000,
        },
        {
            "strategy": "raw",
            "instance_id": "a",
            "input_tokens": 5200,
            "output_tokens": 100,
            "prefix_tokens": 5000,
        },
        {
            "strategy": "llm_summary",
            "instance_id": "a",
            "input_tokens": 3000,
            "output_tokens": 100,
            "prefix_tokens": 3000,
            "summarizer_input_tokens": 2000,
            "summarizer_output_tokens": 200,
        },
    ]

    result = reprice_rows(rows)

    raw = result["strategies"]["raw"]
    summary = result["strategies"]["summarization"]
    assert raw["trajectories"] == 1
    assert raw["turns"] == 2
    assert summary["turns"] == 1
    assert summary["anthropic_cost_usd"] > 0


def test_reprice_rows_is_ttl_sensitive() -> None:
    rows = [
        {
            "strategy": "raw",
            "instance_id": "a",
            "input_tokens": 5000,
            "output_tokens": 10,
            "prefix_tokens": 5000,
        },
        {
            "strategy": "raw",
            "instance_id": "a",
            "input_tokens": 5000,
            "output_tokens": 10,
            "prefix_tokens": 5000,
        },
    ]

    warm = reprice_rows(rows, ttl_seconds=300)["strategies"]["raw"]["anthropic_cost_usd"]
    cold = reprice_rows(rows, ttl_seconds=-1)["strategies"]["raw"]["anthropic_cost_usd"]

    assert warm < cold
