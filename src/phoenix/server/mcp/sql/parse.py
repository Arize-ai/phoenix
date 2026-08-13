from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from difflib import get_close_matches
from enum import Enum
from typing import Any, Optional

from sqlglot import exp, parse, parse_one
from sqlglot.errors import ErrorLevel, ParseError, SqlglotError, UnsupportedError
from sqlglot.optimizer.scope import build_scope

from phoenix.db.helpers import SupportedSQLDialectName
from phoenix.server.mcp.sql.allowlist import (
    ALLOWED_CAST_TYPES,
    EXCLUDED_FUNC_CLASSES,
    Allowlist,
    allowed_func_classes,
    sqlglot_read_dialect,
)
from phoenix.server.mcp.sql.errors import (
    AnalyticsSqlError,
    ErrorCode,
    admission_error_from_outcome,
)
from phoenix.server.mcp.sql.normalize import (
    is_date_shaped,
    is_time_shaped,
    parse_timestamp_literal,
    timestamp_column_names,
    unix_epoch_to_utc,
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


def _fold_unquoted_identifiers(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Canonicalize identifiers to the spelling both supported engines resolve.

    SQLGlot preserves the caller's spelling, while PostgreSQL and SQLite fold
    every unquoted identifier during resolution. Scope construction, CTE lookup,
    and later rewrite passes all operate on SQLGlot's tree, so leaving `WITH X`
    and `FROM x` distinct there makes Phoenix disagree with the database.

    PostgreSQL quoted identifiers retain their exact spelling, while SQLite
    resolves quoted and unquoted identifiers case-insensitively. Use ``lower``,
    not Unicode ``casefold``: database identifier folding does not expand one
    character into several, such as ``ß`` into ``ss``.
    """
    for identifier in root.find_all(exp.Identifier):
        if isinstance(identifier.this, str) and (
            dialect == "sqlite" or not identifier.args.get("quoted")
        ):
            identifier.set("this", identifier.this.lower())
    return root


_QUOTED_CHAR_TYPE = re.compile(r'(?:AS|::)\s*"char"', re.IGNORECASE)

_RECURSIVE_CTE_MESSAGE = (
    "Recursive CTEs are not supported. Walk a parent/child "
    "relationship with a self-join instead (for spans, "
    "`child.parent_id = parent.span_id`)."
)


def parse_sql(sql: str, *, dialect: SupportedSQLDialectName) -> exp.Expression:
    # SQLGlot folds quoted `"char"` to CHAR (bpchar). PostgreSQL's `"char"` is
    # a 1-byte type; CAST(65 AS "char") is 'A' and CAST(65 AS CHAR) is '6'.
    if dialect == "postgresql" and _QUOTED_CHAR_TYPE.search(sql):
        raise AnalyticsSqlError(
            code=ErrorCode.UNSUPPORTED_SYNTAX,
            message=(
                'CAST to quoted `"char"` is not supported: this parser folds it '
                'to CHAR, which is bpchar, not PostgreSQL\'s 1-byte `"char"` '
                "type. Cast to TEXT or CHAR if that is what you mean."
            ),
        )
    try:
        statements = parse(sql, read=sqlglot_read_dialect(dialect))
    except ParseError as exc:
        recovered = _recover_grouping_limit_parse(sql, dialect=dialect)
        if recovered is None:
            raise admission_error_from_outcome(
                "parse_error",
                str(exc),
                message=_grouping_limit_parse_message(sql) or "",
            ) from exc
        return _finish_parse(recovered, dialect=dialect)
    except SqlglotError as exc:
        # TokenError (unterminated comment, etc.) is not a ParseError. Left
        # uncaught it escapes the error envelope as a tool crash.
        raise admission_error_from_outcome(
            "parse_error",
            str(exc),
            message="SQL could not be parsed. Check quotes, comments, and punctuation.",
        ) from exc
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
    return _finish_parse(root, dialect=dialect)


def _finish_parse(root: Optional[exp.Expr], *, dialect: SupportedSQLDialectName) -> exp.Expression:
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
    repaired = _repair_jsonb_extract_array_bracket(root)
    repaired = _repair_lambda_json_accessor(repaired, dialect=dialect)
    repaired = _promote_lateral_table_references(repaired, dialect=dialect)
    repaired = _repair_row_constructor(repaired, dialect=dialect)
    repaired = _repair_jsonb_typeof_text_extract(repaired, dialect=dialect)
    repaired = _rewrite_sqlite_named_from_aliases(repaired, dialect=dialect)
    repaired = _rewrite_sqlite_json_each_paths(repaired, dialect=dialect)
    repaired = _strip_sqlite_index_hints(repaired, dialect=dialect)
    repaired = _rewrite_sqlite_interval_arithmetic(repaired, dialect=dialect)
    repaired = _rewrite_sqlite_ilike(repaired, dialect=dialect)
    return _fold_unquoted_identifiers(repaired, dialect=dialect)


def _grouping_limit_parse_message(sql: str) -> Optional[str]:
    """Actionable copy when SQLGlot cannot parse GROUPING SETS/ROLLUP/CUBE with LIMIT.

    PostgreSQL accepts ``GROUP BY GROUPING SETS (...) LIMIT n``. SQLGlot's
    postgres parser does not; ``FETCH FIRST n ROWS ONLY`` and wrapping the
    aggregation in a subquery both parse. The generic parse error names a
    token the caller cannot act on.
    """
    folded = sql.casefold()
    if "limit" not in folded and "offset" not in folded:
        return None
    if (
        "grouping sets" not in folded
        and not re.search(r"rollup\s*\(", folded)
        and not re.search(r"cube\s*\(", folded)
    ):
        return None
    return (
        "GROUP BY GROUPING SETS, ROLLUP, or CUBE cannot be combined with LIMIT or "
        "OFFSET in this parser. Wrap the aggregation in a subquery and LIMIT the "
        "outer SELECT, or write FETCH FIRST n ROWS ONLY."
    )


_TRAILING_LIMIT_OFFSET = re.compile(
    r"^(?P<head>.*?)(?:\s+LIMIT\s+(?P<limit>\d+)(?:\s+OFFSET\s+(?P<offset>\d+))?"
    r"|\s+OFFSET\s+(?P<offset_only>\d+))\s*;?\s*$",
    re.IGNORECASE | re.DOTALL,
)


def _split_trailing_limit_offset(sql: str) -> Optional[tuple[str, Optional[int], Optional[int]]]:
    """Peel a trailing LIMIT/OFFSET the postgres parser cannot attach to GROUPING SETS."""
    match = _TRAILING_LIMIT_OFFSET.match(sql.strip())
    if match is None:
        return None
    head = match.group("head").strip()
    if not head:
        return None
    if match.group("offset_only") is not None:
        return head, None, int(match.group("offset_only"))
    offset = match.group("offset")
    return head, int(match.group("limit")), int(offset) if offset is not None else None


def _recover_grouping_limit_parse(
    sql: str, *, dialect: SupportedSQLDialectName
) -> Optional[exp.Expression]:
    """Reattach LIMIT/OFFSET that SQLGlot rejects after GROUPING SETS/ROLLUP/CUBE.

    PostgreSQL accepts the combination. The parser does not. Peeling the
    trailing clause, parsing the rest, and putting Limit/Offset back preserves
    the statement the caller wrote rather than refusing a query the engine
    would run.
    """
    if _grouping_limit_parse_message(sql) is None:
        return None
    split = _split_trailing_limit_offset(sql)
    if split is None:
        return None
    head, limit, offset = split
    try:
        statements = parse(head, read=sqlglot_read_dialect(dialect))
    except ParseError:
        return None
    statements = [
        statement
        for statement in statements
        if statement is not None and not isinstance(statement, exp.Semicolon)
    ]
    if len(statements) != 1:
        return None
    root = statements[0]
    if root is None or not isinstance(root, ALLOWED_ROOTS):
        return None
    if limit is not None:
        root.set("limit", exp.Limit(expression=exp.Literal.number(limit)))
    if offset is not None:
        root.set("offset", exp.Offset(expression=exp.Literal.number(offset)))
    return root


def _is_bare_array_name(expression: Optional[exp.Expression]) -> bool:
    """Whether this is the unquoted identifier SQLGlot leaves when it misparses ARRAY[...]."""
    if not isinstance(expression, exp.Column) or expression.table:
        return False
    identifier = expression.this
    if isinstance(identifier, exp.Identifier) and identifier.args.get("quoted"):
        return False
    return (expression.name or "").casefold() == "array"


def _repair_jsonb_extract_array_bracket(root: exp.Expression) -> exp.Expression:
    """Rebuild ``doc #> ARRAY['a','b']`` from SQLGlot's Bracket misparse.

    SQLGlot parses that spelling as subscripting ``JSONB_EXTRACT(doc, ARRAY)``
    with the array elements as keys, so admission saw a Bracket (not in the
    grammar) while ``doc #> '{a,b}'`` and ``doc #- ARRAY['a','b']`` both
    admitted. Postgres treats the two path spellings as equivalent.
    """
    for bracket in list(root.find_all(exp.Bracket)):
        extract = bracket.this
        if not isinstance(extract, (exp.JSONBExtract, exp.JSONBExtractScalar)):
            continue
        if not _is_bare_array_name(extract.expression):
            continue
        elements = bracket.expressions
        if not elements:
            continue
        rebuilt = type(extract)(
            this=extract.this.copy(),
            expression=exp.Array(expressions=[item.copy() for item in elements]),
        )
        bracket.replace(rebuilt)
    return root


def _json_extract_node(
    document: exp.Expression,
    expression: exp.Expression,
    *,
    dialect: SupportedSQLDialectName,
) -> exp.Expression:
    # `only_json_types` is how the generator distinguishes `->` from
    # `json_extract`. Omitting it on SQLite made the later canonicaliser
    # rewrite an in-call arrow to `json_extract`, which is a different
    # accessor (SQL value vs JSON text) and quoted a path literal as one key.
    _ = dialect
    return exp.JSONExtract(this=document, expression=expression, only_json_types=True)


def _lambda_parameter_document(parameter: exp.Expression) -> Optional[exp.Expression]:
    if isinstance(parameter, exp.Column):
        return parameter.copy()
    if isinstance(parameter, exp.Identifier):
        return exp.Column(this=parameter.copy())
    return None


def _json_path_from_string(text: str) -> exp.JSONPath:
    """A JSON path for a ``->`` key or a ``$.a.b`` path literal.

    A lambda body is a bare string, so ``'$.a.b'`` used to become one key
    named ``$.a.b``. SQLite then looks up that name and answers NULL.
    Asking the parser how it reads the same literal as a bare accessor
    reuses the split it already gets right outside a call.
    """
    try:
        probe = parse_one(f"SELECT _ -> {exp.Literal.string(text).sql()}", read="sqlite")
    except SqlglotError:
        probe = None
    extract = next(iter(probe.find_all(exp.JSONExtract)), None) if probe is not None else None
    path = extract.expression if extract is not None else None
    if isinstance(path, exp.JSONPath) and path.expressions:
        return path.copy()
    return exp.JSONPath(expressions=[exp.JSONPathRoot(), exp.JSONPathKey(this=text)])


def _rebuild_lambda_json_body(
    document: exp.Expression, body: exp.Expression, *, dialect: SupportedSQLDialectName
) -> Optional[exp.Expression]:
    """Rebuild ``doc -> k1 -> k2`` from a Lambda whose body is a JSONExtract chain.

    One hop parses as ``Lambda(Literal 'k', [doc])``. Two or more hops parse as
    ``Lambda(JSONExtract('k1', path_rest), [doc])``, nested for each extra key.
    """
    if isinstance(body, exp.Paren):
        return _rebuild_lambda_json_body(document, body.this, dialect=dialect)
    if isinstance(body, exp.Literal):
        if body.is_string:
            path: exp.Expression = _json_path_from_string(body.this)
        else:
            try:
                index = int(body.this)
            except (TypeError, ValueError):
                return None
            path = exp.JSONPath(expressions=[exp.JSONPathRoot(), exp.JSONPathSubscript(this=index)])
        return _json_extract_node(document, path, dialect=dialect)
    if isinstance(body, (exp.Column, exp.Identifier)):
        key = body.copy() if isinstance(body, exp.Column) else exp.Column(this=body.copy())
        return _json_extract_node(document, key, dialect=dialect)
    if not isinstance(body, exp.JSONExtract):
        return None
    inner = body.this
    if isinstance(inner, exp.Literal) and inner.is_string:
        first = _json_extract_node(
            document,
            _json_path_from_string(inner.this),
            dialect=dialect,
        )
        return _json_extract_node(first, body.expression.copy(), dialect=dialect)
    if isinstance(inner, exp.JSONExtract):
        rebuilt_inner = _rebuild_lambda_json_body(document, inner, dialect=dialect)
        if rebuilt_inner is None:
            return None
        return _json_extract_node(rebuilt_inner, body.expression.copy(), dialect=dialect)
    return None


def _repair_lambda_json_accessor(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Rebuild ``col -> 'k'`` inside a call, which SQLGlot parses as a lambda.

    ``jsonb_typeof(attributes -> 'llm')`` is a JSON accessor the engines
    execute once parenthesised. The parser reads the arrow as ``x -> body``
    instead, so admission used to refuse it and name ``->>`` / ``json_extract``,
    neither of which is valid input to ``jsonb_typeof``. Reconstructing the
    accessor is the same request the caller wrote.

    The reconstructed node is the operator on both backends, matching a bare
    ``->`` outside a call. SQLite's ``->`` returns JSON text; ``json_extract``
    and ``->>`` return the SQL value. Rebuilding as the function used to
    change that answer inside MIN/MAX.
    """
    # Innermost first: a three-hop chain nests JSONExtract inside JSONExtract.
    for node in reversed(list(root.find_all(exp.Lambda))):
        parameters = node.expressions
        if len(parameters) != 1:
            continue
        document = _lambda_parameter_document(parameters[0])
        if document is None:
            continue
        rebuilt = _rebuild_lambda_json_body(document, node.this, dialect=dialect)
        if rebuilt is None:
            continue
        node.replace(exp.paren(rebuilt))
    return root


def _is_json_each_call(node: exp.Expression) -> bool:
    """Whether this node is ``json_each(...)``, possibly wrapped in a Table."""
    target = node.this if isinstance(node, exp.Table) else node
    return isinstance(target, exp.Anonymous) and (target.name or "").casefold() == "json_each"


def _promote_lateral_table_references(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Turn ``LATERAL traces t`` into a plain table join.

    SQLGlot stores the relation as an Identifier inside Lateral and emits
    ``LATERAL traces AS t`` or ``LATERAL schema.traces AS t``. PostgreSQL
    rejects that ``AS``: LATERAL is for subqueries and set-returning
    functions, not base tables. A LATERAL table join is the same request as
    an ordinary join, which schema qualification already knows how to emit.

    SQLite has no LATERAL. ``json_each`` does not need it -- a table-valued
    function there may refer to earlier FROM items -- so ``LATERAL json_each``
    is the same request as a plain ``json_each``. Remaining LATERAL nodes
    (subqueries, other SRFs) are refused at admission.
    """
    for lateral in list(root.find_all(exp.Lateral)):
        inner = lateral.this
        if isinstance(inner, exp.Identifier):
            table = exp.Table(this=inner.copy())
        elif isinstance(inner, exp.Table):
            table = inner.copy()
        elif dialect == "sqlite" and _is_json_each_call(inner):
            table = inner.copy() if isinstance(inner, exp.Table) else exp.Table(this=inner.copy())
        else:
            continue
        alias = lateral.args.get("alias")
        if isinstance(alias, exp.TableAlias) and table.args.get("alias") is None:
            table.set("alias", alias.copy())
        lateral.replace(table)
    return root


def _table_alias_column_names(alias: Optional[exp.Expression]) -> list[str]:
    if not isinstance(alias, exp.TableAlias):
        return []
    names: list[str] = []
    for identifier in alias.args.get("columns") or []:
        if isinstance(identifier, exp.Identifier) and identifier.name:
            names.append(identifier.name)
    return names


def _clear_table_alias_columns(alias: Optional[exp.Expression]) -> None:
    if isinstance(alias, exp.TableAlias) and alias.args.get("columns"):
        alias.set("columns", None)


def _select_has_star(select: exp.Select) -> bool:
    return any(
        isinstance(item, exp.Star)
        or (isinstance(item, exp.Column) and isinstance(item.this, exp.Star))
        for item in select.expressions
    )


def _apply_select_output_names(select: exp.Select, names: list[str]) -> bool:
    """Rename the projections. False when the list does not match the width."""
    if _select_has_star(select) or not select.expressions:
        return False
    expressions = list(select.expressions)
    if len(names) > len(expressions):
        return False
    folded = [name.casefold() for name in names]
    if len(folded) != len(set(folded)):
        return False
    for index, name in enumerate(names):
        expressions[index] = exp.alias_(expressions[index], name)
    select.set("expressions", expressions)
    return True


def _values_as_named_select(values: exp.Values, names: list[str]) -> Optional[exp.Expression]:
    """``VALUES (1, 2) AS v(a, b)`` as ``SELECT 1 AS a, 2 AS b``, or None if it cannot."""
    rows = values.expressions
    if not rows or not names:
        return None
    selects: list[exp.Select] = []
    for row_index, row in enumerate(rows):
        cells = list(row.expressions) if isinstance(row, exp.Tuple) else [row]
        if len(cells) != len(names):
            return None
        projections: list[exp.Expr] = []
        for column_index, name in enumerate(names):
            cell = cells[column_index].copy()
            if row_index == 0:
                projections.append(exp.alias_(cell, name))
            else:
                projections.append(cell)
        selects.append(exp.Select().select(*projections))
    combined: exp.Expression = selects[0]
    for extra in selects[1:]:
        combined = exp.Union(this=combined, expression=extra, distinct=False)
    return combined


def _rewrite_sqlite_named_from_aliases(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Lift ``AS t(a, b)`` onto the inner projection so SQLite can render it.

    The SQLite generator refuses named columns on a table alias. PostgreSQL
    accepts the spelling, and the names are what the caller asked to select.
    Pushing them into the inner SELECT (or rewriting VALUES as one) keeps the
    query rather than admitting it and failing at render.
    """
    if dialect != "sqlite":
        return root
    for subquery in list(root.find_all(exp.Subquery)):
        alias = subquery.args.get("alias")
        names = _table_alias_column_names(alias)
        if not names:
            continue
        inner = subquery.this
        if isinstance(inner, exp.Select) and _apply_select_output_names(inner, names):
            _clear_table_alias_columns(alias)
        elif isinstance(inner, exp.Values):
            replacement = _values_as_named_select(inner, names)
            if replacement is not None:
                subquery.set("this", replacement)
                _clear_table_alias_columns(alias)
    for values in list(root.find_all(exp.Values)):
        alias = values.args.get("alias")
        names = _table_alias_column_names(alias)
        if not names:
            continue
        replacement = _values_as_named_select(values, names)
        if replacement is None:
            continue
        relation_name = (
            alias.this.copy() if isinstance(alias, exp.TableAlias) and alias.this else None
        )
        values.replace(
            exp.Subquery(
                this=replacement,
                alias=exp.TableAlias(this=relation_name) if relation_name is not None else None,
            )
        )
    for table in list(root.find_all(exp.Table)):
        if not _is_json_each_call(table):
            continue
        alias = table.args.get("alias")
        names = _table_alias_column_names(alias)
        if not names:
            continue
        offered = list(_JSON_EACH_COLUMNS)
        if len(names) > len(offered):
            continue
        # Keep json_each in the same FROM as the tables it reads. Wrapping it
        # in a subquery would drop correlation (`json_each(attributes)` can
        # no longer see `spans.attributes`). SQLite cannot render the column
        # list, so map t.k → t.key and drop the list.
        rename = {
            _identifier_key(names[index], quoted=False, dialect=dialect): offered[index]
            for index in range(len(names))
        }
        original_names = {
            _identifier_key(names[index], quoted=False, dialect=dialect): names[index]
            for index in range(len(names))
        }
        relation_keys = _relation_identifier_keys(table, dialect=dialect)
        select = table.find_ancestor(exp.Select)
        if select is not None:
            _rename_json_each_alias_columns(
                select,
                rename=rename,
                original_names=original_names,
                relation_keys=relation_keys,
                dialect=dialect,
            )
        table.args["phoenix_tvf_aliases"] = names
        _clear_table_alias_columns(alias)
    return root


def _rename_json_each_alias_columns(
    select: exp.Select,
    *,
    rename: dict[str, str],
    original_names: dict[str, str],
    relation_keys: frozenset[str],
    dialect: SupportedSQLDialectName,
) -> None:
    """Rewrite ``k`` / ``t.k`` from ``json_each(...) AS t(k, v)`` to ``key`` / ``t.key``."""
    rewritten: dict[int, str] = {}
    for column in list(select.find_all(exp.Column)):
        owner = column.find_ancestor(exp.Select)
        if owner is not select:
            continue
        quoted = isinstance(column.this, exp.Identifier) and bool(column.this.args.get("quoted"))
        column_key = _identifier_key(column.name or "", quoted=quoted, dialect=dialect)
        physical = rename.get(column_key)
        if physical is None:
            continue
        if column.table:
            qualifier_key = _column_qualifier_key(column, dialect=dialect)
            if qualifier_key not in relation_keys:
                continue
        column.set("this", exp.to_identifier(physical))
        rewritten[id(column)] = original_names[column_key]
    if not rewritten:
        return
    expressions = list(select.expressions)
    changed = False
    for index, item in enumerate(expressions):
        if isinstance(item, exp.Alias) or id(item) not in rewritten:
            continue
        output_name = rewritten[id(item)]
        if output_name == (item.name or ""):
            continue
        expressions[index] = exp.alias_(item, output_name)
        changed = True
    if changed:
        select.set("expressions", expressions)


def _rewrite_sqlite_json_each_paths(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """``json_each(doc, 'session')`` is a bad path; arrows already get ``$.session``."""
    if dialect != "sqlite":
        return root
    for node in root.find_all(exp.Anonymous):
        if (node.name or "").casefold() != "json_each":
            continue
        arguments = list(node.expressions)
        if len(arguments) < 2:
            continue
        path = arguments[1]
        if not isinstance(path, exp.Literal) or not path.is_string:
            continue
        text = str(path.this)
        if not text or text.startswith("$"):
            continue
        path.set("this", "$." + text)
    return root


def _strip_sqlite_index_hints(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Drop INDEXED BY / NOT INDEXED. They are hints, not part of the question."""
    if dialect != "sqlite":
        return root
    for table in root.find_all(exp.Table):
        if "indexed" in table.args:
            table.args.pop("indexed", None)
    return root


_SQLITE_INTERVAL_UNITS = {
    "second": "seconds",
    "seconds": "seconds",
    "minute": "minutes",
    "minutes": "minutes",
    "hour": "hours",
    "hours": "hours",
    "day": "days",
    "days": "days",
    "week": "days",
    "weeks": "days",
    "month": "months",
    "months": "months",
    "year": "years",
    "years": "years",
}


def _sqlite_interval_modifier(interval: exp.Interval, *, negate: bool) -> Optional[str]:
    """SQLite date-modifier spelling for an INTERVAL, or None if it cannot be mapped."""
    unit = interval.args.get("unit")
    unit_name = (unit.name if isinstance(unit, exp.Expression) else "") or ""
    sqlite_unit = _SQLITE_INTERVAL_UNITS.get(unit_name.casefold())
    if sqlite_unit is None:
        return None
    raw = interval.this
    count_text = raw.this if isinstance(raw, exp.Literal) else None
    if count_text is None:
        return None
    try:
        count: float | int = float(count_text) if "." in str(count_text) else int(count_text)
    except (TypeError, ValueError):
        return None
    if unit_name.casefold() in {"week", "weeks"}:
        count = count * 7
    if negate:
        count = -count
    sign = "+" if count >= 0 else ""
    return f"{sign}{count} {sqlite_unit}"


def _rewrite_sqlite_interval_arithmetic(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """``start_time + INTERVAL '1 day'`` as ``datetime(start_time, '+1 days')``.

    SQLite has no interval type. The generator still emits ``INTERVAL '1' DAY``,
    which is a syntax error at the engine after admission. The date-modifier
    form is the same request.
    """
    if dialect != "sqlite":
        return root
    for node in list(root.find_all(exp.Add, exp.Sub)):
        left, right = node.this, node.expression
        if isinstance(right, exp.Interval) and not isinstance(left, exp.Interval):
            modifier = _sqlite_interval_modifier(right, negate=isinstance(node, exp.Sub))
            if modifier is None or left is None:
                continue
            node.replace(
                exp.Anonymous(
                    this="datetime",
                    expressions=[left.copy(), exp.Literal.string(modifier)],
                )
            )
        elif (
            isinstance(left, exp.Interval)
            and not isinstance(right, exp.Interval)
            and isinstance(node, exp.Add)
            and right is not None
        ):
            modifier = _sqlite_interval_modifier(left, negate=False)
            if modifier is None:
                continue
            node.replace(
                exp.Anonymous(
                    this="datetime",
                    expressions=[right.copy(), exp.Literal.string(modifier)],
                )
            )
    return root


def _rewrite_sqlite_ilike(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """SQLite has no ILIKE. ``lower(x) LIKE lower(y)`` is the same request."""
    if dialect != "sqlite":
        return root
    for node in list(root.find_all(exp.ILike)):
        left = node.this
        right = node.expression
        if left is None or right is None:
            continue
        like = exp.Like(this=exp.Lower(this=left.copy()), expression=exp.Lower(this=right.copy()))
        escape = node.args.get("escape")
        if escape is not None:
            like.set("escape", escape.copy())
        if node.args.get("negate"):
            like.set("negate", True)
        node.replace(like)
    return root


def _repair_row_constructor(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Rebuild ``ROW(a, b)`` as a tuple, which ``(a, b)`` already is.

    PostgreSQL treats the two spellings as the same constructor. The parser
    models the keyword form as ``Anonymous``, so admission refused ``ROW``
    while admitting the parenthesised form and serialising it as a JSON array.
    """
    for node in reversed(list(root.find_all(exp.Anonymous))):
        if (node.name or "").casefold() != "row":
            continue
        items = [item.copy() for item in node.expressions]
        # A one-element Tuple renders as `(1)`, which PostgreSQL treats as a
        # scalar, not a row. Leave ROW(1) as the keyword form.
        if len(items) == 1:
            continue
        node.replace(exp.Tuple(expressions=items))
    if dialect != "postgresql":
        return root
    # `(1,)` is a one-field row. A one-element Tuple renders as `(1)`, a
    # scalar. ROW(1) is the spelling PostgreSQL still treats as a record.
    # VALUES (1) is a one-column row, not a record constructor — leave it.
    for tuple_node in list(root.find_all(exp.Tuple)):
        items = list(tuple_node.expressions)
        if len(items) != 1:
            continue
        if tuple_node.find_ancestor(exp.Values) is not None:
            continue
        if isinstance(tuple_node.parent, (exp.GroupingSets, exp.Cube, exp.Rollup, exp.Group)):
            continue
        tuple_node.replace(exp.Anonymous(this="row", expressions=[items[0].copy()]))
    return root


def _repair_jsonb_typeof_text_extract(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> exp.Expression:
    """Ask ``jsonb_typeof`` about jsonb, not about the text ``->>`` returns.

    ``jsonb_typeof(attributes ->> 'k')`` is the type of a JSON value, written
    with the text extractor. PostgreSQL has no ``jsonb_typeof(text)``. The
    jsonb extractor ``->`` is the same key and the function's real input.
    """
    if dialect != "postgresql":
        return root
    for node in root.find_all(exp.Anonymous):
        if (node.name or "").casefold() not in {"jsonb_typeof", "json_typeof"}:
            continue
        if len(node.expressions) != 1:
            continue
        operand = _strip_parens(node.expressions[0])
        if not isinstance(operand, exp.JSONExtractScalar):
            continue
        rebuilt = exp.JSONExtract(
            this=operand.this.copy(),
            expression=operand.expression.copy(),
        )
        rebuilt.set("only_json_types", True)
        node.set("expressions", [exp.paren(rebuilt)])
    return root


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
# policy's walk never sees them. Lambda is the one that matters for a real
# anonymous function (`x -> x > 0`). A JSON accessor written in the same
# place (`attributes -> 'k'`) is rebuilt in `_repair_lambda_json_accessor`
# before this check runs; what remains here is an actual lambda.
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
        "Anonymous functions (`x -> ...`) are not supported. A JSON accessor "
        "inside a call must be parenthesised, for example "
        "`jsonb_typeof((attributes -> 'k'))`."
    ),
    exp.AtTimeZone: (
        "AT TIME ZONE is not supported. Timestamp columns are stored in UTC; "
        "compare them with an offset-bearing literal, for example "
        "`start_time >= '2026-07-01T14:30:00Z'`."
    ),
    exp.Qualify: (
        "QUALIFY is not supported. PostgreSQL has no QUALIFY clause; filter a "
        "subquery that already computed the window, for example "
        "`SELECT id, rn FROM (SELECT id, ROW_NUMBER() OVER (...) AS rn FROM ...) t "
        "WHERE rn = 1`."
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
    passthrough = _timestamp_passthrough_references(root, columns)

    def offender(
        column: Optional[exp.Expression], operand: Optional[exp.Expression]
    ) -> Optional[str]:
        if not isinstance(column, exp.Column):
            return None
        if id(column) not in passthrough and (column.name or "").casefold() not in columns:
            return None
        if local.is_local(column) and id(column) not in passthrough:
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


def _alias_column_count(alias: Optional[exp.Expression]) -> int:
    if not isinstance(alias, exp.TableAlias):
        return 0
    return len(alias.args.get("columns") or [])


def _values_width(values: exp.Values) -> int:
    rows = values.expressions
    if not rows:
        return 0
    first = rows[0]
    if isinstance(first, exp.Tuple):
        return len(first.expressions)
    return 1


def _select_width(select: exp.Select) -> Optional[int]:
    """Known projection width, or None when a star makes it unknowable."""
    expressions = select.expressions
    if not expressions:
        return 0
    if any(
        isinstance(item, exp.Star)
        or (isinstance(item, exp.Column) and isinstance(item.this, exp.Star))
        for item in expressions
    ):
        from_expr = select.args.get("from_") or select.args.get("from")
        source = from_expr.this if isinstance(from_expr, exp.From) else None
        if isinstance(source, exp.Values):
            return _values_width(source)
        if isinstance(source, exp.Subquery) and isinstance(source.this, exp.Values):
            return _values_width(source.this)
        return None
    return len(expressions)


def _relation_width(expression: Optional[exp.Expression]) -> Optional[int]:
    if isinstance(expression, exp.Select):
        return _select_width(expression)
    if isinstance(expression, exp.Values):
        return _values_width(expression)
    if isinstance(expression, exp.Subquery):
        return _relation_width(expression.this)
    return None


def set_operation_width_mismatch(root: exp.Expression) -> Optional[str]:
    """Message when UNION/EXCEPT/INTERSECT sides have known, unequal widths."""
    for set_operation in root.find_all(exp.Union, exp.Intersect, exp.Except):
        left_width = _relation_width(set_operation.this)
        right_width = _relation_width(set_operation.expression)
        if left_width is None or right_width is None or left_width == right_width:
            continue
        kind = type(set_operation).__name__.upper()
        return (
            f"{kind} needs the same number of columns on both sides "
            f"({left_width} and {right_width}). Put matching columns in the same order."
        )
    return None


def _too_many_alias_columns(
    alias: Optional[exp.Expression],
    available: Optional[int],
    *,
    dialect: SupportedSQLDialectName,
) -> Optional[AdmissionResult]:
    declared = _alias_column_count(alias)
    if declared == 0:
        return None
    names: list[str] = []
    if isinstance(alias, exp.TableAlias):
        for identifier in alias.args.get("columns") or []:
            name = identifier.name if isinstance(identifier, exp.Identifier) else ""
            if name:
                names.append(name.casefold())
    if len(names) != len(set(names)):
        return AdmissionResult(
            AdmissionOutcome.UNSUPPORTED_SYNTAX,
            "Duplicate names in a column list are not supported. Give each column its own name.",
        )
    if available is None or declared == available:
        return None
    if declared < available:
        if dialect != "sqlite":
            return None
        return AdmissionResult(
            AdmissionOutcome.UNSUPPORTED_SYNTAX,
            f"The alias names {declared} columns but the query produces {available}. "
            "Name every column, or drop the list.",
        )
    return AdmissionResult(
        AdmissionOutcome.UNSUPPORTED_SYNTAX,
        f"The alias names {declared} columns but the query produces {available}. "
        "Remove the extra names, or project that many columns.",
    )


def _check_alias_column_list_arity(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> Optional[AdmissionResult]:
    """Refuse a column list that does not match the relation it names.

    Too many admits then fails. Too few is engine-authored on PostgreSQL
    (extra columns keep their names) and a SQLite error (`table x has 2
    values for 1 columns`), so SQLite requires an exact match.
    """
    for cte in root.find_all(exp.CTE):
        refused = _too_many_alias_columns(
            cte.args.get("alias"), _relation_width(cte.this), dialect=dialect
        )
        if refused is not None:
            return refused
    for subquery in root.find_all(exp.Subquery):
        refused = _too_many_alias_columns(
            subquery.args.get("alias"), _relation_width(subquery.this), dialect=dialect
        )
        if refused is not None:
            return refused
    for values in root.find_all(exp.Values):
        refused = _too_many_alias_columns(
            values.args.get("alias"), _values_width(values), dialect=dialect
        )
        if refused is not None:
            return refused
    return None


def _check_lossy_shapes(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> Optional[AdmissionResult]:
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
        if options.args.get("percent"):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "`PERCENT` is not supported: it is dropped when the statement is "
                "prepared, which silently turns a fraction of the rows into that "
                "many rows. Write an explicit row count instead.",
            )
    for select in root.find_all(exp.Select):
        # PostgreSQL accepts an empty select list. SQLAlchemy will not stream
        # a zero-column cursor, so execution used to fail with "does not
        # return rows" after EXPLAIN had already succeeded.
        if not select.expressions:
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "An empty SELECT list is not supported. Name the columns you want.",
            )
    for group in root.find_all(exp.Group):
        # DuckDB/Spark spelling. PostgreSQL and SQLite reject ALL as a grouping
        # token, and injecting LIMIT after it makes the syntax error worse.
        if group.args.get("all") is True:
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "`GROUP BY ALL` is not supported. Name the grouping columns.",
            )
    for node in root.find_all(exp.Rollup, exp.Cube):
        if not node.expressions:
            kind = "ROLLUP" if isinstance(node, exp.Rollup) else "CUBE"
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                f"`{kind}()` with no grouping columns is not supported. Name "
                "the columns, or write GROUPING SETS (()).",
            )
    for window in root.find_all(exp.Window):
        # PostgreSQL: "DISTINCT is not implemented for window functions".
        # COUNT(DISTINCT x) without OVER is fine; the same aggregate with a
        # window admits then fails.
        target = window.this
        core = target.this if isinstance(target, exp.Filter) else target
        if core is not None and core.find(exp.Distinct) is not None:
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "DISTINCT is not implemented for window functions. Compute the "
                "distinct aggregate in a subquery, then apply the window to that "
                "result.",
            )
        if isinstance(target, exp.Filter) and isinstance(
            core,
            (
                exp.RowNumber,
                exp.Rank,
                exp.DenseRank,
                exp.PercentRank,
                exp.CumeDist,
                exp.Ntile,
            ),
        ):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "FILTER is not implemented for ranking window functions. Filter "
                "in a subquery, or use CASE inside an aggregate.",
            )
        if isinstance(target, exp.WithinGroup) or (
            core is not None and core.find(exp.WithinGroup) is not None
        ):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "OVER is not supported for ordered-set aggregates. Omit the window "
                "and write PERCENTILE_CONT(...) WITHIN GROUP (ORDER BY ...) as a "
                "plain aggregate.",
            )
    for join in root.find_all(exp.Join):
        # An empty USING list is dropped before it reaches the engine, which
        # turns the join into a cartesian product. PostgreSQL would reject
        # `USING ()` at a parenthesis.
        if "using" in join.args and not _join_using_identifiers(join):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "`USING ()` is not a join. Name the join columns with USING or ON.",
            )
    for table in root.find_all(exp.Table):
        alias = table.args.get("alias")
        if isinstance(alias, exp.TableAlias) and alias.args.get("columns"):
            # Function scans (`jsonb_each(...) AS t(k, v)`) are the PostgreSQL
            # spelling for naming SRF columns. Only a physical table's alias
            # list is the broken form.
            if isinstance(table.this, exp.Func):
                continue
            # `FROM spans AS t(x)` does not rename physical columns. SELECT x
            # is then refused as spans.x; SELECT * / SELECT id fail as missing
            # t.id. The working spelling is a subquery column list.
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "A column list on a base-table alias (`FROM spans AS t(col, ...)`) "
                "is not supported. Name the table's columns, or wrap it in a "
                "subquery: `FROM (SELECT id FROM spans) AS t(id)`.",
            )
    for node in root.find_all(exp.Tuple, exp.Values):
        if isinstance(node, exp.Values):
            rows = node.expressions
            if rows and all(isinstance(row, exp.Tuple) and not row.expressions for row in rows):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "An empty VALUES row is not supported. Write at least one column.",
                )
        elif not node.expressions:
            # `GROUPING SETS ((), (col))` and `GROUP BY ()` are the grand-total
            # grouping set. Empty ROW() in a projection is the broken form.
            if isinstance(node.parent, (exp.GroupingSets, exp.Cube, exp.Rollup, exp.Group)):
                continue
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "An empty ROW() is not supported. Write at least one column.",
            )
    arity = _check_alias_column_list_arity(root, dialect=dialect)
    if arity is not None:
        return arity
    for set_operation in root.find_all(exp.Union, exp.Intersect, exp.Except):
        # DuckDB/Spark spelling. SQLGlot stores it as `by_name` and renders
        # `UNION BY NAME` / `INNER UNION BY NAME`, which PostgreSQL and SQLite
        # reject at a token the caller never wrote.
        if set_operation.args.get("by_name"):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "`UNION BY NAME` and `CORRESPONDING` are not supported. Put "
                "matching columns in the same order on both sides.",
            )
    mismatch = set_operation_width_mismatch(root)
    if mismatch is not None:
        return AdmissionResult(AdmissionOutcome.UNSUPPORTED_SYNTAX, mismatch)
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


