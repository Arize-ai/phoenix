from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from difflib import get_close_matches
from enum import Enum
from typing import Optional

from sqlglot import exp, parse
from sqlglot.errors import ErrorLevel, ParseError, SqlglotError, UnsupportedError
from sqlglot.optimizer.scope import build_scope

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp_analytics_sql.allowlist import (
    ALLOWED_CAST_TYPES,
    EXCLUDED_FUNC_CLASSES,
    Allowlist,
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
    # Set when the outcome's stock wording would be wrong for this case.
    message: str = ""


ALLOWED_ROOTS = (exp.Select, exp.Union, exp.Intersect, exp.Except)


def _fold_unquoted_identifiers(root: exp.Expression) -> exp.Expression:
    """Canonicalize identifiers to the spelling both supported engines resolve.

    SQLGlot preserves the caller's spelling, while PostgreSQL and SQLite fold
    every unquoted identifier during resolution. Scope construction, CTE lookup,
    and later rewrite passes all operate on SQLGlot's tree, so leaving `WITH X`
    and `FROM x` distinct there makes Phoenix disagree with the database.

    Quoted identifiers deliberately retain their exact spelling: PostgreSQL
    treats `"X"` and `x` as different names. This runs before admission so each
    later layer observes the same names the backend will bind.
    """
    for identifier in root.find_all(exp.Identifier):
        if not identifier.args.get("quoted") and isinstance(identifier.this, str):
            identifier.set("this", identifier.this.casefold())
    return root


def parse_sql(sql: str, *, dialect: SupportedSQLDialectName) -> exp.Expression:
    try:
        statements = parse(sql, read=sqlglot_read_dialect(dialect))
    except ParseError as exc:
        raise admission_error_from_outcome("parse_error", str(exc)) from exc
    except RecursionError as exc:
        # The parser descends recursively, so nesting deep enough exhausts the
        # stack instead of failing to parse -- about a hundred parentheses, which
        # is a short string to send. Left uncaught it escapes the error envelope
        # and reaches the caller as a masked internal failure, which is the one
        # answer this surface is built not to give.
        raise AnalyticsSqlError(
            code=ErrorCode.PARSE_ERROR,
            message="SQL is nested too deeply to parse. Simplify the expression.",
        ) from exc
    statements = [
        statement
        for statement in statements
        if statement is not None and not isinstance(statement, exp.Semicolon)
    ]
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
    if _tree_depth(root) > MAX_TREE_DEPTH:
        raise AnalyticsSqlError(
            code=ErrorCode.UNSUPPORTED_SYNTAX,
            message=(
                f"SQL is nested more than {MAX_TREE_DEPTH} levels deep. "
                "Simplify the statement, or split it into CTEs."
            ),
        )
    return _fold_unquoted_identifiers(root)


#: How deep a statement may nest. Every stage after parsing walks the tree
#: recursively -- admission, the rewrites, and the generator -- so a tree the
#: parser accepts can still exhaust the stack in one of them, where the error is
#: not a refusal but a masked internal failure. Bounding the tree once bounds all
#: of them, and is checked rather than trusted.
#:
#: Chosen against measurement rather than by feel: the deepest statement in the
#: corpus and the liveness suite is 9 levels, and the generator fails somewhere
#: above 258 -- on the nesting this counts, not on operator runs, which render at
#: two thousand terms. So this sits an order of magnitude above real usage and
#: well below the floor of what breaks.
MAX_TREE_DEPTH = 100


def _tree_depth(root: exp.Expression) -> int:
    """How deeply the statement nests, walked iteratively so measuring cannot recurse.

    A repeated operator does not count as nesting. `a OR b OR c` parses
    left-deep, one node per term, but every stage handles a run of one operator
    iteratively -- so counting the terms measures the caller's typing rather than
    the stack, and a hundred-term `OR` over a pasted list of ids is an ordinary
    thing to write. Measured: such chains render at two thousand terms, while
    nested subqueries, which alternate node types, break above 258.

    Same-type descent is the rule rather than a list of operator classes,
    because a list of node classes kept in agreement by hand is how this file
    has produced defects before.
    """
    deepest = 0
    stack: list[tuple[exp.Expression, int]] = [(root, 0)]
    while stack:
        node, depth = stack.pop()
        deepest = max(deepest, depth)
        for value in node.args.values():
            for item in value if isinstance(value, list) else [value]:
                if isinstance(item, exp.Expression):
                    same = type(item) is type(node)
                    stack.append((item, depth if same else depth + 1))
    return deepest


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
    # A sample is a statistical claim, and the two engines do not offer the same
    # one -- SQLite has no TABLESAMPLE at all. Admitting it would mean deciding
    # per dialect what a caller's percentage becomes; refusing says so, and
    # row_limit bounds the scan without claiming the rows are representative.
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
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
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
    local = query_local_columns(root, allowlist=allowlist, dialect=dialect)

    def offender(
        column: Optional[exp.Expression], operand: Optional[exp.Expression]
    ) -> Optional[str]:
        if not isinstance(column, exp.Column) or (column.name or "").casefold() not in columns:
            return None
        if local.is_local(column):
            return None
        if not isinstance(operand, exp.Column) or operand.table:
            return None
        identifier = operand.this
        if isinstance(identifier, exp.Identifier) and identifier.quoted:
            return str(identifier.this)
        return None

    for node in root.walk():
        for column, operand in _timestamp_comparison_pairs(node):
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
    answer available while the loss is real; an entry that becomes unnecessary
    once its cause is fixed says so.
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
#: considered was admitted by default.
#:
#: Two provenances, and they are not equally strong. Most entries were produced
#: by parsing statements this surface ships, tests or teaches -- the admission
#: corpus, the schema's worked examples, the liveness suite. The rest are
#: completions: classes added because refusing them would be arbitrary beside
#: one that was observed (`GTE` beside `GT`, `NullSafeEQ` beside `NullSafeNEQ`,
#: `Intersect` and `Except` beside `Union`), or because a review found ordinary
#: analytics SQL refused. An audit of the observed set puts eleven of the
#: seventy-eight in that second group, which is worth knowing when reading a
#: refusal: an entry here is not proof anyone exercised it.
#:
#: It is therefore a floor, not a survey. The parser defines several hundred
#: structural classes and this names seventy-eight; a legitimate construct nobody
#: has written yet will be refused. That is the deliberate trade -- a refusal
#: names itself and can be lifted by adding a line, while the previous default
#: admitted whatever nobody had thought about.
_ALLOWED_STRUCTURAL_CLASSES: frozenset[str] = frozenset(
    """
    Add Alias All Any Between Block Boolean CTE Column Copy Credentials Cube
    DPipe DataType Distinct Div Dot Drop EQ Escape Except Fetch Filter From GT
    GTE Glob Group GroupingSets Having Identifier In Interval Intersect Into Is
    JSONKeyValue JSONPath JSONPathKey JSONPathRoot Join LT LTE Lateral Like Limit
    LimitOptions Literal Lock Mod Mul NEQ Neg Not Null NullSafeEQ NullSafeNEQ
    ObjectIdentifier Offset Order Ordered Paren Rollup Select Star Sub Subquery
    Table TableAlias Tuple Union Values Var Where Window WindowSpec With
    WithinGroup
    """.split()
)


def _check_structural_policy(root: exp.Expression) -> Optional[AdmissionResult]:
    """Refuse structural classes that nothing has decided about.

    Functions and table sources are checked elsewhere and are skipped here.
    What remains is the seam, and the answer for an unlisted class is no: the
    question is "is this one we have accepted", not "is this one we refuse".
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
#: Binary comparisons whose operands are decided against each other. `IS DISTINCT
#: FROM` belongs here for the same reason `=` does -- it is a comparison whose
#: null handling differs, not a different kind of operation -- and its absence
#: meant a literal beside it got neither the naive refusal nor the storage-format
#: rewrite. `_timestamp_comparison_pairs` covers the spellings that compare
#: without producing one of these nodes.
_TIMESTAMP_COMPARISONS = (
    exp.EQ,
    exp.NEQ,
    exp.GT,
    exp.GTE,
    exp.LT,
    exp.LTE,
    exp.NullSafeEQ,
    exp.NullSafeNEQ,
    # SQLite's `IS` is `=` for non-null operands, so a literal beside it is
    # compared like any other. `IS NULL` reaches here too and is ignored,
    # because a null operand is not a string literal.
    exp.Is,
)


def _strip_parens(node: Optional[exp.Expression]) -> Optional[exp.Expression]:
    """The operand a comparison actually has, with wrapping removed.

    Both consumers match on the node itself, so an operand left wrapped is an
    operand they cannot see. Grouping is never part of what is compared, and a
    cast of a literal is that literal -- `CAST('2026-01-01' AS TEXT)` states a
    value, it does not compute one.

    A cast of anything else is left alone. Unwrapping it would put a check on
    the far side of an expression the caller wrote deliberately, which is the
    standing limit described on `_timestamp_comparison_pairs`.
    """
    while True:
        if isinstance(node, exp.Paren):
            node = node.this
            continue
        if isinstance(node, exp.Cast) and isinstance(_strip_parens(node.this), exp.Literal):
            node = node.this
            continue
        return node


def _timestamp_comparison_pairs(
    node: exp.Expr,
) -> list[tuple[Optional[exp.Expression], Optional[exp.Expression]]]:
    """Every (compared-against, operand) pair a node establishes.

    One enumeration for both consumers, because they ask the same question of the
    same tree and answering it twice is how a spelling gets covered by one and
    not the other. A construct that compares without spelling a comparison
    belongs here: `CASE col WHEN value` and `= ANY(...)` are decided exactly like
    `col = value`, and a quantifier holds its values rather than being one.

    Operands are reduced rather than matched as written, so grouping, casts of
    literals and row syntax do not hide one.

    The standing limit is on both sides and is the same limit: a pair that does
    not reduce to a bare column beside a bare value is left as it is, and the
    consumers ignore it. `date(start_time) = '...'` and `start_time = '...' ||
    ''` are both outside, because in each the caller wrote an expression that
    computes a value rather than naming one, and rewriting a literal beside it
    would change a comparison they authored. A value the query has to run to
    produce -- a scalar subquery, `VALUES` reached through one -- is outside for
    the same reason the quantifier's subquery is.

    On SQLite that limit is a wrong answer rather than an error, because text
    comparison succeeds against the wrong spelling. It is the first place to
    look when a caller reports a timestamp predicate matching nothing.
    """
    if isinstance(node, _TIMESTAMP_COMPARISONS):
        pairs = [(node.this, node.expression), (node.expression, node.this)]
        for column, other in ((node.this, node.expression), (node.expression, node.this)):
            if isinstance(other, exp.Any):
                # Bounded at the subquery edge: `= ANY(SELECT ...)` compares
                # against what the subquery returns, so a value written inside
                # it is beside that subquery's columns, not beside this one.
                pairs.extend(
                    (column, held)
                    for held in _within_scope(other, exp.Expression)
                    if held is not other
                )
        return _unwrapped(pairs)
    if isinstance(node, exp.Between):
        return _unwrapped([(node.this, node.args.get("low")), (node.this, node.args.get("high"))])
    if isinstance(node, exp.In):
        # A comparison spelled as a list, so a member is decided the way a
        # literal beside `=` is, and only against the left operand. `VALUES`
        # holds rows rather than values, so its rows are the members; a
        # subquery's are not, and live in `query` where this does not reach.
        members: list[Optional[exp.Expression]] = []
        for member in node.expressions:
            unwrapped = _strip_parens(member)
            if isinstance(unwrapped, exp.Values):
                members.extend(unwrapped.expressions)
            else:
                members.append(unwrapped)
        return _unwrapped((node.this, member) for member in members)
    if isinstance(node, exp.Case) and node.this is not None:
        # Only the operand form. `CASE WHEN col = value` builds a real comparison
        # node and is covered above; this spelling compares without one.
        return _unwrapped((node.this, when.this) for when in node.args.get("ifs") or [])
    return []


def _unwrapped(
    pairs: Iterable[tuple[Optional[exp.Expression], Optional[exp.Expression]]],
) -> list[tuple[Optional[exp.Expression], Optional[exp.Expression]]]:
    """Reduce each pair to the operands actually compared.

    Applied until neither side can be reduced further, because one pass answers
    only the depth it happens to meet: a row nested inside a row is still a pair
    of rows, and stopping there leaves the operand inside it unexamined.
    """
    out: list[tuple[Optional[exp.Expression], Optional[exp.Expression]]] = []
    pending = list(pairs)
    while pending:
        left, right = pending.pop()
        left, right = _strip_parens(left), _strip_parens(right)
        # `(a, b) = (x, y)` compares a with x and b with y. Callers reach for
        # this to compare several columns at once, and one of them being a
        # timestamp is exactly the case that must not slip through.
        if isinstance(left, exp.Tuple) and isinstance(right, exp.Tuple):
            pending.extend(zip(left.expressions, right.expressions))
            continue
        # A one-element row beside a scalar is that element. `IN (VALUES (x))`
        # spells a single value this way.
        if isinstance(left, exp.Tuple) and len(left.expressions) == 1:
            pending.append((left.expressions[0], right))
            continue
        if isinstance(right, exp.Tuple) and len(right.expressions) == 1:
            pending.append((left, right.expressions[0]))
            continue
        out.append((left, right))
    return out


def _within_scope(clause: exp.Expression, kind: type[exp.Expression]) -> list[exp.Expression]:
    """Nodes of `kind` under `clause` that belong to the clause's own scope.

    A sort or group key may contain a subquery, whose references are resolved
    against that subquery's select list rather than this one, so walking through
    it marks an inner reference against the outer aliases.
    """
    return [
        node
        for node in clause.walk(prune=lambda n: isinstance(n, (exp.Select, exp.Subquery)))
        if isinstance(node, kind)
    ]


def _scope_columns(expression: exp.Expr) -> list[exp.Column]:
    """Column nodes belonging to this scope, excluding nested query scopes."""
    return [
        node
        for child in expression.iter_expressions()
        for node in child.walk(prune=lambda n: isinstance(n, (exp.Select, exp.Subquery)))
        if isinstance(node, exp.Column)
    ]


class Locality(Enum):
    """Why a reference is query-local, which decides who may act on it.

    The distinction is the kind of evidence, not its strength. The two
    ``DERIVED_`` categories are structural: the reference resolves into a
    relation the query itself builds. ``OUTPUT_ALIAS`` models where a name binds,
    and the rule differs by clause -- a bare ``ORDER BY`` key takes the select
    list before the input columns, while ``GROUP BY`` takes an input column when
    one carries the name and the alias only otherwise. Both measured on both
    engines. That makes it a model of the engine rather than a fact about the
    tree, which is why disclosure checks decline it.

    ``DERIVED_PROJECTION`` is the weaker of the two structural cases: an
    unqualified name a derived relation projects can also be offered by a base
    table in the same scope, and then which one it means is an engine question.
    Both engines refuse that collision as ambiguous rather than resolving it,
    which a test pins -- so the category never has to answer it.
    """

    DERIVED_QUALIFIED = "derived_qualified"
    DERIVED_PROJECTION = "derived_projection"
    OUTPUT_ALIAS = "output_alias"


#: Structural evidence a rewrite or schema check may act on. Excluding
#: `OUTPUT_ALIAS` ensures a precedence-modeling error leaves a caller-written
#: expression unchanged rather than rewriting an input column.
STRUCTURAL = frozenset({Locality.DERIVED_QUALIFIED, Locality.DERIVED_PROJECTION})


@dataclass(frozen=True)
class ColumnLocality:
    """Which references are query-local, asked at the bar the caller needs.

    Three questions rather than one lookup, because the obvious spelling of "is
    this local" is the permissive one, and a disclosure check that reaches for it
    fails open. There is no membership test here: a consumer has to name the bar
    it is asking at, so choosing the wrong one is a visible decision rather than
    the default.
    """

    _by_reference: dict[int, Locality]

    def is_local(self, node: exp.Expression) -> bool:
        """Any evidence at all. For decisions whose wrong answer is a wrong row."""
        return id(node) in self._by_reference

    def is_structurally_local(self, node: exp.Expression) -> bool:
        """Only evidence from the shape of the query. For disclosure decisions."""
        return self._by_reference.get(id(node)) in STRUCTURAL

    def is_alias_bound(self, node: exp.Expression) -> bool:
        """The reference was matched against a select list rather than a relation."""
        return self._by_reference.get(id(node)) is Locality.OUTPUT_ALIAS


def query_local_columns(
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
) -> ColumnLocality:
    """Which column references resolve to something query-local, and on what evidence.

    An advertised column that is not stored -- ``latency_ms``, ``graphql_node_id``
    -- is substituted by a rewrite, and a timestamp column decides how a literal
    beside it is spelled. All three must act only on references that mean the
    stored thing. A reference to a CTE, a subquery, or an output alias means
    whatever that relation projected under the name.

    One answer for the four passes that need it -- schema qualification, the two
    substitutions and the timestamp scan -- because any disagreement between
    them is a defect. Star expansion keeps its own scan (`_star_sources`), which
    reads sources rather than resolving references.

    Three ways a reference can be local, and the third is why ``build_scope`` is
    necessary but not sufficient:

    1. Qualified, where the qualifier names a derived relation. Both a CTE's own
       name and the alias it is bound to in ``FROM`` resolve to it.
    2. Unqualified, where a derived relation in the same scope projects the name.
    3. Unqualified in ``ORDER BY``, where the select list aliases the name. Both
       engines resolve that against the output first, and ``build_scope`` does
       not report it as a source column at all, so it has to be walked
       separately.

    ``GROUP BY`` is deliberately absent from the third case, and the two clauses
    are not symmetric. Both engines resolve a bare ``GROUP BY`` name against the
    *input* columns first, falling back to an output alias only when no source
    column carries the name.

    Each reference is returned with the category of evidence that made it local,
    because consumers decide whether to substitute virtual columns or validate a
    physical schema reference. Only the third case above models engine binding
    precedence, so it is not structural evidence.
    """
    scope_root = build_scope(root)
    if scope_root is None:
        return ColumnLocality({})
    # Required rather than optional. Without it `offered` is empty, and the
    # GROUP BY rule then marks every alias-matching name local -- a resolution
    # that is simply wrong, and silently so, since nothing downstream can tell a
    # marking made from knowledge of the tables from one made in their absence.
    table_specs = allowlist.table_specs
    quoted_derived_aliases = {
        alias
        for relation in root.find_all(exp.CTE, exp.Subquery)
        if (alias_expression := relation.args.get("alias"))
        and isinstance(alias_expression, exp.TableAlias)
        and isinstance(alias_expression.this, exp.Identifier)
        and alias_expression.this.args.get("quoted")
        and (alias := relation.alias)
    }
    local: dict[int, Locality] = {}
    for scope in scope_root.traverse():
        derived_aliases: set[str] = set()
        derived_projections: set[str] = set()
        for alias, source in scope.sources.items():
            if isinstance(source, exp.Table):
                continue
            derived_aliases.add(
                alias
                if dialect == "postgresql" and alias in quoted_derived_aliases
                else alias.casefold()
            )
            expression = getattr(source, "expression", None)
            if expression is not None:
                derived_projections.update(name.lower() for name in expression.named_selects)
        select = scope.expression if isinstance(scope.expression, exp.Select) else None
        # A set operation has no input columns of its own, so a sort key over one
        # can only name a result column -- every output name qualifies, not just
        # the aliased ones. Its ORDER BY hangs off the set operation rather than
        # off either branch, so a scope-by-scope walk that looks only at selects
        # never reaches it.
        set_operation = scope.expression if isinstance(scope.expression, exp.SetOperation) else None
        if set_operation is not None:
            output_aliases = {name.lower() for name in set_operation.named_selects}
        else:
            output_aliases = {
                projection.alias.lower()
                for projection in (select.expressions if select else [])
                if isinstance(projection, exp.Alias) and projection.alias
            }
        for column in scope.columns:
            table_identifier = column.args.get("table")
            table = (
                (column.table or "")
                if (
                    dialect == "postgresql"
                    and isinstance(table_identifier, exp.Identifier)
                    and table_identifier.args.get("quoted")
                )
                else (column.table or "").casefold()
            )
            if table:
                if table in derived_aliases:
                    local[id(column)] = Locality.DERIVED_QUALIFIED
                continue
            if (column.name or "").lower() in derived_projections:
                local[id(column)] = Locality.DERIVED_PROJECTION
        scope_root_expression = select if select is not None else set_operation
        order_clause = (
            scope_root_expression.args.get("order") if scope_root_expression is not None else None
        )
        if order_clause is not None:
            for ordered in _within_scope(order_clause, exp.Ordered):
                # The whole sort key, not any column beneath it. An alias binds
                # only when the key *is* the bare name; inside an expression both
                # engines resolve to the input column, so `ORDER BY col || ''`
                # under an alias of that name sorts by the real column.
                key = ordered.this
                if (
                    isinstance(key, exp.Column)
                    and not key.table
                    and (key.name or "").lower() in output_aliases
                ):
                    # setdefault, so a reference that also has structural
                    # evidence keeps it rather than being downgraded to the
                    # category disclosure checks decline.
                    local.setdefault(id(key), Locality.OUTPUT_ALIAS)
        # GROUP BY takes the input column when one carries the name and the
        # output alias only otherwise, so it is local only in the second case.
        group_clause = select.args.get("group") if select else None
        if group_clause is not None:
            offered = {
                column.casefold()
                for alias, source in scope.sources.items()
                if isinstance(source, exp.Table) and source.name in table_specs
                for column in table_specs[source.name].columns
            } | {
                virtual.casefold()
                for alias, source in scope.sources.items()
                if isinstance(source, exp.Table) and source.name in table_specs
                for virtual in table_specs[source.name].virtual_columns
            }
            for group_column in _within_scope(group_clause, exp.Column):
                if not isinstance(group_column, exp.Column):
                    continue
                name = (group_column.name or "").lower()
                if not group_column.table and name in output_aliases and name not in offered:
                    local.setdefault(id(group_column), Locality.OUTPUT_ALIAS)
    return ColumnLocality(local)


def _timestamp_literals(
    root: exp.Expression,
    columns: frozenset[str],
    *,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
) -> list[exp.Literal]:
    """Every string literal compared against a column that holds a timestamp.

    Columns that resolve to a query-local relation are skipped: a derived
    relation exposing a column called ``start_time`` holds whatever it projected,
    and rewriting the literal beside it to storage format changes a comparison
    the caller wrote against their own data.
    """
    local = query_local_columns(root, allowlist=allowlist, dialect=dialect)
    found: list[exp.Literal] = []

    def collect(left: Optional[exp.Expression], right: Optional[exp.Expression]) -> None:
        for column, literal in ((left, right), (right, left)):
            if (
                isinstance(column, exp.Column)
                and (column.name or "").casefold() in columns
                and not local.is_local(column)
                and isinstance(literal, exp.Literal)
                and literal.is_string
            ):
                found.append(literal)

    for node in root.walk():
        for column, operand in _timestamp_comparison_pairs(node):
            collect(column, operand)
    return found


def _check_timestamp_literals(
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
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
    for literal in _timestamp_literals(root, columns, allowlist=allowlist, dialect=dialect):
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
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
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


def _allowlisted_table_name(
    table: exp.Table,
    *,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
) -> Optional[str]:
    """Resolve a table identifier to its allowlisted spelling under SQL case rules."""
    name = table.name or ""
    identifier = table.this
    if (
        dialect == "postgresql"
        and isinstance(identifier, exp.Identifier)
        and identifier.args.get("quoted")
    ):
        return name if name in allowlist.tables else None
    if dialect == "postgresql":
        return next(
            (
                candidate
                for candidate in allowlist.tables
                if candidate == candidate.lower() and candidate == name.casefold()
            ),
            None,
        )
    return next(
        (candidate for candidate in allowlist.tables if candidate.casefold() == name.casefold()),
        None,
    )


def _table_identifier_name(table: exp.Table, *, dialect: SupportedSQLDialectName) -> str:
    """Return the identifier spelling by which the engine resolves this table."""
    name = table.name or ""
    identifier = table.this
    if (
        dialect == "postgresql"
        and isinstance(identifier, exp.Identifier)
        and identifier.args.get("quoted")
    ):
        return name
    return name.casefold()


def _check_base_tables(
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
) -> Optional[AdmissionResult]:
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
            if _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect) is None:
                return AdmissionResult(AdmissionOutcome.RELATION_NOT_ALLOWED, repr(name))

    # `Scope.sources` is keyed by reference name, so a table aliased to a CTE's
    # name collides with it and the table is dropped from the map entirely --
    # `FROM projects AS x, x` alongside `WITH x AS (...)` leaves sources holding
    # only the CTE. Every check built on sources then skips the table: the
    # relation check above never sees it, and later scope-dependent checks find
    # an empty map and move on.
    #
    # Refused rather than resolved. PostgreSQL rejects the statement outright
    # ("table name specified more than once"), so accepting it on SQLite was a
    # divergence as well as a hole, and there is no reading a caller needs.
    # Stated as the invariant rather than as the shape that broke it. Every real
    # table must appear in some scope's sources, because that map is what every
    # later check reads; a table missing from it is skipped rather than refused.
    #
    # Naming the cause instead -- a table alias equal to a CTE name -- would
    # refuse ordinary SQL: in `WITH t AS (...) SELECT ... FROM (SELECT ... FROM
    # spans AS t) q` the two are in different scopes, which is legal and runs on
    # both engines, and `t` is the commonest spelling of each. The invariant
    # refuses only when a table has actually been lost, whatever the cause.
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
            _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
            for source in scope.sources.values()
            if isinstance(source, exp.Table)
            and _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
        }
        for table in scope.tables:
            name = table.name or ""
            table_name = _allowlisted_table_name(
                table, allowlist=allowlist, dialect=dialect
            ) or _table_identifier_name(table, dialect=dialect)
            if table_name and table_name not in declared and table_name not in resolved:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"{name!r} is shadowed by another relation of the same name in this "
                    "statement, so it cannot be resolved. Rename one of them.",
                )
    return None


def _check_column_references(
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
) -> Optional[AdmissionResult]:
    """Validate base-table column references and preserve structural protections.

    Physical columns come from the generated DDL, so every physical column on an
    allowlisted table is queryable. Virtual columns are query-only overlays.
    Query-local relations retain their own names; the manifest cannot validate
    those projections.
    """
    localities = query_local_columns(root, allowlist=allowlist, dialect=dialect)
    try:
        scope_root = build_scope(root)
    except SqlglotError as exc:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, f"scope: {exc}")
    if scope_root is None:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, "scope: unresolved")

    for scope in scope_root.traverse():
        by_reference: dict[str, str] = {}
        for reference, source in scope.sources.items():
            if isinstance(source, exp.Table):
                table_name = _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
                if table_name is not None:
                    by_reference[reference] = table_name
                    by_reference[source.name] = table_name
        # Scope-local table nodes as well, not only what `sources` kept. A
        # reference-name collision silently drops a table from that map, and a
        # check that reads it alone then skips the scope rather than failing
        # closed. Do not descend through subqueries: their tables cannot supply
        # an unqualified column in this scope.
        for node in scope.tables:
            table_name = _allowlisted_table_name(node, allowlist=allowlist, dialect=dialect)
            if table_name is not None:
                by_reference.setdefault(node.alias or node.name, table_name)
                by_reference.setdefault(node.name, table_name)
        if not by_reference:
            continue
        columns = _scope_columns(scope.expression)
        # NATURAL JOIN names none of its join keys, so its behavior changes when
        # physical schemas evolve. Keep join criteria explicit rather than
        # silently taking every same-named column.
        for join in scope.expression.find_all(exp.Join):
            if (join.args.get("method") or "").upper() == "NATURAL":
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "NATURAL JOIN joins on every shared column. Name the join columns with ON.",
                )

        # A bare reference to a relation is the whole row, and PostgreSQL will
        # hand it over. It parses as an ordinary unqualified Column whose name
        # happens to be the relation's, so the per-column rules below do not
        # apply to it.
        #
        # `exp.Dot` is the same escape from the other side: `(d).field` reaches
        # a field of that row without producing a normal Column node.
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
        for column in columns:
            if (
                not column.table
                and not localities.is_alias_bound(column)
                and column.name.casefold() in {reference.casefold() for reference in by_reference}
            ):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"{column.name!r} names a table here, so it selects the whole row "
                    "rather than a column. Name the columns you want.",
                )

        # A source in this scope that is not an allowlisted table -- a
        # table-valued function, a derived relation -- can offer names the
        # manifest has never heard of, and an unqualified reference could have
        # come from it. `json_each(attributes)` projecting `key` is the shape
        # that matters, and it is one the schema teaches.
        foreign_source = any(
            not (
                isinstance(source, exp.Table)
                and _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
                is not None
            )
            for source in scope.sources.values()
        )
        for column in columns:
            if localities.is_structurally_local(column) or isinstance(column.this, exp.Star):
                continue
            name = column.name or ""
            qualifier = column.table or ""
            if qualifier:
                candidates = [by_reference[qualifier]] if qualifier in by_reference else []
                qualifier_identifier = column.args.get("table")
                if not candidates and not (
                    dialect == "postgresql"
                    and isinstance(qualifier_identifier, exp.Identifier)
                    and qualifier_identifier.args.get("quoted")
                ):
                    folded = {
                        table_name
                        for reference, table_name in by_reference.items()
                        if reference.casefold() == qualifier.casefold()
                    }
                    candidates = list(folded) if len(folded) == 1 else []
            else:
                candidates = list(dict.fromkeys(by_reference.values()))
            if not candidates:
                continue
            # A base-table reference must name a physical DDL column or a virtual
            # overlay. Unqualified references are checked against every
            # allowlisted table in scope and admitted if any one offers the name.
            # Output aliases are caller-defined names, so they need no physical
            # schema match.
            if localities.is_alias_bound(column):
                continue
            if any(
                _offers_column(allowlist, table_name, column, dialect) for table_name in candidates
            ):
                continue
            # Unknown to the manifest. That is a refusal when the allowlisted
            # tables are the only thing in scope, and not when something else
            # could have projected it -- a table-valued function names columns
            # the manifest has never heard of, and `json_each(attributes)`
            # projecting `key` is a shape the schema teaches.
            #
            if not qualifier and foreign_source:
                continue
            # Not a column of any table in scope -- a misspelling, most often.
            # Name nearby physical or virtual columns so a misspelling is
            # actionable on both engines. PostgreSQL suggests a name itself in
            # some execution paths; SQLite does not.
            #
            # Virtual columns are in the pool because they are columns to a
            # caller, and `latency_ms` is the most advertised name here.
            offered_here = sorted(
                {
                    physical
                    for table_name in candidates
                    for physical in allowlist.table_specs[table_name].columns
                }
                | {
                    virtual
                    for table_name in candidates
                    for virtual in allowlist.table_specs[table_name].virtual_columns
                }
            )
            near = get_close_matches(name.casefold(), offered_here, n=3, cutoff=0.7)
            suggestion = f" Did you mean {', '.join(near)}?" if near else ""
            # An unqualified reference was checked against every table in scope,
            # so naming one of them would assert something narrower than what
            # was tested.
            subject = (
                f"Column {candidates[0]}.{name} is not a column of that table."
                if len(candidates) == 1
                else f"Column {name} is not a column of any table in scope "
                f"({', '.join(sorted(candidates))})."
            )
            return AdmissionResult(
                AdmissionOutcome.COLUMN_NOT_ALLOWED,
                f"{candidates[0]}.{name}",
                message=(
                    f"{subject}{suggestion} Use describeSqlSchema to see the columns that are."
                ),
            )
    return None


def _offers_column(
    allowlist: Allowlist,
    table_name: str,
    reference: exp.Column,
    dialect: SupportedSQLDialectName,
) -> bool:
    """Whether this table exposes a physical or virtual column under this name.

    Virtual columns are advertised and not stored, so they are offered here and
    absent from the manifest's column list; a check that reads only the latter
    refuses the columns the surface exists to provide.
    """
    spec = allowlist.table_specs[table_name]
    name = reference.name or ""
    if name.casefold() in {virtual.casefold() for virtual in spec.virtual_columns}:
        return True
    if dialect == "sqlite":
        return name.casefold() in {column.casefold() for column in spec.columns}

    # PostgreSQL folds unquoted identifiers to lower-case but preserves quoted
    # spelling. The DDL loader retains which physical names were quoted, so the
    # policy admits `"MixedCase"` only when it exactly names that column and
    # refuses the different physical name `mixedcase`.
    identifier = reference.this
    is_quoted = isinstance(identifier, exp.Identifier) and bool(identifier.args.get("quoted"))
    if is_quoted:
        return name in spec.columns
    return any(
        name.casefold() == physical and physical == physical.lower() for physical in spec.columns
    )


def admit(
    root: exp.Expression, *, allowlist: Allowlist, dialect: SupportedSQLDialectName
) -> exp.Expression:
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
        or _check_double_quoted_timestamp_operands(root, allowlist=allowlist, dialect=dialect)
        or _check_functions(root, allowlist=allowlist, dialect=dialect)
        or _check_base_tables(root, allowlist=allowlist, dialect=dialect)
        or _check_column_references(root, allowlist=allowlist, dialect=dialect)
        or _check_timestamp_literals(root, allowlist=allowlist, dialect=dialect)
    )
    if failure is not None:
        raise admission_error_from_outcome(
            failure.outcome.value, failure.detail, message=failure.message
        )
    return root


def render(root: exp.Expression, *, dialect: SupportedSQLDialectName) -> str:
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
    dialect: SupportedSQLDialectName,
) -> tuple[exp.Expression, str]:
    root = parse_sql(sql, dialect=dialect)
    root = admit(root, allowlist=allowlist, dialect=dialect)
    return root, render(root, dialect=dialect)


def try_parse_and_admit(
    sql: str,
    *,
    dialect: SupportedSQLDialectName = "postgresql",
    allowlist: Optional[Allowlist] = None,
) -> AdmissionResult:
    """Parse and admit SQL, returning a structured outcome instead of raising."""
    if allowlist is None:
        from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist

        allowlist = load_allowlist(dialect)
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

    # Rendering can refuse too, now that it raises rather than degrading: a
    # statement can pass every admission check and still name a construct the
    # target cannot express. `SELECT * FROM (VALUES (1)) AS t(x)` on SQLite is
    # one -- the column-alias list has no rendering there. Left uncaught it
    # escaped this function, whose whole contract is to return an outcome
    # instead of raising, so a corpus entry for such a shape would error out of
    # the harness rather than record a verdict.
    try:
        rendered = render(root, dialect=dialect)
    except AnalyticsSqlError as exc:
        return AdmissionResult(AdmissionOutcome(exc.code.value), exc.message)

    return AdmissionResult(AdmissionOutcome.ADMIT, rendered_sql=rendered)
