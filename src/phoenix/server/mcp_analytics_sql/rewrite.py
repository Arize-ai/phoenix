from __future__ import annotations

import base64
import logging
from binascii import Error as BinasciiError
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlglot import exp
from sqlglot.optimizer.scope import build_scope

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.allowlist import (
    GRAPHQL_NODE_ID_COLUMN,
    TABLE_GRAPHQL_TYPES,
    Allowlist,
    sqlglot_read_dialect,
)
from phoenix.server.mcp_analytics_sql.catalog import IndexedJsonAccessor
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.normalize import (
    format_timestamp_for_sqlite,
    parse_timestamp_literal,
    timestamp_column_names,
)
from phoenix.server.mcp_analytics_sql.parse import (
    _allowlisted_table_name,
    _identifier_key,
    _scope_columns,
    _timestamp_literals,
    query_local_columns,
)

logger = logging.getLogger(__name__)


@dataclass
class RewriteContext:
    allowlist: Allowlist
    dialect: SupportedSQLDialectName
    row_limit: int
    applied: list[str] = field(default_factory=list)
    # Statements about this answer the caller should not have to infer. A pass
    # that resolves something the caller left open records it here.
    notes: list[str] = field(default_factory=list)
    # Logical JSON path -> indexed accessor for paths this
    # deployment has indexed, read from its catalog. Empty when nothing is
    # indexed or the catalog could not be read, which costs only the index.
    indexed_json_accessors: dict[tuple[str, ...], IndexedJsonAccessor] = field(default_factory=dict)
    # Relation names that exist only inside this statement: the caller's CTEs
    # and subqueries. SQLite can attribute a column read to one of these instead
    # of to the underlying table, and the authorizer has no other way to tell
    # such a name from a table nobody allowlisted.
    introduced_relations: set[str] = field(default_factory=set)
    # What the caller sent and what the engine was given. Carried here because
    # this is the object that reaches the envelope. `applied` names the passes
    # that fired, which is not the same claim: a statement can be re-cased,
    # re-spaced, stripped of comments and have its literals respelled by the
    # generator alone, with no pass recorded and the text still changed.
    caller_sql: str = ""
    executed_sql: str = ""
    # Column references a substitution wrote into the tree, keyed by the exact
    # text the engine would name if it cannot resolve one, mapped to the pass
    # that wrote it. Recorded rather than inferred: matching an engine error on
    # column *name* alone blames a rewrite for the caller's own typo, since
    # `id`, `start_time` and `end_time` are ordinary names a caller also writes.
    substituted_columns: dict[str, str] = field(default_factory=dict)


#: Deliberately dialect-specific: the hazard is not the same on both backends
#: and a note that overstates it teaches a caller to distrust correct answers.
#: PostgreSQL's `->>` and `#>>` are defined to return text, so ordering is
#: always character by character there. SQLite returns the document's own type,
#: so a numeric path orders numerically and only a path holding a numeric
#: *string* misorders. Measured on the shipped engine: `MAX(doc ->> '$.n')` over
#: 1017066 and 149740 answers 1017066, typed integer.
_JSON_TEXT_ORDERING_NOTES: dict[str, str] = {
    "postgresql": (
        "A JSON value was ordered or compared without a cast. On PostgreSQL a "
        "JSON extraction returns text, so MIN, MAX and ORDER BY compare "
        "character by character -- '1017066' sorts below '149740'. Cast the "
        "extraction to the type you mean, as in "
        "`CAST(attributes #>> '{a,b}' AS numeric)`."
    ),
    "sqlite": (
        "A JSON value was ordered or compared without a cast. On SQLite the "
        "extraction returns whatever type the document holds, so a numeric path "
        "orders correctly and a path holding a quoted number orders as text. "
        "Cast the extraction if the path may hold either, as in "
        "`CAST(attributes ->> '$.n' AS REAL)`."
    ),
}

#: Positions where text ordering gives a different answer rather than a slower
#: one. `SUM` and `AVG` coerce, so they are absent deliberately.
_ORDER_SENSITIVE = (exp.Min, exp.Max, exp.Ordered)

_JSON_EXTRACTIONS = (
    exp.JSONExtract,
    exp.JSONExtractScalar,
    exp.JSONBExtract,
    exp.JSONBExtractScalar,
)


def _is_json_extraction(node: exp.Expression) -> bool:
    """Both spellings, because canonicalisation has already run.

    That pass rebuilds `->>` as an `Anonymous` call to `json_extract`, so a
    check that knows only the operator classes sees nothing on exactly the
    statements it was written for.
    """
    if isinstance(node, _JSON_EXTRACTIONS):
        return True
    return isinstance(node, exp.Anonymous) and str(node.this).lower() in {
        "json_extract",
        "jsonb_extract_path_text",
    }


def _note_uncast_json_ordering(root: exp.Expression, ctx: RewriteContext) -> None:
    """Say so when a JSON read is ordered as text.

    Engine semantics, not a defect of ours and not a rendering problem, so there
    is nothing to rewrite: on PostgreSQL `#>>` and `->>` are defined to return
    text, and on SQLite the accessors that return a value give whatever the
    document held. Either way `max` over a numeric path answers with the wrong
    row and reports nothing.

    A note rather than a refusal. Text ordering is the correct answer when the
    path holds text, and the surface cannot tell which without knowing the
    document -- so refusing would block a legitimate query to prevent a
    plausible mistake.
    """
    for node in root.find_all(*_ORDER_SENSITIVE):
        target = node.this
        if isinstance(target, exp.Cast):
            continue
        note = _JSON_TEXT_ORDERING_NOTES[ctx.dialect]
        if _is_json_extraction(target) and note not in ctx.notes:
            ctx.notes.append(note)
            return