_QUANTIFIER_NAMES = frozenset({"all", "any", "some"})


def _check_dialect_specific_syntax(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> Optional[AdmissionResult]:
    """Refuse syntax the selected backend cannot execute.

    SQLGlot parses grouping extensions for SQLite even though SQLite has no
    implementation. Letting them through makes a valid-looking query fail only
    after the executor has opened a connection and rewritten it; admission is
    where a caller can still receive a precise, backend-specific correction.
    """
    if dialect != "sqlite":
        return None
    for node in root.walk():
        if isinstance(node, (exp.Rollup, exp.Cube, exp.GroupingSets)):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                f"{node.key.upper()} is not supported by SQLite. Use ordinary GROUP BY.",
            )
        if isinstance(node, exp.ILike):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "ILIKE could not be rewritten for SQLite. Write lower(...) LIKE lower(...).",
            )
        if isinstance(node, exp.SimilarTo):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "SIMILAR TO is not supported by SQLite. Use LIKE, or lower(...) LIKE "
                "lower(...) for case-insensitive matching.",
            )
        if isinstance(node, exp.Distinct) and node.args.get("on"):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "DISTINCT ON is not supported by SQLite. Filter with "
                "ROW_NUMBER() OVER (PARTITION BY ...) = 1, or run the statement "
                "on PostgreSQL.",
            )
        if _is_quantifier(node):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                f"{(node.name or node.key).upper()} is not supported by SQLite. "
                "Use IN (...) or a join.",
            )
        if isinstance(node, exp.Lateral):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "LATERAL is not supported by SQLite. Write a comma join, or "
                "correlate json_each in FROM without LATERAL.",
            )
        if isinstance(node, (exp.JSONBExtract, exp.JSONBExtractScalar)):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "`#>` and `#>>` are PostgreSQL JSONB operators. On SQLite write "
                "json_extract(doc, '$.a.b') or attributes ->> '$.a'.",
            )
        if (
            isinstance(node, exp.Anonymous)
            and (node.name or "").casefold() == "json_each"
            and not isinstance(node.parent, exp.Table)
        ):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "json_each is a table-valued function. Put it in FROM, for example "
                "`FROM spans, json_each(attributes)`.",
            )
        if isinstance(node, exp.Cast) and _cast_type_name(node.to) == "INTERVAL":
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "CAST to INTERVAL is not supported by SQLite. SQLite has no "
                "interval type, and the cast silently becomes a number. "
                "Subtract timestamps with unixepoch, or compare them as text.",
            )
        if isinstance(node, exp.Interval):
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "INTERVAL arithmetic is not supported by SQLite in this form. "
                "Use datetime(column, '+1 day'), or subtract unixepoch values.",
            )
        if isinstance(node, exp.TableAlias) and node.args.get("columns"):
            if isinstance(node.parent, exp.CTE):
                continue
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                "A column list on a FROM alias is not supported on SQLite. "
                "Alias the columns in the inner SELECT, or for VALUES write "
                "`SELECT 1 AS a, 2 AS b UNION ALL ...`.",
            )
    return None


