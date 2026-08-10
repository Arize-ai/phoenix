"""Index reflection: what this deployment has decided is worth finding quickly.

The manifest describes a schema that is the same in every installation. Indexes
are the opposite -- they are what a particular operator added because of what
their data looks like and what they keep asking of it -- so they cannot be
written down ahead of time and have to be read from the live catalog.

Two things make them worth the tokens.

An index on an expression is only usable if the query repeats that expression
character for character. ``attributes #>> '{session,id}'`` and
``attributes -> 'session' ->> 'id'`` return the same value, and only the first
one can be answered from the index. So publishing the definition is not a
performance hint that a caller may take or leave; it is the spelling required to
get the fast path at all, and a caller who has not seen it has no way to guess
which of several equivalent forms is the one that was indexed.

An index over a JSON path is also evidence about the JSON. The attribute space
has no declared keys and cannot be enumerated, which normally leaves a caller
guessing at paths. An operator who indexed a path has told us that the path
exists, that it is populated often enough to be worth indexing, and that it is
one they query -- which is a better map of that space than anything derivable
from the schema.

What is deliberately left out matters as much as what is included. A primary key
and a single-column index on a column the manifest already lists tell a reader
nothing they could not assume, and there are enough of them to cost more than
the entire column catalog. Only what cannot be inferred is published.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Literal, Mapping, NamedTuple, Optional, Sequence, cast

from sqlalchemy import text

from phoenix.config import get_env_database_schema
from phoenix.db import models
from phoenix.db.engines import SQLEAN_EXTENSIONS
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

# Enough to describe a deliberately indexed workload, small enough that a
# pathological installation cannot crowd out the schema it accompanies.
MAX_REFLECTED_INDEXES = 40
IndexKind = Literal["expression", "partial", "composite"]
JsonAccessorKind = Literal["json_extract", "->", "->>"]

_PG_INDEXES = """
SELECT t.relname AS table_name,
       i.relname AS index_name,
       pg_get_indexdef(ix.indexrelid) AS definition,
       ix.indisunique AS is_unique,
       ix.indisprimary AS is_primary,
       ix.indpred IS NOT NULL AS is_partial,
       ix.indexprs IS NOT NULL AS is_expression,
       array_length(ix.indkey, 1) AS column_count
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = :schema AND t.relname = ANY(:tables)
ORDER BY t.relname, i.relname
"""

# sql IS NULL marks an index SQLite created for itself to back a UNIQUE or
# PRIMARY KEY constraint. Those restate the constraint and are excluded here for
# the same reason the Postgres primary keys are.
_SQLITE_INDEXES = """
SELECT tbl_name AS table_name, name AS index_name, sql AS definition
FROM sqlite_master
WHERE type = 'index' AND sql IS NOT NULL
ORDER BY tbl_name, name
"""

# Everything up to the parenthesised body: the name and table are already known
# from the row, and repeating them triples the size of each entry.
# The table name is matched as an identifier rather than as `\S+`, which is
# greedy enough to swallow the body when no space precedes it. SQLite stores
# index DDL exactly as typed, and `ON spans(a, b)` is ordinary hand-written
# form: `\S+` consumed `spans(a,` and left `b)`, which was then published as
# `CREATE INDEX ix ON spans b);` -- invalid SQL, under a heading telling the
# reader to reproduce the spelling exactly. A hand-written expression index
# lost its whole body and was dropped, taking its JSON path with it, so the
# canonicaliser never learned a path that was in fact indexed.
_DDL_PREAMBLE = re.compile(
    r"""^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(IF\s+NOT\s+EXISTS\s+)?
        (?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.$]+)\s+ON\s+
        (?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w.$]+)\s*(USING\s+\w+\s*)?""",
    re.IGNORECASE | re.VERBOSE,
)


@dataclass(frozen=True)
class ReflectedIndex:
    table: str
    name: str
    body: str
    kind: IndexKind
    unique: bool


class IndexedJsonAccessor(NamedTuple):
    kind: JsonAccessorKind
    path_literal: str


@dataclass(frozen=True)
class EngineInfo:
    name: str
    version: str
    extensions: tuple[str, ...] = ()


# WORKAROUND, remove when SQLGlot binds a cast to the operand of a JSON operator
# rather than to the whole extraction.
# Upstream: https://github.com/tobymao/sqlglot/issues/8035
#
# `pg_get_indexdef` renders the operand of `#>>` as `'{a,b}'::text[]`, spelling
# out a cast PostgreSQL applies implicitly. Publishing it verbatim would be
# right -- admission allows an array of an allowed element type -- except that
# SQLGlot's PostgreSQL parser binds `::` to the whole extraction rather than to
# the literal, so `a #>> b::text[]` becomes `CAST(a #>> b AS TEXT[])`. That is a
# different statement, and it fails: "malformed array literal".
#
# The defect is in the parse, so nothing downstream can recover the meaning, and
# a caller who reproduces the published spelling -- which the surrounding text
# tells them to do -- gets an error. Dropping the redundant cast yields a
# spelling that survives the round trip and reaches the same index: verified
# with EXPLAIN that the form with both casts, with only the outer one, and with
# neither all produce `Index Scan using ix_spans_session_id`.
# Anchored to a JSON operator, because that is the only place the cast is both
# redundant and mis-parsed. A bare `(?<=')::text\[\]` also stripped casts that
# resolve a polymorphic argument -- `array_length('{a,b}'::text[], 1)` becomes
# `array_length('{a,b}', 1)`, which PostgreSQL refuses with "could not determine
# polymorphic type" -- so the workaround reintroduced the defect it exists to
# fix, moved from `#>>` to any operator-written index over an array literal.
_IMPLICIT_ARRAY_CAST = re.compile(r"((?:#>>|#>|->>|->)\s*'[^']*')::text\[\]", re.IGNORECASE)


def _body(definition: str) -> str:
    """The parenthesised body of an index definition, as a caller can write it."""
    body = _DDL_PREAMBLE.sub("", definition.replace("\n", " ")).strip()
    return _IMPLICIT_ARRAY_CAST.sub(r"\1", body)


def _classify(*, is_expression: bool, is_partial: bool, column_count: int) -> Optional[IndexKind]:
    """Name the reason this index is worth publishing, or None if it is not.

    The order matters: an index can be both an expression and partial, and the
    expression is the part a caller has to reproduce exactly, so it wins.
    """
    if is_expression:
        return "expression"
    if is_partial:
        return "partial"
    if column_count > 1:
        return "composite"
    return None


def _sqlite_shape(body: str) -> tuple[bool, bool, int]:
    """Infer shape from DDL text, since SQLite exposes no catalog flags for it.

    SQLite has no equivalent of indexrelid metadata, so the DDL string is the
    only description available. The leading parenthesised list is split on
    commas at depth one; a term that is not a bare identifier is an expression.
    """
    # Detected and split by the same case-insensitive pattern. Splitting on the
    # literal " WHERE " while detecting case-insensitively left a lowercase
    # `where` clause inside the column list, so its terms were counted as
    # columns and the predicate itself read as an expression -- a partial index
    # over plain columns reported as an expression index nobody can reproduce.
    partial_match = re.search(r"\s+WHERE\s+", body, re.IGNORECASE)
    partial = partial_match is not None
    columns_part = body[: partial_match.start()] if partial_match else body
    inner = columns_part.strip()
    if inner.startswith("(") and inner.endswith(")"):
        inner = inner[1:-1]
    terms, depth, current = [], 0, ""
    for char in inner:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            terms.append(current)
            current = ""
        else:
            current += char
    if current.strip():
        terms.append(current)
    stripped = [t.strip().strip('"') for t in terms if t.strip()]
    is_expression = any(
        not re.fullmatch(r"[A-Za-z_]\w*(\s+(ASC|DESC))?", t, re.IGNORECASE) for t in stripped
    )
    return is_expression, partial, len(stripped)


async def reflect_indexes(
    db: DbSessionFactory, *, tables: frozenset[str], pg_schema: str = "public"
) -> dict[str, list[ReflectedIndex]]:
    """Read indexes for the allowlisted tables, keeping only the informative ones.

    Reflection is best-effort. A caller asked for the schema, and a catalog that
    is unreadable -- a permission the deployment did not grant, a backend whose
    catalog differs from what is queried here -- is a reason to return the schema
    without indexes rather than to fail the request that would otherwise have
    succeeded.
    """
    try:
        rows = await _read_catalog(db, tables=tables, pg_schema=pg_schema)
    except Exception:
        logger.debug("analytics sql: index reflection unavailable", exc_info=True)
        return {}

    by_table: dict[str, list[ReflectedIndex]] = {}
    for index in rows[:MAX_REFLECTED_INDEXES]:
        by_table.setdefault(index.table, []).append(index)
    if len(rows) > MAX_REFLECTED_INDEXES:
        logger.debug(
            "analytics sql: reflected %d of %d indexes (capped)", MAX_REFLECTED_INDEXES, len(rows)
        )
    return by_table


async def _read_catalog(
    db: DbSessionFactory, *, tables: frozenset[str], pg_schema: str
) -> list[ReflectedIndex]:
    found: list[ReflectedIndex] = []
    # The read path: this is a catalog lookup that never writes, and routing it
    # through the write session would put schema discovery behind whatever
    # serialises writes.
    async with db.read() as session:
        if db.dialect.value == "postgresql":
            result = await session.execute(
                text(_PG_INDEXES), {"schema": pg_schema, "tables": sorted(tables)}
            )
            for row in result:
                if row.is_primary:
                    continue
                kind = _classify(
                    is_expression=bool(row.is_expression),
                    is_partial=bool(row.is_partial),
                    column_count=int(row.column_count or 1),
                )
                if kind is None:
                    continue
                found.append(
                    ReflectedIndex(
                        table=row.table_name,
                        name=row.index_name,
                        body=_body(row.definition),
                        kind=kind,
                        unique=bool(row.is_unique),
                    )
                )
        else:
            result = await session.execute(text(_SQLITE_INDEXES))
            for row in result:
                if row.table_name not in tables:
                    continue
                body = _body(row.definition)
                is_expression, is_partial, column_count = _sqlite_shape(body)
                kind = _classify(
                    is_expression=is_expression,
                    is_partial=is_partial,
                    column_count=column_count,
                )
                if kind is None:
                    continue
                found.append(
                    ReflectedIndex(
                        table=row.table_name,
                        name=row.index_name,
                        body=body,
                        kind=kind,
                        unique=bool(re.match(r"\s*CREATE\s+UNIQUE", row.definition, re.IGNORECASE)),
                    )
                )
    return found


# json_extract(col, '<path>') and col ->> '<path>' / col -> '<path>', read out of
# index DDL rather than out of a parsed tree. Parsing would normalise the path
# literal, and the literal's exact characters are the whole point here.
_JSON_FUNCTION_CALL = re.compile(
    r"\bjson_extract\s*\(\s*[\"'`\[]?(\w+)[\"'`\]]?\s*,\s*'([^']*)'\s*\)", re.IGNORECASE
)
_JSON_OPERATOR = re.compile(r"[\"'`\[]?(\w+)[\"'`\]]?\s*(->>?)\s*'([^']*)'")


def _logical_path(path_literal: str) -> Optional[tuple[str, ...]]:
    """Reduce a JSON path to the keys it names, discarding how they were spelled.

    ``$.a.b`` and ``$."a"."b"`` address the same value and index differently, so
    the spelling cannot be the identity. The keys can be, which is what lets a
    caller's path be recognised as the one an index already covers.
    """
    if not path_literal.startswith("$"):
        return None
    keys: list[str] = []
    for segment in path_literal[1:].split("."):
        if not segment:
            continue
        segment = segment.strip()
        if segment.startswith('"') and segment.endswith('"') and len(segment) > 1:
            segment = segment[1:-1]
        if not re.fullmatch(r"\w+", segment):
            return None
        keys.append(segment)
    return tuple(keys) or None


def indexed_json_accessors(
    indexes: Mapping[str, Sequence[ReflectedIndex]], *, table: str = "spans"
) -> dict[tuple[str, ...], IndexedJsonAccessor]:
    """Map each indexed JSON path to the accessor and literal that reach its index.

    A query uses an expression index only by reproducing the indexed expression,
    and this deployment's spelling is whatever created the index -- SQLAlchemy's
    compiler for the ones Phoenix ships, and whatever a person typed for the ones
    they added. Converging on either convention by assumption serves one and
    strips the index from the other, so the convention is read rather than
    guessed.

    Keys are the logical path. Values are the accessor kind and the exact path
    literal to emit, so the rewrite reconstructs the indexed expression rather
    than approximating it.
    """
    accessors: dict[tuple[str, ...], IndexedJsonAccessor] = {}
    for entry in indexes.get(table, []):
        for _column, literal in _JSON_FUNCTION_CALL.findall(entry.body):
            path = _logical_path(literal)
            if path is not None:
                accessors.setdefault(path, IndexedJsonAccessor("json_extract", literal))
        for _column, operator, literal in _JSON_OPERATOR.findall(entry.body):
            path = _logical_path(literal)
            if path is not None:
                accessors.setdefault(
                    path, IndexedJsonAccessor(cast(JsonAccessorKind, operator), literal)
                )
    return accessors


# Indexes change on migrations and on deliberate operator action, never between
# two queries a second apart, so they are read once and reused. The alternative
# is a catalog round trip on every statement to learn something that is almost
# always the same answer.
_ACCESSOR_CACHE: dict[str, dict[tuple[str, ...], IndexedJsonAccessor]] = {}


async def cached_indexed_json_accessors(
    db: DbSessionFactory, *, tables: frozenset[str], pg_schema: str = "public"
) -> dict[tuple[str, ...], IndexedJsonAccessor]:
    """The indexed-accessor map for this database, read at most once per process.

    Reflection failing yields an empty map, which is a rewrite that forgoes the
    index rather than a query that fails -- the same trade the schema payload
    makes, and for the same reason.
    """
    key = f"{db.dialect.value}:{pg_schema}"
    cached = _ACCESSOR_CACHE.get(key)
    if cached is None:
        cached = indexed_json_accessors(
            await reflect_indexes(db, tables=tables, pg_schema=pg_schema)
        )
        _ACCESSOR_CACHE[key] = cached
        logger.debug("analytics sql: cached %d indexed JSON accessors", len(cached))
    return cached


_SCHEMA_CACHE: dict[str, str] = {}


async def resolve_pg_schema(db: DbSessionFactory) -> str:
    """The PostgreSQL schema Phoenix's ORM actually reads, for this connection.

    Resolved the way `phoenix.db.helpers` resolves it for database usage stats,
    because the two must agree about where Phoenix's tables live:

    1. `PHOENIX_SQL_DATABASE_SCHEMA` when set. `models.Base.metadata.schema` is
       set from the same variable at import, so it is authoritative.
    2. Otherwise the schema an unqualified `projects` reference resolves from on
       this connection. `to_regclass` follows `search_path` exactly as the ORM's
       unqualified queries do.

    Deliberately not `current_schema()`. That reports where an unqualified
    CREATE would target -- the first *existing* entry in `search_path` -- while
    an existing table resolves from the first entry *containing* it. The two
    diverge whenever `search_path` gains a leading entry after migration, and
    qualifying a read with the CREATE target would then name a schema that does
    not hold the table.

    Falls back to "public" only when neither resolves, which means the ORM
    cannot see its own tables. Nothing this surface does will work in that
    state; "public" keeps the error a plain missing-relation rather than a
    confusing empty schema name.

    Cached per process. The schema a deployment runs in does not change under
    it, and both callers are on a request path.
    """
    key = str(db.dialect.value)
    if (cached := _SCHEMA_CACHE.get(key)) is not None:
        return cached
    resolved = get_env_database_schema()
    if not resolved:
        try:
            async with db.read() as session:
                resolved = await session.scalar(
                    text(
                        "SELECT pn.nspname FROM pg_class AS pc "
                        "JOIN pg_namespace AS pn ON pn.oid = pc.relnamespace "
                        f"WHERE pc.oid = to_regclass('{models.Project.__tablename__}')"
                    )
                )
        except Exception:
            logger.debug("analytics sql: schema resolution failed", exc_info=True)
            return "public"
    if resolved:
        _SCHEMA_CACHE[key] = resolved
    else:
        resolved = "public"
    logger.debug("analytics sql: resolved postgres schema to %r", resolved)
    return resolved


_ENGINE_CACHE: dict[str, EngineInfo] = {}


async def cached_engine_info(db: DbSessionFactory) -> Optional[EngineInfo]:
    """The engine version, and on SQLite the extensions loaded into it.

    Version alone is minor: the allowlist already decides what may be called, so
    a caller cannot reach a function this build lacks. It earns its place by
    settling the version-gated cases -- unixepoch arrived in SQLite 3.38, the
    ->> operator with it -- where a model that has read older SQLite would
    otherwise avoid a spelling that works here.

    The extension list is the part nothing else can supply. percentile() is not
    stock SQLite; it comes from a bundled extension, so no amount of
    pre-training tells a caller it exists, and a version number implies the
    opposite of the truth about it.
    """
    key = db.dialect.value
    cached = _ENGINE_CACHE.get(key)
    if cached is None:
        try:
            async with db.read() as session:
                if key == "postgresql":
                    version = (await session.execute(text("SHOW server_version"))).scalar()
                else:
                    version = (await session.execute(text("SELECT sqlite_version()"))).scalar()
        except Exception:
            logger.debug("analytics sql: engine info unavailable", exc_info=True)
            return None
        cached = EngineInfo(
            name="PostgreSQL" if key == "postgresql" else "SQLite",
            version=str(version) if version is not None else "",
            extensions=SQLEAN_EXTENSIONS if key == "sqlite" else (),
        )
        _ENGINE_CACHE[key] = cached
    return cached
