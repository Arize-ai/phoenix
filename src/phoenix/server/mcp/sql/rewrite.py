from __future__ import annotations

import base64
import logging
from binascii import Error as BinasciiError
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlglot import exp
from sqlglot.optimizer.scope import build_scope

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp.sql.allowlist import (
    GRAPHQL_NODE_ID_COLUMN,
    TABLE_GRAPHQL_TYPES,
    Allowlist,
    sqlglot_read_dialect,
)
from phoenix.server.mcp.sql.catalog import IndexedJsonAccessor
from phoenix.server.mcp.sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp.sql.normalize import (
    format_timestamp_for_sqlite,
    parse_timestamp_literal,
    timestamp_column_names,
    unix_epoch_to_utc,
)
from phoenix.server.mcp.sql.parse import (
    _JSON_EACH_COLUMNS,
    _TIMESTAMP_COMPARISONS,
    _allowlisted_table_name,
    _cast_type_name,
    _column_qualifier_key,
    _identifier_key,
    _is_all_quantifier,
    _is_quantifier,
    _join_using_identifiers,
    _quantifier_list_container,
    _relation_identifier_keys,
    _scope_columns,
    _scope_relation_keys,
    _strip_parens,
    _table_alias_column_names,
    _timestamp_literals,
    _timestamp_passthrough_references,
    _unix_epoch_text,
    _values_width,
    _virtual_column_on_source,
    query_local_columns,
    set_operation_width_mismatch,
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
    # USING keys rewritten to ON, keyed by Select identity. Star expansion
    # coalesces each to one output column, matching USING's shape.
    coalesced_using_by_select: dict[int, set[str]] = field(default_factory=dict)


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
        "A JSON value was ordered or compared without a cast. On SQLite "
        "`->>` and `json_extract` return whatever type the document holds, so "
        "a numeric path orders correctly and a path holding a quoted number "
        "orders as text. `->` always returns JSON text. Cast the extraction "
        "if the path may hold either, as in "
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
        "jsonb_extract_path",
        "jsonb_extract_path_text",
    }


#: Comparisons where text ordering answers differently from numeric ordering.
#: Equality is a separate hazard and is not one of these.
_ORDER_SENSITIVE_COMPARISONS = (exp.GT, exp.GTE, exp.LT, exp.LTE, exp.Between)


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
    note = _JSON_TEXT_ORDERING_NOTES[ctx.dialect]
    for node in root.find_all(*_ORDER_SENSITIVE, *_ORDER_SENSITIVE_COMPARISONS):
        for target in (
            _comparison_operands(node)
            if isinstance(node, _ORDER_SENSITIVE_COMPARISONS)
            else (node.this,)
        ):
            # A cast says the caller knows. Parentheses say nothing: the lambda
            # repair adds them, so an accessor written inside a call arrives
            # wrapped.
            unwrapped = _strip_parens(target)
            if unwrapped is None or isinstance(unwrapped, exp.Cast):
                continue
            if _is_json_extraction(unwrapped) and note not in ctx.notes:
                ctx.notes.append(note)
                return


