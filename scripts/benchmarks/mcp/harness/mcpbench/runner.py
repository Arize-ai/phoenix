"""Execution of the task x trial matrix for one labelled run.

Every cell writes its raw stream-json transcript to disk before anything is
derived from it. That file is the artifact of record: re-analysis never re-runs
the suite, and a cell whose transcript already exists is skipped, so raising
``--trials`` only spends the new trials.
"""

from __future__ import annotations

import json
import logging
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from . import store
from .analyze import meta_row, rows_for_transcript, task_rows
from .config import BenchConfig, Task
from .invocation import build_argv, build_env, cell_id, scratch_cwd, write_mcp_config
from .metrics import parse_transcript

logger = logging.getLogger(__name__)


class BudgetExhausted(Exception):
    """Raised when the matrix reaches ``max_total_usd``."""


@dataclass
class Cell:
    label: str
    task: Task
    trial: int

    @property
    def cell_id(self) -> str:
        return cell_id(self.label, self.task, self.trial)


#: Cheapest class first, so a run gives usable signal in seconds rather than
#: after the slowest task. Unknown classes sort last.
_CLASS_ORDER = {"noop": 0, "trivial": 1, "multi-call": 2, "large-result": 3}


def plan_matrix(config: BenchConfig, tasks: list[Task]) -> list[Cell]:
    """Enumerate every cell, cheapest tasks first, trials varying fastest."""
    label = config.resolved_label()
    ordered = sorted(tasks, key=lambda t: (_CLASS_ORDER.get(t.task_class, 99), t.name))
    return [
        Cell(label=label, task=task, trial=trial)
        for task in ordered
        for trial in range(1, config.trials_for(task) + 1)
    ]


