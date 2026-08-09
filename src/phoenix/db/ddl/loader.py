"""Load generated database DDL as package resources."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files
from typing import Literal

from sqlglot import exp, parse

DialectName = Literal["postgresql", "sqlite"]

_DIALECT_FILES: dict[DialectName, str] = {
    "postgresql": "postgresql_schema.sql",
    "sqlite": "sqlite_schema.sql",
}
_SQLGLOT_DIALECTS: dict[DialectName, str] = {"postgresql": "postgres", "sqlite": "sqlite"}
_TABLE_MARKER = re.compile(r"^-- Table: (?P<name>.+)$", re.MULTILINE)


class SchemaAssetError(ValueError):
    """Raised when a generated DDL asset is malformed or the dialects drift."""


@dataclass(frozen=True)
class PhysicalColumn:
    """A stored table column common to both supported database dialects."""

    name: str
    nullable: bool


@dataclass(frozen=True)
class ForeignKey:
    """One column pair in a physical table's foreign-key constraint."""

    column: str
    target_table: str
    target_column: str


@dataclass(frozen=True)
class PhysicalTable:
    """Dialect-independent physical metadata for one table."""

    name: str
    columns: tuple[PhysicalColumn, ...]
    foreign_keys: tuple[ForeignKey, ...]


@dataclass(frozen=True)
class TableSection:
    """The raw DDL and parsed metadata for one marker-delimited table section."""

    table: PhysicalTable
    create_table_ddl: str
    index_ddls: tuple[str, ...]
    section_text: str


@dataclass(frozen=True)
class DialectSchema:
    """A generated schema asset indexed by table name and source order."""

    dialect: DialectName
    sections: dict[str, TableSection]
    order: tuple[str, ...]


@dataclass(frozen=True)
class PhysicalCatalog:
    """Parity-checked physical schema shared by PostgreSQL and SQLite."""

    tables: dict[str, PhysicalTable]
    order: tuple[str, ...]


def _resource_text(dialect: DialectName) -> str:
    return files("phoenix.db.ddl").joinpath(_DIALECT_FILES[dialect]).read_text(encoding="utf-8")


def _statement_texts(section: str) -> tuple[str, ...]:
    """Split the section's SQL statements without treating quoted semicolons as terminators."""

    statements: list[str] = []
    start = 0
    quote: str | None = None
    index = 0
    while index < len(section):
        character = section[index]
        if quote is not None:
            if character == quote:
                if quote != "]" and index + 1 < len(section) and section[index + 1] == quote:
                    index += 2
                    continue
                quote = None
            index += 1
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character == "[":
            quote = "]"
        elif character == ";":
            statement = section[start : index + 1].strip()
            if statement:
                statements.append(statement)
            start = index + 1
        index += 1
    trailing = section[start:].strip()
    if trailing:
        statements.append(trailing)
    return tuple(statements)


