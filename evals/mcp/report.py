"""Cross-arm markdown report from saved session artifacts.

Each pytest session benchmarks one arm and writes one self-describing artifact;
this tool joins any number of them into the comparison tables the write-up
needs. Point it at every session in the comparison:

    uv run python -m evals.mcp.report evals/mcp/results/session-*.json
"""

# ruff: noqa: I001 -- repository import formatter and lint resolver disagree on local `evals`.

from __future__ import annotations

import argparse
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Sequence

from evals.mcp.harness.sessions import Session, load_sessions


def _mean(values: Sequence[float]) -> float:
    return round(statistics.fmean(values), 1) if values else 0.0


def _ratio(numerator: float, denominator: float) -> Optional[float]:
    """Fold-change, or ``None`` when the baseline is zero."""
    return round(numerator / denominator, 2) if denominator else None


@dataclass
class ArmSummary:
    """Aggregate performance of one arm across the whole question set."""

    arm: str
    label: str
    runs: int
    failures: int
    accuracy: float
    mean_score: float
    mean_turns: float
    mean_tool_calls: float
    mean_tool_retries: float
    mean_total_tokens: float
    mean_output_tokens: float
    mean_catalog_tokens: float
    mean_data_shuttle_tokens: float
    mean_peak_context_tokens: float
    max_peak_context_tokens: int
    mean_wall_clock_s: float
    tool_count: int
    schema_chars: int


