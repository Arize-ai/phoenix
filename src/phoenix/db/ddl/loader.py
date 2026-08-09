"""Load generated DDL with a format-specific scanner to avoid SQLGlot dialect bugs."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files
from types import MappingProxyType
from typing import Mapping

from phoenix.db.helpers import SupportedSQLDialectName

DialectName = SupportedSQLDialectName

_DIALECT_FILES: Mapping[DialectName, str] = MappingProxyType(
    {
        "postgresql": "postgresql_schema.sql",
        "sqlite": "sqlite_schema.sql",
    }
)
_TABLE_MARKER = re.compile(r"^-- Table: (?P<name>.+)$", re.MULTILINE)
_CREATE_TABLE = re.compile(r"^\s*CREATE\s+TABLE\s+", re.MULTILINE)
_CONSTRAINT_PREFIXES = frozenset({"CHECK", "CONSTRAINT", "FOREIGN", "PRIMARY", "UNIQUE"})


class SchemaAssetError(ValueError):
    """Raised when a generated DDL asset is malformed or the dialects drift."""


@dataclass(frozen=True)
class TableSchema:
    """Raw generated DDL and ordered physical column names for one table."""

    create_table_ddl: str
    columns: tuple[str, ...]


def _identifier(token: str) -> str:
    """Decode the identifier quoting emitted by the DDL generators."""

    token = token.strip()
    if token.startswith('"') and token.endswith('"'):
        return token[1:-1].replace('""', '"')
    if token.startswith("`") and token.endswith("`"):
        return token[1:-1].replace("``", "`")
    if token.startswith("[") and token.endswith("]"):
        return token[1:-1].replace("]]", "]")
    return token


def _consume_identifier(text: str, start: int = 0) -> tuple[str, int]:
    """Return one generated-DLL identifier token and its exclusive end position."""

    index = start
    while index < len(text) and text[index].isspace():
        index += 1
    if index == len(text):
        raise SchemaAssetError("Expected an identifier")

    opening_delimiter = text[index]
    closing_delimiter = {"'": "'", '"': '"', "`": "`", "[": "]"}.get(opening_delimiter)
    if closing_delimiter is not None:
        token_start = index
        index += 1
        while index < len(text):
            if text[index] == closing_delimiter:
                if index + 1 < len(text) and text[index + 1] == closing_delimiter:
                    index += 2
                    continue
                return text[token_start : index + 1], index + 1
            index += 1
        raise SchemaAssetError("Unterminated quoted identifier")

    token_start = index
    while index < len(text) and (text[index].isalnum() or text[index] in {"_", "$"}):
        index += 1
    if index == token_start:
        raise SchemaAssetError("Expected an identifier")
    return text[token_start:index], index


def _parse_create_table(section: str) -> tuple[re.Match[str], str, int]:
    """Locate one CREATE TABLE statement and return its name and body start."""

    match = _CREATE_TABLE.search(section)
    if match is None:
        raise SchemaAssetError("DDL section must contain a CREATE TABLE statement")

    name_token, index = _consume_identifier(section, match.end())
    table_name = _identifier(name_token)
    while index < len(section) and section[index].isspace():
        index += 1
    if index < len(section) and section[index] == ".":
        name_token, index = _consume_identifier(section, index + 1)
        table_name = _identifier(name_token)
        while index < len(section) and section[index].isspace():
            index += 1
    if index == len(section) or section[index] != "(":
        raise SchemaAssetError("CREATE TABLE name must be followed by an opening parenthesis")
    return match, table_name, index + 1


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
                if index + 1 < len(text) and text[index + 1] == quote:
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
    index = 0
    while index < len(body):
        character = body[index]
        if quote is not None:
            if character == quote:
                if index + 1 < len(body) and body[index + 1] == quote:
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
        elif character == "," and depth == 0:
            definitions.append(body[start:index].strip())
            start = index + 1
        index += 1
    definitions.append(body[start:].strip())
    return tuple(definition for definition in definitions if definition)


def _parse_table_section(name: str, section: str, dialect: DialectName) -> TableSchema:
    try:
        match, table_name, body_start = _parse_create_table(section)
    except SchemaAssetError as error:
        raise SchemaAssetError(
            f"{dialect} DDL section {name!r} must contain exactly one CREATE TABLE statement"
        ) from error
    if _CREATE_TABLE.search(section, match.end()) is not None:
        raise SchemaAssetError(
            f"{dialect} DDL section {name!r} has multiple CREATE TABLE statements"
        )
    if table_name != name:
        raise SchemaAssetError(
            f"{dialect} DDL section marker {name!r} does not match CREATE TABLE {table_name!r}"
        )
    statement_end = _find_statement_end(section, match.start())
    raw_statement = section[match.start() : statement_end]
    create_table_ddl = raw_statement.strip()
    statement = raw_statement.removesuffix(";").rstrip()
    if not statement.endswith(")"):
        raise SchemaAssetError(f"{dialect} DDL section {name!r} has an unterminated table body")
    body = statement[body_start - match.start() : -1]
    columns: list[str] = []
    for definition in _split_definitions(body):
        first, _ = _consume_identifier(definition)
        if first[0] in {'"', "`", "["} or first.upper() not in _CONSTRAINT_PREFIXES:
            columns.append(_identifier(first))
    if not columns:
        raise SchemaAssetError(f"{dialect} DDL section {name!r} has no columns")
    return TableSchema(
        create_table_ddl=create_table_ddl,
        columns=tuple(columns),
    )


def parse_schema_asset(text: str, dialect: DialectName) -> Mapping[str, TableSchema]:
    """Validate generated DDL text and return its immutable table map."""

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
    return MappingProxyType(tables)


@lru_cache
def load_dialect_schema(dialect: DialectName) -> Mapping[str, TableSchema]:
    """Load and validate one generated schema asset from the installed package."""

    return parse_schema_asset(_resource_text(dialect), dialect)
