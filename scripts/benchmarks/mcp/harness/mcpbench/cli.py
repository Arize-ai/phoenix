"""Command line: ``preflight``, ``run``, ``analyze``.

``run`` preflights first by default, because both failure modes it catches are
silent: a server that connects with zero tools still produces an answer, and the
tracing plugin discards delivery errors.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from .analyze import (
    report_for_run,
    rows_for_run,
    summarize,
    write_annotation,
    write_csv,
)
from .config import BenchConfig, ConfigError, apply_overrides, load_config, load_tasks
from .export import (
    DEFAULT_ENDPOINT,
    DEFAULT_PROJECT,
    Planner,
    as_json,
    open_sink,
    plan_run,
    resolve_endpoint,
    resolve_headers,
    send,
)
from .invocation import safe_label
from .otel import DEFAULT_MAX_CHARS
from .preflight import run_preflight
from .runner import BudgetExhausted, Cell, plan_matrix, run_matrix

#: The suite config sits beside `tasks/`, one level above the harness package, so
#: the reviewed inputs live together and the harness stays just code.
DEFAULT_CONFIG = Path(__file__).resolve().parents[2] / "bench.yaml"


def _resolve(config: BenchConfig, args: argparse.Namespace) -> BenchConfig:
    return apply_overrides(
        config,
        trials=getattr(args, "trials", None),
        model=getattr(args, "model", None),
        effort=getattr(args, "effort", None),
        concurrency=getattr(args, "concurrency", None),
        target=getattr(args, "target", None),
        label=getattr(args, "label", None),
        max_total_usd=getattr(args, "max_total_usd", None),
    )


def _default_run_id(config: BenchConfig) -> str:
    """Timestamp plus what the run was, so a directory listing is readable.

    The timestamp alone is unique but indistinguishable at a glance; the model
    and label are what someone is actually looking for. Kept a suffix rather
    than a prefix so listings still sort chronologically, and derived rather
    than typed so re-running cannot collide with an earlier run -- passing an
    existing id means resume, which silently skips completed cells.
    """
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    model = re.sub(r"^claude-", "", config.model)
    parts = [stamp, model]
    # Only a label you chose; the fallback is the target host, which makes for a
    # long directory name and says nothing the manifest does not.
    if config.label and (label := safe_label(config.label)) and label != model:
        parts.append(label)
    return "-".join(parts)


def _results_root(config: BenchConfig, args: argparse.Namespace) -> Path:
    return Path(getattr(args, "out", None) or config.root / "results").resolve()


def _persist(config, tasks, out_dir: Path) -> list[dict]:
    """Re-derive every row from the transcripts and write the report. Returns runs."""
    tables = rows_for_run(config, tasks, out_dir)
    write_csv(tables["runs"], out_dir / "runs.csv")
    return tables["runs"]


def _latest_run(root: Path) -> Path:
    candidates = [p for p in root.glob("*") if (p / "raw").is_dir()]
    if not candidates:
        raise ConfigError(f"No completed runs under {root}.")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def cmd_preflight(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    workdir = _results_root(config, args) / "preflight"
    checks = run_preflight(config, workdir, load_tasks(config))
    for check in checks:
        print(check.render())
    failed = [c for c in checks if not c.ok]
    print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed.")
    return 1 if failed else 0


def cmd_run(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    tasks = load_tasks(config, args.tasks)

    root = _results_root(config, args)
    run_id = args.run_id or _default_run_id(config)
    out_dir = root / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.skip_preflight:
        checks = run_preflight(config, out_dir / "preflight", tasks)
        for check in checks:
            print(check.render())
        if failures := [c for c in checks if not c.ok]:
            print(f"\nPreflight failed ({len(failures)}); not spending the matrix.")
            print("Re-run with --skip-preflight to override.")
            return 1
        print()

    sink = planner = None
    if args.export:
        try:
            sink = open_sink(
                endpoint=resolve_endpoint(args.endpoint),
                project=args.export,
                headers=resolve_headers(),
            )
        except ImportError as exc:
            # Raised here rather than at the first finished cell: the matrix
            # costs money, and a sink that cannot be opened is knowable now.
            print(f"error: {exc}", file=sys.stderr)
            print('install the extra: uv pip install -e "harness[otel]"', file=sys.stderr)
            return 1
        planner = Planner(config, tasks, out_dir)

    cells = plan_matrix(config, tasks)
    done = 0
    print(f"run {run_id} [{config.resolved_label()}]: {len(cells)} cells ({len(tasks)} tasks)")

    report_path = out_dir / "report.html"
    warned_refresh = False

    def refresh_report() -> None:
        """Rebuild the report from what is stored so far.

        Rows land in the database as each cell finishes, so the report can be
        open in a browser from the first cell onwards instead of only existing
        once the whole matrix has been spent. Never allowed to fail the run --
        the results are already durable by this point.
        """
        try:
            report_for_run(config, tasks, out_dir)
        except Exception as exc:
            # Said once: a stale page with no explanation is worse than a line
            # of noise, and repeating it every cell would bury the progress log.
            nonlocal warned_refresh
            if not warned_refresh:
                warned_refresh = True
                print(f"       (live report not updating: {exc})")

    warned_export = False

    def ship(cell: Cell) -> None:
        """Send the finished cell as a trace.

        Same rule as the report: the transcript is already durable by the time
        this runs, so a sink that is unreachable costs the run nothing. What it
        took is reported once, at the end.
        """
        nonlocal warned_export
        if sink is None or planner is None:
            return
        try:
            if trace := planner.cell(out_dir / "raw" / f"{cell.cell_id}.jsonl"):
                sink.send(*trace)
        except Exception as exc:
            if not warned_export:
                warned_export = True
                print(f"       (not exporting: {exc})")

    def progress(cell: Cell, info: dict) -> None:
        nonlocal done
        done += 1
        # Read once, because cells finish on several threads and the report and
        # the export both take long enough for another to land in between. Read
        # again below and the first cell never recognises itself as the first.
        index = done
        status = "cached" if info.get("cached") else f"turns={info.get('num_turns')}"
        print(f"  [{index}/{len(cells)}] {cell.cell_id}  {status}  ${info.get('spend', 0.0):.2f}")
        refresh_report()
        ship(cell)
        if index == 1:
            print(f"       report updating live: {report_path}")
            if args.export:
                print(f"       traces streaming to: {args.export}")

    try:
        run_matrix(config, tasks, out_dir, on_cell=progress)
    except BudgetExhausted as exc:
        print(f"\n{exc}")
        return 2
    finally:
        runs = _persist(config, tasks, out_dir)
        if runs:
            # Emitted here so a run ends with something to open, not a second command.
            path = report_for_run(config, tasks, out_dir)
            print(f"\nreport: {path}")
        if sink is not None:
            print(f"traces: {sink.close().describe()} -> {args.export}")
        print()
        print(summarize(runs))
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    tasks = load_tasks(config)
    root = _results_root(config, args)

    if args.all:
        runs = []
        for folder in sorted(p for p in root.glob("*") if (p / "raw").is_dir()):
            runs.extend(_persist(config, tasks, folder))
            report_for_run(config, tasks, folder)
        print(f"re-derived {len(runs)} runs from transcripts")
        print()
        print(summarize(runs))
        return 0

    out_dir = (root / args.run_id) if args.run_id else _latest_run(root)
    runs = _persist(config, tasks, out_dir)
    report_for_run(config, tasks, out_dir)
    print(f"re-derived {len(runs)} runs from transcripts")
    print()
    print(summarize(runs))
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    tasks = load_tasks(config)
    root = _results_root(config, args)
    out_dir = (root / args.run_id) if args.run_id else _latest_run(root)

    _persist(config, tasks, out_dir)
    print(f"wrote {report_for_run(config, tasks, out_dir)}")
    return 0


def cmd_annotate(args: argparse.Namespace) -> int:
    """Label a run after the fact, so what it meant is recorded where the data is."""
    config = _resolve(load_config(Path(args.config)), args)
    out_dir = _results_root(config, args) / args.run_id
    if not (out_dir / "raw").is_dir():
        print(f"No run directory at {out_dir}.", file=sys.stderr)
        return 1
    annotation = write_annotation(out_dir, label=args.label, note=args.note)
    # The page reads the annotation file, so re-emit it with the new wording.
    load_tasks(config) and report_for_run(config, load_tasks(config), out_dir)
    print(f"{args.run_id}: {annotation}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    """Replay stored transcripts as OpenInference traces."""
    config = _resolve(load_config(Path(args.config)), args)
    tasks = load_tasks(config)
    root = _results_root(config, args)
    if args.all and args.run_id:
        raise ConfigError("--all exports every run; pass one or the other, not both.")
    if args.all:
        folders = sorted(p for p in root.glob("*") if (p / "raw").is_dir())
    else:
        folders = [(root / args.run_id) if args.run_id else _latest_run(root)]

    endpoint = resolve_endpoint(args.endpoint)
    undelivered = 0
    for out_dir in folders:
        traces = plan_run(config, tasks, out_dir, max_chars=args.max_chars)
        spans = sum(len(s) for _, s in traces)
        if args.dry_run:
            path = out_dir / "replay.json"
            path.write_text(json.dumps(as_json(traces), indent=2, default=str))
            print(f"{out_dir.name}: {len(traces)} traces, {spans} spans -> {path}")
            continue
        try:
            delivery = send(
                traces,
                endpoint=endpoint,
                project=args.project,
                headers=resolve_headers(),
                max_chars=args.max_chars,
            )
        except ImportError as exc:
            # The SDK is the extra; everything up to here worked without it, so
            # the planned replay is still worth naming before giving up.
            print(f"error: {exc}", file=sys.stderr)
            print('install the extra: uv pip install -e "harness[otel]"', file=sys.stderr)
            return 1
        where = f"{args.project} at {endpoint}"
        print(f"{out_dir.name}: {len(traces)} traces, {delivery.describe()} -> {where}")
        if not delivery.ok:
            undelivered += delivery.rejected + delivery.missing
    if undelivered:
        # Exits non-zero so a scripted export cannot pass while the collector
        # refused it. The SDK only logs a failed batch, so silence is not proof.
        print(f"\n{undelivered} spans did not reach {endpoint}.", file=sys.stderr)
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mcpbench",
        description="Token-cost benchmark for Phoenix's /mcp surfaces.",
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to bench.yaml.")
    parser.add_argument("--out", help="Results root (default: <config dir>/results).")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_shared(p: argparse.ArgumentParser) -> None:
        p.add_argument("--target", help='MCP endpoint under test, or "none" for no server.')
        p.add_argument("--label", help="What this run is, in your words. The comparison axis.")
        p.add_argument("--model", help="Override the model.")
        p.add_argument("--effort", help="Override the effort level.")

    preflight = sub.add_parser("preflight", help="Check the target and the trace sink.")
    add_shared(preflight)
    preflight.set_defaults(func=cmd_preflight)

    run = sub.add_parser("run", help="Execute the matrix (resumes completed cells).")
    add_shared(run)
    run.add_argument("--tasks", nargs="*", help="Limit to these task names.")
    run.add_argument("--trials", type=int, help="Trials per task; raise it to resume with more.")
    run.add_argument("--concurrency", type=int, help="Parallel runs (default 1).")
    run.add_argument("--max-total-usd", type=float, dest="max_total_usd", help="Matrix cost cap.")
    run.add_argument("--run-id", help="Reuse an existing run id to add trials to it.")
    run.add_argument("--skip-preflight", action="store_true", help="Run without checking first.")
    run.add_argument(
        "--export", metavar="PROJECT", help="Replay each cell to a collector as it completes."
    )
    run.add_argument(
        "--endpoint",
        default=os.environ.get("PHOENIX_COLLECTOR_ENDPOINT") or DEFAULT_ENDPOINT,
        help="Collector for --export.",
    )
    run.set_defaults(func=cmd_run)

    analyze = sub.add_parser("analyze", help="Rebuild the tables from stored transcripts.")
    analyze.add_argument("--run-id", help="Which run (default: most recent).")
    analyze.add_argument(
        "--all", action="store_true", help="Re-derive every run folder from its transcripts."
    )
    analyze.set_defaults(func=cmd_analyze)

    report = sub.add_parser("report", help="Write a self-contained HTML report.")
    report.add_argument("--run-id", help="Which run (default: most recent).")
    report.set_defaults(func=cmd_report)

    annotate = sub.add_parser("annotate", help="Set or change a stored run's label and note.")
    annotate.add_argument("--run-id", required=True)
    annotate.add_argument("--label", help="Rename the run's label.")
    annotate.add_argument("--note", help="Free-text note kept with the run.")
    annotate.set_defaults(func=cmd_annotate)

    export = sub.add_parser("export", help="Replay stored transcripts as OpenInference traces.")
    export.add_argument("--run-id", help="Which run (default: most recent).")
    export.add_argument("--all", action="store_true", help="Every run folder that kept its raw.")
    export.add_argument(
        "--endpoint",
        default=os.environ.get("PHOENIX_COLLECTOR_ENDPOINT") or DEFAULT_ENDPOINT,
        help="Phoenix base URL or collector path.",
    )
    export.add_argument(
        "--project",
        default=os.environ.get("PHOENIX_PROJECT_NAME") or DEFAULT_PROJECT,
        help="Destination project. Also seeds the span ids, so a new name re-imports.",
    )
    export.add_argument(
        "--max-chars", type=int, default=DEFAULT_MAX_CHARS, help="Per-message text cap."
    )
    export.add_argument(
        "--dry-run", action="store_true", help="Write replay.json beside the transcripts instead."
    )
    export.set_defaults(func=cmd_export)

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except ConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\ninterrupted; completed cells are checkpointed.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
