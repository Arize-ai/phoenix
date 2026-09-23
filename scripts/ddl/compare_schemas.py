# /// script
# dependencies = []
# ///
"""Cross-dialect schema comparison.

Both checked-in schema files materialize one logical schema: the same models and
migration sequence rendered for PostgreSQL and for SQLite. Each generator
validates only against its own database, so a migration that creates a table or
column under one dialect and not the other yields two internally consistent
files that disagree with each other.

Compared: the set of tables, the name and position of every column, the names of
explicitly created indexes, and the names of CHECK, UNIQUE, and FOREIGN KEY
constraints.

Names are normalized for identifier length before comparison. PostgreSQL caps
identifiers at 63 bytes and SQLite does not, so SQLAlchemy shortens long
generated names for PostgreSQL only; comparing raw names would report that as
drift. See truncate_identifier.

Constraints are compared by name rather than by expression, since each dialect
deparses the same constraint differently: SQLite keeps "kind IN ('A', 'B')"
where PostgreSQL returns
"((kind)::text = ANY ((ARRAY['A'::character varying, ...])::text[]))".

Not compared, because the dialects are entitled to differ:

- Constraint-backed indexes. PostgreSQL backs every PRIMARY KEY and UNIQUE
  constraint with an index; SQLite creates none for an INTEGER PRIMARY KEY,
  which aliases the rowid the table is already stored by. Neither generator
  emits them, since the implying constraint is already inside CREATE TABLE.
- PRIMARY KEY names. SQLite must render a rowid primary key inline as
  "id INTEGER PRIMARY KEY AUTOINCREMENT", which carries no constraint name.
- Column types (serial vs INTEGER, JSONB vs JSON), defaults (now() vs
  CURRENT_TIMESTAMP), enum types versus CHECK constraints, and index definitions
  (btree operator classes versus SQLite expressions).

Usage:
    python compare_schemas.py
    python compare_schemas.py --postgresql other_pg.sql --sqlite other_sqlite.sql
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

# NAMEDATALEN - 1. SQLite has no equivalent cap.
POSTGRESQL_MAX_IDENTIFIER_LENGTH = 63
DDL_DIRECTORY = Path(__file__).resolve().parents[2] / "src/phoenix/db/ddl"

# A definition starts at exactly four spaces. The PostgreSQL generator wraps
# long constraints onto continuation lines indented further, and those carry
# fragments like "REFERENCES public.users (id)" that must not read as columns.
DEFINITION_PATTERN = re.compile(r"^ {4}\S")
CREATE_TABLE_PATTERN = re.compile(r'^CREATE TABLE (?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"? \($')
CREATE_INDEX_PATTERN = re.compile(r"^CREATE (?:UNIQUE )?INDEX (\w+) ON")
IDENTIFIER_PATTERN = re.compile(r'"?([A-Za-z_][A-Za-z0-9_]*)"?$')

# Keywords that open a table-level constraint rather than a column.
CONSTRAINT_KEYWORDS = frozenset({"CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "EXCLUDE"})

# Named constraints by kind. The name is quoted when the naming convention
# embeds backticks and bare otherwise; \s+ spans the newline the PostgreSQL
# generator inserts when wrapping a long constraint, which puts the name and the
# keyword on separate lines. PRIMARY KEY is absent because SQLite renders a
# rowid primary key inline, with no constraint name to match against.
CONSTRAINT_PATTERNS = {
    "CHECK": re.compile(r'CONSTRAINT\s+("[^"]+"|\w+)\s+CHECK\b'),
    "UNIQUE": re.compile(r'CONSTRAINT\s+("[^"]+"|\w+)\s+UNIQUE\b'),
    "FOREIGN KEY": re.compile(r'CONSTRAINT\s+("[^"]+"|\w+)\s+FOREIGN KEY\b'),
}


def truncate_identifier(name: str, max_length: int = POSTGRESQL_MAX_IDENTIFIER_LENGTH) -> str:
    """Shorten a name the way SQLAlchemy does when a dialect caps identifiers.

    Mirrors _truncate_and_render_maxlen_name in sqlalchemy/sql/compiler.py: keep
    the first max_length - 8 characters, then append an underscore and the last
    four hex digits of the name's MD5. A no-op for names within the cap.

    Reimplemented rather than imported to keep this script dependency-free. A
    future change to SQLAlchemy's rule surfaces as a reported difference, which
    is the safe direction to fail in.
    """
    if len(name) <= max_length:
        return name
    digest = hashlib.md5(name.encode("utf-8")).hexdigest()[-4:]
    return f"{name[0 : max_length - 8]}_{digest}"


def parse_schema(
    path: Path,
) -> tuple[dict[str, list[str]], set[str], dict[str, dict[str, set[str]]]]:
    """Return each table's ordered columns, the explicit index names, and constraint names.

    Every name is passed through truncate_identifier so the two dialects are
    compared on equal terms.
    """
    tables: dict[str, list[str]] = {}
    indexes: set[str] = set()
    constraints: dict[str, dict[str, set[str]]] = {}
    current_table: str | None = None
    block: list[str] = []

    def close_table() -> None:
        """Extract the finished table's constraint names, by kind.

        Scans the whole block rather than line by line, since a wrapped
        PostgreSQL constraint puts its name and keyword on different lines.
        """
        if current_table is None:
            return
        body = "\n".join(block)
        constraints[current_table] = {
            kind: {truncate_identifier(name.strip('"')) for name in pattern.findall(body)}
            for kind, pattern in CONSTRAINT_PATTERNS.items()
        }

    for line in path.read_text(encoding="utf-8").splitlines():
        table_match = CREATE_TABLE_PATTERN.match(line)
        if table_match is not None:
            close_table()
            current_table = str(table_match.group(1))
            tables[current_table] = []
            block = []
            continue

        index_match = CREATE_INDEX_PATTERN.match(line)
        if index_match:
            indexes.add(truncate_identifier(index_match.group(1)))
            continue

        if current_table is None:
            continue
        block.append(line)
        if line.startswith(")"):
            close_table()
            current_table = None
            continue
        if not DEFINITION_PATTERN.match(line):
            continue

        token = line.strip().rstrip(",").split(None, 1)[0]
        if token.upper() in CONSTRAINT_KEYWORDS:
            continue
        # Skips stray closers from the PostgreSQL generator's multi-line ARRAY
        # formatting, which sit at four spaces but are not identifiers.
        identifier = IDENTIFIER_PATTERN.fullmatch(token)
        if identifier is None:
            continue
        tables[current_table].append(identifier.group(1))

    close_table()  # a file whose last table is not followed by another
    return tables, indexes, constraints


def verify_parse(path: Path, tables: dict[str, list[str]]) -> list[str]:
    """Reject an implausible parse, so a broken reader cannot report agreement.

    Two empty parses compare equal; without this the check would report success
    precisely when it had stopped working.
    """
    problems: list[str] = []
    if not tables:
        problems.append(f"{path.name}: no CREATE TABLE statements found")
    empty = sorted(name for name, columns in tables.items() if not columns)
    if empty:
        problems.append(f"{path.name}: tables parsed with no columns: {empty}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Verify the PostgreSQL and SQLite schema files describe the same"
            " tables, columns, and indexes"
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--postgresql",
        type=Path,
        default=DDL_DIRECTORY / "postgresql_schema.sql",
        help="PostgreSQL schema file",
    )
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=DDL_DIRECTORY / "sqlite_schema.sql",
        help="SQLite schema file",
    )
    args = parser.parse_args()

    for path in (args.postgresql, args.sqlite):
        if not path.is_file():
            print(f"Error: schema file not found: {path}", file=sys.stderr)
            return 1

    postgresql_tables, postgresql_indexes, postgresql_constraints = parse_schema(args.postgresql)
    sqlite_tables, sqlite_indexes, sqlite_constraints = parse_schema(args.sqlite)

    parse_problems = verify_parse(args.postgresql, postgresql_tables) + verify_parse(
        args.sqlite, sqlite_tables
    )
    if parse_problems:
        for problem in parse_problems:
            print(f"Error: {problem}", file=sys.stderr)
        return 1

    postgresql_columns = sum(len(columns) for columns in postgresql_tables.values())
    sqlite_columns = sum(len(columns) for columns in sqlite_tables.values())

    def constraint_count(parsed: dict[str, dict[str, set[str]]]) -> int:
        return sum(len(names) for kinds in parsed.values() for names in kinds.values())

    print(
        f"PostgreSQL: {len(postgresql_tables)} tables, {postgresql_columns} columns, "
        f"{len(postgresql_indexes)} explicit indexes, "
        f"{constraint_count(postgresql_constraints)} named constraints"
    )
    print(
        f"SQLite:     {len(sqlite_tables)} tables, {sqlite_columns} columns, "
        f"{len(sqlite_indexes)} explicit indexes, "
        f"{constraint_count(sqlite_constraints)} named constraints"
    )

    differences: list[str] = []

    only_postgresql = sorted(set(postgresql_tables) - set(sqlite_tables))
    only_sqlite = sorted(set(sqlite_tables) - set(postgresql_tables))
    if only_postgresql:
        differences.append(f"tables only in PostgreSQL: {only_postgresql}")
    if only_sqlite:
        differences.append(f"tables only in SQLite: {only_sqlite}")

    for table in sorted(set(postgresql_tables) & set(sqlite_tables)):
        postgresql_column_names = postgresql_tables[table]
        sqlite_column_names = sqlite_tables[table]
        if postgresql_column_names == sqlite_column_names:
            continue
        missing = [c for c in postgresql_column_names if c not in sqlite_column_names]
        extra = [c for c in sqlite_column_names if c not in postgresql_column_names]
        if missing or extra:
            differences.append(
                f"{table}: columns only in PostgreSQL {missing}, only in SQLite {extra}"
            )
        else:
            differences.append(
                f"{table}: same columns in a different order "
                f"(PostgreSQL {postgresql_column_names}, SQLite {sqlite_column_names})"
            )

    for table in sorted(set(postgresql_constraints) & set(sqlite_constraints)):
        for kind in CONSTRAINT_PATTERNS:
            postgresql_names = postgresql_constraints[table][kind]
            sqlite_names = sqlite_constraints[table][kind]
            missing = sorted(postgresql_names - sqlite_names)
            extra = sorted(sqlite_names - postgresql_names)
            if missing or extra:
                differences.append(
                    f"{table}: {kind} constraints only in PostgreSQL {missing}, "
                    f"only in SQLite {extra}"
                )

    only_postgresql_indexes = sorted(postgresql_indexes - sqlite_indexes)
    only_sqlite_indexes = sorted(sqlite_indexes - postgresql_indexes)
    if only_postgresql_indexes:
        differences.append(f"indexes only in PostgreSQL: {only_postgresql_indexes}")
    if only_sqlite_indexes:
        differences.append(f"indexes only in SQLite: {only_sqlite_indexes}")

    if differences:
        print("\n❌ The dialects describe different schemas", file=sys.stderr)
        for difference in differences:
            print(f"  {difference}", file=sys.stderr)
        return 1

    print(
        "✅ Both dialects describe the same tables, columns, explicit indexes,"
        " and CHECK/UNIQUE/FOREIGN KEY constraints"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
