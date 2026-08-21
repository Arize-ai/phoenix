"""Derivation of result rows from transcripts, and the terminal summary.

Plain lists of dicts rather than dataframes: every metric is already computed in
``metrics``, so all that remains is grouping and a median. Nothing is stored --
rows are re-derived from the run directory on demand, and the report computes
its own aggregates in the page.
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
from .otel import trace_hex
from .report import build_report

#: Tables keyed the way the store expects them.
Rows = dict[str, list[dict[str, Any]]]


def task_hash(task: Task) -> str:
    """Content hash of everything that changes what a task means.

    Identifies the wording a row was graded against. For runs whose manifest
    records the questions asked, that is the wording the model saw; for older
    runs it is today's, which is what ``graded_as_run`` flags.
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


ANNOTATION_FILE = "annotation.json"

#: Where this run's spans were last sent. Written by `export`, read by the
#: report, and absent for a run nobody exported -- which is why the links are a
#: property of the run directory rather than a flag on the report command.
DESTINATION_FILE = "export.json"


def read_destination(out_dir: Path) -> dict[str, Any]:
    path = out_dir / DESTINATION_FILE
    return json.loads(path.read_text()) if path.is_file() else {}


def write_destination(out_dir: Path, **fields: Any) -> None:
    """Record where the spans went, so the report can point at them."""
    (out_dir / DESTINATION_FILE).write_text(json.dumps(fields, indent=2))


def trace_url(destination: dict[str, Any], run_id: str, transcript: str) -> Optional[str]:
    """A permalink to one cell's trace, or ``None`` if the run was never sent.

    Addresses the trace by its OpenTelemetry id through the backend's redirect,
    rather than by project and trace: the project in a direct link is an
    internal id this side has no way to know, and asking for it would make a
    report that builds offline depend on the server being up.
    """
    endpoint, project = destination.get("endpoint"), destination.get("project")
    if not endpoint or not project:
        return None
    key = f"{run_id}/{transcript[:-6] if transcript.endswith('.jsonl') else transcript}"
    hex_id = trace_hex(project, key, int(destination.get("max_chars") or 0))
    return f"{str(endpoint).rstrip('/')}/redirects/traces/{hex_id}"


def read_annotation(out_dir: Path) -> dict[str, Any]:
    """Authored notes for a run, kept beside the transcripts."""
    path = out_dir / ANNOTATION_FILE
    return json.loads(path.read_text()) if path.is_file() else {}


def write_annotation(out_dir: Path, **fields: Any) -> dict[str, Any]:
    """Merge ``fields`` into a run's annotation and persist it."""
    current = read_annotation(out_dir)
    current.update({k: v for k, v in fields.items() if v is not None})
    (out_dir / ANNOTATION_FILE).write_text(json.dumps(current, indent=2))
    return current


def meta_row(run_id: str, manifest: dict[str, Any], annotation: dict[str, Any]) -> dict[str, Any]:
    """Provenance for one run: what the harness recorded, plus what was authored."""
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
        "label": annotation.get("label") or manifest.get("label"),
        "note": annotation.get("note"),
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


def _same_prompt(a: str, b: str) -> bool:
    """Whether two promptings are the same question, ignoring rewrapping."""
    return " ".join((a or "").split()) == " ".join((b or "").split())