def rewrite(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    root = _rewrite_virtual_using_joins(root, ctx)
    root = _expand_stars(root, ctx)
    mismatch = set_operation_width_mismatch(root)
    if mismatch is not None:
        raise AnalyticsSqlError(code=ErrorCode.UNSUPPORTED_SYNTAX, message=mismatch)
    root = _substitute_latency_ms(root, ctx)
    root = _substitute_graphql_node_id(root, ctx)
    root = _rewrite_sqlite_timestamp_subtraction(root, ctx)
    root = _rewrite_sqlite_timestamp_vs_epoch_function(root, ctx)
    root = _normalize_timestamp_literals(root, ctx)
    root = _rewrite_sqlite_casts(root, ctx)
    root = _rewrite_sqlite_median(root, ctx)
    root = _canonicalize_json_extract(root, ctx)
    root = _canonicalize_postgres_json_extract_function(root, ctx)
    root = _repair_quoted_json_path(root, ctx)
    root = _qualify_schema(root, ctx)
    root = _parenthesize_setop_operands(root, ctx)
    root = _inject_limit(root, ctx)
    # After canonicalisation, so it sees the accessors that will actually run.
    _note_uncast_json_ordering(root, ctx)
    _record_introduced_relations(root, ctx)
    _assert_rewrites_preserved_policy(root, ctx)
    return root


def _assert_rewrites_preserved_policy(root: exp.Expression, ctx: RewriteContext) -> None:
    """Re-check the finished tree against the guarantees admission established.

    Admission validates the statement the caller sent; the rewrite passes then
    edit it. Without a check between the last pass and the engine, an admitted
    query can become a different query on the way there -- a relation reference
    redirected to a table it was merely named after, or a clause dropped from
    the tables it constrained -- and nothing downstream distinguishes that from
    the query the caller asked for.

    Reaching this normally means a defect in the rewrite passes, but not always:
    a scope the passes model differently from admission sends ordinary caller
    SQL here too. It therefore refuses rather than asserting, so the failure
    leaves through the error envelope instead of escaping as an unhandled
    exception, and logs at error level so the signal reaches whoever runs the
    server. Both halves are load-bearing: a silent refusal hides the defect, and
    an escaping exception hides it while also breaking the response contract.
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


def _json_path_extract_args(path: exp.Expression) -> Optional[list[exp.Expression]]:
    """Path segments as string literals for ``jsonb_extract_path``.

    PostgreSQL takes keys and array indexes as text. JSONPathKey becomes the
    key string; JSONPathSubscript becomes the index digits. Unlike
    ``_json_path_keys``, subscripts are kept: they are valid path elements
    here, and dropping them would rewrite a different extraction.
    """
    if not isinstance(path, exp.JSONPath):
        return None
    args: list[exp.Expression] = []
    for part in path.expressions:
        if isinstance(part, exp.JSONPathRoot):
            continue
        if isinstance(part, exp.JSONPathKey) and isinstance(part.this, str):
            args.append(exp.Literal.string(part.this))
        elif isinstance(part, exp.JSONPathSubscript):
            args.append(exp.Literal.string(str(part.this)))
        else:
            return None
    return args or None


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
_TIMESTAMP_CAST_TYPES = frozenset({"TIMESTAMP", "TIMESTAMPTZ", "DATETIME", "DATE"})


def _is_timestamp_cast_target(target: Optional[exp.Expression]) -> bool:
    if target is None:
        return False
    name = target.this.name if hasattr(target.this, "name") else str(target.this)
    return name.upper().split("(")[0].strip() in _TIMESTAMP_CAST_TYPES


def _enclosing_array(node: exp.Expression) -> Optional[exp.Expression]:
    current = node.parent
    while isinstance(current, (exp.Cast, exp.Paren, exp.Tuple)):
        current = current.parent
    return current if isinstance(current, (exp.Array, exp.Values)) else None


def _normalize_timestamp_literals(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Re-emit timestamp literals in the form the backend compares correctly.

    Admission has already refused a literal that names a time of day without an
    offset, so every string literal reaching here is either aware or a bare date,
    and the instant is known. What remains is spelling -- and unquoted numbers,
    which PostgreSQL cannot compare to timestamptz and which are read as Unix
    epoch instants in UTC.

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
        if not isinstance(literal, exp.Literal):
            continue
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
    for node in _timestamp_literals(
        root, columns, allowlist=ctx.allowlist, dialect=ctx.dialect, numeric=True
    ):
        original = _unix_epoch_text(node)
        if original is None:
            continue
        converted = unix_epoch_to_utc(original)
        if converted is None:
            raise AnalyticsSqlError(
                code=ErrorCode.UNSUPPORTED_SYNTAX,
                message=(
                    f"Integer {original} cannot be read as a Unix epoch instant. "
                    "Write an ISO-8601 timestamp with an offset, for example "
                    "`2026-07-01T00:00:00+00:00`."
                ),
            )
        instant, unit = converted
        if ctx.dialect == "sqlite":
            rendered = format_timestamp_for_sqlite(instant)
        else:
            # isoformat keeps whole seconds as `...00+00:00` and retains the
            # subseconds an explicit `%Y-%m-%dT%H:%M:%S+00:00` format drops.
            rendered = instant.isoformat()
        replacement: exp.Expression = exp.Literal.string(rendered)
        # CAST(1719792000 AS bigint) compared to timestamptz: replacing only
        # the inner number leaves CAST('<instant>' AS bigint), which
        # PostgreSQL rejects. Inside ARRAY[...] or VALUES (...), a bare
        # string types the list as text; cast each element to timestamptz.
        if ctx.dialect == "postgresql" and _enclosing_array(node) is not None:
            replacement = exp.Cast(
                this=replacement,
                to=exp.DataType.build("TIMESTAMPTZ"),
            )
        parent = node.parent
        if isinstance(parent, exp.Cast) and not _is_timestamp_cast_target(parent.to):
            parent.replace(replacement)
        else:
            node.replace(replacement)
        note = f"Integer {original} was read as {unit} since the Unix epoch (UTC)."
        if note not in ctx.notes:
            ctx.notes.append(note)
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
    So the accessor a caller wrote cannot be exchanged for another one.

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
    paths are numeric.
    """
    if ctx.dialect != "sqlite":
        return root
    changed = False
    for node in list(root.find_all(exp.JSONExtract, exp.JSONExtractScalar)):
        # `->` returns JSON text; `json_extract` and `->>` return the SQL value.
        # Rewriting the operator would therefore change both the value and the
        # type of every JSON scalar, so only the function form is canonicalised.
        # `only_json_types` marks the operator spelling. It decides rather than
        # the node class, which is not stable across parser versions.
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


def _repair_quoted_json_path(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Emit a JSON key containing a quote as a literal, so it is escaped.

    The generator renders the path of a JSON accessor without escaping, so a
    key holding an apostrophe closes its own string and the statement does not
    parse. Attribute keys are arbitrary strings, and `describeSqlSchema`
    publishes the populated ones, so the surface can print a path it cannot run.

    A plain string literal in the same position is escaped correctly, and keeps
    the accessor the caller wrote -- which matters on SQLite, where `->` and
    `json_extract` return different types.

    Workaround for https://github.com/tobymao/sqlglot/issues/8251, open
    upstream.
    """
    changed = False
    for node in list(root.find_all(exp.JSONExtract, exp.JSONExtractScalar)):
        path = node.expression
        if not isinstance(path, exp.JSONPath):
            continue
        parts = [part for part in path.expressions if not isinstance(part, exp.JSONPathRoot)]
        keys = [part.this for part in parts if isinstance(part, exp.JSONPathKey)]
        if not any(isinstance(key, str) and "'" in key for key in keys):
            continue
        if ctx.dialect == "sqlite":
            # A subscript belongs to the path as much as a key does, and
            # `_quoted_json_path` spells both, so the shape it accepts is the
            # shape this repairs.
            spelled = _quoted_json_path(path)
            if spelled is None:
                continue
        elif len(keys) == len(parts) == 1:
            # The operator takes one key, and that key is the literal.
            spelled = keys[0]
        else:
            continue
        node.set("expression", exp.Literal.string(spelled))
        changed = True
    if changed:
        ctx.applied.append("json_path_quote_repair")
    return root


def _json_path_is_root_only(path: exp.JSONPath) -> bool:
    """True for `$`, which names the document rather than anything inside it."""
    return not [part for part in path.expressions if not isinstance(part, exp.JSONPathRoot)]


def _canonicalize_postgres_json_extract_function(
    root: exp.Expression, ctx: RewriteContext
) -> exp.Expression:
    """Emit PostgreSQL JSON reads written as a function against the jsonb forms.

    SQLGlot renders ``json_extract(attributes, '$.llm')`` -- the portable
    spelling, and the one this surface canonicalises to on SQLite -- as
    ``json_extract_path``, which PostgreSQL defines over ``json`` and not
    ``jsonb``, so it refuses the stored column. ``jsonb_extract_path`` and
    ``jsonb_extract_path_text`` are the jsonb equivalents; both are in the anon
    allowlist, since callers may also write them directly.

    Only a ``JSONPath`` operand can supply the key arguments, so that is the
    condition for the rewrite; ``only_json_types`` then separates the two
    spellings that carry a path, marking the operator, which already renders
    correctly.

    Any other operand renders inline as ``a -> operand``, and an operand that is
    itself an operator regroups when it does: ``json_extract(a, 'x' || 'y')``
    emits ``a -> 'x' || 'y'``, which PostgreSQL reads as ``(a -> 'x') || 'y'``
    because ``->`` and ``||`` share a precedence class and associate left. That
    is a different statement, so such an operand is parenthesised. It can only
    arise from the function spelling: written as an operator, the same text
    groups that way in the parser too, and the extraction is not the top node.
    """
    if ctx.dialect != "postgresql":
        return root
    changed = False
    parenthesised = False
    for node in list(root.find_all(exp.JSONExtract, exp.JSONExtractScalar)):
        inner = _strip_parens(node.expression)
        if not isinstance(inner, exp.JSONPath):
            # PostgreSQL's `->` takes a key, not a path. A computed operand is
            # therefore looked up as one key name, so `json_extract(doc, '$.' ||
            # 'llm')` asks for a key literally called `$.llm` and answers NULL,
            # while SQLite reads the same text as a path. Nothing in the tree
            # separates a computed key from a computed path -- `doc -> k.key`
            # and `json_extract(doc, k.key)` parse identically -- so this is
            # noted rather than refused or rewritten.
            if not isinstance(inner, (exp.Literal, exp.Column)) and _COMPUTED_JSON_KEY_NOTE not in (
                ctx.notes
            ):
                ctx.notes.append(_COMPUTED_JSON_KEY_NOTE)
            operand = node.expression
            # Binary and Unary cover the infix and prefix operators; Predicate
            # adds the comparison forms that are neither, such as BETWEEN and
            # IN. exp.Paren is itself a Unary, and an already-parenthesised
            # operand renders unambiguously.
            # Workaround for https://github.com/tobymao/sqlglot/issues/8211,
            # fixed upstream but unreleased at the pinned version.
            if isinstance(operand, (exp.Binary, exp.Unary, exp.Predicate)) and not isinstance(
                operand, exp.Paren
            ):
                node.set("expression", exp.Paren(this=operand))
                parenthesised = True
            continue
        if node.args.get("only_json_types") is not None:
            continue
        # A root-only path selects the whole document. It has no keys to pass,
        # and `json_extract_path(doc)` is not a signature PostgreSQL defines,
        # so the path operators express it instead: `#> '{}'` is the document,
        # `#>> '{}'` is the document as text.
        # Workaround for https://github.com/tobymao/sqlglot/issues/8232, fixed
        # upstream but unreleased at the pinned version.
        if _json_path_is_root_only(inner):
            whole = (
                exp.JSONBExtractScalar
                if isinstance(node, exp.JSONExtractScalar)
                else exp.JSONBExtract
            )
            node.replace(whole(this=node.this, expression=exp.Literal.string("{}")))
            changed = True
            continue
        path_args = _json_path_extract_args(inner)
        if path_args is None:
            continue
        name = (
            "jsonb_extract_path_text"
            if isinstance(node, exp.JSONExtractScalar)
            else "jsonb_extract_path"
        )
        node.replace(
            exp.Anonymous(
                this=name,
                expressions=[node.this, *path_args],
            )
        )
        changed = True
    if parenthesised:
        ctx.applied.append("json_operand_parens")
    if changed:
        ctx.applied.append("jsonb_extract_path")
    return root


#: Said when a JSON accessor's key is computed, because the two engines read
#: the same statement differently and neither is wrong.
_COMPUTED_JSON_KEY_NOTE = (
    "A computed JSON key is looked up as a key name on PostgreSQL and as a path on "
    "SQLite. Use jsonb_extract_path(doc, k1, k2) on PostgreSQL, or a literal path, "
    "if you meant to walk into the document."
)


def _source_exposes_column(
    source: exp.Expression,
    name: str,
    *,
    quoted: bool,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
) -> bool:
    """Whether this relation offers the column, stored or overlay."""
    if not isinstance(source, exp.Table):
        return False
    table_name = _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
    if table_name is None:
        return False
    spec = allowlist.table_specs.get(table_name)
    if spec is None:
        return False
    want = _identifier_key(name, quoted=quoted, dialect=dialect)
    return any(
        _identifier_key(offered, quoted=False, dialect=dialect) == want
        for offered in (*spec.columns, *spec.virtual_columns)
    )


def _local_relation_projects(
    source: exp.Expression,
    root: exp.Expression,
    name: str,
    *,
    dialect: SupportedSQLDialectName,
) -> bool:
    """Whether a query-local relation projects this column.

    A CTE, subquery or VALUES list names its own columns, so the manifest
    cannot answer for it. Its copy of a USING key is NULL on the same rows a
    physical table's is.

    Table-valued functions are excluded: their star expansion emits a physical
    column under a different output name, which a two-sided merge of one name
    cannot express.
    """
    if not isinstance(source, exp.Expression) or _tvf_output_names(source) is not None:
        return False
    names = _expression_output_names(
        source, root, dialect=dialect, qualifier=_relation_qualifier(source)
    )
    if not names:
        return False
    want = _identifier_key(name, quoted=False, dialect=dialect)
    return any(_identifier_key(offered, quoted=False, dialect=dialect) == want for offered in names)


def _coalesced_using_column(name: str, *, quoted: bool, merge: list[exp.Identifier]) -> exp.Expr:
    """A USING key as the merge of the relations that supply it."""
    ident = exp.to_identifier(name, quoted=quoted)
    return exp.alias_(
        exp.Coalesce(
            this=exp.Column(this=ident.copy(), table=merge[0].copy()),
            expressions=[exp.Column(this=ident.copy(), table=other.copy()) for other in merge[1:]],
        ),
        ident.copy(),
    )


def _using_key_qualifier(
    left_sources: list[exp.Expression],
    ident: exp.Identifier,
    *,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
) -> exp.Identifier:
    """Which relation on the left a USING key names.

    PostgreSQL refuses a key exposed by more than one relation of the left
    composite, so more than one match here is the caller's ambiguity rather
    than a choice to make for them. No match leaves the nearest relation, which
    is what the engine will report against.
    """
    name = ident.this or ""
    quoted = bool(ident.args.get("quoted"))
    exposing = [
        source
        for source in left_sources
        if _source_exposes_column(source, name, quoted=quoted, allowlist=allowlist, dialect=dialect)
    ]
    if len(exposing) > 1:
        raise AnalyticsSqlError(
            code=ErrorCode.UNSUPPORTED_SYNTAX,
            message=(
                f"`{name}` in USING names a column that more than one relation to its left "
                "provides. Join with ON and qualify each side."
            ),
        )
    return _relation_qualifier(exposing[0] if exposing else left_sources[-1])


def _rewrite_virtual_using_joins(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Turn USING keys that name query-only overlays into ON comparisons.

    Substitution walks ``exp.Column``. A USING key is an identifier, so
    ``JOIN traces USING (latency_ms)`` never reached the overlay rewrite and
    failed in Postgres as a missing physical column. The same join written
    with ON is a comparison the rewrite can see, so that is what we emit.
    Physical USING keys stay as USING unless a virtual key is in the same
    list: ``USING (id) ON (...)`` is not valid PostgreSQL, so every key
    becomes an ON equality and star expansion coalesces them as USING would.
    """
    changed = False
    for select in root.find_all(exp.Select):
        from_expr = select.args.get("from_") or select.args.get("from")
        # Every relation to the left, not just the previous one: SQL resolves a
        # USING key against the whole composite built so far, so in
        # `a JOIN b ON ... JOIN c USING (k)` the key may come from `a`.
        left_sources: list[exp.Expression] = (
            [from_expr.this] if isinstance(from_expr, exp.From) else []
        )
        for join in select.args.get("joins") or []:
            if not left_sources:
                left_sources.append(join.this)
                continue
            virtual_keys: list[exp.Identifier] = []
            physical_keys: list[exp.Identifier] = []
            for ident in _join_using_identifiers(join):
                name = ident.this or ""
                quoted = bool(ident.args.get("quoted"))
                if any(
                    _virtual_column_on_source(
                        source, name, quoted=quoted, allowlist=ctx.allowlist, dialect=ctx.dialect
                    )
                    for source in left_sources
                ) or _virtual_column_on_source(
                    join.this, name, quoted=quoted, allowlist=ctx.allowlist, dialect=ctx.dialect
                ):
                    virtual_keys.append(ident)
                else:
                    physical_keys.append(ident)
            if virtual_keys:
                right_qual = _relation_qualifier(join.this)
                # Physical keys have to become ON too. Leaving them as USING
                # next to the new ON is not valid PostgreSQL (`USING (id) ON
                # (...)`), and the engine then fails a statement admission
                # already accepted.
                on_keys = [*physical_keys, *virtual_keys]
                equalities: list[exp.Expression] = [
                    exp.EQ(
                        this=exp.Column(
                            this=ident.copy(),
                            table=_using_key_qualifier(
                                left_sources, ident, allowlist=ctx.allowlist, dialect=ctx.dialect
                            ).copy(),
                        ),
                        expression=exp.Column(this=ident.copy(), table=right_qual.copy()),
                    )
                    for ident in on_keys
                ]
                on_expr: exp.Expression = equalities[0]
                for extra in equalities[1:]:
                    on_expr = exp.And(this=on_expr, expression=extra)
                existing = join.args.get("on")
                if existing is not None:
                    on_expr = exp.And(this=existing, expression=on_expr)
                join.set("on", on_expr)
                join.set("using", None)
                # USING coalesces each key to one output column. Star expansion
                # runs after this pass, so it would otherwise emit both sides'
                # copies of `latency_ms` and change the shape of `SELECT *`.
                coalesced = ctx.coalesced_using_by_select.setdefault(id(select), set())
                for ident in on_keys:
                    coalesced.add(
                        _identifier_key(
                            ident.this or "",
                            quoted=bool(ident.args.get("quoted")),
                            dialect=ctx.dialect,
                        )
                    )
                changed = True
            left_sources.append(join.this)
    if changed:
        ctx.applied.append("virtual_using")
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
    # SQLite names an unaliased table-valued function after the function.
    # Star expansion must qualify with that name: `json_each.id` is not
    # `spans.id`, and an unqualified `id` is ambiguous once both are in FROM.
    if isinstance(table_ident, exp.Func):
        func_name = table_ident.name or table_ident.sql_name() or ""
        if func_name:
            return exp.to_identifier(func_name)
    return exp.to_identifier(expression.alias_or_name or "")


def _copied_table_identifier(column: exp.Column) -> Optional[exp.Identifier]:
    """The table qualifier on this column, with its quoting intact."""
    table = column.args.get("table")
    if isinstance(table, exp.Identifier):
        return table.copy()
    name = column.table or ""
    return exp.to_identifier(name) if name else None


def _exposed_table_identifier(
    column: exp.Column,
    exposed_by_key: dict[str, exp.Identifier],
    *,
    dialect: SupportedSQLDialectName,
) -> Optional[exp.Identifier]:
    """The FROM alias this column's table is exposed as, quoting included.

    Admission accepts both the alias and the table name. PostgreSQL hides the
    table name once it is aliased, so copying the caller's qualifier into a
    rewrite produces ``traces.id`` after ``FROM traces t``.
    """
    if not column.table:
        return _copied_table_identifier(column)
    ident = exposed_by_key.get(_column_qualifier_key(column, dialect=dialect))
    return ident.copy() if ident is not None else _copied_table_identifier(column)


def _star_sources(
    node: exp.Select, scope: Optional[Any]
) -> list[tuple[str, str, exp.Identifier, exp.Expression]]:
    """Every relation a bare ``*`` in this SELECT draws from.

    Each entry is (physical table name, alias string, qualifier identifier,
    source expression). The identifier keeps the caller's quoting.

    A star means "every column of everything in the FROM clause", so the joins
    count as much as the leading table. Reading only the first source expands to
    one table's columns and silently drops the rest, which returns a plausible
    row that is missing exactly the data the caller joined for.
    """
    sources: list[tuple[str, str, exp.Identifier, exp.Expression]] = []

    def add(expression: Optional[exp.Expression]) -> None:
        if expression is None:
            return
        qualifier = _relation_qualifier(expression)
        alias = expression.alias_or_name if expression else ""
        if isinstance(expression, exp.Table) and expression.name:
            source = scope.sources.get(expression.alias_or_name) if scope is not None else None
            if isinstance(source, exp.Table):
                sources.append((source.name, alias, qualifier, expression))
            else:
                # A CTE parses as a Table too, but resolves to a nested scope.
                sources.append(("", alias, qualifier, expression))
        else:
            sources.append(("", alias, qualifier, expression))

    from_expr = node.args.get("from_") or node.args.get("from")
    if isinstance(from_expr, exp.From):
        add(from_expr.this)
    for join in node.args.get("joins") or []:
        add(join.this)
    return sources


_TVF_STAR_COLUMNS: dict[str, tuple[str, ...]] = {
    "json_each": _JSON_EACH_COLUMNS,
    "jsonb_each": ("key", "value"),
    "jsonb_each_text": ("key", "value"),
}


def _select_output_names(select: exp.Select) -> Optional[list[str]]:
    """Output names of a SELECT whose projection is fully named, or None."""
    names: list[str] = []
    for item in select.expressions:
        if isinstance(item, exp.Star) or (
            isinstance(item, exp.Column) and isinstance(item.this, exp.Star)
        ):
            return None
        name = item.alias_or_name or ""
        if not name or name == "*":
            return None
        names.append(name)
    return names or None


def _expression_output_names(
    expression: Optional[exp.Expression],
    root: exp.Expression,
    *,
    dialect: SupportedSQLDialectName,
    qualifier: exp.Identifier,
) -> Optional[list[str]]:
    """Columns a query-local relation projects, when that list is known."""
    if expression is None:
        return None
    tvf = _tvf_output_names(expression)
    if tvf is not None:
        return tvf
    if isinstance(expression, exp.Subquery):
        return _expression_output_names(expression.this, root, dialect=dialect, qualifier=qualifier)
    if isinstance(expression, (exp.Union, exp.Intersect, exp.Except)):
        return _expression_output_names(expression.this, root, dialect=dialect, qualifier=qualifier)
    if isinstance(expression, exp.Select):
        return _select_output_names(expression)
    if isinstance(expression, exp.Values):
        names = _table_alias_column_names(expression.args.get("alias"))
        if names:
            return names
        width = _values_width(expression)
        if width <= 0:
            return None
        return [f"column{index}" for index in range(1, width + 1)]
    if isinstance(expression, exp.Table):
        return _cte_output_names(root, expression, dialect=dialect, qualifier=qualifier)
    return None


def _tvf_output_names(expression: exp.Expression) -> Optional[list[str]]:
    target = expression.this if isinstance(expression, exp.Table) else expression
    name = ""
    if isinstance(target, exp.Anonymous):
        name = target.name or ""
    elif isinstance(target, exp.Func):
        name = target.sql_name() or target.key or ""
    columns = _TVF_STAR_COLUMNS.get(name.casefold())
    return list(columns) if columns is not None else None


def _tvf_star_projections(expression: exp.Expression) -> Optional[list[tuple[str, str]]]:
    """Physical TVF column and the name the caller asked the star to use."""
    physical = _tvf_output_names(expression)
    if physical is None:
        return None
    aliases = (
        expression.args.get("phoenix_tvf_aliases") if isinstance(expression, exp.Table) else None
    )
    if not aliases:
        return [(column_name, column_name) for column_name in physical]
    return [(physical[index], aliases[index]) for index in range(min(len(aliases), len(physical)))]


def _cte_output_names(
    root: exp.Expression,
    table: exp.Table,
    *,
    dialect: SupportedSQLDialectName,
    qualifier: exp.Identifier,
) -> Optional[list[str]]:
    alias = table.alias_or_name or table.name or ""
    if not alias:
        return None
    quoted = bool(qualifier.args.get("quoted"))
    want = _identifier_key(alias, quoted=quoted, dialect=dialect)
    for cte in root.find_all(exp.CTE):
        cte_ident = cte.args.get("alias")
        cte_quoted = False
        cte_alias = cte.alias or ""
        if isinstance(cte_ident, exp.TableAlias) and isinstance(cte_ident.this, exp.Identifier):
            cte_quoted = bool(cte_ident.this.args.get("quoted"))
            cte_alias = cte_ident.this.name or cte_alias
        if _identifier_key(cte_alias, quoted=cte_quoted, dialect=dialect) != want:
            continue
        names = _table_alias_column_names(
            cte_ident if isinstance(cte_ident, exp.TableAlias) else None
        )
        if names:
            return names
        return _expression_output_names(cte.this, root, dialect=dialect, qualifier=qualifier)
    return None


def _select_from_is_values(select: exp.Select) -> bool:
    """Whether this SELECT's FROM is a VALUES list, possibly wrapped by the parser."""
    from_expr = select.args.get("from_") or select.args.get("from")
    if not isinstance(from_expr, exp.From):
        return False
    source: Optional[exp.Expression] = from_expr.this
    while isinstance(source, (exp.Subquery, exp.Paren, exp.Alias)):
        if isinstance(source, exp.Values):
            return True
        source = source.this
    return isinstance(source, exp.Values)


def _using_keys_needing_coalesce(
    node: exp.Select,
    root: exp.Expression,
    *,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
) -> dict[str, list[exp.Identifier]]:
    """USING keys whose left copy can be NULL, with the relations to merge.

    USING exposes one column per key, defined as the merge of both sides. For
    an inner or left join the left copy is always the merged value, so emitting
    it is faithful. A right or full join produces rows where the left side is
    absent, and there the left copy is NULL while the key itself is not.
    """
    from_expr = node.args.get("from_") or node.args.get("from")
    left_sources: list[exp.Expression] = [from_expr.this] if isinstance(from_expr, exp.From) else []
    needed: dict[str, list[exp.Identifier]] = {}
    for join in node.args.get("joins") or []:
        side = str(join.args.get("side") or "").upper()
        using = join.args.get("using")
        if using and side in ("RIGHT", "FULL") and left_sources:
            items = using if isinstance(using, list) else [using]
            for item in items:
                ident = item if isinstance(item, exp.Identifier) else getattr(item, "this", None)
                if not isinstance(ident, exp.Identifier):
                    continue
                key = _identifier_key(
                    ident.name or ident.this or "",
                    quoted=bool(ident.args.get("quoted")),
                    dialect=dialect,
                )
                # Only the relations that actually offer the key. Merging
                # across every relation to the left names columns they do not
                # have, which the engine refuses. A query-local relation offers
                # it on its own terms, and its copy goes NULL the same way.
                providers = [
                    source
                    for source in left_sources
                    if _source_exposes_column(
                        source,
                        ident.name or ident.this or "",
                        quoted=bool(ident.args.get("quoted")),
                        allowlist=allowlist,
                        dialect=dialect,
                    )
                    or _local_relation_projects(
                        source,
                        root,
                        ident.name or ident.this or "",
                        dialect=dialect,
                    )
                ]
                if not providers:
                    continue
                needed[key] = [
                    *(_relation_qualifier(source) for source in providers),
                    _relation_qualifier(join.this),
                ]
        left_sources.append(join.this)
    return needed


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

    # Innermost first so a derived table's star is named before an outer star
    # tries to read that projection.
    selects = [node for node in root.walk() if isinstance(node, exp.Select)]
    for node in reversed(selects):
        new_exprs: list[exp.Expr] = []
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
                    (name, alias, qualifier, source)
                    for name, alias, qualifier, source in _star_sources(
                        node, scope_by_expression.get(id(node))
                    )
                    if _matches_star_source(explicit, explicit_identifier, qualifier, ctx.dialect)
                ]
                if not targets:
                    raise AnalyticsSqlError(
                        code=ErrorCode.UNSUPPORTED_SYNTAX,
                        message=f"`{explicit}` does not name a relation in this query.",
                        identifiers=(explicit,),
                    )
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
            coalesce_using = (
                _using_keys_needing_coalesce(
                    node, root, allowlist=ctx.allowlist, dialect=ctx.dialect
                )
                if not explicit
                else {}
            )
            using_keys = frozenset(using_keys | ctx.coalesced_using_by_select.get(id(node), set()))
            emitted_using: set[str] = set()

            for table_name, alias, qualifier, source in targets:
                spec = ctx.allowlist.table_specs.get(table_name) if table_name else None
                if spec is None:
                    if _select_from_is_values(node):
                        # SQLGlot rewrites `WITH v(x) AS (VALUES …)` into
                        # `SELECT * FROM (VALUES …) AS _values`. The caller never
                        # wrote that star; leaving it lets the engine name the
                        # columns. Expanding it as a query-local relation refused
                        # a statement both backends execute.
                        new_exprs.append(expression)
                        continue
                    tvf_projections = _tvf_star_projections(source)
                    if tvf_projections:
                        for physical_name, output_name in tvf_projections:
                            key = _identifier_key(output_name, quoted=False, dialect=ctx.dialect)
                            if key in using_keys:
                                if key in emitted_using:
                                    continue
                                emitted_using.add(key)
                            column = exp.Column(this=exp.to_identifier(physical_name))
                            if qualifier.name:
                                column.set("table", qualifier.copy())
                            if output_name != physical_name:
                                new_exprs.append(exp.alias_(column, output_name))
                            else:
                                new_exprs.append(column)
                        local_changed = True
                        continue
                    local_names = _expression_output_names(
                        source, root, dialect=ctx.dialect, qualifier=qualifier
                    )
                    if local_names:
                        for name in local_names:
                            key = _identifier_key(name, quoted=False, dialect=ctx.dialect)
                            if key in using_keys:
                                if key in emitted_using:
                                    continue
                                emitted_using.add(key)
                                merge = coalesce_using.get(key)
                                if merge:
                                    new_exprs.append(
                                        _coalesced_using_column(name, quoted=False, merge=merge)
                                    )
                                    continue
                            column = exp.Column(this=exp.to_identifier(name))
                            if qualifier.name:
                                column.set("table", qualifier.copy())
                            new_exprs.append(column)
                        local_changed = True
                        continue
                    # A source whose columns we still cannot name. Skipping it
                    # would return the other sources' columns and none of these.
                    relation = table_name or alias
                    if relation:
                        message = (
                            f"SELECT * cannot be expanded over {relation!r}, which is a "
                            "query-local relation rather than an allowlisted table. "
                            "Name the columns you want."
                        )
                        identifiers: tuple[str, ...] = (relation,)
                    else:
                        message = (
                            "SELECT * cannot be expanded over a subquery or "
                            "set-returning function. Name the columns you want."
                        )
                        identifiers = ()
                    raise AnalyticsSqlError(
                        code=ErrorCode.UNSUPPORTED_SYNTAX,
                        message=message,
                        identifiers=identifiers,
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
                        merge = coalesce_using.get(key)
                        if merge:
                            new_exprs.append(
                                _coalesced_using_column(name, quoted=quoted, merge=merge)
                            )
                            continue
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


def _latency_ms_is_coalesced_using(column: exp.Column, ctx: RewriteContext) -> bool:
    """True when USING already collapsed this overlay to one output column."""
    select = column.find_ancestor(exp.Select)
    if select is None:
        return False
    coalesced = ctx.coalesced_using_by_select.get(id(select), set())
    return _identifier_key("latency_ms", quoted=False, dialect=ctx.dialect) in coalesced


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
    # Per-column: duration-table count in this scope, and dialect keys a
    # qualifier may use. Only Table sources count; a CTE of the same name is a
    # nested scope.
    duration_scope: dict[int, tuple[int, frozenset[str], dict[str, exp.Identifier]]] = {}
    if scope_root is not None:
        for scope in scope_root.traverse():
            aliases: set[str] = set()
            exposed_by_key: dict[str, exp.Identifier] = {}
            duration_sources = 0
            for source in scope.sources.values():
                table = source.this if isinstance(source, exp.Lateral) else source
                if not isinstance(table, exp.Table):
                    continue
                table_name = _allowlisted_table_name(
                    table, allowlist=ctx.allowlist, dialect=ctx.dialect
                )
                if (
                    table_name is None
                    or "latency_ms" not in ctx.allowlist.table_specs[table_name].virtual_columns
                ):
                    continue
                duration_sources += 1
                exposed = _relation_qualifier(table)
                for key in _relation_identifier_keys(table, dialect=ctx.dialect):
                    aliases.add(key)
                    exposed_by_key[key] = exposed
            names = frozenset(aliases)
            # Every relation this scope introduces, not just the duration tables
            # above: a qualifier the scope binds to something else still belongs
            # to the scope, and must not fall through to an enclosing one.
            scope_relations = _scope_relation_keys(scope, dialect=ctx.dialect)
            # `Scope.columns` reaches in both directions -- an outer query lists
            # a nested subquery's unqualified column, and an inner query lists
            # the correlated columns that reference outward -- and `traverse()`
            # yields the inner scope first. A scope claims a qualified column
            # only when it introduces that qualifier, so a correlated reference
            # is left for the scope that does; keeping the first attribution
            # then binds an unqualified column to the relation enclosing it,
            # rather than to the outer query's table.
            for column in (*scope.columns, *_scope_columns(scope.expression)):
                if (
                    column.table
                    and _column_qualifier_key(column, dialect=ctx.dialect) not in scope_relations
                ):
                    continue
                duration_scope.setdefault(id(column), (duration_sources, names, exposed_by_key))
            if duration_sources < 2:
                continue
            for column in _scope_columns(scope.expression):
                if (
                    (column.name or "").casefold() == "latency_ms"
                    and not column.table
                    and not query_local.is_local(column)
                    and not _latency_ms_is_coalesced_using(column, ctx)
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
            duration_sources, scope_aliases, exposed_by_key = duration_scope.get(
                id(node), (0, frozenset(), {})
            )
            if node.table:
                if _column_qualifier_key(node, dialect=ctx.dialect) not in scope_aliases:
                    continue
            elif duration_sources == 0:
                raise AnalyticsSqlError(
                    code=ErrorCode.UNSUPPORTED_SYNTAX,
                    message=(
                        "`latency_ms` is a query-only overlay on stored duration "
                        "tables, and this statement does not read one that "
                        "exposes it. Project `latency_ms` from `spans` or "
                        "`traces` (or a CTE that selects it)."
                    ),
                )
            elif duration_sources != 1 and not _latency_ms_is_coalesced_using(node, ctx):
                continue
            table_ident = _exposed_table_identifier(node, exposed_by_key, dialect=ctx.dialect)
            if (
                table_ident is None
                and exposed_by_key
                and (duration_sources == 1 or _latency_ms_is_coalesced_using(node, ctx))
            ):
                # Unqualified `latency_ms` still has to name its table: a join
                # partner may share `start_time`/`end_time` without advertising
                # the overlay, and unqualified substitution is then ambiguous.
                # USING coalesces the overlay to one column, so either side is
                # the same value.
                table_ident = next(iter(exposed_by_key.values())).copy()
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


def _sqlite_stored_timestamp_operand(
    node: exp.Expression, timestamp_columns: frozenset[str]
) -> Optional[exp.Column]:
    """The stored timestamp column an operand of `-` reads, or None.

    Elapsed time is written over the columns themselves or over aggregates of
    them, and `MAX(end_time)` is still a stored timestamp: these are zero-padded
    ISO-8601 text, so their text ordering is their timestamp ordering and the
    aggregate result converts like the column. Parentheses are transparent.
    """
    inner = _strip_parens(node)
    if isinstance(inner, (exp.Min, exp.Max)):
        inner = _strip_parens(inner.this)
    elif isinstance(inner, exp.Coalesce):
        # Every branch must be a stored timestamp, or the result is not one.
        branches = [inner.this, *(inner.expressions or [])]
        resolved = [
            _sqlite_stored_timestamp_operand(branch, timestamp_columns) for branch in branches
        ]
        if not resolved or any(column is None for column in resolved):
            return None
        return resolved[0]
    if not isinstance(inner, exp.Column):
        return None
    return inner if (inner.name or "").casefold() in timestamp_columns else None


def _unixepoch_subsec(node: exp.Expression) -> exp.Expression:
    """Seconds since the epoch, keeping fractional seconds."""
    return exp.Anonymous(this="unixepoch", expressions=[node.copy(), exp.Literal.string("subsec")])


def _rewrite_sqlite_timestamp_subtraction(
    root: exp.Expression, ctx: RewriteContext
) -> exp.Expression:
    """Give subtraction of stored SQLite timestamps its elapsed-seconds meaning."""
    if ctx.dialect != "sqlite":
        return root
    timestamp_columns = timestamp_column_names(ctx.allowlist.tables)
    query_local = query_local_columns(root, allowlist=ctx.allowlist, dialect=ctx.dialect)
    passthrough = _timestamp_passthrough_references(root, timestamp_columns)
    changed = False
    for node in list(root.find_all(exp.Sub)):
        left_operand = _strip_parens(node.this)
        right_operand = _strip_parens(node.expression)
        left = _sqlite_stored_timestamp_operand(node.this, timestamp_columns)
        right = _sqlite_stored_timestamp_operand(node.expression, timestamp_columns)
        if not (
            left is not None
            and right is not None
            and left_operand is not None
            and right_operand is not None
            and (left.name or "").casefold() in timestamp_columns
            and (right.name or "").casefold() in timestamp_columns
        ):
            continue
        # A derived relation that merely projects stored timestamps still holds
        # them. Skipping every query-local name leaves that subtraction as text
        # arithmetic, which is 0 on SQLite.
        if query_local.is_local(left) and id(left) not in passthrough:
            continue
        if query_local.is_local(right) and id(right) not in passthrough:
            continue
        node.replace(
            exp.paren(
                exp.Sub(
                    this=_unixepoch_subsec(left_operand),
                    expression=_unixepoch_subsec(right_operand),
                )
            )
        )
        changed = True
    if changed:
        ctx.applied.append("sqlite_timestamp_subtraction")
    return root


_SQLITE_TIMESTAMP_UNIT_FUNCTIONS = frozenset({"unixepoch", "julianday", "datetime", "time", "date"})
_SQLITE_JSON_CASTS = frozenset({"JSON", "JSONB"})
_SQLITE_DATETIME_CASTS = frozenset({"DATETIME", "TIMESTAMP", "TIMESTAMPTZ"})
_SQLITE_TIME_CASTS = frozenset({"TIME"})
_SQLITE_TEXT_CASTS = frozenset({"UUID"})
_SQLITE_NUMERIC_CASTS = frozenset({"NUMERIC", "DECIMAL"})


def _timestamp_unit_function_call(
    node: Optional[exp.Expression],
) -> Optional[tuple[str, exp.Expression]]:
    """``unixepoch`` / ``julianday`` / ``datetime`` / ``time`` / ``date``, or None."""
    unwrapped = _strip_parens(node)
    if isinstance(unwrapped, exp.Anonymous):
        name = (unwrapped.name or "").casefold()
        if name in _SQLITE_TIMESTAMP_UNIT_FUNCTIONS:
            return name, unwrapped
    if isinstance(unwrapped, exp.Date):
        return "date", unwrapped
    return None


#: Unit functions that truncate to whole seconds unless given `subsec`.
#: `julianday` is already fractional and `date` is day-resolution by definition.
_SQLITE_SUBSEC_UNITS = frozenset({"unixepoch", "datetime", "time"})


def _timestamp_unit_through_arithmetic(node: Optional[exp.Expression]) -> Optional[str]:
    """The unit a side is expressed in, seen through unit-preserving arithmetic.

    `unixepoch('now') - 3600` is an epoch value exactly as `unixepoch('now')`
    is; shifting it by a constant does not change its unit. Without this, a
    bounded window -- the most common form of "recent" -- is left comparing
    text to an integer.

    Addition and subtraction only. A product or a quotient is a number in some
    other unit, so it is not one the column can be converted to match.
    """
    unwrapped = _strip_parens(node)
    if isinstance(unwrapped, (exp.Add, exp.Sub)):
        for operand in (unwrapped.this, unwrapped.expression):
            found = _timestamp_unit_through_arithmetic(operand)
            if found is not None:
                return found
        return None
    unit = _timestamp_unit_function_call(unwrapped)
    return unit[0] if unit is not None else None


def _rescaled_timestamp_unit(node: Optional[exp.Expression]) -> Optional[str]:
    """The unit function a multiplication or division rescales on this side.

    Which unit the result is in follows from the factor, and a factor is an
    arbitrary expression rather than something to infer. Reading the side as
    seconds anyway converts the column to seconds and compares two scales,
    which returns the wrong rows rather than failing.
    """
    unwrapped = _strip_parens(node)
    if isinstance(unwrapped, (exp.Mul, exp.Div)):
        for operand in (unwrapped.this, unwrapped.expression):
            found = _timestamp_unit_through_arithmetic(operand) or _rescaled_timestamp_unit(operand)
            if found is not None:
                return found
        return None
    if isinstance(unwrapped, (exp.Add, exp.Sub)):
        for operand in (unwrapped.this, unwrapped.expression):
            found = _rescaled_timestamp_unit(operand)
            if found is not None:
                return found
    return None


def _comparison_operands(node: exp.Condition) -> tuple[Optional[exp.Expression], ...]:
    """Both sides of a comparison, or all three parts of a BETWEEN."""
    if isinstance(node, exp.Between):
        return (node.this, node.args.get("low"), node.args.get("high"))
    return (node.this, node.expression)


#: BETWEEN is a comparison here even though it is not one of the binary
#: comparison classes: `col BETWEEN a AND b` compares `col` against both bounds.
_EPOCH_COMPARISON_NODES = (*_TIMESTAMP_COMPARISONS, exp.Between)


def _rewrite_sqlite_timestamp_vs_epoch_function(
    root: exp.Expression, ctx: RewriteContext
) -> exp.Expression:
    """Compare stored timestamps to unixepoch/julianday/datetime in the same unit.

    SQLite timestamps are text. ``start_time < unixepoch('now')`` compares a
    datetime string to an integer and matches nothing. ``start_time <
    datetime('now')`` compares full ``YYYY-MM-DD HH:MM:SS.ffffff`` storage to
    ``datetime()``'s second-resolution string, so rows in the same second can
    sort the wrong way. Wrapping the column in the same function is the
    comparison the caller wrote.
    """
    if ctx.dialect != "sqlite":
        return root
    timestamp_columns = timestamp_column_names(ctx.allowlist.tables)
    if not timestamp_columns:
        return root
    query_local = query_local_columns(root, allowlist=ctx.allowlist, dialect=ctx.dialect)
    passthrough = _timestamp_passthrough_references(root, timestamp_columns)
    changed = False
    for node in list(root.find_all(*_EPOCH_COMPARISON_NODES)):
        sides = _comparison_operands(node)
        column: Optional[exp.Column] = None
        unit_name: Optional[str] = None
        rescaled: Optional[str] = None
        for side in sides:
            unwrapped = _strip_parens(side)
            if (
                isinstance(unwrapped, exp.Column)
                and (
                    (unwrapped.name or "").casefold() in timestamp_columns
                    or id(unwrapped) in passthrough
                )
                and not (query_local.is_local(unwrapped) and id(unwrapped) not in passthrough)
            ):
                column = unwrapped
            unit = _timestamp_unit_through_arithmetic(side)
            if unit is not None:
                unit_name = unit
            rescaled = rescaled or _rescaled_timestamp_unit(side)
        if column is not None and rescaled is not None:
            raise AnalyticsSqlError(
                code=ErrorCode.UNSUPPORTED_SYNTAX,
                message=(
                    f"`{rescaled}(...)` multiplied or divided is no longer in the unit "
                    f"`{column.name}` converts to, so the comparison would be between "
                    f"two scales. Compare against `{rescaled}(...)` unscaled, or scale "
                    f"both sides -- `{rescaled}({column.name})` is available."
                ),
            )
        if column is None or unit_name is None:
            continue
        if unit_name == "date":
            wrapped: exp.Expression = exp.Date(this=column.copy())
        else:
            # Storage carries fractional seconds. `unixepoch`, `datetime` and
            # `time` truncate to whole seconds unless asked otherwise, which
            # drops rows whose comparison is decided below the second.
            args: list[exp.Expression] = [column.copy()]
            if unit_name in _SQLITE_SUBSEC_UNITS:
                args.append(exp.Literal.string("subsec"))
            wrapped = exp.Anonymous(this=unit_name, expressions=args)
        column.replace(wrapped)
        changed = True
    if changed:
        ctx.applied.append("sqlite_timestamp_epoch_compare")
    return root


def _rewrite_sqlite_casts(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Stop SQLite CASTs that the affinity rules silently turn into numbers.

    ``CAST(x AS JSON)`` has NUMERIC affinity, so a JSON object becomes ``0``.
    ``CAST(x AS DATETIME)`` parses a leading year as an integer. ``json()`` and
    ``datetime()`` are the constructors that keep the value. ``CAST(x AS TIME)``
    as TEXT would return the full datetime string; ``time()`` is the time-of-day
    constructor. ``NUMERIC`` is remapped to ``REAL`` by the generator; emit the
    affinity the caller named.
    """
    if ctx.dialect != "sqlite":
        return root
    changed = False
    for node in list(root.find_all(exp.Cast)):
        target = _cast_type_name(node.to)
        if target in _SQLITE_JSON_CASTS:
            node.replace(exp.Anonymous(this="json", expressions=[node.this.copy()]))
            changed = True
            continue
        if target in _SQLITE_DATETIME_CASTS:
            node.replace(exp.Anonymous(this="datetime", expressions=[node.this.copy()]))
            changed = True
            continue
        if target in _SQLITE_TIME_CASTS:
            node.replace(exp.Anonymous(this="time", expressions=[node.this.copy()]))
            changed = True
            continue
        if target in _SQLITE_TEXT_CASTS:
            node.set("to", exp.DataType.build("TEXT"))
            changed = True
            continue
        if target in _SQLITE_NUMERIC_CASTS:
            node.set(
                "to",
                exp.DataType(
                    this=exp.DataType.Type.USERDEFINED,
                    kind=exp.Identifier(this="NUMERIC"),
                ),
            )
            changed = True
    if changed:
        ctx.applied.append("sqlite_casts")
    return root


def _rewrite_sqlite_median(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Keep ``median(x)`` as the sqlean function, not ``percentile_cont``.

    SQLGlot models ``median`` as the ordered-set aggregate and the SQLite
    generator emits ``PERCENTILE_CONT``, which this engine does not have.
    sqlean stats registers ``median``; rewriting to a generic call is the
    spelling that actually runs.

    Workaround for https://github.com/tobymao/sqlglot/issues/8079, which
    upstream closed as not planned.
    """
    if ctx.dialect != "sqlite":
        return root
    changed = False
    for node in list(root.find_all(exp.Median)):
        argument = node.this
        if argument is None:
            continue
        node.replace(exp.Anonymous(this="median", expressions=[argument.copy()]))
        changed = True
    if changed:
        ctx.applied.append("sqlite_median")
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
    # LATERAL traces t is a Table nested inside Lateral, so it is not a
    # Scope source of class Table. Qualify it the same way.
    for lateral in root.find_all(exp.Lateral):
        inner = lateral.this
        if not isinstance(inner, exp.Table):
            continue
        if (
            _allowlisted_table_name(inner, allowlist=ctx.allowlist, dialect=ctx.dialect) is not None
            and not inner.db
        ):
            inner.set("db", exp.to_identifier(ctx.allowlist.pg_schema))
            changed = True
    if changed:
        ctx.applied.append("schema_qualification")
    return root


def _select_star_from_subquery(subquery: exp.Expression) -> exp.Select:
    """``SELECT * FROM (subquery)`` -- a compound member SQLite will accept."""
    return exp.Select(expressions=[exp.Star()]).from_(subquery, copy=False)


def _rewrite_sqlite_setop_operands(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Lift parenthesised or limited compound members into FROM subqueries.

    SQLite rejects parentheses around UNION/EXCEPT/INTERSECT members, and also
    rejects ORDER BY / LIMIT on a member. ``SELECT * FROM (SELECT ... LIMIT 1)``
    is valid and keeps the limit on that side.
    """
    changed = False
    for node in root.find_all(exp.Union, exp.Intersect, exp.Except):
        for side in ("this", "expression"):
            operand = node.args.get(side)
            if isinstance(operand, exp.Subquery):
                node.set(side, _select_star_from_subquery(operand.copy()))
                changed = True
                continue
            if not isinstance(operand, exp.Select):
                continue
            if not (
                operand.args.get("order")
                or operand.args.get("limit")
                or operand.args.get("offset")
                or operand.args.get("fetch")
            ):
                continue
            node.set(
                side,
                _select_star_from_subquery(exp.Subquery(this=operand.copy())),
            )
            changed = True
    if changed:
        ctx.applied.append("setop_operand_subquery")
    return root


def _parenthesize_setop_operands(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Make set-op operands that carry ORDER BY / LIMIT executable on this backend.

    ``SELECT ... LIMIT 1 UNION SELECT ...`` is a syntax error in PostgreSQL
    unless the limited select is parenthesised. The parser accepts the
    unparenthesised spelling, so the operand arrives bare and the parenthesised
    form is what the engine runs. SQLite rejects the parentheses and the
    LIMIT-on-a-member spelling; those members are lifted into FROM subqueries
    instead.
    """
    if ctx.dialect == "sqlite":
        return _rewrite_sqlite_setop_operands(root, ctx)
    changed = False
    for node in root.find_all(exp.Union, exp.Intersect, exp.Except):
        for side in ("this", "expression"):
            operand = node.args.get(side)
            if not isinstance(operand, exp.Select):
                continue
            if not (
                operand.args.get("order")
                or operand.args.get("limit")
                or operand.args.get("offset")
                or operand.args.get("fetch")
            ):
                continue
            node.set(side, exp.Subquery(this=operand.copy()))
            changed = True
    if changed:
        ctx.applied.append("setop_operand_parens")
    return root


def _limit_count_expression(limit: exp.Expression) -> Optional[exp.Expression]:
    """The numeric bound a LIMIT or FETCH clause states.

    FETCH FIRST ROW ONLY has no count node; SQL's default is one row.
    ``exp.Fetch`` is not a subclass of ``exp.Limit``.
    """
    if isinstance(limit, exp.Limit):
        count = limit.expression
        return count if isinstance(count, exp.Expression) else None
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


def _string_literals_in_container(container: exp.Expression) -> Optional[list[exp.Literal]]:
    """String literals a membership list holds, or None if a member is computed.

    IN, ARRAY, and VALUES are the same list. A subquery, a non-string, or a
    multi-column VALUES row is not a stated node id.
    """
    if isinstance(container, exp.In):
        if container.args.get("query") is not None:
            return None
        found: list[exp.Literal] = []
        for member in container.expressions:
            member = _strip_parens(member)
            if isinstance(member, exp.Literal) and member.is_string:
                found.append(member)
            elif isinstance(member, exp.Values):
                nested = _string_literals_in_container(member)
                if nested is None:
                    return None
                found.extend(nested)
            else:
                return None
        return found
    if isinstance(container, exp.Array):
        found = []
        for member in container.expressions:
            member = _strip_parens(member)
            if isinstance(member, exp.Literal) and member.is_string:
                found.append(member)
            else:
                return None
        return found
    if isinstance(container, exp.Values):
        found = []
        for row in container.expressions:
            row = _strip_parens(row)
            cells = list(row.expressions) if isinstance(row, exp.Tuple) else [row]
            if len(cells) != 1:
                return None
            cell = _strip_parens(cells[0])
            if not (isinstance(cell, exp.Literal) and cell.is_string):
                return None
            found.append(cell)
        return found
    return None


def _decoded_membership_ids(
    literals: list[exp.Literal], type_name: str, *, require_all: bool
) -> Optional[list[int]]:
    """Primary keys these literals name, or None if the comparison must stay encoded.

    A value that is not an id for this type matches nothing. Dropping it from
    ``IN`` / ``= ANY`` / ``NOT IN`` / ``<> ALL`` does not change who matches.
    ``= ALL`` and ``<> ANY`` AND/OR against every member, so an undecodable
    value cannot be dropped without changing the question.
    """
    ids: list[int] = []
    for literal in literals:
        row_id = _decode_node_id(literal.name, type_name)
        if row_id is None:
            if require_all:
                return None
            continue
        ids.append(row_id)
    return ids or None


def _replace_membership_members(container: exp.Expression, ids: list[int]) -> None:
    numbers = [exp.Literal.number(row_id) for row_id in ids]
    if isinstance(container, (exp.In, exp.Array)):
        container.set("expressions", numbers)
    elif isinstance(container, exp.Values):
        container.set("expressions", [exp.Tuple(expressions=[number]) for number in numbers])


def _quantifier_requires_every_member(comparison: exp.Expr, quantifier: exp.Expression) -> bool:
    """Whether dropping an undecodable member would change this comparison.

    ``x = ALL(a, b)`` is true only if x equals both; dropping a never-matching
    b would make it ``x = a``. ``x <> ANY(a, b)`` is true if x differs from
    either; dropping a never-matching b would make it ``x <> a``.
    """
    if isinstance(comparison, (exp.EQ, exp.NullSafeEQ)):
        return _is_all_quantifier(quantifier)
    return not _is_all_quantifier(quantifier)


def _substitute_graphql_node_id(root: exp.Expression, ctx: RewriteContext) -> exp.Expression:
    """Translate between Relay global ids and the integer primary key.

    Users never see the integer id. The UI and the GraphQL API both speak base64
    "TypeName:id", so an agent arriving with one of those has nothing to join on,
    and an agent producing an integer has nothing to hand back.

    The substitution differs by position, for the same reason latency_ms does.

    In a predicate the literal is decoded here and the comparison becomes
    ``id = 7`` -- or ``id IN (7, 8)`` for a membership list -- which reaches
    the primary key. Encoding in SQL instead would make the engine compute a
    value for every row before comparing, turning a key lookup into a full
    scan -- and the only way to index around that would be an expression
    index, which means a migration.

    Equality, inequality, ``IN`` / ``NOT IN``, ``= ANY`` / ``= ALL``, and
    ``IS [NOT] DISTINCT FROM`` are the same question. A pattern or a range
    is not a node id, so ``LIKE`` and ``BETWEEN`` stay in the projection form.

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
    # column id -> (alias/table -> type, fallback type, physical graphql sources,
    # qualifier -> exposed FROM identifier)
    resolution: dict[int, tuple[dict[str, str], Optional[str], int, dict[str, exp.Identifier]]] = {}
    if scope_root is not None:
        for scope in scope_root.traverse():
            by_alias, exposed_by_key, n_sources = _physical_graphql_types(
                scope, allowlist=ctx.allowlist, dialect=ctx.dialect
            )
            fallback = next(iter(set(by_alias.values()))) if n_sources == 1 else None
            # Attribution follows the duration overlay: a scope claims a
            # qualified column only when it introduces that qualifier, so a
            # correlated reference is left for the scope that does, and the
            # innermost scope wins for an unqualified one.
            scope_relations = _scope_relation_keys(scope, dialect=ctx.dialect)
            for column in (*scope.columns, *_scope_columns(scope.expression)):
                if (
                    column.table
                    and _column_qualifier_key(column, dialect=ctx.dialect) not in scope_relations
                ):
                    continue
                resolution.setdefault(id(column), (by_alias, fallback, n_sources, exposed_by_key))
    if not any(n_sources for _, _, n_sources, _ in resolution.values()):
        return root

    changed = False

    def is_node_id(node: exp.Expression) -> bool:
        return (
            isinstance(node, exp.Column)
            and (node.name or "").lower() == GRAPHQL_NODE_ID_COLUMN
            and not query_local.is_local(node)
        )

    def type_for(node: exp.Column) -> Optional[str]:
        by_alias, fallback, _, _ = resolution.get(id(node), ({}, None, 0, {}))
        qualifier = node.table or ""
        if not qualifier:
            return fallback
        return by_alias.get(_column_qualifier_key(node, dialect=ctx.dialect))

    def graphql_source_count(node: exp.Column) -> int:
        return resolution.get(id(node), ({}, None, 0, {}))[2]

    # Predicate position first: rewriting the whole comparison removes the column
    # before the projection pass can see it.
    def physical_id(column: exp.Column) -> exp.Column:
        _, _, n_sources, exposed_by_key = resolution.get(id(column), ({}, None, 0, {}))
        table_ident = _exposed_table_identifier(column, exposed_by_key, dialect=ctx.dialect)
        if table_ident is None and n_sources == 1 and exposed_by_key:
            # Unqualified `graphql_node_id` still has to name its table: a join
            # partner may share `id` without advertising the overlay, and
            # `CAST(id AS TEXT)` is then ambiguous.
            table_ident = next(iter(exposed_by_key.values())).copy()
        return exp.column("id", table=table_ident)

    for cmp_node in list(root.find_all(exp.EQ, exp.NEQ, exp.NullSafeEQ, exp.NullSafeNEQ)):
        left, right = cmp_node.this, cmp_node.expression
        for column, other in ((left, right), (right, left)):
            if not isinstance(column, exp.Column) or not is_node_id(column):
                continue
            type_name = type_for(column)
            if type_name is None:
                continue
            if isinstance(other, exp.Literal) and other.is_string:
                row_id = _decode_node_id(other.name, type_name)
                if row_id is None:
                    continue
                cmp_node.set("this", physical_id(column))
                cmp_node.set("expression", exp.Literal.number(row_id))
                changed = True
                break
            if isinstance(other, exp.Column) and is_node_id(other):
                other_type = type_for(other)
                if other_type == type_name:
                    cmp_node.set("this", physical_id(column))
                    cmp_node.set("expression", physical_id(other))
                    changed = True
                    break
            if _is_quantifier(other):
                container = _quantifier_list_container(other)
                literals = (
                    _string_literals_in_container(container) if container is not None else None
                )
                if container is None or literals is None:
                    continue
                ids = _decoded_membership_ids(
                    literals,
                    type_name,
                    require_all=_quantifier_requires_every_member(cmp_node, other),
                )
                if ids is None:
                    continue
                _replace_membership_members(container, ids)
                cmp_node.set("this", physical_id(column))
                cmp_node.set("expression", other)
                changed = True
                break

    for in_node in list(root.find_all(exp.In)):
        column = in_node.this
        if not isinstance(column, exp.Column) or not is_node_id(column):
            continue
        type_name = type_for(column)
        if type_name is None:
            continue
        literals = _string_literals_in_container(in_node)
        if literals is None:
            continue
        ids = _decoded_membership_ids(literals, type_name, require_all=False)
        if ids is None:
            continue
        in_node.set("this", physical_id(column))
        _replace_membership_members(in_node, ids)
        changed = True

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
        written = physical_id(column)
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
) -> tuple[dict[str, str], dict[str, exp.Identifier], int]:
    """Alias and table name -> GraphQL type for physical tables in this scope.

    Keyed by both under dialect identifier rules, because ``FROM traces t``
    lets the caller write either ``t.graphql_node_id`` or
    ``traces.graphql_node_id``. The rewrite then uses the exposed FROM
    qualifier, because PostgreSQL hides the table name once it is aliased.

    A name that resolves to two different types is dropped rather than guessed
    at -- a self-join has one type per side and picking either would attribute
    a row id to the wrong one.

    Only ``scope.sources`` that resolve to a Table. A CTE of the same name is a
    nested scope.
    """
    found: dict[str, Optional[str]] = {}
    exposed_by_key: dict[str, exp.Identifier] = {}
    n_sources = 0

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
        exposed = _relation_qualifier(source)
        for key in _relation_identifier_keys(source, dialect=dialect):
            if key in found and found[key] != type_name:
                found[key] = None
            else:
                found.setdefault(key, type_name)
            exposed_by_key[key] = exposed
    return (
        {key: value for key, value in found.items() if value is not None},
        exposed_by_key,
        n_sources,
    )
