"""Command line: ``preflight``, ``run``, ``analyze``.

``run`` preflights first by default, because both failure modes it catches are
silent: a server that connects with zero tools still produces an answer, and the
tracing plugin discards delivery errors.
"""

from __future__ import annotations

import argparse
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
from .invocation import safe_label
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
    checks = run_preflight(config, workdir)
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
        checks = run_preflight(config, out_dir / "preflight")
        for check in checks:
            print(check.render())
        if failures := [c for c in checks if not c.ok]:
            print(f"\nPreflight failed ({len(failures)}); not spending the matrix.")
            print("Re-run with --skip-preflight to override.")
            return 1
        print()

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

    def progress(cell: Cell, info: dict) -> None:
        nonlocal done
        done += 1
        status = "cached" if info.get("cached") else f"turns={info.get('num_turns')}"
        print(f"  [{done}/{len(cells)}] {cell.cell_id}  {status}  ${info.get('spend', 0.0):.2f}")
        refresh_report()
        if done == 1:
            print(f"       report updating live: {report_path}")

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
