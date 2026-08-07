from __future__ import annotations

import base64
import logging
from binascii import Error as BinasciiError
from dataclasses import dataclass, field
from typing import Optional

from sqlglot import exp
from sqlglot.optimizer.scope import build_scope

from phoenix.server.mcp_analytics_sql.allowlist import (
    GRAPHQL_NODE_ID_COLUMN,
    TABLE_GRAPHQL_TYPES,
    Allowlist,
    DialectName,
)
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.normalize import (
    format_timestamp_for_sqlite,
    parse_timestamp_literal,
    timestamp_column_names,
)
from phoenix.server.mcp_analytics_sql.parse import _timestamp_literals, query_local_columns

logger = logging.getLogger(__name__)


@dataclass
class RewriteContext:
    allowlist: Allowlist
    dialect: DialectName
    row_limit: int
    applied: list[str] = field(default_factory=list)
    # Statements about this answer the caller should not have to infer. A pass
    # that resolves something the caller left open records it here.
    notes: list[str] = field(default_factory=list)
    # Logical JSON path -> (accessor kind, exact path literal) for paths this
    # deployment has indexed, read from its catalog. Empty when nothing is
    # indexed or the catalog could not be read, which costs only the index.
    indexed_json_accessors: dict[tuple[str, ...], tuple[str, str]] = field(default_factory=dict)
    # Relation names that exist only inside this statement -- CTEs, and the
    # derived tables the rewrites below wrap real tables in. SQLite can attribute
    # a column read to one of these instead of to the underlying table, and the
    # authorizer has no other way to tell such a name from a table nobody
    # allowlisted.
    introduced_relations: set[str] = field(default_factory=set)