_SQLITE_COLLATIONS = frozenset({"binary", "nocase", "rtrim"})


def _collation_name(node: exp.Collate) -> str:
    collation = node.expression
    if collation is None:
        return ""
    return collation.name or ""


def _check_collate(
    root: exp.Expression, *, dialect: SupportedSQLDialectName
) -> Optional[AdmissionResult]:
    """COLLATE is a clause, not a function. Admit the collations this engine has."""
    for node in root.find_all(exp.Collate):
        name = _collation_name(node)
        if dialect == "sqlite" and name.casefold() not in _SQLITE_COLLATIONS:
            spelling = name or "this collation"
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                f"COLLATE {spelling} is not a SQLite collation. Use BINARY, NOCASE, or RTRIM.",
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
    ILike JSONKeyValue JSONPath JSONPathKey JSONPathRoot JSONPathSubscript
    Join LT LTE Lateral Like Limit
    LimitOptions Literal Lock Mod Mul NEQ Neg Not Null NullSafeEQ NullSafeNEQ
    ObjectIdentifier Offset Order Ordered Paren Rollup Select Star Sub Subquery
    SimilarTo Table TableAlias Tuple Union Values Var Where Window WindowSpec With
    WithinGroup DataTypeParam
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


# WORKAROUND sqlglot<=30.15.0 -- remove when pin > 30.16.0
# Upstream: tobymao/sqlglot#8063 (closes #8035)
# https://github.com/tobymao/sqlglot/issues/8035
#
# `#>` and `#>>` take a `text[]` path, so a cast on their right operand is
# meaningful; `pg_get_indexdef` emits exactly that form for an expression index
# over a JSON path.
#
# Through 30.15.0 SQLGlot binds such a cast to the whole extraction, so
# `a #>> b::text[]` parses as `CAST(a #>> b AS TEXT[])`. A deliberate
# `CAST(a #>> b AS text[])` produces the identical tree and means something
# else: it parses the extracted string as an array literal, so
# `('{"tags":"{a,b}"}'::jsonb #>> '{tags}')::text[]` yields a two-element array.
#
# Nothing in the tree separates the two, so neither reading can be chosen on the
# caller's behalf, and the shape is refused with both unambiguous spellings
# named. A parenthesised operand is unambiguous and never reaches this test: it
# arrives under a `Paren` node.
#
# 30.16.0 binds the cast to the path. The two readings become distinct trees,
# and this refusal is then only hitting the deliberate CAST-of-extraction form.
_JSON_PATH_EXTRACTIONS = (exp.JSONBExtract, exp.JSONBExtractScalar)


