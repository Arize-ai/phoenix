from __future__ import annotations

import argparse
from pathlib import Path

try:
    from ._psql import DatabaseConfig, PsqlError, add_database_arguments, run_sql
except ImportError:  # Support direct execution from this directory.
    from _psql import DatabaseConfig, PsqlError, add_database_arguments, run_sql


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Report generated PostgreSQL table sizes.")
    add_database_arguments(parser)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        print(
            run_sql(
                DatabaseConfig.from_args(args),
                Path(__file__).with_name("report_spans_table_sizes.sql"),
            )
        )
    except PsqlError as error:
        print(f"error: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
