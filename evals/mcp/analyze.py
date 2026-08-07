"""Per-question comparison from saved session artifacts.

``report.py`` aggregates by question shape, which is the right altitude for a
summary. Prose about the results usually needs the individual rows — which
question produced the biggest gap, which one inverted, what the tool sequences
actually were.

Every cell is (question, arm) and may hold several repeats. Numeric fields are
averaged across a cell's repeats and correctness is reported as a fraction, so
raising ``PHOENIX_TEST_REPETITIONS`` changes the precision of these numbers
rather than silently discarding all but the last run.

    uv run python -m evals.mcp.analyze evals/mcp/results/session-*.json

Legacy pre-pytest ``runs-*.jsonl`` files load too.
"""

# ruff: noqa: I001 -- repository import formatter and lint resolver disagree on local `evals`.

from __future__ import annotations

import argparse
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional, Sequence

from evals.mcp.harness.sessions import load_sessions

#: Per-run fields averaged across a cell's repeats.
_NUMERIC_FIELDS = (
    "total_tokens",
    "turns",
    "tool_calls",
    "tool_retries",
    "peak_context_tokens",
    "input_tokens",
    "output_tokens",
    "wall_clock_s",
)


def _fold(numerator: float, denominator: float) -> Optional[float]:
    return round(numerator / denominator, 2) if denominator else None