def _is_ambiguous_path_cast(node: exp.Cast) -> bool:
    """True for a cast to an array type applied directly to a `#>`/`#>>` extraction."""
    if not isinstance(node.this, _JSON_PATH_EXTRACTIONS):
        return False
    return isinstance(node.to, exp.DataType) and bool(node.to.this == exp.DataType.Type.ARRAY)


def _cast_type_name(target: exp.Expression) -> str:
    """The SQL type a CAST names, including schema-qualified USERDEFINED forms.

    SQLGlot models `pg_catalog.varchar` as USERDEFINED wrapping a Dot. Reporting
    USERDEFINED tells the caller nothing; the leaf identifier is the type.
    """
    if isinstance(target, exp.DataType) and target.this == exp.DataType.Type.USERDEFINED:
        kind = target.args.get("kind")
        if isinstance(kind, exp.Dot):
            leaf = kind.expression
            if isinstance(leaf, exp.Identifier) and leaf.name:
                return _canonical_cast_type_name(leaf.name.upper())
        if isinstance(kind, exp.Identifier) and kind.name:
            return _canonical_cast_type_name(kind.name.upper())
    name = target.this.name if hasattr(target.this, "name") else str(target.this)
    return _canonical_cast_type_name(name.upper().split("(")[0].strip())


