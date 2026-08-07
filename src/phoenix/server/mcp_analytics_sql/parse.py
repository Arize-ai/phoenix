from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from sqlglot import exp, parse
from sqlglot.errors import ErrorLevel, ParseError, SqlglotError, UnsupportedError
from sqlglot.optimizer.scope import build_scope

from phoenix.server.mcp_analytics_sql.allowlist import (
    ALLOWED_CAST_TYPES,
    EXCLUDED_FUNC_CLASSES,
    Allowlist,
    DialectName,
    allowed_func_classes,
    sqlglot_read_dialect,
)
from phoenix.server.mcp_analytics_sql.errors import (
    AnalyticsSqlError,
    ErrorCode,
    admission_error_from_outcome,
)
from phoenix.server.mcp_analytics_sql.normalize import (
    parse_timestamp_literal,
    timestamp_column_names,
)


class AdmissionOutcome(str, Enum):
    ADMIT = "admit"
    PARSE_ERROR = "parse_error"
    UNSUPPORTED_SYNTAX = "unsupported_syntax"
    NOT_READ_ONLY = "not_read_only"
    RELATION_NOT_ALLOWED = "relation_not_allowed"
    COLUMN_NOT_ALLOWED = "column_not_allowed"
    FUNCTION_NOT_ALLOWED = "function_not_allowed"
    MULTI_STATEMENT = "multi_statement"


@dataclass(frozen=True)
class AdmissionResult:
    outcome: AdmissionOutcome
    detail: str = ""
    rendered_sql: Optional[str] = None


ALLOWED_ROOTS = (exp.Select, exp.Union, exp.Intersect, exp.Except)


def parse_sql(sql: str, *, dialect: DialectName) -> exp.Expression:
    try:
        statements = parse(sql, read=sqlglot_read_dialect(dialect))
    except ParseError as exc:
        raise admission_error_from_outcome("parse_error", str(exc)) from exc
    if len(statements) != 1:
        raise AnalyticsSqlError(
            code=ErrorCode.MULTI_STATEMENT,
            message=f"Only one SQL statement is supported ({len(statements)} found).",
        )
    root = statements[0]
    if root is None or not isinstance(root, ALLOWED_ROOTS):
        raise AnalyticsSqlError(
            code=ErrorCode.UNSUPPORTED_SYNTAX,
            message=f"Only SELECT/set operations are supported (root={type(root).__name__}).",
        )
    return root


# Node classes that are callable-shaped but are not exp.Func, so the function
# policy's walk never sees them. Lambda is the one that matters: several dialects
# spell an anonymous function `x -> body`, so inside an argument list the parser
# reads the JSON accessor `attributes -> 'k'` as a lambda instead. No JSONExtract
# node is produced, the canonicalisation pass finds nothing to fix, and a raw `->`
# reaches SQLite -- where it returns JSON *text*, so MIN and MAX compare
# lexicographically and answer with the wrong row while SUM and AVG, which
# coerce, stay right. Nothing errors. Refusing here is what turns that silent
# inversion into a message naming a spelling that works.
# Keyed on Expr rather than Expression because walk() yields Expr, and
# type[Expr] is not a subtype of type[Expression] under mypy's typing of type[].
_REFUSED_NODE_CLASSES: dict[type[exp.Expr], str] = {
    # OPERATOR(schema.op) invokes an operator by name, and exp.Operator is not an
    # exp.Func either -- so `name ~ 'x'` is refused as regexp_like while
    # `name OPERATOR(pg_catalog.~) 'x'` was admitted and rendered verbatim. Same
    # capability, two spellings, opposite verdicts, which means the function
    # allowlist did not mean what it claimed.
    exp.Operator: (
        "OPERATOR(...) names an operator directly and bypasses the function "
        "allowlist. Use the operator's ordinary spelling."
    ),
    # TABLESAMPLE was silently discarded on the four time-bounded tables,
    # because the wrapper rebuilds the source from the manifest and drops every
    # arg the original table node carried. A caller sampling one percent
    # received the first page in scan order instead, with nothing reported --
    # the statistical claim the query makes was quietly falsified.
    exp.TableSample: (
        "TABLESAMPLE is not supported. Use a filter or a row_limit to bound the rows examined."
    ),
    # A bind placeholder in caller-supplied text. `:x` survives rendering into
    # text() as a real bind parameter with no value bound, so the statement
    # reaches the driver expecting something nobody will supply. There is no
    # parameter channel on this surface -- every value a caller wants is written
    # as a literal -- so a placeholder can only ever be a mistake or an attempt
    # to reach one.
    exp.Placeholder: (
        "Bind placeholders are not supported. Write values as literals; this "
        "surface takes no parameters."
    ),
    exp.Parameter: (
        "Bind placeholders are not supported. Write values as literals; this "
        "surface takes no parameters."
    ),
    exp.Lambda: (
        "`->` is read as a lambda arrow inside a function call, not as a JSON "
        "accessor, so it cannot be used there. Use `->>` or json_extract(...) "
        "to read a JSON value."
    ),
}