def tasks_as_run(manifest: dict[str, Any], current: list[Task]) -> dict[str, Task]:
    """The questions as they were asked, keyed by name.

    The *question* is what must not change under a run: grading an old answer
    against a rewritten prompt turns answers that were right at the time into
    failures, silently. So a run whose recorded prompt differs from today's is
    graded against the prompt and expectation it was given.

    The *expectation* is the grader, not the question. When the prompt is
    unchanged, a corrected expectation is applied -- the run answered exactly
    this question, and an answer wrongly marked should not stay wrong because
    the mistake was recorded. Both of ours were: one accepted a rounding the
    question never specified, another pinned a value only correct under a
    threshold clause.

    Falls back to the current definition for runs recorded before the manifest
    carried prompts, which is the old behaviour and the best available.
    """
    by_name = {t.name: t for t in current}
    for entry in manifest.get("tasks") or []:
        name = entry.get("name")
        if not name or "expect" not in entry:
            continue  # older manifest: name only, nothing to recover
        template = by_name.get(name)
        prompt = entry.get("prompt") or (template.prompt if template else "")
        asked_today = template is not None and _same_prompt(prompt, template.prompt)
        by_name[name] = Task(
            name=name,
            task_class=entry.get("task_class") or (template.task_class if template else "unknown"),
            prompt=prompt,
            expect=(template.expect if asked_today else entry.get("expect")) or {},
            json_schema=entry.get("json_schema"),
        )
    return by_name


def rows_for_run(config: BenchConfig, tasks: list[Task], out_dir: Path) -> Rows:
    """Derive every table from the transcripts under ``out_dir/raw``."""
    raw_dir = out_dir / "raw"
    if not raw_dir.is_dir():
        raise FileNotFoundError(f"No transcripts under {raw_dir}.")

    meta = {}
    if (manifest := out_dir / "manifest.json").is_file():
        meta = json.loads(manifest.read_text())
    by_name = tasks_as_run(meta, tasks)
    destination = read_destination(out_dir)
    # Whether this run recorded the questions it asked. Runs predating that are
    # graded against today's wording, which can mark a right answer wrong.
    as_run = any("expect" in e for e in (meta.get("tasks") or []))

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
        for row in part["runs"]:
            row["graded_as_run"] = as_run
            row["trace_url"] = trace_url(destination, out_dir.name, path.name)
        for key, rows in part.items():
            tables[key].extend(rows)
    tables["runs"].sort(key=lambda r: (r["label"], r["task"], r["trial"]))
    return tables


def report_for_run(config: BenchConfig, tasks: list[Task], out_dir: Path) -> Optional[Path]:
    """Write ``report.html`` for one run directory. ``None`` if nothing is in it yet.

    Everything is re-derived from the transcripts on each call. That is cheap --
    a whole run parses in tens of milliseconds -- and it keeps the run directory
    self-describing: transcripts, the manifest beside them, and the page built
    from both, with no separate index to fall out of step.
    """
    tables = rows_for_run(config, tasks, out_dir)
    if not tables["runs"]:
        return None
    manifest = {}
    if (path := out_dir / "manifest.json").is_file():
        manifest = json.loads(path.read_text())
    return build_report(
        tables["runs"],
        tables["turns"],
        out_dir,
        tasks=task_rows(tasks),
        tool_calls=tables["tool_calls"],
        meta=meta_row(out_dir.name, manifest, read_annotation(out_dir)),
    )


def task_rows(tasks: list[Task]) -> list[dict[str, Any]]:
    """Task definitions, denormalised so the report explains itself."""
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
    # Said loudly: these grades may disagree with what the model was actually
    # marked on at the time, and the direction is not predictable.
    if stale := [r for r in runs if not r.get("graded_as_run")]:
        runs_affected = sorted({r["run_id"] for r in stale})
        lines.append(
            f"WARNING: {len(stale)} rows graded against the current task files, not the "
            f"questions as asked ({', '.join(runs_affected)}). These runs predate the "
            f"manifest recording prompts; a since-edited question makes their pass/fail "
            f"unreliable. Do not mix them into an aggregate."
        )
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

    labels = sorted({r["label"] for r in scored})
    classes = sorted({r.get("task_class") or "?" for r in scored})
    width = max(len(c) for c in classes) + 2
    header = "task_class".ljust(width) + "".join(a.rjust(24) for a in labels)
    lines += ["", "median conversation size at the point of answering (tokens)", header]
    for cls in classes:
        cells = []
        for label in labels:
            vals = [
                r["peak_context_tokens"]
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