def _group(runs: Sequence[dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    """Collapse repeats into one aggregate per (question, arm).

    Failed repeats are excluded from the numeric averages — a run that died
    early would otherwise look cheap — but stay in the correctness denominator,
    because an arm that cannot answer is wrong.
    """
    cells: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for run in runs:
        cells[(run["question_id"], run["arm"])].append(run)

    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for (question_id, arm), cell in cells.items():
        completed = [r for r in cell if not r.get("error")]
        aggregate: dict[str, Any] = {
            "shape": cell[0]["shape"],
            "repeats": len(cell),
            "failures": len(cell) - len(completed),
            # None only when every repeat failed, so downstream "did this cell
            # produce a comparable number?" checks stay a simple truthiness test.
            "error": None if completed else "all repeats failed",
            "correct_count": sum(1 for r in cell if r.get("correct")),
        }
        for field in _NUMERIC_FIELDS:
            values = [r[field] for r in completed if field in r]
            aggregate[field] = statistics.fmean(values) if values else 0
        grouped[question_id][arm] = aggregate
    return grouped


def per_question_table(runs: Sequence[dict[str, Any]], baseline_arm: str) -> str:
    """One row per question, comparing every arm against the baseline."""
    grouped = _group(runs)
    arms = list(dict.fromkeys(r["arm"] for r in runs))
    others = [a for a in arms if a != baseline_arm]

    header = ["Question", "Shape"]
    for arm in arms:
        header += [f"{arm} tokens", f"{arm} turns", f"{arm} correct"]
    for arm in others:
        header.append(f"{arm} vs {baseline_arm}")

    lines = [
        "| " + " | ".join(header) + " |",
        "|" + "|".join("---" for _ in header) + "|",
    ]

    for question_id, by_arm in grouped.items():
        any_cell = next(iter(by_arm.values()))
        row: list[str] = [f"`{question_id}`", any_cell["shape"]]
        for arm in arms:
            cell = by_arm.get(arm)
            if not cell:
                row += ["—", "—", "—"]
                continue
            row += [
                "failed" if cell["error"] else f"{cell['total_tokens']:,.0f}",
                "—" if cell["error"] else f"{cell['turns']:.1f}",
                f"{cell['correct_count']}/{cell['repeats']}",
            ]
        for arm in others:
            cell, base = by_arm.get(arm), by_arm.get(baseline_arm)
            if not cell or not base or cell["error"] or base["error"]:
                row.append("—")
                continue
            fold = _fold(base["total_tokens"], cell["total_tokens"])
            row.append(
                f"{fold:.2f}x cheaper" if fold and fold >= 1 else f"{1 / fold:.2f}x costlier"
            )
        lines.append("| " + " | ".join(row) + " |")

    return "\n".join(lines)


def tool_sequences(runs: Sequence[dict[str, Any]]) -> str:
    """The literal call sequence per run — the qualitative half of the story."""
    lines: list[str] = []
    for run in sorted(runs, key=lambda r: (r["question_id"], r["arm"], r.get("repeat", 0))):
        sequence = " → ".join(run.get("tool_call_sequence") or []) or "(none)"
        status = "FAILED" if run.get("error") else ("ok" if run.get("correct") else "wrong")
        suffix = f" #{run['repeat'] + 1}" if run.get("repeat") else ""
        lines.append(f"- `{run['question_id']}` / {run['arm']}{suffix} [{status}]: {sequence}")
    return "\n".join(lines)


def variance_table(runs: Sequence[dict[str, Any]]) -> str:
    """Spread across repeats — how much of a gap is signal versus noise.

    With one repeat per cell there is nothing to report; the table exists so a
    multi-repeat run can show whether the arms' differences exceed their own
    run-to-run variation.
    """
    cells: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for run in runs:
        if not run.get("error"):
            cells[(run["question_id"], run["arm"])].append(run)

    multi = {k: v for k, v in cells.items() if len(v) > 1}
    if not multi:
        return "(single run per cell — no variance to report; re-run with --repeats N)"

    by_arm: dict[str, list[float]] = defaultdict(list)
    for (_, arm), cell in multi.items():
        values = [r["total_tokens"] for r in cell]
        mean = statistics.fmean(values)
        if mean:
            # Spread as a fraction of the cell's own mean, so cells of very
            # different sizes contribute comparably.
            by_arm[arm].append((max(values) - min(values)) / mean)

    lines = [
        "Relative spread of total tokens within each (question, arm) cell.",
        "",
        "| Arm | Cells | Median spread | Worst spread |",
        "|---|---|---|---|",
    ]
    for arm, spreads in by_arm.items():
        lines.append(
            f"| {arm} | {len(spreads)} | {statistics.median(spreads):.0%} | {max(spreads):.0%} |"
        )
    return "\n".join(lines)


def headline_stats(runs: Sequence[dict[str, Any]]) -> str:
    """Aggregate ratios, computed only over questions both arms completed."""
    grouped = _group(runs)
    arms = list(dict.fromkeys(r["arm"] for r in runs))
    if len(arms) != 2:
        return "(headline ratios assume exactly two arms)"
    a, b = arms

    comparable = [
        pair
        for pair in grouped.values()
        if a in pair and b in pair and not pair[a]["error"] and not pair[b]["error"]
    ]
    if not comparable:
        return "(no questions completed by both arms)"

    def total(arm: str, key: str) -> float:
        return sum(pair[arm][key] for pair in comparable)

    repeats = max((c[a]["repeats"] for c in comparable), default=1)
    lines = [
        f"Questions completed by both arms: {len(comparable)} of {len(grouped)}"
        f" ({repeats} repeat{'s' if repeats != 1 else ''} per cell)",
        "",
        "Sums are outlier-sensitive — one heavy question can carry the headline. The "
        "median ratio and the worst-question ratio bracket the honest range; quote "
        "the median as the typical case.",
        "",
        f"| Metric | {a} sum | {b} sum | sum ratio | median ratio | min | max |",
        "|---|---|---|---|---|---|---|",
    ]
    for key, label in [
        ("total_tokens", "Total tokens"),
        ("turns", "Turns"),
        ("tool_calls", "Tool calls"),
        ("peak_context_tokens", "Peak context"),
    ]:
        sum_a, sum_b = total(a, key), total(b, key)
        fold = _fold(max(sum_a, sum_b), min(sum_a, sum_b))
        # Orient every per-question ratio the same way the summed one points, so
        # the median is comparable to it rather than being its reciprocal.
        bigger_is_b = sum_b >= sum_a
        ratios = sorted(
            (pair[b][key] / pair[a][key] if bigger_is_b else pair[a][key] / pair[b][key])
            for pair in comparable
            if pair[a][key] and pair[b][key]
        )
        median = round(statistics.median(ratios), 2) if ratios else None
        lines.append(
            f"| {label} | {sum_a:,.0f} | {sum_b:,.0f} | {fold}x | {median}x | "
            f"{round(ratios[0], 2) if ratios else '—'}x | "
            f"{round(ratios[-1], 2) if ratios else '—'}x |"
        )

    runs_a = sum(c[a]["repeats"] for c in grouped.values() if a in c)
    runs_b = sum(c[b]["repeats"] for c in grouped.values() if b in c)
    correct_a = sum(c[a]["correct_count"] for c in grouped.values() if a in c)
    correct_b = sum(c[b]["correct_count"] for c in grouped.values() if b in c)
    lines.append(
        f"| Correct (all runs) | {correct_a}/{runs_a} | {correct_b}/{runs_b} | — | — | — | — |"
    )
    return "\n".join(lines)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "sessions", nargs="+", type=Path, help="session-*.json artifacts (or legacy runs-*.jsonl)."
    )
    parser.add_argument("--baseline", default="phoenix_mcp", help="Arm to compare against.")
    args = parser.parse_args(argv)

    runs = [run for session in load_sessions(args.sessions) for run in session.runs]
    print("## Headline\n")
    print(headline_stats(runs))
    print("\n## Variance across repeats\n")
    print(variance_table(runs))
    print("\n## Per question\n")
    print(per_question_table(runs, args.baseline))
    print("\n## Tool call sequences\n")
    print(tool_sequences(runs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