def _parse_table_section(name: str, section: str, dialect: DialectName) -> TableSection:
    statements = _statement_texts(section)
    create_statements = tuple(
        statement[match.start() :]
        for statement in statements
        if (match := re.search(r"^CREATE TABLE ", statement, re.MULTILINE)) is not None
    )
    if len(create_statements) != 1:
        raise SchemaAssetError(
            f"{dialect} DDL section {name!r} must contain exactly one CREATE TABLE statement"
        )
    create_table_ddl = create_statements[0]
    parsed = parse(create_table_ddl, read=_SQLGLOT_DIALECTS[dialect])
    if (
        len(parsed) != 1
        or not isinstance(parsed[0], exp.Create)
        or not isinstance(parsed[0].this, exp.Schema)
    ):
        raise SchemaAssetError(
            f"{dialect} DDL section {name!r} has an invalid CREATE TABLE statement"
        )
    schema = parsed[0].this
    parsed_name = schema.this.name
    if parsed_name != name:
        raise SchemaAssetError(
            f"{dialect} DDL section marker {name!r} does not match CREATE TABLE {parsed_name!r}"
        )

    columns = tuple(
        PhysicalColumn(
            name=definition.name,
            nullable=not any(
                isinstance(constraint.kind, exp.NotNullColumnConstraint)
                for constraint in definition.constraints
            ),
        )
        for definition in schema.expressions
        if isinstance(definition, exp.ColumnDef)
    )
    if not columns:
        raise SchemaAssetError(f"{dialect} DDL section {name!r} has no columns")

    foreign_keys: list[ForeignKey] = []
    for constraint in schema.find_all(exp.ForeignKey):
        reference = constraint.args["reference"].this
        if not isinstance(reference, exp.Schema):
            raise SchemaAssetError(f"{dialect} DDL section {name!r} has an invalid foreign key")
        target_table = reference.this.name
        source_columns = constraint.expressions
        target_columns = reference.expressions
        if len(source_columns) != len(target_columns):
            raise SchemaAssetError(f"{dialect} DDL section {name!r} has an invalid foreign key")
        foreign_keys.extend(
            ForeignKey(
                column=source_column.name,
                target_table=target_table,
                target_column=target_column.name,
            )
            for source_column, target_column in zip(source_columns, target_columns)
        )

    index_ddls = tuple(
        statement[match.start() :]
        for statement in statements
        if (match := re.search(r"^CREATE (?:UNIQUE )?INDEX ", statement, re.MULTILINE)) is not None
    )
    return TableSection(
        table=PhysicalTable(name=name, columns=columns, foreign_keys=tuple(foreign_keys)),
        create_table_ddl=create_table_ddl,
        index_ddls=index_ddls,
        section_text=section.strip(),
    )


@lru_cache
def load_dialect_schema(dialect: DialectName) -> DialectSchema:
    """Load and validate one generated schema asset from the installed package."""

    text = _resource_text(dialect)
    markers = tuple(_TABLE_MARKER.finditer(text))
    if not markers:
        raise SchemaAssetError(f"{dialect} DDL asset has no table markers")

    sections: dict[str, TableSection] = {}
    order: list[str] = []
    for index, marker in enumerate(markers):
        name = marker.group("name").strip()
        if name in sections:
            raise SchemaAssetError(f"{dialect} DDL asset has duplicate table marker {name!r}")
        section_end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        sections[name] = _parse_table_section(name, text[marker.end() : section_end], dialect)
        order.append(name)
    return DialectSchema(dialect=dialect, sections=sections, order=tuple(order))


@lru_cache
def load_physical_catalog() -> PhysicalCatalog:
    """Return the physical catalog after asserting PostgreSQL/SQLite column parity."""

    postgresql = load_dialect_schema("postgresql")
    sqlite = load_dialect_schema("sqlite")
    if set(postgresql.sections) != set(sqlite.sections):
        raise SchemaAssetError(
            "PostgreSQL and SQLite DDL assets have different tables: "
            f"only PostgreSQL={sorted(set(postgresql.sections) - set(sqlite.sections))}, "
            f"only SQLite={sorted(set(sqlite.sections) - set(postgresql.sections))}"
        )

    for name in postgresql.order:
        postgresql_columns = postgresql.sections[name].table.columns
        sqlite_columns = sqlite.sections[name].table.columns
        if postgresql_columns != sqlite_columns:
            raise SchemaAssetError(
                f"PostgreSQL and SQLite DDL assets disagree on columns for {name!r}: "
                f"PostgreSQL={[column.name for column in postgresql_columns]}, "
                f"SQLite={[column.name for column in sqlite_columns]}"
            )
    return PhysicalCatalog(
        tables={name: postgresql.sections[name].table for name in postgresql.order},
        order=postgresql.order,
    )


def clear_schema_cache() -> None:
    """Clear package-resource caches for tests that replace generated assets."""

    load_dialect_schema.cache_clear()
    load_physical_catalog.cache_clear()