def _git_sha(root: Path) -> Optional[str]:
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def write_manifest(config: BenchConfig, tasks: list[Task], out_dir: Path) -> dict[str, Any]:
    """Record what produced these numbers, for reproducing them later.

    Returned as well as written, so the store can keep the same provenance
    alongside the rows.
    """
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": config.model,
        "effort": config.effort,
        "trials": config.trials,
        "concurrency": config.concurrency,
        "max_budget_usd": config.max_budget_usd,
        "max_total_usd": config.max_total_usd,
        "phoenix_git_sha": _git_sha(config.root),
        "tracing_enabled": config.tracing.enabled,
        "tracing_plugin_dir": config.tracing.plugin_dir if config.tracing.enabled else None,
        # Resolved URL, not a variable name: without it a stored result cannot
        # say which instance produced it. URL only -- never the key.
        "label": config.resolved_label(),
        "target": config.target if config.uses_mcp else None,
        "uses_mcp": config.uses_mcp,
        "trace_sink": config.tracing.sink_endpoint() if config.tracing.enabled else None,
        "tasks": [
            {"name": t.name, "task_class": t.task_class, "trials": config.trials_for(t)}
            for t in tasks
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def execute_cell(
    config: BenchConfig,
    cell: Cell,
    *,
    raw_dir: Path,
    mcp_config: Optional[Path],
) -> Path:
    """Run one cell and return the transcript path, retrying harness failures.

    A harness failure (server unreachable, permission denial, API error) is
    retried; a wrong or unproductive answer never is, because retrying model
    failures would bias the distribution the benchmark is measuring.
    """
    transcript_path = raw_dir / f"{cell.cell_id}.jsonl"
    if transcript_path.exists():
        return transcript_path

    argv = build_argv(
        config,
        cell.task.prompt,
        mcp_config_path=mcp_config,
        json_schema=cell.task.json_schema,
    )
    env = build_env(config)
    staging = transcript_path.with_suffix(".partial")

    for attempt in range(1, config.retries + 2):
        try:
            proc = subprocess.run(
                argv,
                env=env,
                capture_output=True,
                text=True,
                timeout=config.timeout_s,
                cwd=str(scratch_cwd()),
            )
            stdout, stderr = proc.stdout, proc.stderr
        except subprocess.TimeoutExpired as exc:
            stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
            stderr = f"timeout after {config.timeout_s}s"

        staging.write_text(stdout)
        if stderr.strip():
            transcript_path.with_suffix(".stderr").write_text(stderr)

        reason = None
        transcript = parse_transcript(staging)
        if not transcript.result:
            reason = "no_result"
        elif config.uses_mcp and transcript.mcp_status != "connected":
            reason = f"mcp_{transcript.mcp_status or 'absent'}"

        if reason is None or attempt > config.retries:
            # Rename last: a transcript only appears at its final path once it is
            # complete, so an interrupted run never resumes onto a partial file.
            staging.replace(transcript_path)
            return transcript_path

    staging.replace(transcript_path)
    return transcript_path


def run_matrix(
    config: BenchConfig,
    tasks: list[Task],
    out_dir: Path,
    *,
    on_cell: Optional[Callable[[Cell, dict[str, Any]], None]] = None,
    cancel: Optional[threading.Event] = None,
) -> list[Path]:
    """Execute every cell, resuming past completed ones. Returns transcript paths.

    ``cancel`` is checked between cells; a cell already running is left to finish
    rather than killed, so its transcript is never truncated mid-write.
    """
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    # Written to scratch, never into out_dir: the generated config carries the
    # target's bearer token, and results directories get shared and published.
    mcp_config = write_mcp_config(config, scratch_cwd()) if config.uses_mcp else None
    meta = write_manifest(config, tasks, out_dir)
    db = out_dir.parent / "bench.db"
    by_name = {t.name: t for t in tasks}
    store.write_tasks(db, task_rows(tasks))
    store.write_meta(db, meta_row(out_dir.name, meta))

    cells = plan_matrix(config, tasks)
    spend = 0.0
    lock = threading.Lock()
    stop = threading.Event()
    paths: list[Path] = []

    def work(cell: Cell) -> Optional[Path]:
        nonlocal spend
        if stop.is_set() or (cancel is not None and cancel.is_set()):
            return None
        # Checked before executing: a cell restored from a previous run was paid
        # for then, and charging it again would trip the cap on every resume.
        cached = (raw_dir / f"{cell.cell_id}.jsonl").exists()
        path = execute_cell(config, cell, raw_dir=raw_dir, mcp_config=mcp_config)
        transcript = parse_transcript(path)
        cost = 0.0 if cached else float(transcript.result.get("total_cost_usd") or 0.0)
        with lock:
            spend += cost
            if spend >= config.max_total_usd:
                stop.set()
        # Persisted per cell, not at the end: a served report can then show
        # progress live, and an interrupted run leaves queryable results.
        try:
            part = rows_for_transcript(
                path,
                run_id=out_dir.name,
                label=cell.label,
                task=by_name.get(cell.task.name),
                task_name=cell.task.name,
                trial=cell.trial,
                meta=meta,
            )
            store.write_cell(
                db, run=part["runs"][0], turns=part["turns"], tool_calls=part["tool_calls"]
            )
        except Exception as exc:  # storage must never lose a completed cell
            logger.warning("Could not store cell %s: %s", cell.cell_id, exc)

        if on_cell:
            on_cell(
                cell,
                {
                    "cached": cached,
                    "cost": cost,
                    "spend": spend,
                    "invalid": not transcript.result,
                    "num_turns": transcript.result.get("num_turns"),
                },
            )
        return path

    if config.concurrency > 1:
        with ThreadPoolExecutor(max_workers=config.concurrency) as pool:
            paths = [p for p in pool.map(work, cells) if p is not None]
    else:
        for cell in cells:
            if (path := work(cell)) is not None:
                paths.append(path)

    if stop.is_set():
        raise BudgetExhausted(
            f"Reached max_total_usd (${config.max_total_usd:.2f}) after ${spend:.2f}. "
            f"Completed cells are checkpointed -- rerun the same command to continue."
        )
    return paths