_CAST_TYPE_ALIASES = {
    "INT2": "SMALLINT",
    "INT4": "INT",
    "INT8": "BIGINT",
    "FLOAT4": "REAL",
    "FLOAT8": "DOUBLE",
    "BOOL": "BOOLEAN",
}


def _canonical_cast_type_name(name: str) -> str:
    """Map catalog aliases (int4, float8) to the allowlisted spelling."""
    return _CAST_TYPE_ALIASES.get(name, name)


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
    name = _cast_type_name(target)
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
    would change a comparison they authored. A SELECT subquery is outside for
    the same reason. `ANY(VALUES (...))` is a list of literals spelled as a
    quantifier, not a computed subquery, and is decided like `IN (VALUES ...)`.

    On SQLite that limit is a wrong answer rather than an error, because text
    comparison succeeds against the wrong spelling. It is the first place to
    look when a caller reports a timestamp predicate matching nothing.
    """
    if isinstance(node, _TIMESTAMP_COMPARISONS):
        pairs = [(node.this, node.expression), (node.expression, node.this)]
        for column, other in ((node.this, node.expression), (node.expression, node.this)):
            if _is_quantifier(other):
                # Bounded at the subquery edge: `= ANY(SELECT ...)` compares
                # against what the subquery returns, so a value written inside
                # it is beside that subquery's columns, not beside this one.
                # `= ANY(VALUES (...))` is a list; the parser wraps it in a
                # Subquery, which `_within_scope` would otherwise skip.
                pairs.extend(
                    (column, held)
                    for held in _quantifier_compared_values(other)
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


def _is_quantifier_call(node: Optional[exp.Expr]) -> bool:
    """Whether this node is ANY / ALL / SOME written as a function call.

    `ANY(ARRAY[...])` parses as `exp.Any`. `ALL(ARRAY[...])` and `SOME(...)`
    parse as `exp.Anonymous`, so the function allowlist would otherwise refuse
    them as unknown functions named all and some.
    """
    return isinstance(node, exp.Anonymous) and (node.name or "").casefold() in _QUANTIFIER_NAMES


def _is_quantifier(node: Optional[exp.Expr]) -> bool:
    """ANY / ALL / SOME, whether parsed as a node or as a function call."""
    return isinstance(node, (exp.Any, exp.All)) or _is_quantifier_call(node)


def _is_all_quantifier(node: exp.Expression) -> bool:
    """ALL as opposed to ANY / SOME. ``= ALL`` is conjunction; ``= ANY`` is membership."""
    return isinstance(node, exp.All) or (
        isinstance(node, exp.Anonymous) and (node.name or "").casefold() == "all"
    )


def _quantifier_list_container(quantifier: exp.Expression) -> Optional[exp.Expression]:
    """ARRAY or VALUES a quantifier holds, if that is a stated list rather than a subquery."""
    inner = (
        _strip_parens(quantifier.expressions[0])
        if isinstance(quantifier, exp.Anonymous) and quantifier.expressions
        else _strip_parens(quantifier.this)
    )
    if isinstance(inner, exp.Subquery):
        inner = _strip_parens(inner.this)
    if isinstance(inner, (exp.Values, exp.Array)):
        return inner
    return None


def _quantifier_compared_values(quantifier: exp.Expression) -> list[exp.Expression]:
    """Operands a = ANY / = ALL compares against in this scope.

    A SELECT subquery is computed and is skipped. VALUES, including when the
    parser wraps it in a Subquery, is a list of literals spelled as a
    quantifier. ARRAY is the same list in constructor form.
    """
    held = [node for node in _within_scope(quantifier, exp.Expression) if node is not quantifier]
    inner = _quantifier_list_container(quantifier)
    if inner is not None:
        held.extend(inner.expressions)
    return held


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
        if isinstance(node, exp.Column) and not _is_limit_all(node)
    ]


def _is_limit_all(column: exp.Column) -> bool:
    """Whether this node is the ALL keyword in LIMIT ALL, not a column named all."""
    ident = column.this
    if isinstance(ident, exp.Identifier) and ident.args.get("quoted"):
        return False
    parent = column.parent
    return (
        isinstance(parent, exp.Limit)
        and parent.expression is column
        and not column.table
        and (column.name or "").casefold() == "all"
    )


class Locality(Enum):
    """Why a reference is query-local, which decides who may act on it.

    The distinction is the kind of evidence, not its strength. The two
    ``DERIVED_`` categories are structural: the reference resolves into a
    relation the query itself builds. ``OUTPUT_ALIAS`` models where a name binds,
    and the rule differs by clause -- a bare ``ORDER BY`` key takes the select
    list before the input columns, while ``GROUP BY`` takes an input column when
    one carries the name and the alias only otherwise. SQLite extends the latter
    rule to ``HAVING``; PostgreSQL does not. This makes it a model of the engine
    rather than a fact about the tree, which is why disclosure checks decline it.

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

    Four ways a reference can be local, and the last two are why ``build_scope`` is
    necessary but not sufficient:

    1. Qualified, where the qualifier names a derived relation. Both a CTE's own
       name and the alias it is bound to in ``FROM`` resolve to it.
    2. Unqualified, where a derived relation in the same scope projects the name.
    3. Unqualified in ``ORDER BY``, where the select list aliases the name. Both
       engines resolve that against the output first, and ``build_scope`` does
       not report it as a source column at all, so it has to be walked
       separately.
    4. Unqualified in SQLite's ``HAVING``, where a select-list alias is used
       only when no input column has the name. PostgreSQL does not bind aliases
       there, so this case is deliberately dialect-specific.

    ``GROUP BY`` is deliberately absent as a separate case, and the two clauses
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
    quoted_derived_aliases: set[str] = set()
    # Names a CTE or subquery exposes via ``AS t(col, ...)``. Those do not
    # appear in the inner SELECT's ``named_selects``.
    derived_column_lists: dict[str, set[str]] = {}
    for relation in root.find_all(exp.CTE, exp.Subquery):
        alias_expression = relation.args.get("alias")
        if not isinstance(alias_expression, exp.TableAlias):
            continue
        alias = relation.alias
        if not alias:
            continue
        if isinstance(alias_expression.this, exp.Identifier) and alias_expression.this.args.get(
            "quoted"
        ):
            quoted_derived_aliases.add(alias)
        for identifier in alias_expression.args.get("columns") or []:
            name = identifier.name if isinstance(identifier, exp.Identifier) else ""
            if name:
                derived_column_lists.setdefault(alias, set()).add(name.lower())
                derived_column_lists.setdefault(alias.casefold(), set()).add(name.lower())
    local: dict[int, Locality] = {}
    for scope in scope_root.traverse():
        derived_aliases: set[str] = set()
        derived_projections: set[str] = set()
        for alias, source in scope.sources.items():
            if _table_from_scope_source(source) is not None:
                continue
            derived_aliases.add(
                _identifier_key(alias, quoted=alias in quoted_derived_aliases, dialect=dialect)
            )
            expression = getattr(source, "expression", None)
            if expression is not None:
                derived_projections.update(name.lower() for name in expression.named_selects)
            derived_projections.update(derived_column_lists.get(alias, ()))
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
            table = _column_qualifier_key(column, dialect=dialect) if column.table else ""
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
        # output alias only otherwise. SQLite applies the same precedence in
        # HAVING; PostgreSQL does not permit output aliases there at all.
        # Virtual overlays are not input columns: they exist only after rewrite.
        offered = {
            column.casefold()
            for alias, source in scope.sources.items()
            if isinstance(source, exp.Table) and source.name in table_specs
            for column in table_specs[source.name].columns
        }
        group_clause = select.args.get("group") if select else None
        if group_clause is not None:
            for group_column in _within_scope(group_clause, exp.Column):
                if not isinstance(group_column, exp.Column):
                    continue
                name = (group_column.name or "").lower()
                if not group_column.table and name in output_aliases and name not in offered:
                    local.setdefault(id(group_column), Locality.OUTPUT_ALIAS)
        having_clause = select.args.get("having") if dialect == "sqlite" and select else None
        if having_clause is not None:
            for having_column in _within_scope(having_clause, exp.Column):
                if not isinstance(having_column, exp.Column):
                    continue
                name = (having_column.name or "").lower()
                if not having_column.table and name in output_aliases and name not in offered:
                    local.setdefault(id(having_column), Locality.OUTPUT_ALIAS)
    return ColumnLocality(local)


