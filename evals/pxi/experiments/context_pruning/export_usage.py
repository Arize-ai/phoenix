from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from statistics import mean
from typing import Any

from evals.pxi.experiments.context_pruning.cost_model import (
    anthropic_cost_usd,
    usage_from_output,
)
from evals.pxi.experiments.context_pruning.summarize_grid import DATASET_RE, EXPERIMENT_POLICY_RE


def _policy_from_experiment_name(name: str) -> str:
    if match := EXPERIMENT_POLICY_RE.search(name):
        return match.group(1).removesuffix("-fixed")
    return "unknown"


def _task_output(raw_output: Any) -> dict[str, Any]:
    if isinstance(raw_output, str):
        raw_output = json.loads(raw_output)
    if not isinstance(raw_output, dict):
        return {}
    output = raw_output.get("task_output", raw_output)
    return output if isinstance(output, dict) else {}


def _percentile(values: list[int], percentile: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * percentile))
    return ordered[index]


def _cell_key(row: dict[str, Any]) -> tuple[str, str]:
    return (str(row["dataset"]), str(row["policy"]))


def _prefer_candidate(
    current: dict[str, Any] | None,
    candidate: dict[str, Any],
) -> dict[str, Any]:
    if current is None:
        return candidate
    current_usage = sum(int(v) for v in current["usage"].values())
    candidate_usage = sum(int(v) for v in candidate["usage"].values())
    current_rank = (current["successful_runs"], current_usage, current["experiment_id"])
    candidate_rank = (candidate["successful_runs"], candidate_usage, candidate["experiment_id"])
    return candidate if candidate_rank > current_rank else current


def export_usage(db_path: Path, *, experiment_prefix: str) -> dict[str, Any]:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT
                e.id AS experiment_id,
                e.name AS experiment_name,
                d.name AS dataset_name,
                r.output AS output,
                r.error AS error
            FROM experiments e
            JOIN datasets d ON d.id = e.dataset_id
            LEFT JOIN experiment_runs r ON r.experiment_id = e.id
            WHERE e.name LIKE ?
            ORDER BY e.id, r.id
            """,
            (f"{experiment_prefix}%",),
        ).fetchall()
    finally:
        conn.close()

    experiments: dict[int, dict[str, Any]] = {}
    for row in rows:
        experiment = experiments.setdefault(
            int(row["experiment_id"]),
            {
                "experiment_id": int(row["experiment_id"]),
                "experiment_name": str(row["experiment_name"]),
                "dataset": str(row["dataset_name"]),
                "policy": _policy_from_experiment_name(str(row["experiment_name"])),
                "runs": 0,
                "successful_runs": 0,
                "error_runs": 0,
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cache_read_tokens": 0,
                    "cache_write_tokens": 0,
                },
                "latencies_ms": [],
            },
        )
        if row["output"] is None:
            continue
        experiment["runs"] += 1
        if row["error"] is not None:
            experiment["error_runs"] += 1
            continue
        experiment["successful_runs"] += 1
        output = _task_output(row["output"])
        usage = usage_from_output(output)
        for key, value in usage.items():
            experiment["usage"][key] += value
        latency = output.get("latency_ms")
        if isinstance(latency, int):
            experiment["latencies_ms"].append(latency)

    selected: dict[tuple[str, str], dict[str, Any]] = {}
    for experiment in experiments.values():
        if experiment["runs"] == 0:
            continue
        match = DATASET_RE.match(experiment["dataset"])
        if match is None:
            continue
        task_type, depth = match.groups()
        experiment["task_type"] = task_type
        experiment["depth"] = depth
        key = _cell_key(experiment)
        selected[key] = _prefer_candidate(selected.get(key), experiment)

    cells = []
    for cell in sorted(selected.values(), key=lambda c: (c["task_type"], c["depth"], c["policy"])):
        latencies = list(cell.pop("latencies_ms"))
        usage = cell["usage"]
        input_tokens = int(usage["input_tokens"])
        cache_tokens = int(usage["cache_read_tokens"])
        cell["cache_read_ratio"] = cache_tokens / input_tokens if input_tokens else None
        cell["anthropic_opus_4_6_cost_usd"] = anthropic_cost_usd(usage)
        cell["mean_latency_ms"] = round(mean(latencies)) if latencies else 0
        cell["median_latency_ms"] = _percentile(latencies, 0.50)
        cell["p95_latency_ms"] = _percentile(latencies, 0.95)
        cells.append(cell)

    return {"cell_count": len(cells), "cells": cells}


def _format_ratio(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.1%}"


def write_markdown(summary: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Context Pruning Usage Summary",
        "",
        f"Cells summarized: `{summary['cell_count']}`",
        "",
        "| Task | Depth | Policy | Runs | Input | Cache read | Cache % | Output | Cost | Median ms | P95 ms |",
        "|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for cell in summary["cells"]:
        usage = cell["usage"]
        lines.append(
            f"| {cell['task_type']} | {cell['depth']} | {cell['policy']} | "
            f"{cell['successful_runs']}/{cell['runs']} | "
            f"{usage['input_tokens']} | {usage['cache_read_tokens']} | "
            f"{_format_ratio(cell['cache_read_ratio'])} | {usage['output_tokens']} | "
            f"${cell['anthropic_opus_4_6_cost_usd']:.4f} | "
            f"{cell['median_latency_ms']} | {cell['p95_latency_ms']} |"
        )
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Export context-pruning usage from Phoenix SQLite."
    )
    parser.add_argument("db_path", type=Path)
    parser.add_argument("--experiment-prefix", default="context-pruning-main")
    parser.add_argument("--json-output", type=Path)
    parser.add_argument("--markdown-output", type=Path)
    args = parser.parse_args(argv)
    summary = export_usage(args.db_path, experiment_prefix=args.experiment_prefix)
    if args.json_output is not None:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    if args.markdown_output is not None:
        write_markdown(summary, args.markdown_output)
    if args.json_output is None and args.markdown_output is None:
        print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
