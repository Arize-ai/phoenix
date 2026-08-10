"""Render the allowlisted schema as DDL.

The schema is described in the form callers write rather than a JSON transcript
of it. Two reasons, one measured and one structural.

Measured: DDL costs roughly a third fewer tokens than the equivalent JSON for
the same content, because every column in JSON repeats the key names ``name``,
``type`` and ``nullable``.

Structural: a JSON type is an abstraction and DDL is not. The manifest calls
``start_time`` a ``datetime``, which is true of both backends and useful to
neither -- it is ``TIMESTAMP`` on SQLite and ``TIMESTAMP WITH TIME ZONE`` on
PostgreSQL, and a caller writing a comparison or a CAST needs the real one.
The generated DDL assets are the physical schema source of truth, so this
module selects their ``CREATE TABLE`` statements without re-synthesizing them.

Curation the database cannot know -- which area a table belongs to, what one
row means, and how to reach the project -- rides along as ``--`` comments.
They are read, never executed, so the only constraint is that the result still
parses; `validate_ddl` enforces that.

Comments must not be round-tripped through SQLGlot to produce the output. It
parses them correctly but re-emits them as ``/* */`` and normalizes type
spellings (``VARCHAR`` becomes ``TEXT``), which would report a type the
deployment does not have. It is used to check the text, not to produce it.
"""

from __future__ import annotations

import re
from typing import Literal, Optional, cast

import sqlglot

from phoenix.db.ddl import load_dialect_schema
from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.allowlist import (
    TableSpec,
    load_allowlist,
)
from phoenix.server.mcp_analytics_sql.manifest import manifest

__all__ = ["DetailLevel", "render_schema_ddl", "validate_ddl"]

_SQLGLOT_DIALECT = {"postgresql": "postgres", "sqlite": "sqlite"}
DetailLevel = Literal["brief", "detailed", "full"]
_POSTGRES_PUBLIC_TABLE_REFERENCE = re.compile(
    r"\b(?:CREATE\s+TABLE|REFERENCES)\s+public\.", re.IGNORECASE
)


def _unqualify_postgresql_ddl(create_table_ddl: str) -> str:
    """Remove ``public.`` only from the PostgreSQL table-definition syntax."""
    parts: list[str] = []
    index = 0
    quote: str | None = None
    while index < len(create_table_ddl):
        character = create_table_ddl[index]
        if quote is not None:
            parts.append(character)
            if character == quote:
                if index + 1 < len(create_table_ddl) and create_table_ddl[index + 1] == quote:
                    parts.append(quote)
                    index += 2
                    continue
                quote = None
            index += 1
            continue
        if create_table_ddl.startswith("--", index):
            line_end = create_table_ddl.find("\n", index)
            if line_end == -1:
                return "".join(parts) + create_table_ddl[index:]
            parts.append(create_table_ddl[index : line_end + 1])
            index = line_end + 1
            continue
        if create_table_ddl.startswith("/*", index):
            comment_end = create_table_ddl.find("*/", index + 2)
            if comment_end == -1:
                return "".join(parts) + create_table_ddl[index:]
            parts.append(create_table_ddl[index : comment_end + 2])
            index = comment_end + 2
            continue
        if character in {"'", '"'}:
            quote = character
            parts.append(character)
            index += 1
            continue
        match = _POSTGRES_PUBLIC_TABLE_REFERENCE.match(create_table_ddl, index)
        if match is not None:
            parts.append(match.group()[: -len("public.")])
            index = match.end()
            continue
        parts.append(character)
        index += 1
    return "".join(parts)


def _render_table(spec: TableSpec, *, detail: DetailLevel, create_table_ddl: str) -> list[str]:
    if detail == "brief":
        # A catalogue rather than a schema: names and meanings only, because a
        # caller at this stage is still choosing which table to ask about and
        # cannot use a column list yet. Rendered as comments, not as
        # `CREATE TABLE spans (...)`, which reads like DDL but is not valid SQL
        # and would teach an ellipsis that no backend accepts.
        return [f"-- {spec.name}: {spec.grain}" if spec.grain else f"-- {spec.name}"]
    return [create_table_ddl]


def _render_curation(spec: TableSpec) -> list[str]:
    """Render non-relational curation comments for one table."""

    lines: list[str] = []
    for column in sorted(spec.virtual_columns):
        lines.append(f"-- query-only virtual column: {column}")
    if spec.time_column:
        lines.append(f"-- {spec.time_column}: time column")
    for column, note in sorted(spec.column_notes.items()):
        lines.append(f"-- {column}: {note}")
    if spec.promoted_columns_note:
        lines.append(f"-- {spec.promoted_columns_note}")
    return lines


def render_schema_ddl(
    *,
    area: Optional[str] = None,
    tables: Optional[list[str]] = None,
    detail: DetailLevel = "brief",
    search: Optional[str] = None,
    dialect: str = "postgresql",
) -> str:
    """Render the selected part of the allowlisted schema as DDL text."""
    curation = manifest()
    dialect_name = cast(SupportedSQLDialectName, dialect)
    allowlist = load_allowlist(dialect_name)
    schema = load_dialect_schema(dialect_name)
    chunks: list[str] = []

    for area_name in [area] if area else curation.areas:
        if area_name not in curation.areas:
            continue
        area_tables = curation.areas[area_name].tables
        rendered: list[str] = []
        for table_name in tables or list(area_tables):
            if table_name not in area_tables:
                continue
            spec = allowlist.table_specs.get(table_name)
            if spec is None or (search and not _matches(spec, search)):
                continue
            create_table_ddl = schema[table_name].create_table_ddl
            if dialect_name == "postgresql":
                create_table_ddl = _unqualify_postgresql_ddl(create_table_ddl)
            block = _render_table(spec, detail=detail, create_table_ddl=create_table_ddl)
            if detail != "brief":
                block += _render_curation(spec)
            rendered.append("\n".join(block))
        if rendered:
            # Brief entries are single lines, so blank lines between them would
            # double the payload for nothing; table blocks need the separation.
            separator = "\n" if detail == "brief" else "\n\n"
            chunks.append(f"-- area: {area_name}\n" + separator.join(rendered))
    return "\n\n".join(chunks)


def _matches(spec: TableSpec, search: str) -> bool:
    needle = search.lower()
    if needle in spec.name.lower():
        return True
    return any(needle in name.lower() for name in (*spec.columns, *spec.virtual_columns))


def validate_ddl(ddl: str, dialect: str) -> None:
    """Raise if any rendered statement fails to parse.

    Generated DDL fails quietly in ways handwritten DDL does not -- a comment
    swallowing the comma after it, or a column emitted after the table
    constraints, both of which produce text that reads correctly and parses as
    something else or not at all. Parsing every statement is the cheapest
    guard, and SQLGlot is already a dependency.

    Splitting the text on ``;`` and parsing the pieces does not work, because a
    curation note may contain one -- "per-span tokens; never SUM cumulative_*"
    splits mid-comment, and the remainder is then parsed as SQL. SQLGlot
    separates statements itself with comments accounted for, so it splits.
    """
    if not ddl.strip():
        return
    sqlglot.parse(ddl, dialect=_SQLGLOT_DIALECT[dialect])
