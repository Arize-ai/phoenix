"""Command line: ``preflight``, ``run``, ``analyze``.

``run`` preflights first by default, because both failure modes it catches are
silent -- an arm that connects with zero tools still answers, and the tracing
plugin swallows every delivery error.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from . import store
from .analyze import meta_row, rows_for_run, summarize, task_rows, write_csv
from .config import BenchConfig, ConfigError, apply_overrides, load_config, load_tasks
from .preflight import run_preflight
from .report import build_report
from .runner import BudgetExhausted, Cell, plan_matrix, run_matrix
from .server import serve

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


def _results_root(config: BenchConfig, args: argparse.Namespace) -> Path:
    return Path(getattr(args, "out", None) or config.root / "results").resolve()


def _db(root: Path) -> Path:
    """One bench.db beside the per-run directories, shared across runs."""
    return root / "bench.db"


def _persist(config, tasks, out_dir: Path) -> list[dict]:
    """Re-derive every table from the transcripts and store it. Returns runs."""
    tables = rows_for_run(config, tasks, out_dir)
    db = _db(out_dir.parent)
    store.write_tasks(db, task_rows(tasks))
    # Provenance was previously written only by `run`, so a run that had only
    # been analyzed lost its model, git sha, targets and sink.
    if (manifest := out_dir / "manifest.json").is_file():
        store.write_meta(db, meta_row(out_dir.name, json.loads(manifest.read_text())))

    def of(rows, cell):
        return [r for r in rows if (r["label"], r["task"], r["trial"]) == cell]

    for row in tables["runs"]:
        cell = (row["label"], row["task"], row["trial"])
        store.write_cell(
            db,
            run=row,
            turns=of(tables["turns"], cell),
            tool_calls=of(tables["tool_calls"], cell),
        )
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
    run_id = args.run_id or datetime.now().strftime("%Y%m%d-%H%M%S")
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

    def progress(cell: Cell, info: dict) -> None:
        nonlocal done
        done += 1
        status = "cached" if info.get("cached") else f"turns={info.get('num_turns')}"
        print(f"  [{done}/{len(cells)}] {cell.cell_id}  {status}  ${info.get('spend', 0.0):.2f}")

    try:
        run_matrix(config, tasks, out_dir, on_cell=progress)
    except BudgetExhausted as exc:
        print(f"\n{exc}")
        return 2
    finally:
        runs = _persist(config, tasks, out_dir)
        if runs:
            db = _db(out_dir.parent)
            # Emitted here so a run ends with something to open, not a second command.
            path = build_report(
                runs,
                store.read_rows(db, "turns", out_dir.name),
                out_dir,
                tasks=store.read_rows(db, "tasks"),
                meta={"run_id": out_dir.name, "model": config.model},
            )
            print(f"\nreport: {path}")
            print(f"store:  {db}")
        print()
        print(summarize(runs))
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    tasks = load_tasks(config)
    root = _results_root(config, args)

    if args.all:
        # bench.db is a disposable index: dropping and rebuilding it from the run
        # folders is the supported way to clear anything stale.
        for suffix in ("", "-wal", "-shm"):
            (root / f"bench.db{suffix}").unlink(missing_ok=True)
        runs = []
        for folder in sorted(p for p in root.glob("*") if (p / "raw").is_dir()):
            runs.extend(_persist(config, tasks, folder))
        print(f"rebuilt {_db(root)} from {len(runs)} runs")
        print()
        print(summarize(runs))
        return 0

    out_dir = (root / args.run_id) if args.run_id else _latest_run(root)
    runs = _persist(config, tasks, out_dir)
    print(f"stored {len(runs)} runs in {_db(out_dir.parent)}")
    print()
    print(summarize(runs))
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    tasks = load_tasks(config)
    root = _results_root(config, args)
    out_dir = (root / args.run_id) if args.run_id else _latest_run(root)

    runs = _persist(config, tasks, out_dir)
    db = _db(out_dir.parent)
    path = build_report(
        runs,
        store.read_rows(db, "turns", out_dir.name),
        out_dir,
        tasks=store.read_rows(db, "tasks"),
        meta={"run_id": out_dir.name, "model": config.model},
    )
    print(f"wrote {path}")
    print("Open it directly, or `mcpbench serve` to run the benchmark from the page.")
    return 0


def cmd_annotate(args: argparse.Namespace) -> int:
    """Label a run after the fact, so what it meant is recorded where the data is."""
    config = _resolve(load_config(Path(args.config)), args)
    db = _db(_results_root(config, args))
    try:
        changed = store.annotate_run(db, args.run_id, label=args.label, note=args.note)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    if not changed:
        print(f"No stored run {args.run_id!r}. Try: mcpbench analyze --run-id {args.run_id}")
        return 1
    print(f"{args.run_id}: {changed}")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    config = _resolve(load_config(Path(args.config)), args)
    root = _results_root(config, args)
    out_dir = (root / args.run_id) if args.run_id else _latest_run(root)
    serve(config, out_dir, host=args.host, port=args.port)
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
        "--all", action="store_true", help="Drop bench.db and rebuild it from every run folder."
    )
    analyze.set_defaults(func=cmd_analyze)

    report = sub.add_parser("report", help="Write a self-contained HTML report.")
    report.add_argument("--run-id", help="Which run (default: most recent).")
    report.set_defaults(func=cmd_report)

    annotate = sub.add_parser("annotate", help="Set or change a stored run's label and note.")
    annotate.add_argument("--run-id", required=True)
    annotate.add_argument("--label", help="Rename the run's label (rewrites its stored rows).")
    annotate.add_argument("--note", help="Free-text note kept with the run.")
    annotate.set_defaults(func=cmd_annotate)

    serve_cmd = sub.add_parser("serve", help="Serve the report with run controls (localhost).")
    serve_cmd.add_argument("--run-id", help="Which run (default: most recent).")
    serve_cmd.add_argument("--host", default="127.0.0.1", help="Bind address; loopback by default.")
    serve_cmd.add_argument("--port", type=int, default=8765)
    serve_cmd.set_defaults(func=cmd_serve)
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
