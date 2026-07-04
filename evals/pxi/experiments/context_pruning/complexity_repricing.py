from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from evals.pxi.experiments.context_pruning.cache_simulator import (
    SimulatedTurn,
    simulate_anthropic_prompt_cache,
    total_anthropic_cost,
)

STRATEGY_ALIASES = {
    "raw": "raw",
    "full": "raw",
    "baseline": "raw",
    "none": "raw",
    "mask": "masking",
    "masked": "masking",
    "masking": "masking",
    "observation_masking": "masking",
    "summary": "summarization",
    "summarization": "summarization",
    "llm_summary": "summarization",
    "llm-summarization": "summarization",
}


def _int_field(row: dict[str, Any], *names: str, default: int = 0) -> int:
    for name in names:
        value = row.get(name)
        if value in (None, ""):
            continue
        return max(0, int(float(str(value))))
    return default


def _str_field(row: dict[str, Any], *names: str, default: str = "") -> str:
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return str(value)
    return default


def _strategy(value: str) -> str:
    return STRATEGY_ALIASES.get(value.strip().lower().replace(" ", "_"), value.strip().lower())


def load_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".jsonl":
        return [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        if isinstance(payload, dict) and isinstance(payload.get("rows"), list):
            return [row for row in payload["rows"] if isinstance(row, dict)]
        raise ValueError("JSON input must be a list or an object with a rows list")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def turn_from_row(row: dict[str, Any]) -> SimulatedTurn:
    input_tokens = _int_field(
        row,
        "input_tokens",
        "prompt_tokens",
        "total_input_tokens",
        "context_tokens",
    )
    output_tokens = _int_field(row, "output_tokens", "completion_tokens", "response_tokens")
    cacheable_prefix_tokens = _int_field(
        row,
        "cacheable_prefix_tokens",
        "prefix_tokens",
        "input_tokens",
        "prompt_tokens",
        default=input_tokens,
    )
    prefix_key = _str_field(row, "prefix_key", "trajectory_id", "instance_id", "problem_id")
    strategy = _strategy(_str_field(row, "strategy", "condition", "policy", default="unknown"))
    return SimulatedTurn(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cacheable_prefix_tokens=min(cacheable_prefix_tokens, input_tokens),
        prefix_key=f"{strategy}:{prefix_key}",
        summarizer_usage={
            "input_tokens": _int_field(row, "summarizer_input_tokens", "summary_input_tokens"),
            "output_tokens": _int_field(row, "summarizer_output_tokens", "summary_output_tokens"),
        },
    )


def _group_rows(rows: Iterable[dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for index, row in enumerate(rows):
        strategy = _strategy(_str_field(row, "strategy", "condition", "policy", default="unknown"))
        trajectory_id = _str_field(
            row,
            "trajectory_id",
            "instance_id",
            "problem_id",
            "run_id",
            default=f"row-{index}",
        )
        grouped[(strategy, trajectory_id)].append(row)
    return grouped


def reprice_rows(rows: list[dict[str, Any]], *, ttl_seconds: float = 300) -> dict[str, Any]:
    by_strategy: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"trajectories": 0, "turns": 0, "anthropic_cost_usd": 0.0}
    )
    for (strategy, _trajectory_id), trajectory_rows in _group_rows(rows).items():
        turns = [turn_from_row(row) for row in trajectory_rows]
        usages = simulate_anthropic_prompt_cache(turns, ttl_seconds=ttl_seconds)
        summary = by_strategy[strategy]
        summary["trajectories"] += 1
        summary["turns"] += len(turns)
        summary["anthropic_cost_usd"] += total_anthropic_cost(usages)
    for summary in by_strategy.values():
        trajectories = max(1, int(summary["trajectories"]))
        summary["mean_cost_per_trajectory_usd"] = summary["anthropic_cost_usd"] / trajectories
    return {"ttl_seconds": ttl_seconds, "strategies": dict(sorted(by_strategy.items()))}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reprice Complexity Trap per-turn token exports with PXI cache model."
    )
    parser.add_argument("input", type=Path, help="CSV, JSON, or JSONL per-turn token export")
    parser.add_argument("--ttl-seconds", type=float, default=300)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    result = reprice_rows(load_rows(args.input), ttl_seconds=args.ttl_seconds)
    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output is None:
        print(text, end="")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
