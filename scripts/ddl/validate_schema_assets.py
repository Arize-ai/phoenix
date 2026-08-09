"""Verify generated canonical DDL remains consumable by Phoenix's loader."""

from __future__ import annotations

import argparse
import shlex
from pathlib import Path

from phoenix.db.ddl import parse_schema_asset
from phoenix.db.helpers import SupportedSQLDialectName

ROOT = Path(__file__).resolve().parents[2]
DDL_DIRECTORY = ROOT / "src/phoenix/db/ddl"
SCHEMA_ASSETS: tuple[tuple[SupportedSQLDialectName, str], ...] = (
    ("postgresql", "postgresql_schema.sql"),
    ("sqlite", "sqlite_schema.sql"),
)


def _writes_canonical(args: str, *, canonical_output: Path, external_output: Path) -> bool:
    """Whether one generator invocation resolved its output to the packaged asset."""
    arguments = shlex.split(args)
    external = "--external" in arguments
    output: Path | None = None
    for index, argument in enumerate(arguments):
        if argument == "--output":
            if index + 1 == len(arguments):
                raise ValueError("--output requires a path")
            output = Path(arguments[index + 1])
        elif argument.startswith("--output="):
            output = Path(argument.removeprefix("--output="))
    resolved = output or (external_output if external else canonical_output)
    return resolved.resolve() == canonical_output.resolve()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--postgresql-args", default="")
    parser.add_argument("--sqlite-args", default="")
    args = parser.parse_args()
    writes_postgresql = _writes_canonical(
        args.postgresql_args,
        canonical_output=DDL_DIRECTORY / "postgresql_schema.sql",
        external_output=Path(__file__).with_name("postgresql_schema.sql"),
    )
    writes_sqlite = _writes_canonical(
        args.sqlite_args,
        canonical_output=DDL_DIRECTORY / "sqlite_schema.sql",
        external_output=Path(__file__).with_name("sqlite_schema.sql"),
    )
    if not (writes_postgresql and writes_sqlite):
        print("Skipping canonical DDL validation: a generator wrote a non-canonical output")
        return 0
    for dialect, filename in SCHEMA_ASSETS:
        path = DDL_DIRECTORY / filename
        tables = parse_schema_asset(path.read_text(encoding="utf-8"), dialect)
        print(f"{filename}: loader recognized {len(tables)} tables")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
