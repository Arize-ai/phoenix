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
        probability,
        run_sql,
    )
except ImportError:  # Support direct execution from this directory.
    from _psql import (
        DatabaseConfig,
        PsqlError,
        add_database_arguments,
        positive_int,
        probability,
        run_sql,
    )

DEFAULT_ANNOTATION_NAMES = "correctness,helpfulness,relevance,safety,coherence,note"
SQL_SCRIPT = Path(__file__).with_name("generate_span_annotations.sql")


def annotation_names(value: str) -> str:
    names = [name.strip() for name in value.split(",") if name.strip()]
    if not names:
        raise argparse.ArgumentTypeError("must contain at least one name")
    if any("," in name or "'" in name for name in names):
        raise argparse.ArgumentTypeError("names cannot contain commas or single quotes")
    return ",".join(names)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Add realistic evaluation annotations to sampled PostgreSQL spans."
    )
    add_database_arguments(parser)
    parser.add_argument("--limit", type=positive_int, default=10_000)
    parser.add_argument("--max-annotations-per-span", type=positive_int, default=10)
    parser.add_argument("--label-missing-prob", type=probability, default=0.1)
    parser.add_argument("--score-missing-prob", type=probability, default=0.1)
    parser.add_argument("--explanation-missing-prob", type=probability, default=0.1)
    parser.add_argument("--metadata-missing-prob", type=probability, default=0.1)
    parser.add_argument(
        "--annotation-names",
        type=annotation_names,
        default=DEFAULT_ANNOTATION_NAMES,
        help=f"Comma-separated names (default: {DEFAULT_ANNOTATION_NAMES}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize the workload without connecting to PostgreSQL.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    print(f"span_sample_limit={args.limit}")
    print(f"max_annotations_per_span={args.max_annotations_per_span}")
    print(f"annotation_names={args.annotation_names}")
    if args.dry_run:
        print("dry_run=true")
        return 0

    variables = {
        "limit": args.limit,
        "max_annotations_per_span": args.max_annotations_per_span,
        "label_missing_prob": args.label_missing_prob,
        "score_missing_prob": args.score_missing_prob,
        "explanation_missing_prob": args.explanation_missing_prob,
        "metadata_missing_prob": args.metadata_missing_prob,
        "annotation_names": args.annotation_names,
    }
    started_at = time.monotonic()
    try:
        output = run_sql(DatabaseConfig.from_args(args), SQL_SCRIPT, variables=variables)
    except PsqlError as error:
        print(f"error: {error}")
        return 1
    if output:
        print(output)
    print(f"duration={timedelta(seconds=round(time.monotonic() - started_at))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