def rewrite(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    root = _expand_stars(root, ctx)
    root = _substitute_latency_ms(root, ctx)
    root = _substitute_graphql_node_id(root, ctx)
    root = _rewrite_sqlite_timestamp_subtraction(root, ctx)
    root = _normalize_timestamp_literals(root, ctx)
    root = _canonicalize_json_extract(root, ctx)
    root = _qualify_schema(root, ctx)
    root = _inject_limit(root, ctx)
    # After canonicalisation, so it sees the accessors that will actually run.
    _note_uncast_json_ordering(root, ctx)
    _record_introduced_relations(root, ctx)
    _assert_rewrites_preserved_policy(root, ctx)
    return root


def _assert_rewrites_preserved_policy(root: exp.Expression, ctx: RewriteContext) -> None:
    """Re-check the finished tree against the guarantees admission established.

    Admission validates the statement the caller sent. Seven passes then edit
    that statement, and until this ran, nothing looked at the result -- so an
    admitted query could become a different query on its way to the engine, and
    twice it did. One pass redirected a CTE reference to the base table it was
    named after, turning a filtered count into a count of everything. Another
    silently dropped a TABLESAMPLE clause on exactly the tables it wrapped.

    Neither was caught by a check, because no check existed between the last
    pass and the engine. Both would have failed here.

    This used to raise AssertionError, on the reasoning that reaching it meant
    our own code had produced something admission would not have accepted --
    a defect on this side, which should surface as one. The reasoning was
    sound and the premise was not: a table aliased to a CTE's name was dropped
    from the scope map admission reads, so ordinary caller SQL reached here and
    the AssertionError left through the caller's response rather than the error
    envelope, exactly as an unhandled driver error would.

    So it refuses, and logs at error level. The loud signal is kept where it is
    useful -- to whoever runs the server -- rather than delivered to a caller
    who can neither act on it nor tell it apart from a crash. Both halves
    matter: a silent refusal here would hide the defect, and an escaping
    exception hides it just as well while also breaking the response contract.
    """
    for table in root.find_all(exp.Table):
        name = table.name or ""
        if not name or name in ctx.introduced_relations:
            continue
        if _allowlisted_table_name(table, allowlist=ctx.allowlist, dialect=ctx.dialect) is None:
            logger.error(
                "analytics sql: rewrite produced a reference to %r, which is not "
                "allowlisted and was not declared by the statement",
                name,
            )
            raise AnalyticsSqlError(
                code=ErrorCode.RELATION_NOT_ALLOWED,
                message=f"Table '{name}' is not available for analytics SQL.",
                identifiers=(name,),
            )
        if ctx.dialect == "postgresql" and table.db and table.db != ctx.allowlist.pg_schema:
            logger.error(
                "analytics sql: rewrite qualified %r with schema %r, not %r",
                name,
                table.db,
                ctx.allowlist.pg_schema,
            )
            raise AnalyticsSqlError(
                code=ErrorCode.UNSUPPORTED_SYNTAX,
                message="The statement could not be prepared for this database.",
            )


def _record_introduced_relations(root: exp.Expression, ctx: RewriteContext) -> None:
    """Collect every relation name that exists only for the duration of this statement.

    SQLite may report a column read against a derived relation's alias rather
    than against the table beneath it. The table check reads a name it does not
    recognise as an attempt on an unknown table, so without this the caller's own
    CTE is refused as if it were a forbidden relation.

    Caller-written CTEs and subqueries are the whole of it. Letting
    them through costs nothing: a derived relation yields only rows drawn from
    its own SELECT, and the base tables that SELECT reads are authorized
    separately, so the underlying access has already been decided on its merits.
    """
    for cte in root.find_all(exp.CTE):
        if cte.alias:
            ctx.introduced_relations.add(cte.alias)
    for subquery in root.find_all(exp.Subquery):
        if subquery.alias:
            ctx.introduced_relations.add(subquery.alias)


def _json_path_keys(path: exp.Expression) -> Optional[tuple[str, ...]]:
    """The keys a JSON path names, as the identity that survives respelling."""
    if not isinstance(path, exp.JSONPath):
        return None
    keys: list[str] = []
    for part in path.expressions:
        if isinstance(part, exp.JSONPathRoot):
            continue
        if isinstance(part, exp.JSONPathKey) and isinstance(part.this, str):
            keys.append(part.this)
        else:
            return None
    return tuple(keys) or None


def _quoted_json_path(path: exp.Expression) -> Optional[str]:
    """Render a JSON path with every key quoted, or None if the shape is unfamiliar.

    SQLite accepts ``$.a.b`` and ``$."a"."b"`` as the same path, but an index on
    one is not an index on the other: expression indexes are matched on the
    parsed expression, and the two literals are different. SQLAlchemy always
    emits the quoted form, so every expression index Phoenix declares over JSON
    is in that form, and it is the one worth converging on.

    Returning None for anything not built purely from keys and subscripts leaves
    the caller's own rendering in place rather than guessing at a spelling.
    """
    if not isinstance(path, exp.JSONPath):
        return None
    rendered = ""
    for part in path.expressions:
        if isinstance(part, exp.JSONPathRoot):
            rendered += "$"
        elif isinstance(part, exp.JSONPathKey):
            key = part.this
            if not isinstance(key, str):
                return None
            if '"' in key:
                # Quoting a key that already contains a quote produces a path
                # that reads as two different keys, and SQLite answers NULL
                # rather than erroring -- so the caller concludes the key is
                # absent. Declining leaves the caller's own rendering in place.
                return None
            rendered += f'."{key}"'
        elif isinstance(part, exp.JSONPathSubscript):
            rendered += f"[{part.this}]"
        else:
            return None
    return rendered or None


_UTC_DATE_NOTE = "A bare date was read as UTC. Write an offset to name a different zone."


def _normalize_timestamp_literals(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Re-emit timestamp literals in the form the backend compares correctly.

    Admission has already refused a literal that names a time of day without an
    offset, so every literal reaching here is either aware or a bare date, and
    the instant is known. What remains is spelling.

    PostgreSQL parses the literal, so the spelling carries nothing and only the
    note is recorded. SQLite does not: storage is text written by `UtcTimeStamp`
    as `YYYY-MM-DD HH:MM:SS.ffffff` in UTC, comparison is character by character,
    and an ISO `T` differs from the stored space at index 10 -- before any digit
    that was meant to decide the comparison. Left alone, `'2026-07-01T00:00:00Z'`
    excludes the whole of 1 July from the low end of a window.
    """
    columns = timestamp_column_names(ctx.allowlist.tables)
    if not columns:
        return root
    changed = False
    saw_bare_date = False
    for literal in _timestamp_literals(root, columns, allowlist=ctx.allowlist, dialect=ctx.dialect):
        parsed = parse_timestamp_literal(literal.this)
        if parsed is None:
            continue
        if not parsed.has_time:
            saw_bare_date = True
        if ctx.dialect != "sqlite":
            continue
        rendered = format_timestamp_for_sqlite(parsed.value)
        if rendered != literal.this:
            literal.set("this", rendered)
            changed = True
    if saw_bare_date and _UTC_DATE_NOTE not in ctx.notes:
        ctx.notes.append(_UTC_DATE_NOTE)
    if changed:
        ctx.applied.append("timestamp_literals")
    return root


def _canonicalize_json_extract(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Emit SQLite JSON reads as ``json_extract`` with a fully quoted path.

    Two separate problems are settled by choosing one spelling.

    The first is the return type. SQLite has three JSON accessors and they do not
    agree: ``json_extract`` and ``->>`` yield the underlying SQL value, while
    ``->`` yields JSON text. For a number that difference is invisible to ``SUM``,
    which coerces, and decisive for ``MIN``, ``MAX``, ``ORDER BY`` and every
    comparison, which compare text character by character -- so 1017066 sorts
    below 149740 and the answer is confidently wrong with no error anywhere.
    Left alone the generator emits ``->`` for a caller's ``json_extract``,
    silently exchanging one accessor for another.

    The second is whether an expression index can be used at all. SQLite matches
    such an index on the parsed expression, so a query reaches it only by
    repeating the indexed expression exactly -- same function, same path
    literal. The indexes Phoenix declares over JSON are compiled by SQLAlchemy
    into ``json_extract`` with every key quoted, which is a spelling no caller
    would arrive at unaided. Converging on it here means a caller who writes the
    obvious ``$.a.b`` gets the index anyway, rather than being expected to guess
    the form that matches.

    Both accessors that return a value are equivalent for the first problem, so
    the choice between them is settled by the second.

    This runs before the relation wrappers, so it sees the caller's expressions
    where the caller put them.

    SQLite only, and the first problem is *not* closed on PostgreSQL. There
    ``#>>`` and ``->>`` are defined to return ``text``, so ``MAX`` over numeric
    JSON still compares character by character -- ``max(attributes #>>
    '{llm,token_count,total}')`` answers ``"n/a"`` over a column of integers.
    Nothing here can fix that generally: the jsonb form that would order
    correctly has no ``max`` aggregate, and a cast would have to guess whether
    the path holds a number or a string. The caller has to cast for themselves,
    and the schema's populated-path comments are where they find out which
    paths are numeric. Stated rather than silently scoped, because the rest of
    this docstring reads as though the hazard were settled everywhere.
    """
    if ctx.dialect != "sqlite":
        return root
    changed = False
    for node in list(root.find_all(exp.JSONExtract, exp.JSONExtractScalar)):
        # `->` and `json_extract` parse to the same class, and rewriting both
        # meant a caller who chose `->` deliberately got the other accessor's
        # semantics -- a different value and a different type on every JSON
        # scalar. The parser records which was written: the operator sets
        # `only_json_types`, the function leaves it absent. Canonicalising is
        # what stops the generator turning the function back into `->`, so it is
        # still applied where the marker is missing.
        if isinstance(node, exp.JSONExtract) and node.args.get("only_json_types") is not None:
            continue
        keys = _json_path_keys(node.expression)
        indexed = ctx.indexed_json_accessors.get(keys) if keys else None
        if indexed is not None:
            # An index built on `->` is deliberately not matched. That accessor
            # returns JSON text, so reproducing it to gain the index would
            # reintroduce the comparison bug this function exists to prevent,
            # and a fast wrong answer is worse than a slow right one.
            if indexed.kind == "json_extract":
                node.replace(
                    exp.Anonymous(
                        this="json_extract",
                        expressions=[node.this, exp.Literal.string(indexed.path_literal)],
                    )
                )
                changed = True
                continue
            if indexed.kind == "->>":
                node.replace(
                    exp.JSONExtractScalar(
                        this=node.this, expression=exp.Literal.string(indexed.path_literal)
                    )
                )
                changed = True
                continue

        quoted = _quoted_json_path(node.expression)
        if quoted is None:
            # An unfamiliar path shape still must not be left as `->`, whose
            # return type is the original defect; the scalar operator is correct
            # even though it forgoes the index.
            if isinstance(node, exp.JSONExtract):
                node.replace(exp.JSONExtractScalar(this=node.this, expression=node.expression))
                changed = True
            continue
        node.replace(
            exp.Anonymous(
                this="json_extract",
                expressions=[node.this, exp.Literal.string(quoted)],
            )
        )
        changed = True
    if changed:
        ctx.applied.append("json_extract_canonical")
    return root


def _relation_qualifier(expression: exp.Expression) -> exp.Identifier:
    """Qualifier for rewritten columns of this relation, quoting included.

    PostgreSQL folds unquoted identifiers; ``exp.to_identifier("S")`` is not ``"S"``.
    """
    alias = expression.args.get("alias")
    if isinstance(alias, exp.TableAlias) and isinstance(alias.this, exp.Identifier):
        return alias.this.copy()
    table_ident = expression.this if isinstance(expression, exp.Table) else None
    if isinstance(table_ident, exp.Identifier):
        return table_ident.copy()
    return exp.to_identifier(expression.alias_or_name or "")


def _copied_table_identifier(column: exp.Column) -> Optional[exp.Identifier]:
    """The table qualifier on this column, with its quoting intact."""
    table = column.args.get("table")
    if isinstance(table, exp.Identifier):
        return table.copy()
    name = column.table or ""
    return exp.to_identifier(name) if name else None


def _star_sources(node: exp.Select, scope: Optional[Any]) -> list[tuple[str, str, exp.Identifier]]:
    """Every relation a bare ``*`` in this SELECT draws from.

    Each entry is (physical table name, alias string, qualifier identifier).
    The identifier keeps the caller's quoting.

    A star means "every column of everything in the FROM clause", so the joins
    count as much as the leading table. Reading only the first source expands to
    one table's columns and silently drops the rest, which returns a plausible
    row that is missing exactly the data the caller joined for.
    """
    sources: list[tuple[str, str, exp.Identifier]] = []

    def add(expression: Optional[exp.Expression]) -> None:
        if expression is None:
            return
        qualifier = _relation_qualifier(expression)
        alias = expression.alias_or_name if expression else ""
        if isinstance(expression, exp.Table) and expression.name:
            source = scope.sources.get(expression.alias_or_name) if scope is not None else None
            if isinstance(source, exp.Table):
                sources.append((source.name, alias, qualifier))
            else:
                # A CTE parses as a Table too, but resolves to a nested scope.
                # Its projection is query-local rather than part of the
                # manifest, so it follows the same refusal path as a subquery.
                sources.append(("", alias, qualifier))
        else:
            # A derived table, a table-valued function, or anything else whose
            # columns come from the query rather than the manifest. Recorded
            # with an empty table name so the caller of this function refuses
            # rather than skipping it: dropping such a source silently returns
            # the other sources' columns and none of these, which is a
            # well-formed answer missing exactly what was joined for.
            sources.append(("", alias, qualifier))

    from_expr = node.args.get("from_") or node.args.get("from")
    if isinstance(from_expr, exp.From):
        add(from_expr.this)
    for join in node.args.get("joins") or []:
        add(join.this)
    return sources


def _using_join_keys(node: exp.Select, dialect: SupportedSQLDialectName) -> frozenset[str]:
    """Join keys named by USING, compared the way this dialect compares identifiers.

    A USING join exposes each key once. Expanding a bare star to every table's
    copy of that key returns two columns of the same name, which is not the
    shape USING produces.
    """
    keys: set[str] = set()
    for join in node.args.get("joins") or []:
        using = join.args.get("using")
        if not using:
            continue
        items = using if isinstance(using, list) else [using]
        for item in items:
            ident = item if isinstance(item, exp.Identifier) else getattr(item, "this", None)
            if not isinstance(ident, exp.Identifier):
                continue
            keys.add(
                _identifier_key(
                    ident.name or ident.this or "",
                    quoted=bool(ident.args.get("quoted")),
                    dialect=dialect,
                )
            )
    return frozenset(keys)


def _matches_star_source(
    explicit: str,
    identifier: Optional[exp.Expression],
    qualifier: exp.Identifier,
    dialect: SupportedSQLDialectName,
) -> bool:
    """Whether a qualified star names this relation under SQL identifier rules.

    Match the name the relation is exposed as, not its physical table name.
    After ``FROM traces AS spans``, ``spans.*`` is traces; the table ``spans``
    is only reachable under its own alias.
    """
    star_quoted = isinstance(identifier, exp.Identifier) and bool(identifier.args.get("quoted"))
    return _identifier_key(explicit, quoted=star_quoted, dialect=dialect) == _identifier_key(
        qualifier.name or "",
        quoted=bool(qualifier.args.get("quoted")),
        dialect=dialect,
    )


def _expand_stars(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    changed = False
    scope_root = build_scope(root)
    scope_by_expression = (
        {id(scope.expression): scope for scope in scope_root.traverse()}
        if scope_root is not None
        else {}
    )

    for node in list(root.walk()):
        if not isinstance(node, exp.Select):
            continue
        new_exprs: list[exp.Expression] = []
        local_changed = False
        for expression in node.expressions:
            # Two different nodes mean "star". A bare `*` is exp.Star and carries
            # no table. A qualified `t.*` is a Column whose `this` is a Star and
            # whose `table` names the relation -- it is not an exp.Star at all,
            # so a check for that class alone leaves qualified stars unexpanded
            # and passes `t.*` through to the engine, which returns every
            # physical column rather than the manifest's.
            explicit = ""
            explicit_identifier: Optional[exp.Expression] = None
            if isinstance(expression, exp.Star):
                pass
            elif isinstance(expression, exp.Column) and isinstance(expression.this, exp.Star):
                explicit = expression.table or ""
                explicit_identifier = expression.args.get("table")
            else:
                new_exprs.append(expression)
                continue

            if explicit:
                targets = [
                    (name, alias, qualifier)
                    for name, alias, qualifier in _star_sources(
                        node, scope_by_expression.get(id(node))
                    )
                    if _matches_star_source(explicit, explicit_identifier, qualifier, ctx.dialect)
                ] or [("", explicit, exp.to_identifier(explicit))]
            else:
                targets = _star_sources(node, scope_by_expression.get(id(node)))

            if not targets:
                raise AnalyticsSqlError(
                    code=ErrorCode.UNSUPPORTED_SYNTAX,
                    message=(
                        "SELECT * is supported only over allowlisted tables. "
                        "List the columns explicitly here."
                    ),
                )

            # USING coalesces each join key to one output column. A qualified
            # star names one relation's columns, so it keeps that relation's
            # copy of the key.
            using_keys = _using_join_keys(node, ctx.dialect) if not explicit else frozenset()
            emitted_using: set[str] = set()

            for table_name, alias, qualifier in targets:
                spec = ctx.allowlist.table_specs.get(table_name) if table_name else None
                if spec is None:
                    table_name = table_name or alias or "a query-local relation"
                    # A CTE or derived table. Its columns are whatever its own
                    # SELECT produced, which the manifest cannot know, so the
                    # caller has to name them. Refusing as an ordinary admission
                    # error matters: raising ValueError here escaped the error
                    # envelope entirely and reached the caller as an internal
                    # failure for perfectly ordinary SQL.
                    raise AnalyticsSqlError(
                        code=ErrorCode.UNSUPPORTED_SYNTAX,
                        message=(
                            f"SELECT * cannot be expanded over {table_name!r}, which is a "
                            "query-local relation rather than an allowlisted table. "
                            "Name the columns you want."
                        ),
                        identifiers=(table_name,),
                    )
                # Every physical DDL column, then query-only virtual overlays.
                # Star expansion runs before virtual-column substitution, so
                # naming the overlays here is enough for those passes to resolve
                # them while retaining the ordered physical table shape.
                emitted = [*spec.columns, *sorted(spec.virtual_columns)]
                for name in emitted:
                    quoted = name in spec.quoted_columns
                    key = _identifier_key(name, quoted=quoted, dialect=ctx.dialect)
                    if key in using_keys:
                        if key in emitted_using:
                            continue
                        emitted_using.add(key)
                    # Qualify by the caller's alias, quoting included: after
                    # ``FROM spans AS s`` the name ``spans`` no longer resolves.
                    new_exprs.append(
                        exp.Column(
                            this=exp.to_identifier(name, quoted=quoted),
                            table=qualifier.copy(),
                        )
                    )
            local_changed = True

        if local_changed:
            node.set("expressions", new_exprs)
            changed = True

    if changed:
        ctx.applied.append("star_expansion")
    return root


def _substitute_latency_ms(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Replace the advertised ``latency_ms`` column with elapsed milliseconds.

    No such column is stored. It is advertised because every caller wants
    duration and nobody wants to rediscover that it must be derived from two
    timestamps, in units that differ by backend.

    The substitution is the same in every position. A column that claims to be
    a float must behave like one wherever it appears -- ``latency_ms > 100``
    has to mean the same hundred milliseconds as a projected ``latency_ms`` of
    100, or the advertisement is a lie in one of the two places. Comparing the
    raw SQLite timestamp subtraction coerces stored text to zero, so a sibling
    rewrite gives timestamp subtraction elapsed-seconds semantics there.

    Two rendering hazards govern how the tree is built, and both produce
    plausible SQL that computes the wrong number rather than failing.

    The subtraction must be parenthesised explicitly. A generator emits an
    arithmetic tree in source order without consulting precedence, so a
    structurally correct ``Mul(Sub(a, b), 1000)`` renders as ``a - b * 1000``
    and is then reparsed by the engine as ``a - (b * 1000)``. Applied to unix
    timestamps that yields roughly ``-1000 x start_time``: a large negative
    number that executes without error, and that orders rows by start time
    whenever it is used to sort.

    ``EXTRACT`` takes the field first and the source second. Supplying them the
    other way round builds a node that renders as ``EXTRACT(a - b FROM EPOCH)``,
    which is not the same request and is not valid.
    """
    changed = False

    # Resolved once against the tree that is about to be edited, so node
    # identity is stable across the walk below. A reference this marks local
    # means the column some derived relation projected under the name, not the
    # duration this pass computes.
    query_local = query_local_columns(root, allowlist=ctx.allowlist, dialect=ctx.dialect)
    scope_root = build_scope(root)
    # Per-column: duration-table count in this scope, and folded names a
    # qualifier may use. Only Table sources count; a CTE of the same name is a
    # nested scope.
    duration_scope: dict[int, tuple[int, frozenset[str]]] = {}
    if scope_root is not None:
        for scope in scope_root.traverse():
            aliases: set[str] = set()
            duration_sources = 0
            for alias, source in scope.sources.items():
                if not isinstance(source, exp.Table):
                    continue
                table_name = _allowlisted_table_name(
                    source, allowlist=ctx.allowlist, dialect=ctx.dialect
                )
                if (
                    table_name is None
                    or "latency_ms" not in ctx.allowlist.table_specs[table_name].virtual_columns
                ):
                    continue
                duration_sources += 1
                aliases.add(alias.casefold())
                aliases.add((source.name or "").casefold())
            names = frozenset(aliases)
            for column in (*scope.columns, *_scope_columns(scope.expression)):
                duration_scope[id(column)] = (duration_sources, names)
            if duration_sources < 2:
                continue
            for column in _scope_columns(scope.expression):
                if (
                    (column.name or "").casefold() == "latency_ms"
                    and not column.table
                    and not query_local.is_local(column)
                ):
                    raise AnalyticsSqlError(
                        code=ErrorCode.UNSUPPORTED_SYNTAX,
                        message=(
                            "`latency_ms` is ambiguous across multiple duration tables. "
                            "Qualify it with a table alias (for example, `t.latency_ms`)."
                        ),
                    )

    for node in list(root.find_all(exp.Column)):
        if (node.name or "").lower() == "latency_ms" and not query_local.is_local(node):
            duration_sources, aliases = duration_scope.get(id(node), (0, frozenset()))
            qualifier = (node.table or "").casefold()
            if qualifier:
                if qualifier not in aliases:
                    continue
            elif duration_sources != 1:
                continue
            table_ident = _copied_table_identifier(node)
            start = exp.column("start_time", table=table_ident)
            end = exp.column(
                "end_time", table=table_ident.copy() if table_ident is not None else None
            )
            for written in (start, end):
                ctx.substituted_columns[written.sql()] = "latency_ms"
            changed = True
            if ctx.dialect == "postgresql":
                # Subtracting two timestamps gives an interval; EXTRACT(EPOCH ...)
                # converts it to seconds. The function call parenthesises itself,
                # so only the interval subtraction needs a Paren of its own.
                elapsed: exp.Expression = exp.Extract(
                    this=exp.var("EPOCH"),
                    expression=exp.paren(exp.Sub(this=end, expression=start)),
                )
            else:
                # 'subsec' keeps the fractional part; without it unixepoch
                # truncates to whole seconds and every sub-second span reads 0.
                elapsed = exp.paren(
                    exp.Sub(
                        this=exp.Anonymous(
                            this="unixepoch", expressions=[end, exp.Literal.string("subsec")]
                        ),
                        expression=exp.Anonymous(
                            this="unixepoch", expressions=[start, exp.Literal.string("subsec")]
                        ),
                    )
                )
            # Parenthesised as a whole, not just the subtraction inside it. The
            # substituted node takes the place of a *column*, so it must bind as
            # tightly as one wherever it lands. Without the outer parens
            # `1000 / latency_ms` renders as `1000 / <elapsed> * 1000`, which
            # regroups to `(1000 / elapsed) * 1000` and answers 10^6 times too
            # large -- silently, since the result is a plausible float.
            milliseconds = exp.paren(exp.Mul(this=elapsed, expression=exp.Literal.number(1000)))
            # Aliased in the select list so the result carries the name the
            # caller asked for. Without it the column comes back as `?column?`
            # on Postgres and as the expression text on SQLite, so a column the
            # schema advertises never appears under its own name in any answer.
            in_select_list = isinstance(node.parent, exp.Select)
            node.replace(
                exp.Alias(this=milliseconds, alias=exp.to_identifier("latency_ms"))
                if in_select_list
                else milliseconds
            )

    if changed:
        ctx.applied.append("latency_ms")
    return root


def _rewrite_sqlite_timestamp_subtraction(
    root: exp.Expression, ctx: RewriteContext
) -> exp.Expression:
    """Give subtraction of stored SQLite timestamps its elapsed-seconds meaning."""
    if ctx.dialect != "sqlite":
        return root
    timestamp_columns = timestamp_column_names(ctx.allowlist.tables)
    query_local = query_local_columns(root, allowlist=ctx.allowlist, dialect=ctx.dialect)
    changed = False
    for node in list(root.find_all(exp.Sub)):
        left, right = node.this, node.expression
        if not (
            isinstance(left, exp.Column)
            and isinstance(right, exp.Column)
            and (left.name or "").casefold() in timestamp_columns
            and (right.name or "").casefold() in timestamp_columns
            and not query_local.is_local(left)
            and not query_local.is_local(right)
        ):
            continue
        node.replace(
            exp.paren(
                exp.Sub(
                    this=exp.Anonymous(
                        this="unixepoch", expressions=[left.copy(), exp.Literal.string("subsec")]
                    ),
                    expression=exp.Anonymous(
                        this="unixepoch", expressions=[right.copy(), exp.Literal.string("subsec")]
                    ),
                )
            )
        )
        changed = True
    if changed:
        ctx.applied.append("sqlite_timestamp_subtraction")
    return root


def _qualify_schema(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Point unqualified table references at the schema the tables live in.

    Only base tables. A walk that qualifies every node whose name matches an
    allowlisted table also rewrites references to a CTE of the same name, and
    since a schema-qualified name cannot resolve to a CTE, that silently
    redirects the query to the physical table:

        WITH spans AS (SELECT * FROM spans WHERE name = 'foo')
        SELECT count(*) FROM spans

    becomes a count over all of ``public.spans``. The CTE turns into dead code,
    the caller's filter disappears, and the statement is valid SQL throughout --
    so the only symptom is a wrong number. SQLite has no such pass and answers the same
    query correctly, so the two backends disagree.

    The pass immediately before this one already resolves scopes correctly and
    declines to wrap CTE references. This one used a raw walk, so two
    consecutive passes disagreed about what the same node was.
    """
    if ctx.dialect != "postgresql":
        return root
    scope_root = build_scope(root)
    if scope_root is None:
        return root
    changed = False
    for scope in scope_root.traverse():
        for source in scope.sources.values():
            # Only sources that resolve to a table. A CTE resolves to a nested
            # scope instead, and is skipped -- while inside that CTE's own body
            # the same name resolves to the table again and is qualified there,
            # which a name-matching rule cannot express.
            if not isinstance(source, exp.Table):
                continue
            if (
                _allowlisted_table_name(source, allowlist=ctx.allowlist, dialect=ctx.dialect)
                is not None
                and not source.db
            ):
                source.set("db", exp.to_identifier(ctx.allowlist.pg_schema))
                changed = True
    if changed:
        ctx.applied.append("schema_qualification")
    return root


def _limit_count_expression(limit: exp.Expression) -> Optional[exp.Expression]:
    """The numeric bound a LIMIT or FETCH clause states.

    FETCH FIRST ROW ONLY has no count node; SQL's default is one row.
    ``exp.Fetch`` is not a subclass of ``exp.Limit``.
    """
    if isinstance(limit, exp.Limit):
        return limit.expression
    if isinstance(limit, exp.Fetch):
        count = limit.args.get("count")
        return count if isinstance(count, exp.Expression) else exp.Literal.number(1)
    return None


def _parse_limit_count(
    expression: exp.Expression, *, dialect: SupportedSQLDialectName
) -> Optional[int]:
    """The integer a limit expression names, or None if it cannot be read.

    Render through SQLGlot's dialect (``postgres``), not Phoenix's (``postgresql``).
    """
    try:
        return int(expression.sql(dialect=sqlglot_read_dialect(dialect)))
    except ValueError:
        return None


def _inject_limit(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    # Set operations are admitted too, and they are the shape that most needs a
    # limit: UNION deduplicates and INTERSECT sorts, so the engine can be made to
    # materialise both sides in full even though the caller only reads the first
    # page. Handling Select alone let those reach the backend unbounded.
    if not isinstance(root, (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        return root
    limit = root.args.get("limit")
    should_probe = limit is None
    count_expression = _limit_count_expression(limit) if isinstance(limit, exp.Expression) else None
    if count_expression is not None:
        requested_limit = _parse_limit_count(count_expression, dialect=ctx.dialect)
        if requested_limit is None:
            # An expression or placeholder can be unbounded at execution time.
            # Replacing it is safer than trusting a value admission cannot see.
            should_probe = True
        else:
            should_probe = requested_limit < 0 or requested_limit >= ctx.row_limit
    elif limit is not None:
        # A limit-like node we cannot read. Fail closed rather than leaving
        # the statement unbounded.
        should_probe = True
    if should_probe:
        # One more row than the caller asked for. Fetching exactly the limit
        # makes truncation undetectable: a result of exactly N rows is
        # indistinguishable from a result that had N+1, because the row that
        # would prove it was never retrieved. The consumer trims back to the
        # limit and reports partial only when this extra row actually arrived,
        # which is the difference between a flag that is sometimes right and one
        # that is always right.
        probe_limit = exp.Limit(expression=exp.Literal.number(ctx.row_limit + 1))
        if limit is None:
            root.set("limit", probe_limit)
        else:
            limit.replace(probe_limit)
        ctx.applied.append("limit_injection")
    return root


def _decode_node_id(value: str, type_name: str) -> Optional[int]:
    """Recover the primary key from a Relay global id, if it names this type."""
    try:
        decoded = base64.b64decode(value, validate=True).decode()
    except (BinasciiError, UnicodeDecodeError):
        return None
    prefix, _, payload = decoded.partition(":")
    if prefix != type_name or not payload.isdigit():
        return None
    try:
        return int(payload)
    except ValueError:
        return None


def _substitute_graphql_node_id(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Translate between Relay global ids and the integer primary key.

    Users never see the integer id. The UI and the GraphQL API both speak base64
    "TypeName:id", so an agent arriving with one of those has nothing to join on,
    and an agent producing an integer has nothing to hand back.

    The substitution differs by position, for the same reason latency_ms does.

    In a predicate the literal is decoded here and the comparison becomes
    ``id = 7``, which reaches the primary key. Encoding in SQL instead would make
    the engine compute a value for every row before comparing, turning a key
    lookup into a full scan -- and the only way to index around that would be an
    expression index, which means a migration.

    In a projection there is nothing to search, so the value is built in SQL,
    where it composes with ORDER BY, GROUP BY and joins. Encoding after the fact
    in the result normaliser would produce a value that none of those can see.

    A comparison against something that is not a valid id for this type is left
    alone: it will match nothing, which is the truthful answer, rather than being
    rewritten into a comparison the caller did not ask for.
    """
    # Physical tables in this reference's scope. A CTE of the same name is a
    # nested scope, not a Table.
    query_local = query_local_columns(root, allowlist=ctx.allowlist, dialect=ctx.dialect)
    scope_root = build_scope(root)
    # column id -> (alias/table -> type, fallback type, physical graphql sources)
    resolution: dict[int, tuple[dict[str, str], Optional[str], int]] = {}
    if scope_root is not None:
        for scope in scope_root.traverse():
            by_alias, n_sources = _physical_graphql_types(
                scope, allowlist=ctx.allowlist, dialect=ctx.dialect
            )
            fallback = next(iter(set(by_alias.values()))) if n_sources == 1 else None
            for column in (*scope.columns, *_scope_columns(scope.expression)):
                resolution[id(column)] = (by_alias, fallback, n_sources)
    if not any(n_sources for _, _, n_sources in resolution.values()):
        return root

    changed = False

    def is_node_id(node: exp.Expression) -> bool:
        return (
            isinstance(node, exp.Column)
            and (node.name or "").lower() == GRAPHQL_NODE_ID_COLUMN
            and not query_local.is_local(node)
        )

    def type_for(node: exp.Column) -> Optional[str]:
        by_alias, fallback, _ = resolution.get(id(node), ({}, None, 0))
        qualifier = node.table or ""
        if not qualifier:
            return fallback
        identifier = node.args.get("table")
        quoted = isinstance(identifier, exp.Identifier) and bool(identifier.args.get("quoted"))
        return by_alias.get(_identifier_key(qualifier, quoted=quoted, dialect=ctx.dialect))

    def graphql_source_count(node: exp.Column) -> int:
        return resolution.get(id(node), ({}, None, 0))[2]

    # Predicate position first: rewriting the whole comparison removes the column
    # before the projection pass can see it.
    for cmp_node in list(root.find_all(exp.EQ, exp.NEQ)):
        left, right = cmp_node.this, cmp_node.expression
        for column, literal in ((left, right), (right, left)):
            if is_node_id(column) and isinstance(literal, exp.Literal) and literal.is_string:
                type_name = type_for(column)
                if type_name is None:
                    continue
                row_id = _decode_node_id(literal.name, type_name)
                if row_id is None:
                    continue
                cmp_node.set("this", exp.column("id", table=_copied_table_identifier(column)))
                cmp_node.set("expression", exp.Literal.number(row_id))
                changed = True
                break

    # Whatever is left is a projection or an unrecognised position; build the id.
    for column in list(root.find_all(exp.Column)):
        if not is_node_id(column):
            continue
        type_name = type_for(column)
        if type_name is None:
            # Ambiguous only when this scope has several GraphQL tables. With
            # none, leave the name for the engine.
            if not column.table and graphql_source_count(column) > 1:
                raise AnalyticsSqlError(
                    code=ErrorCode.UNSUPPORTED_SYNTAX,
                    message=(
                        "`graphql_node_id` is ambiguous across multiple GraphQL tables. "
                        "Qualify it with a table alias (for example, `t.graphql_node_id`)."
                    ),
                )
            continue
        written = exp.column("id", table=_copied_table_identifier(column))
        ctx.substituted_columns[written.sql()] = "graphql_node_id"
        payload = exp.Concat(
            expressions=[
                exp.Literal.string(f"{type_name}:"),
                exp.Cast(this=written, to=exp.DataType.build("TEXT")),
            ]
        )
        if ctx.dialect == "sqlite":
            encoded: exp.Expression = exp.Anonymous(
                this="encode", expressions=[payload, exp.Literal.string("base64")]
            )
        else:
            encoded = exp.Anonymous(
                this="encode",
                expressions=[
                    exp.Anonymous(
                        this="convert_to", expressions=[payload, exp.Literal.string("UTF8")]
                    ),
                    exp.Literal.string("base64"),
                ],
            )
        # Alias only in the select list. The same expression can legitimately
        # appear in a predicate -- a node id for another type, which decoding
        # correctly declined to rewrite -- and an alias there is a syntax error.
        in_select_list = isinstance(column.parent, exp.Select)
        column.replace(exp.alias_(encoded, GRAPHQL_NODE_ID_COLUMN) if in_select_list else encoded)
        changed = True

    if changed:
        ctx.applied.append("graphql_node_id")
    return root


def _physical_graphql_types(
    scope: Any, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
) -> tuple[dict[str, str], int]:
    """Alias and table name -> GraphQL type for physical tables in this scope.

    Keyed by both under dialect identifier rules, because ``FROM traces t``
    lets the caller write either ``t.graphql_node_id`` or
    ``traces.graphql_node_id``. A name that resolves to two different types is
    dropped rather than guessed at -- a self-join has one type per side and
    picking either would attribute a row id to the wrong one.

    Only ``scope.sources`` that resolve to a Table. A CTE of the same name is a
    nested scope.
    """
    found: dict[str, Optional[str]] = {}
    n_sources = 0

    def record(name: str, type_name: str, *, quoted: bool) -> None:
        key = _identifier_key(name, quoted=quoted, dialect=dialect)
        if key in found and found[key] != type_name:
            found[key] = None
        else:
            found.setdefault(key, type_name)

    for source in scope.sources.values():
        if not isinstance(source, exp.Table):
            continue
        table_name = _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
        if table_name is None:
            continue
        type_name = TABLE_GRAPHQL_TYPES.get(table_name)
        if type_name is None:
            continue
        n_sources += 1
        alias_node = source.args.get("alias")
        alias_identifier = alias_node.this if isinstance(alias_node, exp.TableAlias) else alias_node
        if isinstance(alias_identifier, exp.Identifier):
            record(
                alias_identifier.this or "",
                type_name,
                quoted=bool(alias_identifier.args.get("quoted")),
            )
        table_identifier = source.this
        if isinstance(table_identifier, exp.Identifier):
            record(
                table_identifier.this or "",
                type_name,
                quoted=bool(table_identifier.args.get("quoted")),
            )
        elif source.name:
            record(source.name, type_name, quoted=False)
    return {key: value for key, value in found.items() if value is not None}, n_sources