#: Star modifiers, and what each one would have meant. The star expansion pass
#: rebuilds the projection from the manifest and carries none of them, so the
#: statement runs over every column and the exclusion the caller asked for is
#: gone. Strict rendering does not catch it: the loss happens in a pass of ours,
#: before the generator sees anything.
_STAR_MODIFIERS = {
    "except_": "EXCEPT",
    "replace": "REPLACE",
    "rename": "RENAME",
    "ilike": "ILIKE",
}


def _check_double_quoted_timestamp_operands(
    root: exp.Expression, *, allowlist: Allowlist
) -> Optional[AdmissionResult]:
    """Refuse a double-quoted operand compared against a timestamp column.

    SQLite reads a double-quoted token as an identifier, and falls back to
    treating it as a string only when nothing resolves. So
    ``start_time > "2026-01-01T00:00:00Z"`` parses as a column reference, which
    means it is not a literal, which means the naive-literal refusal and the
    storage-format rewrite both look straight past it -- and the comparison then
    runs against a string in the wrong format, matching nothing.

    Narrow on purpose. The general rule, refusing any double-quoted identifier
    that resolves to no known column, is a larger change with its own blast
    radius; this closes the case where the misreading is silent and the column
    it sits beside is the one the surface is built around.
    """
    columns = timestamp_column_names(allowlist.tables)
    if not columns:
        return None
    local = query_local_columns(root)

    def offender(
        column: Optional[exp.Expression], operand: Optional[exp.Expression]
    ) -> Optional[str]:
        if not isinstance(column, exp.Column) or (column.name or "").casefold() not in columns:
            return None
        if id(column) in local:
            return None
        if not isinstance(operand, exp.Column) or operand.table:
            return None
        identifier = operand.this
        if isinstance(identifier, exp.Identifier) and identifier.quoted:
            return str(identifier.this)
        return None

    for node in root.walk():
        candidates: list[tuple[Optional[exp.Expression], Optional[exp.Expression]]] = []
        if isinstance(node, _TIMESTAMP_COMPARISONS):
            candidates = [(node.this, node.expression), (node.expression, node.this)]
        elif isinstance(node, exp.Between):
            candidates = [(node.this, node.args.get("low")), (node.this, node.args.get("high"))]
        elif isinstance(node, exp.In):
            candidates = [(node.this, member) for member in node.expressions]
        for column, operand in candidates:
            text = offender(column, operand)
            if text is not None:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f'`"{text}"` is read as a column name here, not as a timestamp, '
                    "because double quotes name identifiers. Use single quotes for the "
                    f"value: '{text}'.",
                )
    return None


def _check_lossy_shapes(root: exp.Expression) -> Optional[AdmissionResult]:
    """Refuse shapes that survive admission and lose meaning before execution.

    Each of these renders without complaint into something that means less than
    it said, so nothing downstream can notice. Refusing is the only honest
    answer available while the loss is real; two of the three become
    unnecessary once the causes are fixed, and are marked accordingly.
    """
    for star in root.find_all(exp.Star):
        for arg, spelling in _STAR_MODIFIERS.items():
            if star.args.get(arg):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"`* {spelling} (...)` is not supported: the star is expanded from the "
                    "schema and the modifier would be dropped, returning every column "
                    "instead. Name the columns you want.",
                )
    for options in root.find_all(exp.LimitOptions):
        # Carried on the options node under `FETCH`, not on `Limit`. Rendered as
        # a plain LIMIT on SQLite, which drops the ties and returns an arbitrary
        # subset of the tied rows -- a different answer, silently.
        if options.args.get("with_ties"):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "`WITH TIES` is not supported: it is dropped when the statement is "
                "prepared, which silently returns an arbitrary subset of the tied "
                "rows. Rank explicitly with a window function instead.",
            )
    for literal in root.find_all(exp.HexString):
        # The parse is lossy: `0x1f` and `x'1f'` are both valid SQLite, mean an
        # integer and a blob respectively, and produce one identical node. So
        # this refuses the blob spelling too, which is the price of not
        # answering an integer comparison with a blob. Withdrawable once the
        # tokenizer records which was written.
        del literal
        return AdmissionResult(
            AdmissionOutcome.UNSUPPORTED_SYNTAX,
            "Hexadecimal literals are not supported: `0x1f` and `x'1f'` parse "
            "identically here, so an integer written in hex would be executed as a "
            "blob. Write the value in decimal.",
        )
    return None


