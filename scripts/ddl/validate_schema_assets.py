"""Verify generated canonical DDL remains consumable by Phoenix's loader."""

from __future__ import annotations

from pathlib import Path

from phoenix.db.ddl import parse_schema_asset
from phoenix.db.ddl.loader import DialectName

ROOT = Path(__file__).resolve().parents[2]
DDL_DIRECTORY = ROOT / "src/phoenix/db/ddl"
SCHEMA_ASSETS: tuple[tuple[DialectName, str], ...] = (
    ("postgresql", "postgresql_schema.sql"),
    ("sqlite", "sqlite_schema.sql"),
)


def main() -> int:
    for dialect, filename in SCHEMA_ASSETS:
        path = DDL_DIRECTORY / filename
        tables = parse_schema_asset(path.read_text(encoding="utf-8"), dialect)
        print(f"{filename}: loader recognized {len(tables)} tables")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
