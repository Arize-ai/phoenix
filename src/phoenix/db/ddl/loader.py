"""Load generated DDL with a format-specific scanner to avoid SQLGlot dialect bugs."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files
from types import MappingProxyType
from typing import Literal, Mapping

DialectName = Literal["postgresql", "sqlite"]

_DIALECT_FILES: Mapping[DialectName, str] = MappingProxyType(
    {
        "postgresql": "postgresql_schema.sql",
        "sqlite": "sqlite_schema.sql",
    }
)
_TABLE_MARKER = re.compile(r"^-- Table: (?P<name>.+)$", re.MULTILINE)
_CREATE_TABLE = re.compile(
    r"^\s*CREATE\s+TABLE\s+(?:(?P<schema>[A-Za-z_][A-Za-z0-9_]*)\.)?"
    r"(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\(",
    re.MULTILINE,
)
_NOT_NULL = re.compile(r"\bNOT\s+NULL\b", re.IGNORECASE)
_CONSTRAINT_PREFIXES = frozenset({"CHECK", "CONSTRAINT", "FOREIGN", "PRIMARY", "UNIQUE"})


class SchemaAssetError(ValueError):
    """Raised when a generated DDL asset is malformed or the dialects drift."""


@dataclass(frozen=True)
class PhysicalColumn:
    """A stored table column common to both supported database dialects."""

    name: str
    nullable: bool


@dataclass(frozen=True)
class TableSchema:
    """Generated DDL and physical metadata for one table."""

    name: str
    create_table_ddl: str
    columns: tuple[PhysicalColumn, ...]


@dataclass(frozen=True)
class DialectSchema:
    """A generated schema asset indexed by table name."""

    dialect: DialectName
    tables: Mapping[str, TableSchema]


def _identifier(token: str) -> str:
    """Decode the identifier quoting emitted by the DDL generators."""

    token = token.strip()
    if token.startswith('"') and token.endswith('"'):
        return token[1:-1].replace('""', '"')
    if token.startswith("`") and token.endswith("`"):
        return token[1:-1].replace("``", "`")
    if token.startswith("[") and token.endswith("]"):
        return token[1:-1]
    return token


def _resource_text(dialect: DialectName) -> str:
    return files("phoenix.db.ddl").joinpath(_DIALECT_FILES[dialect]).read_text(encoding="utf-8")


def _find_statement_end(text: str, start: int) -> int:
    """Return the semicolon ending a generated statement."""

    quote: str | None = None
    depth = 0
    index = start
    while index < len(text):
        character = text[index]
        if quote is not None:
            if character == quote:
                if quote != "]" and index + 1 < len(text) and text[index + 1] == quote:
                    index += 2
                    continue
                quote = None
            index += 1
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character == "[":
            quote = "]"
        elif character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
        elif character == ";" and depth == 0:
            return index + 1
        index += 1
    raise SchemaAssetError("Generated CREATE TABLE statement has no terminator")


def _split_definitions(body: str) -> tuple[str, ...]:
    """Split top-level comma-separated definitions in generated CREATE TABLE DDL."""

    definitions: list[str] = []
    start = 0
    quote: str | None = None
    depth = 0
    for index, character in enumerate(body):
        if quote is not None:
            if character == quote:
                quote = None
            continue
        if character in {"'", '"', "`"}:
            quote = character
        elif character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
        elif character == "," and depth == 0:
            definitions.append(body[start:index].strip())
            start = index + 1
    definitions.append(body[start:].strip())
    return tuple(definition for definition in definitions if definition)


def _parse_table_section(name: str, section: str, dialect: DialectName) -> TableSchema:
    match = _CREATE_TABLE.search(section)
    if match is None:
        raise SchemaAssetError(
            f"{dialect} DDL section {name!r} must contain exactly one CREATE TABLE statement"
        )
    if _CREATE_TABLE.search(section, match.end()) is not None:
        raise SchemaAssetError(
            f"{dialect} DDL section {name!r} has multiple CREATE TABLE statements"
        )
    if match.group("name") != name:
        raise SchemaAssetError(
            f"{dialect} DDL section marker {name!r} does not match CREATE TABLE "
            f"{match.group('name')!r}"
        )
    statement_end = _find_statement_end(section, match.start())
    create_table_ddl = section[match.start() : statement_end].strip()
    body = create_table_ddl[match.end() - match.start() : -2]
    columns: list[PhysicalColumn] = []
    for definition in _split_definitions(body):
        first = definition.split(None, 1)[0]
        if first.upper() not in _CONSTRAINT_PREFIXES:
            columns.append(
                PhysicalColumn(
                    name=_identifier(first), nullable=_NOT_NULL.search(definition) is None
                )
            )
    if not columns:
        raise SchemaAssetError(f"{dialect} DDL section {name!r} has no columns")
    return TableSchema(
        name=name,
        create_table_ddl=create_table_ddl,
        columns=tuple(columns),
    )


@lru_cache
def load_dialect_schema(dialect: DialectName) -> DialectSchema:
    """Load and validate one generated schema asset from the installed package."""

    text = _resource_text(dialect)
    markers = tuple(_TABLE_MARKER.finditer(text))
    if not markers:
        raise SchemaAssetError(f"{dialect} DDL asset has no table markers")

    tables: dict[str, TableSchema] = {}
    for index, marker in enumerate(markers):
        name = marker.group("name").strip()
        if name in tables:
            raise SchemaAssetError(f"{dialect} DDL asset has duplicate table marker {name!r}")
        section_end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        tables[name] = _parse_table_section(name, text[marker.end() : section_end], dialect)
    return DialectSchema(dialect=dialect, tables=MappingProxyType(tables))