def _group_by_arm(
    sessions: Sequence[Session],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    """Merge sessions into (runs per arm, latest meta per arm).

    Several sessions of the same arm concatenate — that is how repeats
    accumulated across reruns enter one summary row.
    """
    runs_by_arm: dict[str, list[dict[str, Any]]] = {}
    meta_by_arm: dict[str, dict[str, Any]] = {}
    for session in sessions:
        for run in session.runs:
            runs_by_arm.setdefault(run["arm"], []).append(run)
        meta = session.meta or {}
        if meta.get("arm"):
            meta_by_arm[meta["arm"]] = meta
    return runs_by_arm, meta_by_arm


def summarize(sessions: Sequence[Session]) -> list[ArmSummary]:
    """Roll per-run records up to one row per arm.

    Failed runs stay in the denominator for accuracy — an arm that cannot answer
    is wrong — but are excluded from the token and turn averages, where they
    would otherwise flatter an arm for giving up early.
    """
    runs_by_arm, meta_by_arm = _group_by_arm(sessions)

    summaries: list[ArmSummary] = []
    for arm, runs in runs_by_arm.items():
        completed = [r for r in runs if not r.get("error")]
        meta = meta_by_arm.get(arm, {})
        catalog = meta.get("catalog") or {}

        def mean_of(key: str, rows: Sequence[dict[str, Any]] = completed) -> float:
            return _mean([r[key] for r in rows if r.get(key) is not None])

        summaries.append(
            ArmSummary(
                arm=arm,
                label=meta.get("arm_label", arm),
                runs=len(runs),
                failures=len(runs) - len(completed),
                accuracy=round(
                    sum(1 for r in runs if r.get("correct")) / len(runs) if runs else 0.0, 3
                ),
                mean_score=round(
                    sum(r.get("score") or 0.0 for r in runs) / len(runs) if runs else 0.0, 3
                ),
                mean_turns=mean_of("turns"),
                mean_tool_calls=mean_of("tool_calls"),
                mean_tool_retries=mean_of("tool_retries"),
                mean_total_tokens=mean_of("total_tokens"),
                mean_output_tokens=mean_of("output_tokens"),
                mean_catalog_tokens=mean_of("catalog_tokens"),
                mean_data_shuttle_tokens=mean_of("data_shuttle_tokens"),
                mean_peak_context_tokens=mean_of("peak_context_tokens"),
                max_peak_context_tokens=max(
                    (r.get("peak_context_tokens") or 0 for r in completed), default=0
                ),
                mean_wall_clock_s=mean_of("wall_clock_s"),
                tool_count=catalog.get("tool_count", 0),
                schema_chars=catalog.get("schema_chars", 0),
            )
        )
    return summaries


def _table(headers: Sequence[str], rows: Sequence[Sequence[Any]]) -> str:
    lines = [
        "| " + " | ".join(str(h) for h in headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
    ]
    lines.extend("| " + " | ".join(str(c) for c in row) + " |" for row in rows)
    return "\n".join(lines)


def _session_file_for(sessions: Sequence[Session], arm: str) -> str:
    return next((s.path.name for s in sessions if (s.meta or {}).get("arm") == arm), "—")


def render_markdown(sessions: Sequence[Session], *, baseline_arm: str) -> str:
    """Render the full report, including the per-shape breakdown."""
    summaries = summarize(sessions)
    runs_by_arm, meta_by_arm = _group_by_arm(sessions)
    baseline = next((s for s in summaries if s.arm == baseline_arm), None)
    all_runs = [run for session in sessions for run in session.runs]

    sections: list[str] = [
        "# Phoenix MCP surfaces: code mode vs conventional tool calling",
        "",
        "Every arm answered the same questions with the same system prompt and "
        "the same usage limits, one arm per pytest session.",
        "",
        "## Sessions",
        "",
        _table(
            ["Arm", "Model", "Started", "No-tools baseline (tokens)", "File"],
            [
                [
                    meta.get("arm_label", arm),
                    f"`{meta.get('model', '?')}`",
                    (meta.get("started_at") or "?")[:19],
                    meta.get("no_tools_baseline", "—"),
                    f"`{_session_file_for(sessions, arm)}`",
                ]
                for arm, meta in meta_by_arm.items()
            ],
        ),
        "",
        "Catalog cost below is measured net of each session's no-tools baseline "
        "(system prompt + question, no tool definitions).",
        "",
        "## Catalog tax — what an arm costs before it does anything",
        "",
        _table(
            ["Arm", "Tools advertised", "Schema chars", "Catalog tokens (mean)"],
            [
                [s.label, s.tool_count, f"{s.schema_chars:,}", f"{s.mean_catalog_tokens:,.0f}"]
                for s in summaries
            ],
        ),
        "",
        "## Headline — cost and correctness per question",
        "",
        _table(
            [
                "Arm",
                "Accuracy",
                "Mean score",
                "Turns",
                "Tool calls",
                "Total tokens",
                "vs baseline",
                "Failures",
            ],
            [
                [
                    s.label,
                    f"{s.accuracy:.0%}",
                    f"{s.mean_score:.2f}",
                    s.mean_turns,
                    s.mean_tool_calls,
                    f"{s.mean_total_tokens:,.0f}",
                    (
                        f"{_ratio(s.mean_total_tokens, baseline.mean_total_tokens):.2f}x"
                        if baseline and _ratio(s.mean_total_tokens, baseline.mean_total_tokens)
                        else "—"
                    ),
                    s.failures,
                ]
                for s in summaries
            ],
        ),
        "",
        "## Where the tokens go",
        "",
        _table(
            [
                "Arm",
                "Catalog",
                "Data shuttle",
                "Output",
                "Peak context (mean)",
                "Peak context (worst)",
                "Self-corrections",
                "Wall clock (s)",
            ],
            [
                [
                    s.label,
                    f"{s.mean_catalog_tokens:,.0f}",
                    f"{s.mean_data_shuttle_tokens:,.0f}",
                    f"{s.mean_output_tokens:,.0f}",
                    f"{s.mean_peak_context_tokens:,.0f}",
                    f"{s.max_peak_context_tokens:,}",
                    s.mean_tool_retries,
                    s.mean_wall_clock_s,
                ]
                for s in summaries
            ],
        ),
        "",
        "Total tokens are billed tokens — every request re-sends the transcript, so "
        "they measure spend. Peak context is the largest single request, which is "
        "what actually has to fit in the window.",
        "",
        "## By question shape",
        "",
    ]

    labels = {s.arm: s.label for s in summaries}
    for shape in dict.fromkeys(r["shape"] for r in all_runs):
        shape_rows = []
        for arm, arm_runs in runs_by_arm.items():
            shape_runs = [r for r in arm_runs if r["shape"] == shape]
            completed = [r for r in shape_runs if not r.get("error")]
            shape_rows.append(
                [
                    labels.get(arm, arm),
                    _mean([r["turns"] for r in completed]),
                    _mean([r["tool_calls"] for r in completed]),
                    f"{_mean([r['total_tokens'] for r in completed]):,.0f}",
                    f"{sum(1 for r in shape_runs if r.get('correct'))}/{len(shape_runs)}",
                ]
            )
        sections.extend(
            [
                f"### `{shape}`",
                "",
                _table(["Arm", "Turns", "Tool calls", "Total tokens", "Correct"], shape_rows),
                "",
            ]
        )

    failures = [r for r in all_runs if r.get("error")]
    if failures:
        sections.extend(
            [
                "## Failures",
                "",
                _table(
                    ["Arm", "Question", "Error"],
                    [[r["arm"], r["question_id"], (r.get("error") or "")[:160]] for r in failures],
                ),
                "",
            ]
        )

    return "\n".join(sections)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "sessions", nargs="+", type=Path, help="session-*.json artifacts to compare."
    )
    parser.add_argument("--baseline", default="phoenix_mcp", help="Arm the ratios compare against.")
    args = parser.parse_args(argv)

    print(render_markdown(load_sessions(args.sessions), baseline_arm=args.baseline))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