def _select_output_names(select: exp.Select) -> list[str]:
    """Names a SELECT exposes, preferring an alias column list when present."""
    parent = select.parent
    if isinstance(parent, (exp.CTE, exp.Subquery)):
        alias = parent.args.get("alias")
        if isinstance(alias, exp.TableAlias):
            listed = [
                identifier.name
                for identifier in alias.args.get("columns") or []
                if isinstance(identifier, exp.Identifier) and identifier.name
            ]
            if listed and len(listed) == len(select.expressions):
                return listed
    return list(select.named_selects)


def _source_by_name(sources: dict[str, Any], qualifier: str) -> Any:
    if qualifier in sources:
        return sources[qualifier]
    folded = qualifier.casefold()
    matches = [source for name, source in sources.items() if name.casefold() == folded]
    return matches[0] if len(matches) == 1 else None


def _timestamp_passthrough_names(
    scope: Any, columns: frozenset[str], visiting: set[int]
) -> set[str]:
    """Output names this derived scope projects from a stored timestamp column."""
    scope_id = id(scope)
    if scope_id in visiting:
        return set()
    visiting.add(scope_id)
    select = getattr(scope, "expression", None)
    if not isinstance(select, exp.Select):
        return set()
    inner_sources = getattr(scope, "sources", {})
    found: set[str] = set()
    for item, output_name in zip(select.expressions, _select_output_names(select)):
        expression = item.this if isinstance(item, exp.Alias) else item
        if _is_stored_timestamp_column(expression, inner_sources, columns, visiting):
            found.add(output_name.casefold())
    return found


def _is_stored_timestamp_column(
    expression: exp.Expression,
    sources: dict[str, Any],
    columns: frozenset[str],
    visiting: set[int],
) -> bool:
    """Whether this expression is a column that still holds a stored timestamp."""
    if not isinstance(expression, exp.Column):
        return False
    name = (expression.name or "").casefold()
    if name not in columns:
        return False
    qualifier = expression.table or ""
    if qualifier:
        source = _source_by_name(sources, qualifier)
        if source is None:
            return False
        if isinstance(source, exp.Table):
            return True
        return name in _timestamp_passthrough_names(source, columns, visiting)
    if any(isinstance(source, exp.Table) for source in sources.values()):
        return True
    return any(
        name in _timestamp_passthrough_names(source, columns, visiting)
        for source in sources.values()
        if not isinstance(source, exp.Table)
    )


def _timestamp_passthrough_references(root: exp.Expression, columns: frozenset[str]) -> set[int]:
    """Column nodes that are query-local yet still hold a stored timestamp.

    A derived relation that projects a stored timestamp column still holds that
    timestamp. A derived relation that invents the name does not.
    """
    scope_root = build_scope(root)
    if scope_root is None:
        return set()
    ids: set[int] = set()
    for scope in scope_root.traverse():
        visiting: set[int] = set()
        passthrough_names: set[str] = set()
        for source in scope.sources.values():
            if isinstance(source, exp.Table):
                continue
            passthrough_names.update(_timestamp_passthrough_names(source, columns, visiting))
        if not passthrough_names:
            continue
        for column in scope.columns:
            if (column.name or "").casefold() in passthrough_names:
                ids.add(id(column))
    return ids


def _unix_epoch_text(node: exp.Expression) -> Optional[str]:
    """The signed number a timestamp comparison holds, or None if it is not one."""
    if isinstance(node, exp.Literal) and node.is_number:
        return str(node.this)
    if isinstance(node, exp.Neg):
        inner = _strip_parens(node.this)
        if isinstance(inner, exp.Literal) and inner.is_number:
            return f"-{inner.this}"
    return None


def _timestamp_literals(
    root: exp.Expression,
    columns: frozenset[str],
    *,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
    numeric: bool = False,
) -> list[exp.Expression]:
    """Every literal compared against a column that holds a timestamp.

    String literals are the usual case. ``numeric=True`` collects unquoted
    numbers instead, so a unix-epoch comparison can be rewritten to an instant
    rather than failing in PostgreSQL as ``timestamptz >= integer``.

    Columns that resolve to a query-local relation are skipped unless that
    relation merely projected a stored timestamp column: rewriting a literal
    beside caller-invented data of the same name changes a comparison they
    wrote against their own values. An alias of a stored timestamp
    (``start_time AS ts``) is still a timestamp, even though the output name
    is no longer in ``columns``.
    """
    local = query_local_columns(root, allowlist=allowlist, dialect=dialect)
    passthrough = _timestamp_passthrough_references(root, columns)
    found: list[exp.Expression] = []

    def is_timestamp_column(column: exp.Column) -> bool:
        if id(column) in passthrough:
            return True
        if (column.name or "").casefold() not in columns:
            return False
        return not local.is_local(column)

    def collect(left: Optional[exp.Expression], right: Optional[exp.Expression]) -> None:
        for column, operand in ((left, right), (right, left)):
            if not isinstance(column, exp.Column) or not is_timestamp_column(column):
                continue
            if operand is None:
                continue
            if numeric:
                if _unix_epoch_text(operand) is not None:
                    found.append(operand)
                continue
            if isinstance(operand, exp.Literal) and operand.is_string:
                found.append(operand)

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
        if not isinstance(literal, exp.Literal):
            continue
        parsed = parse_timestamp_literal(literal.this)
        if parsed is None:
            if is_date_shaped(literal.this):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"`{literal.this}` looks like a timestamp but could not be read. "
                    "Write an ISO-8601 instant with an offset, for example "
                    "`2026-07-01T00:00:00+00:00`, or a bare date such as `2026-07-01`.",
                )
            if is_time_shaped(literal.this):
                zone = "no date" if _time_literal_has_zone(literal.this) else "no date or time zone"
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"`{literal.this}` names a time of day but {zone}. "
                    "Write an ISO-8601 instant with an offset, for example "
                    "`2026-07-01T14:30:00+00:00`, or a bare date such as `2026-07-01`.",
                )
            if _ambiguous_calendar_literal(literal.this):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"`{literal.this}` is a calendar date whose day and month depend "
                    "on DateStyle. Write an ISO date such as `2026-08-12`, or an "
                    "instant with an offset.",
                )
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                f"`{literal.this}` is not a timestamp. Write an ISO-8601 instant "
                "with an offset, for example `2026-07-01T00:00:00+00:00`, or a "
                "bare date such as `2026-07-01`.",
            )
        if parsed.is_aware or not parsed.has_time:
            continue
        return AdmissionResult(
            AdmissionOutcome.UNSUPPORTED_SYNTAX,
            f"`{literal.this}` names a time of day but no time zone, and this surface "
            "will not choose one for you. Add an offset -- "
            f"`{literal.this}+00:00` for UTC. A bare date such as `2026-07-01` needs "
            "none and is read as UTC.",
        )
    for node in _timestamp_literals(
        root, columns, allowlist=allowlist, dialect=dialect, numeric=True
    ):
        original = _unix_epoch_text(node)
        if original is None:
            continue
        if unix_epoch_to_utc(original) is None:
            return AdmissionResult(
                AdmissionOutcome.UNSUPPORTED_SYNTAX,
                f"Integer {original} cannot be read as a Unix epoch instant. "
                "Write an ISO-8601 timestamp with an offset, for example "
                "`2026-07-01T00:00:00+00:00`.",
            )
    return None


_TIME_HAS_ZONE = re.compile(r"(?:Z|[+-]\d{2}(?::?\d{2})?)$", re.IGNORECASE)