#: Structural classes a SELECT may contain. Everything the parser can build
#: that is neither an `exp.Func` (its own allowlist) nor a table source (its
#: own check) falls here, and until this existed the seam between those two
#: policies was governed by a five-entry denylist -- so a class nobody had
#: considered was admitted by default. Three defects were found in that seam in
#: one night, none of them by a check.
#:
#: Derived from evidence rather than from opinion: every entry is a class
#: produced by parsing a statement this surface already ships, tests or teaches
#: -- the admission corpus, the schema's worked examples, the liveness suite,
#: and a battery covering the ordinary analytics grammar (predicates, CASE,
#: windows, joins, set operations, grouping, JSON and timestamp comparisons).
#:
#: It is therefore a floor, not a survey. The parser defines several hundred
#: structural classes and this names sixty-odd; a legitimate construct nobody
#: has written yet will be refused. That is the deliberate trade -- a refusal
#: names itself and can be lifted by adding a line, while the previous default
#: admitted whatever nobody had thought about.
_ALLOWED_STRUCTURAL_CLASSES: frozenset[str] = frozenset(
    """
    Add Alias All Any Between Block CTE Column Copy Credentials DPipe DataType
    Distinct Div Dot Drop EQ Escape Except Fetch Filter From GT GTE Glob Group
    Having Identifier In Intersect Into Is JSONKeyValue JSONPath JSONPathKey
    JSONPathRoot Join LT LTE Lateral Like Limit LimitOptions Literal Lock Mod Mul
    NEQ Neg Not Null ObjectIdentifier Offset Order Ordered Paren Select Star Sub
    Subquery Table TableAlias Union Var Where Window WindowSpec With WithinGroup
    """.split()
)


def _check_structural_policy(root: exp.Expression) -> Optional[AdmissionResult]:
    """Refuse structural classes that nothing has decided about.

    Functions and table sources are checked elsewhere and are skipped here.
    What remains is the seam, and the answer for an unlisted class is no --
    which is the whole change: the question used to be "is this one of the five
    we refuse", and it is now "is this one we have accepted".
    """
    for node in root.walk():
        if isinstance(node, exp.Func):
            continue
        name = type(node).__name__
        if name in _ALLOWED_STRUCTURAL_CLASSES:
            continue
        if name in {cls.__name__ for cls in _REFUSED_NODE_CLASSES}:
            continue  # a dedicated message says more; let that check answer
        return AdmissionResult(
            AdmissionOutcome.UNSUPPORTED_SYNTAX,
            f"This statement uses a construct ({name}) that is not part of the "
            "permitted grammar for analytics SQL. Rewrite it using the forms "
            "describeSqlSchema demonstrates, or report it if it belongs here.",
        )
    return None


def _check_node_classes(root: exp.Expression) -> Optional[AdmissionResult]:
    for node in root.walk():
        message = _REFUSED_NODE_CLASSES.get(type(node))
        if message is not None:
            return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, message)
        if isinstance(node, exp.Cast):
            refused = _refused_cast_target(node.to)
            if refused is not None:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"CAST to {refused} is not supported; cast to one of the column "
                    "types describeSqlSchema reports.",
                )
            if _is_ambiguous_path_cast(node):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "A cast written directly after `#>` or `#>>` is ambiguous: it could "
                    "cast the path or the extracted value. Parenthesise the one you mean "
                    "-- `a #>> (b::text[])` casts the path, `(a #>> b)::text[]` casts the "
                    "result. A path literal needs no cast at all.",
                )
    return None


# `#>` and `#>>` take a `text[]` path, so a cast on their right operand is
# meaningful; `pg_get_indexdef` emits exactly that form for an expression index
# over a JSON path.
#
# SQLGlot binds such a cast to the whole extraction, so `a #>> b::text[]` parses
# as `CAST(a #>> b AS TEXT[])`. A deliberate `CAST(a #>> b AS text[])` produces
# the identical tree and means something else: it parses the extracted string as
# an array literal, so `('{"tags":"{a,b}"}'::jsonb #>> '{tags}')::text[]` yields
# a two-element array.
#
# Nothing in the tree separates the two, so neither reading can be chosen on the
# caller's behalf, and the shape is refused with both unambiguous spellings
# named. A parenthesised operand is unambiguous and never reaches this test: it
# arrives under a `Paren` node.
#
# Upstream: https://github.com/tobymao/sqlglot/issues/8035
_JSON_PATH_EXTRACTIONS = (exp.JSONBExtract, exp.JSONBExtractScalar)


def _is_ambiguous_path_cast(node: exp.Cast) -> bool:
    """True for a cast to an array type applied directly to a `#>`/`#>>` extraction."""
    if not isinstance(node.this, _JSON_PATH_EXTRACTIONS):
        return False
    return isinstance(node.to, exp.DataType) and bool(node.to.this == exp.DataType.Type.ARRAY)