def rewrite(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    root = _expand_stars(root, ctx)
    root = _substitute_latency_ms(root, ctx)
    root = _substitute_graphql_node_id(root, ctx)
    root = _normalize_timestamp_literals(root, ctx)
    root = _canonicalize_json_extract(root, ctx)
    root = _qualify_schema(root, ctx)
    root = _inject_limit(root, ctx)
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
        if name not in ctx.allowlist.tables:
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

    The time-bound wrapper replaces ``FROM spans s`` with
    ``FROM (SELECT * FROM spans WHERE ...) AS s``, so the statement handed to the
    engine contains a derived table that the caller never wrote and the manifest
    has never heard of. SQLite may then report a column read against that alias
    rather than against ``spans``, which the table check reads as an attempt on an
    unknown table and refuses -- a statement rejected for a relation we invented.

    Caller-written CTEs and subqueries are collected for the same reason. Letting
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
    for literal in _timestamp_literals(root, columns):
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
        keys = _json_path_keys(node.expression)
        indexed = ctx.indexed_json_accessors.get(keys) if keys else None
        if indexed is not None:
            accessor, literal = indexed
            # An index built on `->` is deliberately not matched. That accessor
            # returns JSON text, so reproducing it to gain the index would
            # reintroduce the comparison bug this function exists to prevent,
            # and a fast wrong answer is worse than a slow right one.
            if accessor == "json_extract":
                node.replace(
                    exp.Anonymous(
                        this="json_extract",
                        expressions=[node.this, exp.Literal.string(literal)],
                    )
                )
                changed = True
                continue
            if accessor == "->>":
                node.replace(
                    exp.JSONExtractScalar(this=node.this, expression=exp.Literal.string(literal))
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


def _star_sources(node: exp.Select) -> list[tuple[str, str]]:
    """Every relation a bare ``*`` in this SELECT draws from, as (table, alias).

    A star means "every column of everything in the FROM clause", so the joins
    count as much as the leading table. Reading only the first source expands to
    one table's columns and silently drops the rest, which returns a plausible
    row that is missing exactly the data the caller joined for.
    """
    sources: list[tuple[str, str]] = []

    def add(expression: Optional[exp.Expression]) -> None:
        if expression is None:
            return
        if isinstance(expression, exp.Table) and expression.name:
            sources.append((expression.name, expression.alias_or_name))
        else:
            # A derived table, a table-valued function, or anything else whose
            # columns come from the query rather than the manifest. Recorded
            # with an empty table name so the caller of this function refuses
            # rather than skipping it: dropping such a source silently returns
            # the other sources' columns and none of these, which is a
            # well-formed answer missing exactly what was joined for.
            sources.append(("", expression.alias_or_name if expression else ""))

    from_expr = node.args.get("from_") or node.args.get("from")
    if isinstance(from_expr, exp.From):
        add(from_expr.this)
    for join in node.args.get("joins") or []:
        add(join.this)
    return sources


def _expand_stars(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    changed = False

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
            if isinstance(expression, exp.Star):
                pass
            elif isinstance(expression, exp.Column) and isinstance(expression.this, exp.Star):
                explicit = expression.table or ""
            else:
                new_exprs.append(expression)
                continue

            if explicit:
                targets = [
                    (name, alias)
                    for name, alias in _star_sources(node)
                    if explicit in (name, alias)
                ] or [(explicit, explicit)]
            else:
                targets = _star_sources(node)

            if not targets:
                raise AnalyticsSqlError(
                    code=ErrorCode.UNSUPPORTED_SYNTAX,
                    message=(
                        "SELECT * is supported only over allowlisted tables. "
                        "List the columns explicitly here."
                    ),
                )

            for table_name, alias in targets:
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
                # Exposed columns, then the virtual ones. Expanding the hidden
                # list here would hand back through `*` exactly what the schema
                # declines to show; omitting the virtual list did the mirror
                # image, returning fewer columns than the same CREATE TABLE
                # block advertises, so a caller who used `*` to learn the shape
                # concluded `latency_ms` and `graphql_node_id` did not exist.
                # Star expansion runs before their substitution passes, so
                # naming them here is enough for those passes to resolve them.
                emitted = [col.name for col in spec.exposed_columns]
                emitted += sorted(spec.virtual_columns)
                for name in emitted:
                    # Qualified by the alias the caller used, not by the table
                    # name: after `FROM spans AS s` the name `spans` no longer
                    # resolves, and the time-bound wrapper renames the source to
                    # the alias too.
                    new_exprs.append(exp.column(name, table=alias or table_name or None))
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
    raw timestamp difference in a predicate would be cheaper to build and would
    silently mean seconds on one backend and an interval on the other.

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
    query_local = query_local_columns(root)

    for node in list(root.find_all(exp.Column)):
        if (node.name or "").lower() == "latency_ms" and id(node) not in query_local:
            table_name = node.table or ""
            start = exp.column("start_time", table=table_name or None)
            end = exp.column("end_time", table=table_name or None)
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


def _qualify_schema(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Point unqualified table references at the schema the tables live in.

    Only base tables. A walk that qualifies every node whose name matches an
    allowlisted table also rewrites references to a CTE of the same name, and
    since a schema-qualified name cannot resolve to a CTE, that silently
    redirects the query to the physical table:

        WITH spans AS (SELECT * FROM spans WHERE name = 'foo')
        SELECT count(*) FROM spans

    becomes a count over all of ``public.spans``. The CTE turns into dead code,
    the caller's filter disappears, the outer read escapes the time bounds the
    envelope still reports, and the statement is valid SQL throughout -- so the
    only symptom is a wrong number. SQLite has no such pass and answers the same
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
            if source.name in ctx.allowlist.tables and not source.db:
                source.set("db", exp.to_identifier(ctx.allowlist.pg_schema))
                changed = True
    if changed:
        ctx.applied.append("schema_qualification")
    return root


def _inject_limit(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    # Set operations are admitted too, and they are the shape that most needs a
    # limit: UNION deduplicates and INTERSECT sorts, so the engine can be made to
    # materialise both sides in full even though the caller only reads the first
    # page. Handling Select alone let those reach the backend unbounded.
    if isinstance(root, (exp.Select, exp.Union, exp.Intersect, exp.Except)) and (
        root.args.get("limit") is None
    ):
        # One more row than the caller asked for. Fetching exactly the limit
        # makes truncation undetectable: a result of exactly N rows is
        # indistinguishable from a result that had N+1, because the row that
        # would prove it was never retrieved. The consumer trims back to the
        # limit and reports partial only when this extra row actually arrived,
        # which is the difference between a flag that is sometimes right and one
        # that is always right.
        root.set("limit", exp.Limit(expression=exp.Literal.number(ctx.row_limit + 1)))
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
    return int(payload)


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
    # Resolved per reference, not once per statement. Requiring a single table
    # meant the column worked alone and failed in a join -- including the join
    # the schema's own "to area root" hint teaches -- while `latency_ms`, listed
    # beside it and described in the same preamble sentence, worked in both. A
    # qualified reference names its table, so a join is only ambiguous for a
    # bare `graphql_node_id`, which stays untouched as before.
    by_alias = _graphql_types_in_scope(root)
    fallback = TABLE_GRAPHQL_TYPES.get(_single_table_name(root) or "")
    if not by_alias and fallback is None:
        return root

    changed = False

    # The same resolution `latency_ms` uses. This pass previously carried none
    # at all, so a derived relation projecting the column had its outer
    # reference rewritten into an expression over an `id` that relation does not
    # provide, and a CTE's own literal column of that name was overwritten.
    query_local = query_local_columns(root)

    def is_node_id(node: exp.Expression) -> bool:
        return (
            isinstance(node, exp.Column)
            and (node.name or "").lower() == GRAPHQL_NODE_ID_COLUMN
            and id(node) not in query_local
        )

    def type_for(node: exp.Column) -> Optional[str]:
        qualifier = (node.table or "").lower()
        return by_alias.get(qualifier) if qualifier else fallback

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
                cmp_node.set("this", exp.column("id", table=column.table or None))
                cmp_node.set("expression", exp.Literal.number(row_id))
                changed = True
                break

    # Whatever is left is a projection or an unrecognised position; build the id.
    for column in list(root.find_all(exp.Column)):
        if not is_node_id(column):
            continue
        type_name = type_for(column)
        if type_name is None:
            continue
        payload = exp.Concat(
            expressions=[
                exp.Literal.string(f"{type_name}:"),
                exp.Cast(
                    this=exp.column("id", table=column.table or None),
                    to=exp.DataType.build("TEXT"),
                ),
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


def _graphql_types_in_scope(root: exp.Expression) -> dict[str, str]:
    """Every alias and table name in the statement that has a GraphQL type.

    Keyed by both, lower-cased, because `FROM traces t` lets the caller write
    either `t.graphql_node_id` or `traces.graphql_node_id`. A name that resolves
    to two different types is dropped rather than guessed at -- a self-join has
    one type per side and picking either would attribute a row id to the wrong
    one, which is the failure the single-table rule was protecting against.
    """
    found: dict[str, Optional[str]] = {}

    def record(key: str, type_name: str) -> None:
        lowered = key.lower()
        if lowered in found and found[lowered] != type_name:
            found[lowered] = None
        else:
            found.setdefault(lowered, type_name)

    for table in root.find_all(exp.Table):
        type_name = TABLE_GRAPHQL_TYPES.get(table.name or "")
        if type_name is None:
            continue
        record(table.name, type_name)
        if table.alias:
            record(table.alias, type_name)
    return {key: value for key, value in found.items() if value is not None}


def _single_table_name(root: exp.Expression) -> Optional[str]:
    """The one real table this statement reads, or None if it reads several.

    A node id encodes its own type, so translating one requires knowing which
    table the column belongs to. With a single table that is unambiguous. With a
    join it is not, and guessing would silently attribute a row id to the wrong
    type -- so the column is left alone and the caller gets an unresolved-column
    error rather than a wrong row.
    """
    names = {t.name for t in root.find_all(exp.Table) if t.name and t.name in TABLE_GRAPHQL_TYPES}
    others = {t.name for t in root.find_all(exp.Table) if t.name}
    if len(others) != 1 or len(names) != 1:
        return None
    return next(iter(names))
