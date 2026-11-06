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


def _canonical_assets(
    postgresql_args: str,
    sqlite_args: str,
) -> tuple[tuple[SupportedSQLDialectName, str], ...]:
    """Return packaged assets whose generator invocation wrote canonical output."""
    generator_args = {
        "postgresql": postgresql_args,
        "sqlite": sqlite_args,
    }
    assets: list[tuple[SupportedSQLDialectName, str]] = []
    for dialect, filename in SCHEMA_ASSETS:
        if _writes_canonical(
            generator_args[dialect],
            canonical_output=DDL_DIRECTORY / filename,
            external_output=Path(__file__).with_name(filename),
        ):
            assets.append((dialect, filename))
    return tuple(assets)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--postgresql-args", default="")
    parser.add_argument("--sqlite-args", default="")
    args = parser.parse_args()
    assets = _canonical_assets(args.postgresql_args, args.sqlite_args)
    if not assets:
        print("Skipping canonical DDL validation: no generator wrote a canonical output")
        return 0
    for dialect, filename in assets:
        path = DDL_DIRECTORY / filename
        tables = parse_schema_asset(path.read_text(encoding="utf-8"), dialect)
        print(f"{filename}: loader recognized {len(tables)} tables")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