def _refused_cast_target(target: exp.Expression) -> Optional[str]:
    """The first disallowed type in a cast target, or None if all are allowed.

    The list exists to keep a cast away from PostgreSQL's object-identifier
    types, not to enumerate SQL: `CAST('pg_authid' AS regclass)` consults the
    system catalogs for any relation, role or function, and never appears as a
    scanned relation, so the plan gate cannot see it.

    An array of an allowed type is allowed, because it reaches nothing the
    element type does not. Refusing it made the surface reject its own output:
    `pg_get_indexdef` renders the operand of `#>>` as `'{a,b}'::text[]`, so
    `describeSqlSchema` published an index spelling under a heading telling the
    caller to reproduce it exactly, and admission then refused it. Nothing
    protective was lost -- `regclass[]` does not parse, and an array whose
    element type is disallowed is still caught by the recursion.
    """
    name = target.this.name if hasattr(target.this, "name") else str(target.this)
    name = name.upper().split("(")[0].strip()
    if name == "ARRAY":
        for nested in target.args.get("expressions") or []:
            if (refused := _refused_cast_target(nested)) is not None:
                return refused
        return None
    return None if not name or name in ALLOWED_CAST_TYPES else name


# Comparisons a timestamp literal can appear in. LIKE and GLOB are deliberately
# absent: there the string form is the point, and a caller matching a prefix has
# not made the mistake this refuses.
_TIMESTAMP_COMPARISONS = (exp.EQ, exp.NEQ, exp.GT, exp.GTE, exp.LT, exp.LTE)


def query_local_columns(root: exp.Expression) -> set[int]:
    """``id()`` of every column reference that resolves to something query-local.

    An advertised column that is not stored -- ``latency_ms``, ``graphql_node_id``
    -- is substituted by a rewrite, and a timestamp column decides how a literal
    beside it is spelled. All three must act only on references that mean the
    stored thing. A reference to a CTE, a subquery, or an output alias means
    whatever that relation projected under the name.

    Four passes previously carried four answers to this question -- ``build_scope``
    in schema qualification, a hand-built name set in the duration substitution,
    nothing at all in the node-id substitution, and a syntactic scan for star
    expansion -- and every disagreement between them was a defect. This is the
    one answer.

    Three ways a reference can be local, and the third is why ``build_scope`` is
    necessary but not sufficient:

    1. Qualified, where the qualifier names a derived relation. Both a CTE's own
       name and the alias it is bound to in ``FROM`` resolve to it.
    2. Unqualified, where a derived relation in the same scope projects the name.
    3. Unqualified in ``ORDER BY`` or ``GROUP BY``, where the select list aliases
       the name. Both engines resolve those against the output first, and
       ``build_scope`` does not report them as source columns at all, so they
       have to be walked separately.
    """
    scope_root = build_scope(root)
    if scope_root is None:
        return set()
    local: set[int] = set()
    for scope in scope_root.traverse():
        derived_aliases: set[str] = set()
        derived_projections: set[str] = set()
        for alias, source in scope.sources.items():
            if isinstance(source, exp.Table):
                continue
            derived_aliases.add(alias.lower())
            expression = getattr(source, "expression", None)
            if expression is not None:
                derived_projections.update(name.lower() for name in expression.named_selects)
        select = scope.expression if isinstance(scope.expression, exp.Select) else None
        output_aliases = {
            projection.alias.lower()
            for projection in (select.expressions if select else [])
            if isinstance(projection, exp.Alias) and projection.alias
        }
        for column in scope.columns:
            table = (column.table or "").lower()
            if table:
                if table in derived_aliases:
                    local.add(id(column))
                continue
            if (column.name or "").lower() in derived_projections:
                local.add(id(column))
        for clause_name in ("order", "group"):
            clause = select.args.get(clause_name) if select else None
            if clause is None:
                continue
            for column in clause.find_all(exp.Column):
                if not column.table and (column.name or "").lower() in output_aliases:
                    local.add(id(column))
    return local


