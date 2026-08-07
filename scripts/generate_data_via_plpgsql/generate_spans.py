from __future__ import annotations

import argparse
import time
from datetime import timedelta
from pathlib import Path

try:
    from ._psql import (
        DatabaseConfig,
        PsqlError,
        add_database_arguments,
        positive_int,
        run_sql,
    )
except ImportError:  # Support direct execution from this directory.
    from _psql import DatabaseConfig, PsqlError, add_database_arguments, positive_int, run_sql

SCRIPT_DIRECTORY = Path(__file__).resolve().parent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate high-volume trace data directly in PostgreSQL."
    )
    add_database_arguments(parser)
    parser.add_argument("--num-batches", type=positive_int, default=10)
    parser.add_argument("--traces-per-batch", type=positive_int, default=100)
    parser.add_argument(
        "--report",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Print table sizes after generation (default: enabled).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize the workload without connecting to PostgreSQL.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = DatabaseConfig.from_args(args)
    total_traces = args.num_batches * args.traces_per_batch
    print(f"traces={total_traces}")
    print(f"batches={args.num_batches}")
    print(f"traces_per_batch={args.traces_per_batch}")
    if args.dry_run:
        print("dry_run=true")
        return 0

    started_at = time.monotonic()
    try:
        for batch in range(1, args.num_batches + 1):
            batch_started_at = time.monotonic()
            run_sql(
                config,
                SCRIPT_DIRECTORY / "generate_spans.sql",
                variables={"num_traces": args.traces_per_batch},
            )
            duration = timedelta(seconds=round(time.monotonic() - batch_started_at))
            print(f"batch={batch}/{args.num_batches} duration={duration}")
        print(f"duration={timedelta(seconds=round(time.monotonic() - started_at))}")
        if args.report:
            print(run_sql(config, SCRIPT_DIRECTORY / "report_spans_table_sizes.sql"))
    except PsqlError as error:
        print(f"error: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