def _time_literal_has_zone(text: str) -> bool:
    return bool(_TIME_HAS_ZONE.search(text.strip()))


_AMBIGUOUS_CALENDAR = re.compile(r"^\d{1,4}[./]\d{1,2}[./]\d{2,4}$")


def _ambiguous_calendar_literal(text: str) -> bool:
    """Slash and dotted dates whose day/month order is DateStyle, not ISO."""
    return bool(_AMBIGUOUS_CALENDAR.match(text.strip()))


# SQLGlot's first sql_names() entry is sometimes an internal alias, not the
# spelling the caller typed or the engine documents.
_SQLGLOT_FUNCTION_SPELLING = {
    "explode": "unnest",
    "unix_to_time": "to_timestamp",
}

# First sql_names() entry by dialect when the portable alias would send the
# caller looking for a function this backend does not have.
_SQLGLOT_FUNCTION_SPELLING_BY_DIALECT: dict[SupportedSQLDialectName, dict[str, str]] = {
    "sqlite": {
        "str_position": "instr",
        "sha": "sha1",
        "current_version": "sqlite_version",
        "chr": "char",
        "rand": "random",
    },
    "postgresql": {
        "current_version": "version",
    },
}


def _reported_function_name(sql_names: list[str], *, dialect: SupportedSQLDialectName) -> str:
    """The spelling a caller wrote, not SQLGlot's internal class alias.

    ``generate_series`` is modelled as ``ExplodingGenerateSeries``, whose only
    ``sql_names`` entry is ``EXPLODING_GENERATE_SERIES``. ``unnest`` is
    modelled as ``Explode``. Reporting those internal names sends the caller
    looking for a function that does not exist. Strip the prefix SQLGlot uses
    for the exploding (set-returning) variant, then map any remaining alias.
    """
    dialect_aliases = _SQLGLOT_FUNCTION_SPELLING_BY_DIALECT.get(dialect, {})

    def resolve(name: str) -> str:
        return dialect_aliases.get(name, _SQLGLOT_FUNCTION_SPELLING.get(name, name))

    lowered = [name.lower() for name in sql_names]
    for name in lowered:
        if name.startswith("exploding_"):
            stripped = name[len("exploding_") :]
            if stripped:
                return resolve(stripped)
            continue
        return resolve(name)
    return resolve(lowered[0])


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
            if _is_quantifier_call(node):
                continue
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
                _reported_function_name(names, dialect=dialect) if names else type(node).__name__,
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
    identifier = table.this
    quoted = isinstance(identifier, exp.Identifier) and bool(identifier.args.get("quoted"))
    return _identifier_key(table.name or "", quoted=quoted, dialect=dialect)


def _identifier_key(name: str, *, quoted: bool, dialect: SupportedSQLDialectName) -> str:
    """Compare identifiers the way this dialect does."""
    if dialect == "sqlite" or not quoted:
        return name.casefold()
    return name


def _column_qualifier_key(column: exp.Column, *, dialect: SupportedSQLDialectName) -> str:
    """The dialect key of this column's table qualifier, if any."""
    identifier = column.args.get("table")
    quoted = isinstance(identifier, exp.Identifier) and bool(identifier.args.get("quoted"))
    return _identifier_key(column.table or "", quoted=quoted, dialect=dialect)


def _ancestor_scopes(scope: Any) -> Iterable[Any]:
    """This scope, then each enclosing one. Cycle-guarded.

    SQLGlot builds a scope per SELECT and per LATERAL. A correlated subquery
    names a relation the inner FROM does not introduce, and a later LATERAL
    reads an earlier LATERAL's alias; both live on a parent scope. Walking
    inward-out matches how the engines resolve those names.
    """
    seen: set[int] = set()
    current = scope
    while current is not None:
        scope_id = id(current)
        if scope_id in seen:
            break
        seen.add(scope_id)
        yield current
        current = getattr(current, "parent", None)


def _scope_exposes_qualifier(
    scope: Any,
    qualifier: str,
    *,
    quoted: bool,
    dialect: SupportedSQLDialectName,
) -> bool:
    """Whether `qualifier` names a relation this scope or an enclosing one exposes."""
    want = _identifier_key(qualifier, quoted=quoted, dialect=dialect)
    for current in _ancestor_scopes(scope):
        for source in current.sources.values():
            table = _table_from_scope_source(source)
            if table is not None and want in _relation_identifier_keys(table, dialect=dialect):
                return True
        for table in _lateral_tables_in_scope(current):
            if want in _relation_identifier_keys(table, dialect=dialect):
                return True
        for ident in _derived_alias_identifiers(current):
            if (
                _identifier_key(
                    ident.this or "",
                    quoted=bool(ident.args.get("quoted")),
                    dialect=dialect,
                )
                == want
            ):
                return True
    return False


def _allowlisted_table_for_qualifier(
    scope: Any,
    qualifier: str,
    *,
    quoted: bool,
    dialect: SupportedSQLDialectName,
    allowlist: Allowlist,
) -> Optional[str]:
    """Allowlisted table this qualifier names, including outer scopes.

    `_scope_exposes_qualifier` accepts a correlated name; this is the matching
    lookup so a misspelled column on the outer table is still refused rather
    than skipped because the inner FROM does not mention that table.
    """
    want = _identifier_key(qualifier, quoted=quoted, dialect=dialect)
    for current in _ancestor_scopes(scope):
        for source in current.sources.values():
            table = _table_from_scope_source(source)
            if table is None:
                continue
            if want not in _relation_identifier_keys(table, dialect=dialect):
                continue
            table_name = _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect)
            if table_name is not None:
                return table_name
        for table in _lateral_tables_in_scope(current):
            if want not in _relation_identifier_keys(table, dialect=dialect):
                continue
            table_name = _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect)
            if table_name is not None:
                return table_name
    return None


def _alias_identifier(expression: Optional[exp.Expression]) -> Optional[exp.Identifier]:
    """The alias this relation is exposed as, quoting included."""
    if expression is None:
        return None
    alias = expression.args.get("alias")
    if isinstance(alias, exp.TableAlias):
        ident = alias.this
        return ident if isinstance(ident, exp.Identifier) else None
    return alias if isinstance(alias, exp.Identifier) else None


def _relation_identifier_keys(
    source: exp.Table, *, dialect: SupportedSQLDialectName
) -> frozenset[str]:
    """Dialect keys this physical table is reachable as: alias and table name."""
    keys: set[str] = set()
    ident = _alias_identifier(source)
    if ident is not None:
        keys.add(
            _identifier_key(
                ident.this or "",
                quoted=bool(ident.args.get("quoted")),
                dialect=dialect,
            )
        )
    table_identifier = source.this
    if isinstance(table_identifier, exp.Identifier):
        keys.add(
            _identifier_key(
                table_identifier.this or "",
                quoted=bool(table_identifier.args.get("quoted")),
                dialect=dialect,
            )
        )
    elif ident is None and isinstance(table_identifier, exp.Func):
        # SQLite names an unaliased table-valued function after the function.
        func_name = table_identifier.name or ""
        if func_name:
            keys.add(_identifier_key(func_name, quoted=False, dialect=dialect))
    elif ident is None and source.name:
        keys.add(_identifier_key(source.name, quoted=False, dialect=dialect))
    return frozenset(keys)


def _derived_alias_identifiers(scope: Any) -> list[exp.Identifier]:
    """Aliases of CTEs, subqueries, and other query-local relations in this scope."""
    expression = getattr(scope, "expression", None)
    if not isinstance(expression, exp.Select):
        return []
    relations: list[Optional[exp.Expression]] = []
    from_expr = expression.args.get("from_") or expression.args.get("from")
    if isinstance(from_expr, exp.From):
        relations.append(from_expr.this)
    relations.extend(join.this for join in (expression.args.get("joins") or []))
    with_expr = expression.args.get("with_") or expression.args.get("with")
    if isinstance(with_expr, exp.With):
        relations.extend(with_expr.expressions)
    found: list[exp.Identifier] = []
    for relation in relations:
        ident = _alias_identifier(relation)
        if ident is None and isinstance(relation, exp.Lateral):
            ident = _alias_identifier(relation.this)
        if ident is not None:
            found.append(ident)
    return found


def _table_from_scope_source(source: Any) -> Optional[exp.Table]:
    """The base table a scope source names, including ``LATERAL traces t``.

    SQLGlot stores that join as Lateral wrapping a Table, so a check that
    only matches Table sources never sees the relation.
    """
    if isinstance(source, exp.Table):
        return source
    if isinstance(source, exp.Lateral) and isinstance(source.this, exp.Table):
        return source.this
    return None


_JSON_EACH_COLUMNS = (
    "key",
    "value",
    "type",
    "atom",
    "id",
    "parent",
    "fullkey",
    "path",
)


def _json_each_columns_for_relation(relation: exp.Expression) -> Optional[frozenset[str]]:
    """Columns ``json_each`` projects, or None if this is not that function."""
    if not _is_json_each_call(relation):
        return None
    return frozenset(_JSON_EACH_COLUMNS)


def _json_each_bindings(scope: Any) -> dict[str, frozenset[str]]:
    """Alias (lowercased; empty if unaliased) to ``json_each`` columns in this scope."""
    expression = getattr(scope, "expression", None)
    if not isinstance(expression, exp.Select):
        return {}
    relations: list[Optional[exp.Expression]] = []
    from_expr = expression.args.get("from_") or expression.args.get("from")
    if isinstance(from_expr, exp.From):
        relations.append(from_expr.this)
    relations.extend(join.this for join in (expression.args.get("joins") or []))
    found: dict[str, frozenset[str]] = {}
    for relation in relations:
        if relation is None:
            continue
        columns = _json_each_columns_for_relation(relation)
        if columns is None:
            continue
        alias = (relation.alias or "").casefold()
        found[alias] = columns
        if not alias:
            # SQLite's default table name for the TVF is the function name.
            found["json_each"] = columns
    return found


def _lateral_tables_in_scope(scope: Any) -> list[exp.Table]:
    """Tables that appear only as ``LATERAL <table>``, not as Scope sources.

    SQLGlot puts ``JOIN LATERAL traces t`` in a nested scope whose ``sources``
    map does not hold the table, while ``scope.tables`` still does.
    """
    found: list[exp.Table] = []
    for table in getattr(scope, "tables", ()):
        if isinstance(table.parent, exp.Lateral):
            found.append(table)
    return found