def _timestamp_literals(root: exp.Expression, columns: frozenset[str]) -> list[exp.Literal]:
    """Every string literal compared against a column that holds a timestamp.

    Columns that resolve to a query-local relation are skipped: a derived
    relation exposing a column called ``start_time`` holds whatever it projected,
    and rewriting the literal beside it to storage format changes a comparison
    the caller wrote against their own data.
    """
    local = query_local_columns(root)
    found: list[exp.Literal] = []

    def collect(left: Optional[exp.Expression], right: Optional[exp.Expression]) -> None:
        for column, literal in ((left, right), (right, left)):
            if (
                isinstance(column, exp.Column)
                and (column.name or "").casefold() in columns
                and id(column) not in local
                and isinstance(literal, exp.Literal)
                and literal.is_string
            ):
                found.append(literal)

    for node in root.walk():
        if isinstance(node, _TIMESTAMP_COMPARISONS):
            collect(node.this, node.expression)
        elif isinstance(node, exp.Between):
            collect(node.this, node.args.get("low"))
            collect(node.this, node.args.get("high"))
        elif isinstance(node, exp.In):
            # Every member, and only against the left operand -- `IN` is a
            # comparison spelled as a list, so a literal in it is decided the
            # same way one beside `=` is. Uncovered until now, so a caller
            # listing instants got neither the naive-literal refusal nor the
            # storage-format rewrite, and the comparison quietly matched nothing
            # on SQLite.
            for member in node.expressions:
                collect(node.this, member)
    return found


def _check_timestamp_literals(
    root: exp.Expression, *, allowlist: Allowlist
) -> Optional[AdmissionResult]:
    """Refuse a timestamp literal that names an instant without saying which one.

    A naive literal carrying a time of day means "ask the environment", and the
    three environments involved answer differently: a naive value written through
    `UtcTimeStamp` is localised to the writing process's zone, PostgreSQL reads a
    naive literal in the session `TimeZone`, and SQLite compares text against
    whatever those two produced. Picking one on the caller's behalf would answer
    a question they did not ask, so the shape is refused and the offset asked for.

    A bare date is admitted. It names a day rather than an instant, so UTC
    resolves it without guessing, and refusing the commonest predicate anyone
    writes would charge every caller a round trip for a rule that costs them
    nothing here. The envelope records that it was read as UTC.
    """
    columns = timestamp_column_names(allowlist.tables)
    if not columns:
        return None
    for literal in _timestamp_literals(root, columns):
        parsed = parse_timestamp_literal(literal.this)
        if parsed is None or parsed.is_aware or not parsed.has_time:
            continue
        return AdmissionResult(
            AdmissionOutcome.UNSUPPORTED_SYNTAX,
            f"`{literal.this}` names a time of day but no time zone, and this surface "
            "will not choose one for you. Add an offset -- "
            f"`{literal.this}+00:00` for UTC. A bare date such as `2026-07-01` needs "
            "none and is read as UTC.",
        )
    return None


def _check_functions(
    root: exp.Expression, *, allowlist: Allowlist, dialect: DialectName
) -> Optional[AdmissionResult]:
    allowed_anon = allowlist.allowed_anon_functions(dialect)
    allowed_classes = allowed_func_classes(dialect)
    for node in root.walk():
        if not isinstance(node, exp.Func):
            continue
        if isinstance(node, tuple(EXCLUDED_FUNC_CLASSES)):
            continue
        if isinstance(node, exp.Anonymous):
            name = (node.name or "").lower()
            if name not in allowed_anon:
                return AdmissionResult(AdmissionOutcome.FUNCTION_NOT_ALLOWED, name or "<anonymous>")
            continue
        if type(node) not in allowed_classes:
            # Report the SQL spelling, not the parser's class name. A caller who
            # wrote json_type() cannot act on being told that "JSONType" is not
            # allowed -- they never typed that, and it does not appear in any
            # documentation they have.
            names = type(node).sql_names()
            return AdmissionResult(
                AdmissionOutcome.FUNCTION_NOT_ALLOWED,
                names[0].lower() if names else type(node).__name__,
            )
    return None


