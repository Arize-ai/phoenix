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
Emitting DDL forces the choice, so types are compiled per dialect from the
models rather than restated by hand.

Curation the database cannot know -- which area a table belongs to, what one
row means, how to reach the project, which JSON paths are populated -- rides
along as ``--`` comments. They are read, never executed, so the only constraint
is that the result still parses; `validate_ddl` enforces that.

Comments must not be round-tripped through SQLGlot to produce the output. It
parses them correctly but re-emits them as ``/* */`` and normalizes type
spellings (``VARCHAR`` becomes ``TEXT``), which would report a type the
deployment does not have. It is used to check the text, not to produce it.
"""

from __future__ import annotations

from typing import Optional, cast

import sqlglot
from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine.interfaces import Dialect

from phoenix.db import models
from phoenix.server.mcp_analytics_sql.allowlist import (
    Allowlist,
    DialectName,
    TableSpec,
    load_allowlist,
    manifest_document,
)

__all__ = ["render_schema_ddl", "validate_ddl"]

_SQLGLOT_DIALECT = {"postgresql": "postgres", "sqlite": "sqlite"}


def _sa_dialect(dialect: DialectName) -> Dialect:
    factory = postgresql.dialect if dialect == "postgresql" else sqlite.dialect
    return cast(Dialect, factory())


def _column_types(table_name: str, dialect: DialectName) -> dict[str, str]:
    """Compile each column's type for one backend, keyed by column name.

    Types come from the models rather than the manifest because the manifest's
    are hand-written and unverified: `test_manifest_matches_sqlalchemy_metadata`
    compares column *names* against the models and stops there.
    """
    sa_dialect = _sa_dialect(dialect)
    table = models.Base.metadata.tables.get(table_name)
    if table is None:
        return {}
    compiled: dict[str, str] = {}
    for column in table.columns:
        try:
            compiled[column.name] = column.type.compile(sa_dialect)
        except Exception:
            # A type with no rendering on this backend is described rather than
            # guessed at; omitting it entirely would hide the column.
            compiled[column.name] = "UNKNOWN"
    return compiled


def _virtual_column_types(dialect: DialectName) -> dict[str, str]:
    """Types for the columns the server substitutes rather than stores."""
    return {
        "latency_ms": "DOUBLE PRECISION" if dialect == "postgresql" else "REAL",
        "graphql_node_id": "VARCHAR",
    }


def _render_table(
    spec: TableSpec,
    *,
    dialect: DialectName,
    detail: str,
    allowlist: Allowlist,
) -> list[str]:
    lines: list[str] = []
    grain = f"  -- {spec.grain}" if spec.grain else ""
    if detail == "brief":
        # A catalogue rather than a schema: names and meanings only, because a
        # caller at this stage is still choosing which table to ask about and
        # cannot use a column list yet. Rendered as comments, not as
        # `CREATE TABLE spans (...)`, which reads like DDL but is not valid SQL
        # and would teach an ellipsis that no backend accepts.
        lines.append(f"-- {spec.name}:{grain.replace('  --', '')}")
        return lines

    types = _column_types(spec.name, dialect)
    virtual = _virtual_column_types(dialect)
    width = max((len(c.name) for c in spec.exposed_columns), default=0)
    width = max(width, *(len(v) for v in spec.virtual_columns)) if spec.virtual_columns else width

    lines.append(f"CREATE TABLE {spec.name} ({grain.strip() and '  ' + grain.strip() or ''}")

    # (definition, trailing comment) kept apart so the separating comma lands
    # before the comment. Emitting `TIMESTAMP NOT NULL  -- time column,` puts
    # the comma inside the comment, which drops the separator and makes the
    # next column read as a continuation of this one.
    body: list[tuple[str, str]] = []
    for column in spec.exposed_columns:
        rendered = types.get(column.name, "UNKNOWN")
        suffix = "" if column.nullable else " NOT NULL"
        # One note per column, and only where a reasonable guess is wrong. The
        # type and the key already say what they can; a note is for what they
        # cannot -- `spans.parent_id` is a VARCHAR holding a `span_id`, so the
        # obvious self-join against `spans.id` compares a string to an integer
        # and silently returns nothing.
        note = spec.column_notes.get(column.name, "")
        if column.name == spec.time_column:
            note = f"time column{'; ' + note if note else ''}"
        body.append((f"  {column.name:<{width}} {rendered}{suffix}", note))
    for name in sorted(spec.virtual_columns):
        # Written like any other column because that is how they may be used --
        # in SELECT, WHERE, GROUP BY, ORDER BY alike. That they are computed is
        # said once in the preamble rather than on each of the 25 occurrences.
        body.append((f"  {name:<{width}} {virtual.get(name, 'VARCHAR')}", ""))

    # Constraints last: SQL requires every column definition to precede them,
    # and a virtual column appended afterwards produces DDL that does not parse.
    constraints = _render_constraints(spec, allowlist)
    for index, (definition, note) in enumerate(body):
        separator = "," if index < len(body) - 1 or constraints else ""
        lines.append(f"{definition}{separator}{'  -- ' + note if note else ''}")
    for index, constraint in enumerate(constraints):
        lines.append(f"  {constraint}{',' if index < len(constraints) - 1 else ''}")
    lines.append(");")
    return lines


def _render_constraints(spec: TableSpec, allowlist: Allowlist) -> list[str]:
    """Keys and uniqueness, which change how a query has to be written.

    Without them a caller cannot tell which column identifies a row, so it
    cannot know whether a join fans out or whether a GROUP BY is needed.
    `span_annotations` being unique on (name, span_rowid, identifier) is the
    difference between one annotation per span and many.

    A foreign key whose target is outside the allowlist is omitted: it names an
    edge the executor refuses, so advertising it invites a join that can only
    come back as an error. Targets in other areas are kept, because this is a
    description rather than a migration script -- a caller reading one area
    still benefits from knowing that `dataset_examples.span_rowid` reaches
    `spans`, and scoping keys to the current response would delete that from
    every single-table request. The column itself always appears when exposed.
    """
    table = models.Base.metadata.tables.get(spec.name)
    if table is None:
        return []
    exposed = {column.name for column in spec.exposed_columns}
    rendered: list[str] = []

    primary = [c.name for c in table.primary_key.columns if c.name in exposed]
    if primary:
        rendered.append(f"PRIMARY KEY ({', '.join(primary)})")

    # CHECK is where an enumerated column's permitted values are actually
    # written down -- nothing else in the schema says `status_code` is one of
    # OK, ERROR, UNSET. A caller guessing 'error' or 'Error' gets zero rows and
    # no indication why, which reads as absent data rather than a wrong literal.
    checks: list[str] = []
    for column in table.columns:
        for constraint in column.constraints:
            if isinstance(constraint, CheckConstraint) and column.name in exposed:
                checks.append(f"CHECK ({constraint.sqltext})")
    for constraint in table.constraints:
        if isinstance(constraint, CheckConstraint):
            text = str(constraint.sqltext)
            if all(c.name in exposed for c in table.columns if c.name in text):
                checks.append(f"CHECK ({text})")
    rendered.extend(sorted(set(checks)))

    unique: list[str] = []
    for constraint in table.constraints:
        if not isinstance(constraint, UniqueConstraint):
            continue
        columns = [c.name for c in constraint.columns]
        if columns and all(c in exposed for c in columns):
            unique.append(f"UNIQUE ({', '.join(columns)})")
    rendered.extend(sorted(unique))

    foreign: list[str] = []
    for constraint in table.foreign_key_constraints:
        target = constraint.referred_table.name
        if target not in allowlist.tables:
            continue
        columns = [c.name for c in constraint.columns]
        if not all(c in exposed for c in columns):
            continue
        referred = [element.column.name for element in constraint.elements]
        foreign.append(
            f"FOREIGN KEY ({', '.join(columns)}) REFERENCES {target} ({', '.join(referred)})"
        )
    rendered.extend(sorted(foreign))
    return rendered


def _blessed_path_expression(path: str, dialect: DialectName) -> str:
    """A blessed attribute path as the expression a caller has to write.

    The manifest stores a logical path, `attributes.session.id`. That is not SQL
    in either dialect: PostgreSQL reads three dotted parts as
    schema.table.column and answers `missing FROM-clause entry for table
    "session"`, so publishing the logical form advertises a path in a notation
    the executor rejects. The first segment names the column and the rest is the
    route into the document.

    The dotted form is also ambiguous in a way the rendered form is not. A key
    may itself contain a dot -- OpenInference writes flat keys like
    `llm.token_count.prompt` -- so `a.b.c` cannot say whether it means two
    nested objects or one key spelled with dots. The expression states which.
    """
    column, _, route = path.partition(".")
    if not route:
        return column
    if dialect == "postgresql":
        return f"{column} #>> '{{{route.replace('.', ',')}}}'"
    return f"json_extract({column}, '$.{route}')"


def _render_curation(spec: TableSpec, dialect: DialectName = "postgresql") -> list[str]:
    """Render non-relational curation comments for one table."""

    lines: list[str] = []
    for path in sorted(spec.blessed_attribute_paths):
        lines.append(f"-- populated JSON path: {_blessed_path_expression(path, dialect)}")
    if spec.promoted_columns_note:
        lines.append(f"-- {spec.promoted_columns_note}")
    return lines


def render_schema_ddl(
    *,
    area: Optional[str] = None,
    tables: Optional[list[str]] = None,
    detail: str = "brief",
    search: Optional[str] = None,
    dialect: DialectName = "postgresql",
) -> str:
    """Render the selected part of the allowlisted schema as DDL text."""
    manifest = manifest_document()
    allowlist = load_allowlist(dialect)
    chunks: list[str] = []

    for area_name in [area] if area else list(manifest["areas"]):
        if area_name not in manifest["areas"]:
            continue
        area_tables = manifest["areas"][area_name]["tables"]
        rendered: list[str] = []
        for table_name in tables or list(area_tables):
            if table_name not in area_tables:
                continue
            spec = allowlist.table_specs.get(table_name)
            if spec is None or (search and not _matches(spec, search)):
                continue
            block = _render_table(spec, dialect=dialect, detail=detail, allowlist=allowlist)
            if detail != "brief":
                block += _render_curation(spec, dialect)
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
    return any(needle in column.name.lower() for column in spec.exposed_columns)


def validate_ddl(ddl: str, dialect: DialectName) -> None:
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