def _table_is_nonrecursive_cte_self_reference(table: exp.Table) -> bool:
    """True when a table names its enclosing CTE without WITH RECURSIVE.

    SQLGlot treats that as a base table, so the relation check would say the
    name is not allowlisted. The statement is recursive; name that instead.
    """
    table_name = (table.name or "").casefold()
    if not table_name:
        return False
    cte = table.find_ancestor(exp.CTE)
    if cte is None:
        return False
    if (cte.alias or "").casefold() != table_name:
        return False
    with_clause = cte.find_ancestor(exp.With)
    if with_clause is None:
        return False
    return not with_clause.args.get("recursive")


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
            table = _table_from_scope_source(source)
            if table is None:
                continue
            if table.db or table.catalog:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "Schema-qualified tables are not allowed. Write the table "
                    "name only, for example `spans` rather than `analytics_sql.spans`.",
                )
            name = table.name or ""
            if not name:
                continue
            if _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect) is None:
                if _table_is_nonrecursive_cte_self_reference(table):
                    return AdmissionResult(
                        AdmissionOutcome.UNSUPPORTED_SYNTAX,
                        "recursive CTE",
                        message=_RECURSIVE_CTE_MESSAGE,
                    )
                return AdmissionResult(AdmissionOutcome.RELATION_NOT_ALLOWED, repr(name))
        for table in _lateral_tables_in_scope(scope):
            if table.db or table.catalog:
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "Schema-qualified tables are not allowed. Write the table "
                    "name only, for example `spans` rather than `analytics_sql.spans`.",
                )
            name = table.name or ""
            if not name:
                continue
            if _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect) is None:
                if _table_is_nonrecursive_cte_self_reference(table):
                    return AdmissionResult(
                        AdmissionOutcome.UNSUPPORTED_SYNTAX,
                        "recursive CTE",
                        message=_RECURSIVE_CTE_MESSAGE,
                    )
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
        resolved: set[str] = set()
        for source in scope.sources.values():
            table = _table_from_scope_source(source)
            if table is None:
                continue
            allowlisted = _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect)
            if allowlisted is not None:
                resolved.add(allowlisted)
        for table in _lateral_tables_in_scope(scope):
            allowlisted = _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect)
            if allowlisted is not None:
                resolved.add(allowlisted)
        for table in scope.tables:
            parent = table.parent
            if isinstance(parent, exp.Table) and parent.args.get("indexed") is table:
                continue
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
        # A qualifier must name a relation this scope exposes. Schema-qualified
        # special forms (`pg_catalog.current_user`) are columns in the tree, not
        # functions, so the function allowlist never sees them.
        for column in _scope_columns(scope.expression):
            if isinstance(column.this, exp.Star):
                continue
            if column.args.get("db") or column.args.get("catalog"):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    "Schema-qualified columns are not allowed",
                )
            qualifier = column.table or ""
            if not qualifier:
                continue
            qualifier_identifier = column.args.get("table")
            quoted = isinstance(qualifier_identifier, exp.Identifier) and bool(
                qualifier_identifier.args.get("quoted")
            )
            if not _scope_exposes_qualifier(scope, qualifier, quoted=quoted, dialect=dialect):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"`{qualifier}` does not name a relation in this query.",
                )
        by_reference: dict[str, str] = {}
        for reference, source in scope.sources.items():
            table = _table_from_scope_source(source)
            if table is not None:
                table_name = _allowlisted_table_name(table, allowlist=allowlist, dialect=dialect)
                if table_name is not None:
                    by_reference[reference] = table_name
                    by_reference[table.name] = table_name
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
        having = scope.expression.args.get("having")
        having_columns = (
            {id(column) for column in _within_scope(having, exp.Column)}
            if isinstance(having, exp.Expression)
            else set()
        )
        output_aliases = {
            projection.alias.casefold()
            for projection in scope.expression.expressions
            if isinstance(projection, exp.Alias) and projection.alias
        }
        input_columns = {
            column.casefold()
            for table_name in set(by_reference.values())
            for column in (
                *allowlist.table_specs[table_name].columns,
                *allowlist.table_specs[table_name].virtual_columns,
            )
        }
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
                # `pg_catalog.varchar` is a schema-qualified type, not a row
                # field. `_refused_cast_target` already decides those.
                if isinstance(dot.parent, exp.DataType):
                    continue
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"Composite field access ({dot.sql()}) is not supported. "
                    "Name the column, or expand the function in the FROM clause.",
                )
        for column in columns:
            if (
                dialect == "postgresql"
                and id(column) in having_columns
                and not column.table
                and not localities.is_alias_bound(column)
                and column.name.casefold() in output_aliases
                and column.name.casefold() not in input_columns
            ):
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    f"`HAVING {column.name}` refers to a SELECT alias. PostgreSQL does not "
                    "allow that, so repeat its expression (for example, "
                    "`HAVING COUNT(*) >= 50`).",
                )
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
        json_each_by_alias = _json_each_bindings(scope)
        json_each_names = (
            frozenset().union(*json_each_by_alias.values()) if json_each_by_alias else frozenset()
        )
        foreign_source = any(
            not (
                isinstance(source, exp.Table)
                and _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
                is not None
            )
            for source in scope.sources.values()
        )
        has_opaque_foreign = any(
            not (
                isinstance(source, exp.Table)
                and (
                    _allowlisted_table_name(source, allowlist=allowlist, dialect=dialect)
                    is not None
                    or _json_each_columns_for_relation(source) is not None
                )
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
                if not candidates:
                    quoted = isinstance(qualifier_identifier, exp.Identifier) and bool(
                        qualifier_identifier.args.get("quoted")
                    )
                    outer_table = _allowlisted_table_for_qualifier(
                        scope,
                        qualifier,
                        quoted=quoted,
                        dialect=dialect,
                        allowlist=allowlist,
                    )
                    if outer_table is not None:
                        candidates = [outer_table]
            else:
                candidates = list(dict.fromkeys(by_reference.values()))
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
            json_each_columns = (
                json_each_by_alias.get(qualifier.casefold()) if qualifier else json_each_names
            )
            if json_each_columns is not None and name.casefold() in json_each_columns:
                continue
            # SQLite treats a quoted unknown identifier as a string, so
            # `"nope"` from json_each is a silent wrong answer rather than
            # "no such column". Name the columns json_each actually projects.
            if (
                dialect == "sqlite"
                and json_each_by_alias
                and (qualifier.casefold() in json_each_by_alias or not qualifier)
                and not (not qualifier and has_opaque_foreign)
            ):
                offered = ", ".join(_JSON_EACH_COLUMNS)
                subject = (
                    f"Column {qualifier}.{name} is not projected by json_each."
                    if qualifier
                    else f"Column {name} is not projected by json_each."
                )
                return AdmissionResult(
                    AdmissionOutcome.UNSUPPORTED_SYNTAX,
                    subject,
                    message=f"{subject} json_each columns are {offered}.",
                )
            if not candidates:
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
    offered = (*spec.columns, *spec.virtual_columns)
    if dialect == "sqlite":
        return name.casefold() in {column.casefold() for column in offered}

    # PostgreSQL folds unquoted identifiers to lower-case but preserves quoted
    # spelling. Physical names retain which were quoted in the DDL; virtual
    # overlays are advertised as unquoted names and follow the same rule.
    identifier = reference.this
    is_quoted = isinstance(identifier, exp.Identifier) and bool(identifier.args.get("quoted"))
    if is_quoted:
        return name in offered
    return any(name.casefold() == column and column == column.lower() for column in offered)


def _join_using_identifiers(join: exp.Join) -> list[exp.Identifier]:
    using = join.args.get("using")
    if not using:
        return []
    items = using if isinstance(using, list) else [using]
    found: list[exp.Identifier] = []
    for item in items:
        ident = item if isinstance(item, exp.Identifier) else getattr(item, "this", None)
        if isinstance(ident, exp.Identifier):
            found.append(ident)
    return found


def _virtual_column_on_source(
    expression: Optional[exp.Expression],
    column_name: str,
    *,
    quoted: bool,
    allowlist: Allowlist,
    dialect: SupportedSQLDialectName,
) -> bool:
    if not isinstance(expression, exp.Table):
        return False
    table_name = _allowlisted_table_name(expression, allowlist=allowlist, dialect=dialect)
    if table_name is None:
        return False
    spec = allowlist.table_specs.get(table_name)
    if spec is None:
        return False
    want = _identifier_key(column_name, quoted=quoted, dialect=dialect)
    return any(
        _identifier_key(virtual, quoted=False, dialect=dialect) == want
        for virtual in spec.virtual_columns
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
            raise admission_error_from_outcome(
                "unsupported_syntax",
                "Lock",
                message=(
                    "FOR UPDATE and FOR SHARE are not supported. This surface "
                    "is read-only; omit the lock clause."
                ),
            )
        if isinstance(node, exp.With) and node.args.get("recursive"):
            raise admission_error_from_outcome(
                "unsupported_syntax",
                "recursive CTE",
                message=_RECURSIVE_CTE_MESSAGE,
            )

    failure = (
        _check_node_classes(root)
        # Before the structural policy, which would otherwise answer these with
        # its generic message. A caller told `HexString` is not in the grammar
        # learns nothing; the lossy-shape refusals name the hazard and the
        # spelling that works.
        or _check_lossy_shapes(root, dialect=dialect)
        or _check_dialect_specific_syntax(root, dialect=dialect)
        or _check_structural_policy(root)
        or _check_double_quoted_timestamp_operands(root, allowlist=allowlist, dialect=dialect)
        or _check_collate(root, dialect=dialect)
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
        from phoenix.server.mcp.sql.allowlist import load_allowlist

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
    # target cannot express. Left uncaught it escaped this function, whose
    # whole contract is to return an outcome instead of raising, so a corpus
    # entry for such a shape would error out of the harness rather than record
    # a verdict.
    try:
        rendered = render(root, dialect=dialect)
    except AnalyticsSqlError as exc:
        return AdmissionResult(AdmissionOutcome(exc.code.value), exc.message)

    return AdmissionResult(AdmissionOutcome.ADMIT, rendered_sql=rendered)