def _check_base_tables(root: exp.Expression, *, allowlist: Allowlist) -> Optional[AdmissionResult]:
    try:
        scope_root = build_scope(root)
    except SqlglotError as exc:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, f"scope: {exc}")
    if scope_root is None:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, "scope: unresolved")

    for scope in scope_root.traverse():
        for source in scope.sources.values():
            if not isinstance(source, exp.Table):
                continue
            if source.db or source.catalog:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "Schema-qualified tables are not allowed",
                )
            name = source.name or ""
            if not name:
                continue
            if name not in allowlist.tables:
                return AdmissionResult(AdmissionOutcome.RELATION_NOT_ALLOWED, repr(name))

    # `Scope.sources` is keyed by reference name, so a table aliased to a CTE's
    # name collides with it and the table is dropped from the map entirely --
    # `FROM projects AS x, x` alongside `WITH x AS (...)` leaves sources holding
    # only the CTE. Every check built on sources then skips the table: the
    # relation check above never sees it, and the hidden-column check finds an
    # empty map and moves on, so `projects`'s omitted columns were readable.
    #
    # Refused rather than resolved. PostgreSQL rejects the statement outright
    # ("table name specified more than once"), so accepting it on SQLite was a
    # divergence as well as a hole, and there is no reading a caller needs.
    # Stated as the invariant rather than as the shape that broke it. Every real
    # table must appear in some scope's sources, because that map is what every
    # later check reads; a table missing from it is skipped rather than refused.
    #
    # An earlier version looked for the specific cause -- a table alias equal to
    # a CTE name -- and refused whenever both appeared anywhere in the
    # statement. That rejected ordinary SQL: `WITH t AS (...) SELECT ... FROM
    # (SELECT ... FROM spans AS t) q` has the CTE and the alias in different
    # scopes, which is legal, unambiguous, and executes on both engines. `t` is
    # both the most common CTE name and the most common table alias, so the
    # false positive was easy to hit and the rule was far broader than the bug.
    #
    # Checking the invariant instead refuses only when a table has actually been
    # lost, whatever the cause.
    # Checked per scope, not across the statement. A flat set of every resolved
    # name let one occurrence mask another: with `projects` read normally in one
    # subquery and shadowed in a second, the shadowed one passed because the
    # name appeared somewhere. That admitted a statement SQLite runs and
    # PostgreSQL rejects outright -- the divergence this refusal exists to
    # prevent -- while `scope.tables` answers the question actually being asked,
    # which is whether *this* scope resolved the table it names.
    declared = {cte.alias for cte in root.find_all(exp.CTE) if cte.alias}
    for scope in scope_root.traverse():
        resolved = {
            source.name
            for source in scope.sources.values()
            if isinstance(source, exp.Table) and source.name
        }
        for table in scope.tables:
            name = table.name or ""
            if name and name not in declared and name not in resolved:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"{name!r} is shadowed by another relation of the same name in this "
                    "statement, so it cannot be resolved. Rename one of them.",
                )
    return None


