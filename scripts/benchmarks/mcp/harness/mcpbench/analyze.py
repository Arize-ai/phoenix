"""Derivation of result rows from transcripts, and the terminal summary.

Plain lists of dicts rather than dataframes: every metric is already computed in
``metrics``, so all that remains is grouping and a median. SQLite holds the rows;
the report computes its own aggregates in the page.
"""

from __future__ import annotations

import hashlib
import json
import statistics
from pathlib import Path
from typing import Any, Optional

from .config import BenchConfig, Task
from .invocation import safe_label
from .metrics import iteration_rows, parse_transcript, run_row, tool_call_rows

#: Tables keyed the way the store expects them.
Rows = dict[str, list[dict[str, Any]]]


def task_hash(task: Task) -> str:
    """Content hash of everything that changes what a task means.

    Stored on both the task and every result row, so results produced under an
    older wording stay identifiable after the prompt is edited.
    """
    payload = json.dumps(
        {
            "prompt": " ".join(task.prompt.split()),
            "expect": task.expect,
            "json_schema": task.json_schema,
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def meta_row(run_id: str, manifest: dict[str, Any]) -> dict[str, Any]:
    """Provenance for one run, from its manifest."""
    return {
        "run_id": run_id,
        "created_at": manifest.get("created_at"),
        "model": manifest.get("model"),
        "effort": manifest.get("effort"),
        "trials": manifest.get("trials"),
        "phoenix_git_sha": manifest.get("phoenix_git_sha"),
        "tracing_enabled": int(bool(manifest.get("tracing_enabled"))),
        "trace_sink": manifest.get("trace_sink"),
        "target": manifest.get("target"),
        "label": manifest.get("label"),
    }


def split_cell_id(stem: str) -> Optional[tuple[str, str, int]]:
    """Recover (label, task, trial) from a transcript filename."""
    parts = stem.split("__")
    if len(parts) < 3:
        return None
    try:
        trial = int(parts[-1])
    except ValueError:
        return None
    return parts[0], "__".join(parts[1:-1]), trial


def rows_for_transcript(
    path: Path,
    *,
    run_id: str,
    label: str,
    task: Optional[Task],
    task_name: str,
    trial: int,
    meta: Optional[dict[str, Any]] = None,
) -> Rows:
    """Every stored row derived from one transcript."""
    transcript = parse_transcript(path)
    meta = meta or {}
    identity = {
        "run_id": run_id,
        "label": label,
        "task": task_name,
        "trial": trial,
        "task_class": task.task_class if task else "unclassified",
        "task_hash": task_hash(task) if task else None,
    }

    run = run_row(transcript, expect=task.expect if task else {})
    run.update(identity)
    run.update(
        {
            # From the transcript, not the manifest: a run resumed under another
            # model must not restamp earlier trials.
            "model": transcript.init.get("model") or meta.get("model"),
            "effort": meta.get("effort"),
            "phoenix_git_sha": meta.get("phoenix_git_sha"),
            "transcript": path.name,
        }
    )

    turns = [{**identity, **row} for row in iteration_rows(transcript)]
    calls = [{**identity, "call_idx": i, **row} for i, row in enumerate(tool_call_rows(transcript))]
    return {"runs": [run], "turns": turns, "tool_calls": calls}


def rows_for_run(config: BenchConfig, tasks: list[Task], out_dir: Path) -> Rows:
    """Derive every table from the transcripts under ``out_dir/raw``."""
    raw_dir = out_dir / "raw"
    if not raw_dir.is_dir():
        raise FileNotFoundError(f"No transcripts under {raw_dir}.")

    by_name = {t.name: t for t in tasks}
    meta = {}
    if (manifest := out_dir / "manifest.json").is_file():
        meta = json.loads(manifest.read_text())

    tables: Rows = {"runs": [], "turns": [], "tool_calls": []}
    for path in sorted(raw_dir.glob("*.jsonl")):
        if not (parsed := split_cell_id(path.stem)):
            continue
        file_label, task_name, trial = parsed
        # The filename is authoritative: a run directory can hold transcripts from
        # several labels, and the manifest only describes the most recent one.
        # Preferring the manifest would restamp older transcripts with the new
        # label and collapse genuinely different measurements onto one key.
        label = file_label
        if (typed := meta.get("label")) and safe_label(typed) == file_label:
            label = typed  # same label -- recover the exact wording
        part = rows_for_transcript(
            path,
            run_id=out_dir.name,
            label=label,
            task=by_name.get(task_name),
            task_name=task_name,
            trial=trial,
            meta=meta,
        )
        for key, rows in part.items():
            tables[key].extend(rows)
    tables["runs"].sort(key=lambda r: (r["label"], r["task"], r["trial"]))
    return tables


def task_rows(tasks: list[Task]) -> list[dict[str, Any]]:
    """Task definitions, denormalised so a shared db explains itself."""
    return [
        {
            "task_hash": task_hash(t),
            "name": t.name,
            "task_class": t.task_class,
            "prompt": " ".join(t.prompt.split()),
            "expect_json": json.dumps(t.expect),
            "structured": int(t.json_schema is not None),
        }
        for t in tasks
    ]


def write_csv(rows: list[dict[str, Any]], path: Path) -> Optional[Path]:
    """CSV export for spreadsheets. SQLite is the store; this is a convenience."""
    import csv

    if not rows:
        return None
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key not in columns:
                columns.append(key)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    return path


def _median(values: list[Any]) -> Optional[float]:
    numbers = [v for v in values if isinstance(v, (int, float)) and v is not None]
    return statistics.median(numbers) if numbers else None


def _fmt(value: Optional[float]) -> str:
    if value is None:
        return "-"
    if value >= 1000:
        return f"{value / 1000:.1f}k"
    return f"{value:.0f}" if float(value).is_integer() else f"{value:.1f}"


def summarize(runs: list[dict[str, Any]]) -> str:
    """The headline table: median context tokens per label, conditioned on correctness."""
    if not runs:
        return "No runs to summarize."

    lines = []
    invalid = [r for r in runs if r.get("invalid")]
    usable = [r for r in runs if not r.get("invalid")]
    lines.append(f"runs: {len(runs)}  usable: {len(usable)}  invalid: {len(invalid)}")
    if invalid:
        reasons: dict[str, int] = {}
        for r in invalid:
            reasons[r.get("invalid_reason") or "?"] = (
                reasons.get(r.get("invalid_reason") or "?", 0) + 1
            )
        lines.append(f"  invalid reasons: {reasons}")

    graded = [r for r in usable if r.get("graded")]
    if graded:
        by_arm: dict[str, list[int]] = {}
        for r in graded:
            by_arm.setdefault(r["label"], []).append(1 if r.get("passed") else 0)
        rates = {a: round(sum(v) / len(v), 3) for a, v in sorted(by_arm.items())}
        lines.append(f"  pass rate by label: {rates}")
        scored = [r for r in graded if r.get("passed")]
    else:
        lines.append("  pass rate: no task declared an expectation (all runs ungraded)")
        scored = usable

    if not scored:
        return "\n".join(lines + ["", "No passing runs to compare."])

    arms = sorted({r["label"] for r in scored})
    classes = sorted({r.get("task_class") or "?" for r in scored})
    width = max(len(c) for c in classes) + 2
    header = "task_class".ljust(width) + "".join(a.rjust(24) for a in arms)
    lines += ["", "median total_context_tokens (input + cache_creation + cache_read)", header]
    for cls in classes:
        cells = []
        for label in arms:
            vals = [
                r["total_context_tokens"]
                for r in scored
                if r.get("task_class") == cls and r["label"] == label
            ]
            median = _median(vals)
            cells.append(
                (f"{_fmt(median)} (n={len(vals)})" if median is not None else "-").rjust(24)
            )
        lines.append(cls.ljust(width) + "".join(cells))

    # Sandbox errors mean the run measured server capacity, not the tool surface.
    sandbox = sum(int(r.get("n_sandbox_errors") or 0) for r in scored)
    if sandbox:
        lines += ["", f"WARNING: {sandbox} sandbox errors across passing runs (pool contention?)"]
    return "\n".join(lines)