def _check_hidden_columns(
    root: exp.Expression, *, allowlist: Allowlist
) -> Optional[AdmissionResult]:
    """Refuse a reference to a column the schema declines to show.

    Without this the schema would be decoration: `describeSqlSchema` omits
    `user_id`, but nothing stopped `SELECT user_id FROM datasets` from returning
    it, so the document and the executor disagreed about what the surface is.

    Resolution is deliberately conservative. A qualified reference resolves
    through the scope's own sources, which is exact. An unqualified one is
    checked against every allowlisted table in scope, so a bare `user_id` is
    refused wherever it could have come from -- at the cost of also refusing an
    alias that happens to share the name. Refusing something harmless costs a
    caller one rewrite; admitting a column the schema never showed them means
    the document and the executor disagree, which is the failure this surface
    has produced most often.
    """
    # Case-folded on both sides. The table rule above is an allowlist, so an
    # unrecognised spelling fails closed; this one is a denylist, so an
    # unrecognised spelling fails *open* -- and both engines resolve unquoted
    # identifiers case-insensitively, which made `SELECT GRADIENT_START_COLOR`
    # and `SELECT USER_ID` return exactly the data the lowercase spelling is
    # refused for. Quoted upper-case is folded too: it names nothing on
    # PostgreSQL, and SQLite matches it case-insensitively regardless.
    hidden_anywhere = {
        column.casefold()
        for spec in allowlist.table_specs.values()
        for column in spec.hidden_columns
    }
    # A CTE column, a subquery projection or an output alias is the caller's own
    # name for their own value, and resolving it against a base table's schema
    # refuses a statement that never touched one.
    local = query_local_columns(root)
    try:
        scope_root = build_scope(root)
    except SqlglotError as exc:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, f"scope: {exc}")
    if scope_root is None:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, "scope: unresolved")

    for scope in scope_root.traverse():
        by_reference: dict[str, str] = {}
        for reference, source in scope.sources.items():
            if isinstance(source, exp.Table) and source.name in allowlist.table_specs:
                by_reference[reference] = source.name
                by_reference[source.name] = source.name
        # Raw table nodes as well, not only what `sources` kept. A reference-name
        # collision silently drops a table from that map, and a check that reads
        # it alone then skips the scope rather than failing closed. The collision
        # itself is refused during admission, but this map is what the rest of
        # this function reasons over, so it is built from the nodes that are
        # actually there.
        for node in scope.expression.find_all(exp.Table):
            if node.name in allowlist.table_specs:
                by_reference.setdefault(node.alias or node.name, node.name)
                by_reference.setdefault(node.name, node.name)
        if not by_reference:
            continue
        # `USING (col)` and NATURAL JOIN both equate columns without ever
        # producing an `exp.Column`, so scanning column references alone missed
        # them. That was not merely a read of a hidden column: joining a
        # caller-supplied VALUES list `USING (gradient_start_color)` returns one
        # row per match, so a candidate list reconstructs the omitted value row
        # by row -- reaching, through a join, past what the schema describes.
        for join in scope.expression.find_all(exp.Join):
            if (join.args.get("method") or "").upper() == "NATURAL":
                # NATURAL names nothing, so nothing can be inspected: it joins on
                # every column the two sides share, hidden ones included. There
                # is no safe subset, so the construct goes.
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "NATURAL JOIN joins on every shared column, including ones "
                    "this surface does not expose. Name the join columns with ON.",
                )
            for identifier in join.args.get("using") or []:
                folded = identifier.name.casefold()
                if folded in hidden_anywhere:
                    for table_name in dict.fromkeys(by_reference.values()):
                        if folded in {
                            c.casefold() for c in allowlist.table_specs[table_name].hidden_columns
                        }:
                            return AdmissionResult(
                                AdmissionOutcome.COLUMN_NOT_ALLOWED,
                                f"{table_name}.{identifier.name}",
                            )

        # A bare reference to a relation is the whole row, and PostgreSQL will
        # hand it over: `SELECT p FROM projects p` and `SELECT CAST(p AS TEXT)
        # FROM projects p` both return every physical column, hidden ones
        # included. It parses as an ordinary unqualified Column whose name
        # happens to be the relation's, so the per-column rules below never
        # applied to it -- the check reads column names, and this construct
        # names no column at all.
        #
        # `exp.Dot` is the same escape from the other side: `(d).user_id`
        # reaches a field of that row without producing a Column node for it.
        # Neither has a use here that naming the columns does not serve.
        for dot in scope.expression.find_all(exp.Dot):
            # Only when the left side is a *relation*, which is the row-valued
            # escape: `(d).user_id` reaches a field of the whole row without
            # producing a column node for it. A blanket refusal also removed
            # `(jsonb_each(attributes)).key`, the idiomatic way to project one
            # field of a set-returning function's result on PostgreSQL -- the
            # very statement `allowlist.py` cites as the reason the plan gate's
            # function set exists. An identifier on the left is a schema
            # qualifier, which stays refused: it reaches a function by a path
            # the function policy never inspected.
            # Every layer of parens, not one. `((d)).user_id` left a Paren in
            # `inner`, which matches neither branch, so this rule did not fire.
            # It is refused today regardless, by the row-valued rule above --
            # which scans columns at any depth -- but the two are described as
            # covering the escape from both sides, and only one of them was
            # depth-independent. Narrowing that rule later would reopen this
            # silently.
            inner = dot.this
            while isinstance(inner, exp.Paren):
                inner = inner.this
            if isinstance(inner, (exp.Column, exp.Identifier)):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"Composite field access ({dot.sql()}) is not supported. "
                    "Name the column, or expand the function in the FROM clause.",
                )
        for column in scope.expression.find_all(exp.Column):
            if not column.table and column.name.casefold() in {
                reference.casefold() for reference in by_reference
            }:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"{column.name!r} names a table here, so it selects the whole row "
                    "including columns this surface does not expose. Name the columns "
                    "you want.",
                )

        # A source in this scope that is not an allowlisted table -- a
        # table-valued function, a derived relation -- can offer names the
        # manifest has never heard of, and an unqualified reference could have
        # come from it. `json_each(attributes)` projecting `key` is the shape
        # that matters, and it is one the schema teaches.
        foreign_source = any(
            not (isinstance(source, exp.Table) and source.name in allowlist.table_specs)
            for source in scope.sources.values()
        )
        for column in scope.expression.find_all(exp.Column):
            if id(column) in local or isinstance(column.this, exp.Star):
                continue
            name = column.name.casefold()
            qualifier = column.table or ""
            if qualifier:
                candidates = [by_reference[qualifier]] if qualifier in by_reference else []
            elif foreign_source:
                continue
            else:
                candidates = list(dict.fromkeys(by_reference.values()))
            if not candidates:
                continue
            # An allowlist, not a hidden-column denylist. The two agree on every
            # column the manifest knows about, and differ on one it does not:
            # under a denylist a column that exists and is described nowhere is
            # readable, so the schema stops being the description of the surface
            # the moment the two drift.
            #
            # Safe to invert because the drift is already impossible to ship:
            # the manifest is asserted equal to the ORM's columns, table by
            # table. This makes the runtime enforce what that assertion checks,
            # rather than trusting it to have been run.
            #
            # Unqualified references are checked against every allowlisted table
            # in scope and refused if *no* candidate offers the name, which is
            # the conservative direction: a name that resolves nowhere is a
            # mistake, and one that resolves somewhere is admitted.
            if any(_offers_column(allowlist, table_name, name) for table_name in candidates):
                continue
            for table_name in candidates:
                folded = {c.casefold() for c in allowlist.table_specs[table_name].hidden_columns}
                if name in folded:
                    return AdmissionResult(
                        AdmissionOutcome.COLUMN_NOT_ALLOWED, f"{table_name}.{name}"
                    )
            return AdmissionResult(
                AdmissionOutcome.COLUMN_NOT_ALLOWED,
                f"{candidates[0]}.{name}",
            )
    return None


def _offers_column(allowlist: Allowlist, table_name: str, folded_name: str) -> bool:
    """Whether the schema shows this column for this table.

    Virtual columns are advertised and not stored, so they are offered here and
    absent from the manifest's column list; a check that reads only the latter
    refuses the columns the surface exists to provide.
    """
    spec = allowlist.table_specs[table_name]
    if folded_name in {column.name.casefold() for column in spec.columns}:
        return folded_name not in {hidden.casefold() for hidden in spec.hidden_columns}
    return folded_name in {virtual.casefold() for virtual in spec.virtual_columns}


def admit(root: exp.Expression, *, allowlist: Allowlist, dialect: DialectName) -> exp.Expression:
    for node in root.walk():
        if isinstance(node, (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create)):
            raise admission_error_from_outcome("not_read_only", type(node).__name__)
        if isinstance(node, exp.Into):
            raise admission_error_from_outcome("not_read_only", "Into")
        if isinstance(node, exp.Lock):
            raise admission_error_from_outcome("unsupported_syntax", "Lock")
        if isinstance(node, exp.With) and node.args.get("recursive"):
            raise admission_error_from_outcome("unsupported_syntax", "recursive CTE")

    failure = (
        _check_node_classes(root)
        # Before the structural policy, which would otherwise answer these with
        # its generic message. A caller told `HexString` is not in the grammar
        # learns nothing; the lossy-shape refusals name the hazard and the
        # spelling that works.
        or _check_lossy_shapes(root)
        or _check_structural_policy(root)
        or _check_double_quoted_timestamp_operands(root, allowlist=allowlist)
        or _check_functions(root, allowlist=allowlist, dialect=dialect)
        or _check_base_tables(root, allowlist=allowlist)
        or _check_hidden_columns(root, allowlist=allowlist)
        or _check_timestamp_literals(root, allowlist=allowlist)
    )
    if failure is not None:
        raise admission_error_from_outcome(failure.outcome.value, failure.detail)
    return root


def render(root: exp.Expression, *, dialect: DialectName) -> str:
    """Render the admitted tree, refusing rather than degrading.

    sqlglot warns and emits what it can when the target cannot express a node,
    which is right for a transpiler -- partial output beats refusing to
    translate -- and wrong here. This function authors the statement the engine
    runs, so a clause dropped on the way out is a statement that was admitted
    with one meaning and executed with another, and the caller is told nothing.

    Raising instead turns every such case into an ordinary refusal, including
    ones nobody has catalogued yet. What it does not catch is a node the
    generator can express incorrectly; those are refused at admission.
    """
    try:
        return root.sql(
            dialect=sqlglot_read_dialect(dialect),
            comments=False,
            unsupported_level=ErrorLevel.RAISE,
        )
    except UnsupportedError as exc:
        # The message names the construct, and it is the only description of the
        # gap that exists -- there is no catalogue of what each generator cannot
        # express.
        raise AnalyticsSqlError(
            code=ErrorCode.UNSUPPORTED_SYNTAX,
            message=f"This statement cannot be expressed for {dialect}: {exc}",
        ) from exc


def admit_sql(
    sql: str,
    *,
    allowlist: Allowlist,
    dialect: DialectName,
) -> tuple[exp.Expression, str]:
    root = parse_sql(sql, dialect=dialect)
    root = admit(root, allowlist=allowlist, dialect=dialect)
    return root, render(root, dialect=dialect)


def try_parse_and_admit(
    sql: str,
    *,
    dialect: DialectName = "postgresql",
    allowlist: Optional[Allowlist] = None,
) -> AdmissionResult:
    """Parse and admit SQL, returning a structured outcome instead of raising."""
    if allowlist is None:
        from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist

        allowlist = load_allowlist()
    try:
        root = parse_sql(sql, dialect=dialect)
    except AnalyticsSqlError as exc:
        return AdmissionResult(AdmissionOutcome(exc.code.value), exc.message)

    try:
        root = admit(root, allowlist=allowlist, dialect=dialect)
    except AnalyticsSqlError as exc:
        return AdmissionResult(
            AdmissionOutcome(exc.code.value),
            exc.admission_detail or (exc.identifiers[0] if exc.identifiers else exc.message),
        )

    return AdmissionResult(
        AdmissionOutcome.ADMIT,
        rendered_sql=render(root, dialect=dialect),
    )
