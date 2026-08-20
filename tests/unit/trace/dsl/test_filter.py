import ast
import random
import typing
from ast import unparse
from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Optional
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import insert, select
from sqlalchemy.dialects import postgresql

import phoenix.trace.dsl.filter
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import (
    Projector,
    RootSpanScope,
    SpanFilter,
    _apply_eval_aliasing,
    _get_attribute_keys_list,
    root_span_scope,
)


@pytest.mark.parametrize(
    "expression,expected",
    [
        ("output.value", ["output", "value"]),
        ("llm.token_count.completion", ["llm", "token_count", "completion"]),
        ("attributes['key']", ["key"]),
        ("attributes['a']['b.c'][['d']]", ["a", "b.c", "d"]),
        ("attributes['a'][['b.c']][['d']]", ["a", "b.c", "d"]),
        ("attributes[['a']]['b.c'][['d']]", ["a", "b.c", "d"]),
        ("attributes['a'][['b.c', 'd']]", ["a", "b.c", "d"]),
        ("attributes['a']['b.c'][['d']][0]", ["a", "b.c", "d", 0]),
        ("attributes[['a', 1]]['b.c'][['d']]", ["a", 1, "b.c", "d"]),
        ("attributes[[1, 'a']]['b.c'][['d']]", None),
        ("attributes[0]['b.c'][['d']]", None),
        ("attributes[[0]]['b.c'][['d']]", None),
        ("attributes['a'][[]]['b']", None),
        ("attributes[[]]", None),
        ("attributes[[['a']]]", None),
        ("attributes[None]", None),
        ("attributes['a'][True]", None),
        ("attributes['a'][[True]]", None),
        ("attributes['a'][1+1]", None),
        ("attributes['a'][[1+1]]", None),
        ("metadata['key']", ["metadata", "key"]),
        ("metadata['a']['b.c'][['d']]", ["metadata", "a", "b.c", "d"]),
        ("metadata['a'][['b.c']][['d']]", ["metadata", "a", "b.c", "d"]),
        ("metadata[['a']]['b.c'][['d']]", ["metadata", "a", "b.c", "d"]),
        ("metadata['a'][['b.c', 'd']]", ["metadata", "a", "b.c", "d"]),
        ("metadata['a']['b.c'][['d']][0]", ["metadata", "a", "b.c", "d", 0]),
        ("metadata[['a', 1]]['b.c'][['d']]", ["metadata", "a", 1, "b.c", "d"]),
        ("metadata[[1, 'a']]['b.c'][['d']]", None),
        ("metadata[0]['b.c'][['d']]", None),
        ("metadata[[0]]['b.c'][['d']]", None),
        ("metadata['a'][[]]['b']", None),
        ("metadata[[]]", None),
        ("metadata[[['a']]]", None),
        ("metadata[None]", None),
        ("metadata['a'][True]", None),
        ("metadata['a'][[True]]", None),
        ("metadata['a'][1+1]", None),
        ("metadata['a'][[1+1]]", None),
        ("abc", None),
        ("123", None),
    ],
)
def test_get_attribute_keys_list(expression: str, expected: Optional[list[str]]) -> None:
    actual = _get_attribute_keys_list(
        ast.parse(expression, mode="eval").body,
    )
    if expected is None:
        assert actual is None
    else:
        assert isinstance(actual, list)
        assert [c.value for c in actual] == expected


@pytest.mark.parametrize(
    "expression,expected",
    [
        (
            "parent_id is not None and 'abc' in name or span_kind == 'LLM' and span_id in ('123',)",
            "or_(and_(parent_id != None, CaseInsensitiveContains(name, 'abc')), and_(span_kind == 'LLM', span_id.in_(('123',))))",
        ),
        (
            "(parent_id is None or 'abc' not in name) and not (span_kind != 'LLM' or span_id not in ('123',))",
            "and_(or_(parent_id == None, not_(CaseInsensitiveContains(name, 'abc'))), not_(or_(span_kind != 'LLM', span_id.not_in(('123',)))))",
        ),
        (
            "1000 < latency_ms < 2000 or status_code == 'ERROR' or 2000 <= cumulative_llm_token_count_total",
            "or_(and_(1000 < latency_ms, latency_ms < 2000), status_code == 'ERROR', 2000 <= cumulative_llm_token_count_total)",
        ),
        (
            "llm.token_count.total - llm.token_count.prompt > 1000",
            "SafeJsonFloat(attributes[['llm', 'token_count', 'total']]) - SafeJsonFloat(attributes[['llm', 'token_count', 'prompt']]) > 1000",
        ),
        (
            "first.value in (1,) and second.value in ('2',) and '3' in third.value",
            "and_(SafeJsonFloat(attributes[['first', 'value']]).in_((1,)), attributes[['second', 'value']].as_string().in_(('2',)), CaseInsensitiveContains(attributes[['third', 'value']].as_string(), '3'))",
        ),
        (
            "'1.0' < my.value < 2.0",
            "and_('1.0' < attributes[['my', 'value']].as_string(), SafeJsonFloat(attributes[['my', 'value']]) < 2.0)",
        ),
        (
            "first.value + 1 < second.value",
            "SafeJsonFloat(attributes[['first', 'value']]) + 1 < SafeJsonFloat(attributes[['second', 'value']])",
        ),
        (
            "first.value * second.value > third.value",
            "SafeJsonFloat(attributes[['first', 'value']]) * SafeJsonFloat(attributes[['second', 'value']]) > SafeJsonFloat(attributes[['third', 'value']])",
        ),
        (
            "first.value + second.value > third.value",
            "cast(attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string(), String) > attributes[['third', 'value']].as_string()",
        ),
        (
            "my.value == '1.0' or float(my.value) < 2.0",
            "or_(attributes[['my', 'value']].as_string() == '1.0', SafeJsonFloat(attributes[['my', 'value']]) < 2.0)",
        ),
        (
            "not(-metadata['a.b'] + float(metadata[['c.d']]) != metadata[['e.f', 'g.h']])",
            "not_(-SafeJsonFloat(attributes[['metadata', 'a.b']]) + SafeJsonFloat(attributes[['metadata', 'c.d']]) != SafeJsonFloat(attributes[['metadata', 'e.f', 'g.h']]))",
        ),
        (
            "attributes['attributes'] == attributes[['attributes']] != attributes[['attributes', 'attributes']]",
            "and_(attributes[['attributes']].as_string() == attributes[['attributes']].as_string(), attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string())",
        ),
        (
            "metadata['is_empty'] == True",
            "SafeJsonBoolean(attributes[['metadata', 'is_empty']]) == True",
        ),
        (
            "metadata['is_empty'] == False",
            "SafeJsonBoolean(attributes[['metadata', 'is_empty']]) == False",
        ),
        (
            "True == metadata['is_empty']",
            "True == SafeJsonBoolean(attributes[['metadata', 'is_empty']])",
        ),
        (
            "metadata['is_empty'] is True",
            "SafeJsonBoolean(attributes[['metadata', 'is_empty']]) == True",
        ),
        (
            "metadata['is_empty'] is not False",
            "SafeJsonBoolean(attributes[['metadata', 'is_empty']]) != False",
        ),
        (
            "span_kind == 'chain'",
            "span_kind == 'CHAIN'",
        ),
        (
            "span_kind == 'Chain'",
            "span_kind == 'CHAIN'",
        ),
        (
            "'chain' == span_kind",
            "'CHAIN' == span_kind",
        ),
        (
            "span_kind != 'llm'",
            "span_kind != 'LLM'",
        ),
        (
            "span_kind in ('chain', 'LLM')",
            "span_kind.in_(('CHAIN', 'LLM'))",
        ),
        (
            "span_kind not in ['chain', 'tool']",
            "span_kind.not_in(['CHAIN', 'TOOL'])",
        ),
        (
            "'cha' in span_kind",
            "CaseInsensitiveContains(span_kind, 'CHA')",
        ),
        (
            "status_code == 'error'",
            "status_code == 'ERROR'",
        ),
        (
            "'Error' == status_code",
            "'ERROR' == status_code",
        ),
        (
            "status_code in ('ok', 'Error')",
            "status_code.in_(('OK', 'ERROR'))",
        ),
        (
            "'err' in status_code",
            "CaseInsensitiveContains(status_code, 'ERR')",
        ),
        # `parent_span` root predicate: `parent_span is None` / `parent_span is not None` become
        # references to correlated EXISTS predicates bound in SpanFilter.__call__.
        (
            "parent_span is None",
            "__parent_is_null__",
        ),
        (
            "parent_span is not None",
            "__parent_is_not_null__",
        ),
        (
            "parent_span == None",
            "__parent_is_null__",
        ),
        (
            "parent_span != None",
            "__parent_is_not_null__",
        ),
        (
            "not (parent_span is None)",
            "not_(__parent_is_null__)",
        ),
    ],
)
async def test_filter_translated(
    db: DbSessionFactory,
    expression: str,
    expected: str,
    default_project: Any,
    abc_project: Any,
) -> None:
    with patch.object(
        phoenix.trace.dsl.filter,
        "uuid4",
        return_value=UUID(hex="00000000000000000000000000000000"),
    ):
        f = SpanFilter(expression)
    assert unparse(f.translated).strip() == expected
    # next line is only to test that the syntax is accepted
    async with db() as session:
        await session.execute(f(select(models.Span.id)))


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("name and status_code", id="named-columns"),
        # Reported as `... and span.k`, respelled while `span` was briefly a reserved
        # root. `span.k` is an ordinary dotted attribute path again, so either spelling
        # exercises this case; the respelling is kept to avoid churning the pin.
        pytest.param('"" in input.value and svc.k', id="issue-5802"),
        pytest.param("revenueio.language_code == 'en-US' and r", id="issue-10306"),
        pytest.param("name == 'n' and r", id="bare-name-operand"),
        pytest.param("name == 'n' and input.value", id="attribute-operand"),
        pytest.param("metadata['flag'] and name == 'x'", id="metadata-operand"),
        pytest.param("not metadata['flag']", id="negated-json-operand"),
        pytest.param("name == 'n' or 5", id="numeric-operand"),
        pytest.param("name == 'n' and evals['x'].score", id="annotation-member-operand"),
        pytest.param("name == 'n' and (span_kind == 'LLM' and r)", id="nested-operand"),
    ],
)
def test_filter_rejects_non_boolean_logical_operands(condition: str) -> None:
    """A value in `and` / `or` / `not` position is a filter error, not a query error.

    Each of these puts something that is not a predicate where SQL will use it as
    one. Left to the database the two backends disagree about the consequence --
    PostgreSQL aborts the statement (`argument of AND must be type boolean, not
    type jsonb`) while SQLite coerces and silently returns the wrong rows -- and
    on either one it arrives after validation has already called the condition
    valid, so the UI has committed to a query it cannot run.

    Unknown-typed operands (a bare JSON attribute) are included deliberately:
    exempting them as "truthy values" is what let the raw JSON through. Every one
    of these is also a prefix of a longer expression someone is part way through
    typing, which is how they reach the server at all.
    """
    with pytest.raises(SyntaxError, match="is not a condition"):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("name == 'n' and span_kind == 'LLM'", id="comparisons"),
        pytest.param("name == 'n' and True", id="true-literal"),
        pytest.param("name == 'n' or False", id="false-literal"),
        pytest.param("annotations['Hallucination']", id="bare-existence-check"),
        pytest.param(
            "name == 'n' and annotations['Hallucination']",
            id="existence-check-as-operand",
        ),
        pytest.param("evals['Hallucination'] or name == 'n'", id="evals-alias-operand"),
        pytest.param("not (parent_id is None)", id="negated-comparison"),
        pytest.param("parent_span is None and name == 'x'", id="parent-predicate"),
        pytest.param(
            "annotations['q'].score >= 0.5 and not (name == 'z')",
            id="mixed-nesting",
        ),
    ],
)
def test_filter_still_accepts_every_condition_form(condition: str) -> None:
    """The check above must not narrow what counts as a condition.

    A bare annotation is an existence check and the boolean literals are
    meaningful operands (the generated corpus below relies on both), so these are
    predicates despite not being comparisons.
    """
    SpanFilter(condition)  # does not raise


@pytest.mark.parametrize(
    "condition",
    [
        "name == 1",
        "context.span_id == 1",
        "latency_ms == 'slow'",
        "llm.token_count.total == 'many'",
        "cumulative_token_count.total == 'many'",
        "annotations['quality'].label < 1",
        "annotations['quality'].score == 'high'",
    ],
)
def test_filter_rejects_incompatible_scalar_comparisons(condition: str) -> None:
    with pytest.raises(SyntaxError, match="cannot compare"):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        "name / 2 > 1",
        "annotations['quality'].label * 2 > 1",
        "latency_ms << 1 > 0",
    ],
)
def test_filter_rejects_invalid_arithmetic(condition: str) -> None:
    with pytest.raises(SyntaxError, match="invalid arithmetic"):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        "name in [1]",
        "annotations['quality'].label in [True]",
        "annotations['quality'].score in ['high']",
        "metadata['quality'] in [True, 'true']",
        "1 in metadata['quality']",
    ],
)
def test_filter_rejects_incompatible_collection_membership(condition: str) -> None:
    with pytest.raises(SyntaxError, match="cannot compare"):
        SpanFilter(condition)


def test_filter_rejects_non_datetime_timestamp_comparison() -> None:
    with pytest.raises(SyntaxError, match="cannot compare datetime and number"):
        SpanFilter("start_time == 1")


@pytest.mark.parametrize("condition", ["float(name) > 1", "float('not-a-number') > 1"])
def test_filter_rejects_unsafe_string_to_number_cast(condition: str) -> None:
    with pytest.raises(SyntaxError, match="cannot cast string to number"):
        SpanFilter(condition)


def test_filter_rejects_invalid_datetime_literal() -> None:
    with pytest.raises(SyntaxError, match="invalid datetime literal"):
        SpanFilter("start_time > 'yesterday'")


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param('start_time >= "2025-12-16T13:43:00"', id="naive-datetime"),
        pytest.param("start_time >= '2025-12-16 13:43:00'", id="naive-space-separated"),
        pytest.param("start_time in ['2025-12-16T13:43:00']", id="naive-in-collection"),
    ],
)
def test_filter_rejects_naive_datetime_literals(condition: str) -> None:
    """A literal without an offset has no single defensible meaning.

    `UtcTimeStamp` applies Phoenix's local-time convention to a naive value, so
    binding one would give the same saved filter a different boundary in
    deployments with different timezones -- and conditions travel in URLs.
    Reading it as UTC instead would be deterministic but would silently disagree
    with that convention, so the offset is required rather than guessed.
    """
    with pytest.raises(SyntaxError, match="no timezone"):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("start_time >= '2025-12-16T13:43:00Z'", id="zulu"),
        pytest.param("start_time >= '2025-12-16T13:43:00+02:00'", id="explicit-offset"),
        pytest.param("start_time in ['2025-12-16T13:43:00Z']", id="aware-in-collection"),
    ],
)
def test_filter_accepts_timezone_aware_datetime_literals(condition: str) -> None:
    SpanFilter(condition)  # does not raise


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("latency_ms == '1_000'", id="underscore-separator"),
        pytest.param("latency_ms == 'nan'", id="nan"),
        pytest.param("latency_ms == 'inf'", id="inf"),
        pytest.param("latency_ms == '0x10'", id="hex"),
        pytest.param("latency_ms == ' 12'", id="leading-space"),
        pytest.param("float('1_000') > 1", id="cast-underscore"),
        pytest.param("float('nan') > 1", id="cast-nan"),
        pytest.param("latency_ms in ['1_000']", id="membership-underscore"),
        pytest.param("latency_ms in [1.5, '2.0']", id="membership-mixed-types"),
    ],
)
def test_filter_rejects_numeric_strings_the_databases_disagree_about(condition: str) -> None:
    """One numeric grammar, applied wherever a string becomes a number.

    Python's `float()` accepts all of these, but the two backends do not agree
    on them: SQLite casts `'1_000'` to 1.0 while PostgreSQL rejects it outright,
    and the infinities and NaN are dialect-dependent. Accepting them at
    validation is precisely the validate-then-fail-at-query-time shape this
    module exists to prevent.
    """
    with pytest.raises(SyntaxError):
        SpanFilter(condition)


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("latency_ms == '1000'", id="scalar-eq"),
        pytest.param("latency_ms > '100'", id="scalar-gt"),
        pytest.param("'100' < latency_ms", id="quoted-number-on-left"),
        pytest.param("latency_ms == '-12.5'", id="negative-decimal"),
        pytest.param("latency_ms == '1e3'", id="exponent"),
        pytest.param("annotations['quality'].score >= '0.5'", id="annotation-score"),
        pytest.param("llm.token_count.total > '5'", id="float-attribute"),
        pytest.param("latency_ms in ['1.5', '2.0']", id="membership"),
    ],
)
def test_filter_rejects_quoted_numbers_against_numeric_fields(condition: str) -> None:
    """A quoted number against a numeric field is an error, not a coercion.

    Both sides are statically typed here, so there is nothing to infer. The
    coercion this replaces never worked on PostgreSQL: it bound the string as a
    float parameter, which asyncpg refuses, so the condition validated and then
    failed when the query ran. It only looked valid because SQLite is loosely
    typed and the tests asserting it "previously worked" only constructed a
    `SpanFilter` rather than running one.
    """
    with pytest.raises(SyntaxError, match="cannot compare"):
        SpanFilter(condition)


def test_quoted_number_rejection_suggests_the_unquoted_form() -> None:
    with pytest.raises(SyntaxError, match=r"write 100 instead of '100'"):
        SpanFilter("latency_ms > '100'")


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("float('10') > 1", id="cast-integer"),
        pytest.param("float('-12.5') < 1", id="cast-negative"),
        pytest.param("float(attributes['num']) > 1", id="cast-dynamic"),
    ],
)
def test_explicit_float_cast_still_parses_a_string(condition: str) -> None:
    """`float()` is how a caller opts into parsing a string as a number."""
    SpanFilter(condition)  # does not raise


@pytest.fixture
async def coercion_project(db: DbSessionFactory) -> None:
    """Two spans differing only in latency, for exercising coercion against a
    real database rather than against the compiler."""
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="coercion").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace-coercion",
                project_rowid=project_rowid,
                start_time=_PARENT_PREDICATE_TS,
                end_time=_PARENT_PREDICATE_TS,
            )
            .returning(models.Trace.id)
        )
        for span_id, seconds, attributes in (
            ("fast", 1, {"num": "1.5", "flag": True}),
            ("slow", 10, {"num": "not-a-number", "flag": "true"}),
        ):
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name=span_id,
                    span_kind="LLM",
                    start_time=_PARENT_PREDICATE_TS,
                    end_time=_PARENT_PREDICATE_TS + timedelta(seconds=seconds),
                    attributes=attributes,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param("latency_ms > 5000", ["slow"], id="scalar"),
        pytest.param("latency_ms >= 1000", ["fast", "slow"], id="scalar-inclusive"),
        pytest.param("5000 < latency_ms", ["slow"], id="number-on-left"),
        pytest.param("latency_ms in [1000, 10000]", ["fast", "slow"], id="membership"),
        pytest.param("latency_ms not in [1000]", ["slow"], id="negated-membership"),
        pytest.param("float('5000') < latency_ms", ["slow"], id="explicit-cast-of-string"),
        # dynamic values take the total cast, so an uncastable row drops out
        # rather than aborting the statement
        pytest.param("float(attributes['num']) > 1", ["fast"], id="uncastable-row-excluded"),
    ],
)
async def test_numeric_coercion_executes_against_the_database(
    db: DbSessionFactory,
    coercion_project: None,
    condition: str,
    expected: list[str],
) -> None:
    """Numeric coercion has to survive execution, not just compilation.

    `cast('1000', Float)` compiles on both dialects and then fails when the
    query runs, because asyncpg is asked to encode a `str` as a float parameter.
    Constructing a `SpanFilter` cannot catch that -- only running it can, which
    is why these assert rows rather than SQL.
    """
    span_filter = SpanFilter(condition)
    async with db() as session:
        span_ids = list(
            await session.scalars(
                span_filter(select(models.Span.span_id)).order_by(models.Span.span_id)
            )
        )
    assert span_ids == expected


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("annotations['café'].score < 0.5", id="multibyte-name"),
        pytest.param("annotations['日本語'].score < 0.5", id="cjk-name"),
        pytest.param("annotations['Q&A Correctness'].label == 'x'", id="ampersand-and-space"),
        pytest.param("annotations['span_annotation_0'].score > 0", id="alias-lookalike-name"),
        # a multi-byte *literal* ahead of the accessor: offsets are in bytes, so
        # this is where a character-based table would splice in the wrong place
        pytest.param(
            "attributes['uni'] == 'café' and annotations['q'].score > 0",
            id="multibyte-literal-before-accessor",
        ),
        pytest.param(
            "attributes['uni'] == '日本語' and annotations['q'].score > 0",
            id="cjk-literal-before-accessor",
        ),
        # multi-line sources exercise the line-offset table itself
        pytest.param(
            "(annotations['q'].score > 0\n and annotations['café'].score > 0)",
            id="multiline",
        ),
        pytest.param(
            "(attributes['uni'] == 'café'\n and annotations['日本語'].score > 0)",
            id="multiline-after-multibyte-literal",
        ),
        pytest.param(
            "(annotations['q'].score > 0\r\n and annotations['café'].score > 0)",
            id="multiline-crlf",
        ),
    ],
)
def test_annotation_aliasing_splices_at_the_right_offset(condition: str) -> None:
    """Annotation accessors are replaced by byte offset into the source.

    The offset table is built from the source text but matched against AST
    positions, so it has to agree with the tokenizer about where lines start.
    `str.splitlines` does not: it also breaks on \\v, \\f, \\x1c-\\x1e, \\x85,
    \\u2028 and \\u2029, none of which the tokenizer treats as a newline. A
    mismatch splices the alias at the wrong byte, which either corrupts the
    expression or silently rewrites a different part of it.
    """
    aliased, relations = _apply_eval_aliasing(condition)
    assert relations, "expected at least one aliased annotation relation"
    # a clean splice leaves no accessor behind
    assert "annotations[" not in aliased
    assert "evals[" not in aliased
    # and the spliced source is still a valid, compilable condition
    SpanFilter(condition)


def test_filter_rejects_membership_between_two_literals() -> None:
    """`1 in [1, 2]` translates to `1.in_([1, 2])`.

    That reaches evaluation inside `SpanFilter.__call__` and raises a bare
    `AttributeError`, which is the wrong exception type for what is simply an
    invalid condition -- direct callers see a crash rather than a filter error.
    """
    with pytest.raises(SyntaxError, match="compares two literals"):
        SpanFilter("1 in [1, 2]")


def test_unary_plus_does_not_negate_dynamic_json_attributes() -> None:
    """`+attributes['x']` used to translate to `-SafeJsonFloat(...)`.

    The cast branch hardcoded `USub`, so unary plus on a dynamic JSON attribute
    silently returned the rows of its negation. Native numeric columns took a
    different branch and were unaffected, which is why it went unnoticed.
    """
    positive = str(
        SpanFilter("+metadata['x'] > 5")(select(models.Span.id)).compile(
            dialect=postgresql.dialect()  # type: ignore[no-untyped-call]
        )
    )
    negative = str(
        SpanFilter("-metadata['x'] > 5")(select(models.Span.id)).compile(
            dialect=postgresql.dialect()  # type: ignore[no-untyped-call]
        )
    )
    assert positive != negative
    assert "-" not in positive.split("WHERE")[-1].split(">")[0]


@pytest.mark.parametrize(
    "condition",
    [
        "start_time < '2024-01-01T00:00:00Z'",
        "latency_ms == None",
    ],
)
def test_filter_accepts_previously_valid_conditions(condition: str) -> None:
    # Quoted numbers (`latency_ms > '100'`) deliberately no longer appear here:
    # they were only ever valid on SQLite. See
    # `test_filter_rejects_quoted_numbers_against_numeric_fields`.
    SpanFilter(condition)


def test_filter_rejects_zero_argument_cast() -> None:
    with pytest.raises(SyntaxError, match="invalid expression"):
        SpanFilter("float() > 1")


def test_filter_rejects_string_column_vs_datetime_column_comparison() -> None:
    with pytest.raises(SyntaxError, match="cannot compare"):
        SpanFilter("name == start_time")


async def test_filter_iso_datetime_string_executes(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    span_filter = SpanFilter("start_time >= '2021-01-01T00:00:00+00:00'")

    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids)


async def test_filter_non_numeric_json_cast_excludes_rows(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span = await session.scalar(select(models.Span).order_by(models.Span.id).limit(1))
        assert span is not None
        span.attributes = {**span.attributes, "metadata": {"value": "not-a-number"}}

    span_filter = SpanFilter("float(metadata['value']) > 1")
    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == []


async def test_filter_numeric_json_string_cast_matches(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span = await session.scalar(select(models.Span).order_by(models.Span.id).limit(1))
        assert span is not None
        span.attributes = {**span.attributes, "metadata": {"value": "1.25"}}

    span_filter = SpanFilter("float(metadata['value']) == 1.25")
    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == [span.id]


async def test_filter_non_boolean_json_cast_excludes_rows(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span = await session.scalar(select(models.Span).order_by(models.Span.id).limit(1))
        assert span is not None
        span.attributes = {**span.attributes, "metadata": {"flag": "not-a-boolean"}}

    span_filter = SpanFilter("metadata['flag'] in [False]")
    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == []


async def test_filter_boolean_json_string_cast_matches(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span = await session.scalar(select(models.Span).order_by(models.Span.id).limit(1))
        assert span is not None
        span.attributes = {**span.attributes, "metadata": {"flag": "false"}}

    span_filter = SpanFilter("metadata['flag'] is False")
    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == [span.id]


async def test_filter_real_json_boolean_matches(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span = await session.scalar(select(models.Span).order_by(models.Span.id).limit(1))
        assert span is not None
        span.attributes = {**span.attributes, "metadata": {"flag": True}}

    span_filter = SpanFilter("metadata['flag'] is True")
    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == [span.id]


async def test_filter_datetime_in_tuple_matches(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span = await session.scalar(select(models.Span).order_by(models.Span.id).limit(1))
        assert span is not None
        iso = span.start_time.isoformat()

    span_filter = SpanFilter(f"start_time in ('{iso}',)")
    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert span.id in list(span_ids)


async def test_filter_numeric_null_comparison_executes(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        none_ids = await session.scalars(SpanFilter("latency_ms == None")(select(models.Span.id)))
        assert list(none_ids) == []
        not_none_ids = await session.scalars(
            SpanFilter("latency_ms != None")(select(models.Span.id))
        )
        assert list(not_none_ids)


@pytest.mark.parametrize("operator", ["/", "%"])
async def test_filter_zero_denominator_excludes_rows(
    db: DbSessionFactory,
    default_project: Any,
    operator: str,
) -> None:
    span_filter = SpanFilter(f"latency_ms {operator} 0 > 1")

    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == []


async def test_filter_annotation_explanation_executes(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span_id = await session.scalar(select(models.Span.id).order_by(models.Span.id).limit(1))
        assert span_id is not None
        session.add(
            models.SpanAnnotation(
                span_rowid=span_id,
                name="quality",
                label=None,
                score=None,
                explanation="contains the needle",
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
            )
        )

    span_filter = SpanFilter("'needle' in annotations['quality'].explanation")

    async with db() as session:
        span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(span_ids) == [span_id]


async def test_filter_annotation_name_uses_python_string_escaping(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    async with db() as session:
        span_id = await session.scalar(select(models.Span.id).order_by(models.Span.id).limit(1))
        assert span_id is not None
        session.add(
            models.SpanAnnotation(
                span_rowid=span_id,
                name='rate"limit',
                label="limited",
                score=None,
                explanation=None,
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
            )
        )

    span_filter = SpanFilter(r"""annotations["rate\"limit"].label == 'limited' """)
    async with db() as session:
        matched_span_ids = await session.scalars(span_filter(select(models.Span.id)))

    assert list(matched_span_ids) == [span_id]


@pytest.mark.parametrize(
    "filter_condition,expected",
    [
        pytest.param(
            """evals["Q&A Correctness"].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="double-quoted-eval-name",
        ),
        pytest.param(
            """evals['Q&A Correctness'].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="single-quoted-eval-name",
        ),
        pytest.param(
            """evals[""].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="empty-eval-name",
        ),
        pytest.param(
            """evals['Hallucination'].label == 'correct' or evals['Hallucination'].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' or span_annotation_0_score_00000000000000000000000000000000 < 0.5",
            id="repeated-single-quoted-eval-name",
        ),
        pytest.param(
            """evals["Hallucination"].label == 'correct' or evals["Hallucination"].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' or span_annotation_0_score_00000000000000000000000000000000 < 0.5",
            id="repeated-double-quoted-eval-name",
        ),
        pytest.param(
            """evals['Hallucination'].label == 'correct' or evals["Hallucination"].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' or span_annotation_0_score_00000000000000000000000000000000 < 0.5",
            id="repeated-mixed-quoted-eval-name",
        ),
        pytest.param(
            """evals['Q&A Correctness'].label == 'correct' and evals["Hallucination"].score < 0.5""",
            "span_annotation_0_label_00000000000000000000000000000000 == 'correct' and span_annotation_1_score_00000000000000000000000000000000 < 0.5",
            id="distinct-mixed-quoted-eval-names",
        ),
        pytest.param(
            """evals["Hallucination].label is not None""",
            """evals["Hallucination].label is not None""",
            id="missing-right-quotation-mark",
        ),
        pytest.param(
            """evals["Hallucination"].label == 'correct' orevals["Hallucination"].score < 0.5""",
            """evals["Hallucination"].label == 'correct' orevals["Hallucination"].score < 0.5""",
            id="no-word-boundary-on-the-left",
        ),
        pytest.param(
            """evals["Hallucination"].scoreq < 0.5""",
            """evals["Hallucination"].scoreq < 0.5""",
            id="no-word-boundary-on-the-right",
        ),
        pytest.param(
            """0.5 <evals["Hallucination"].score""",
            """0.5 <span_annotation_0_score_00000000000000000000000000000000""",
            id="left-word-boundary-without-space",
        ),
        pytest.param(
            """evals["Hallucination"].score< 0.5""",
            """span_annotation_0_score_00000000000000000000000000000000< 0.5""",
            id="right-word-boundary-without-space",
        ),
        pytest.param(
            """annotations["Q&A Correctness"].label is not None""",
            "span_annotation_0_label_00000000000000000000000000000000 is not None",
            id="double-quoted-annotation-name",
        ),
        # Existence checks (bare annotation reference)
        pytest.param(
            """evals['Hallucination']""",
            "span_annotation_0_exists_00000000000000000000000000000000",
            id="bare-evals-exists",
        ),
        pytest.param(
            """annotations['Hallucination']""",
            "span_annotation_0_exists_00000000000000000000000000000000",
            id="bare-annotations-exists",
        ),
        pytest.param(
            """'annotations[\"quality\"].label' in name or annotations[\"quality\"].label == 'good'""",
            """'annotations[\"quality\"].label' in name or span_annotation_0_label_00000000000000000000000000000000 == 'good'""",
            id="annotation-spelling-inside-string-literal",
        ),
        pytest.param(
            """metadata['café'] == 'yes' and annotations["quality"].label == 'good'""",
            """metadata['café'] == 'yes' and span_annotation_0_label_00000000000000000000000000000000 == 'good'""",
            id="unicode-before-annotation",
        ),
        pytest.param(
            """trace_annotations['quality'].score >= 0.5""",
            "trace_annotation_0_score_00000000000000000000000000000000 >= 0.5",
            id="trace-annotation-score",
        ),
        pytest.param(
            """trace_annotations['quality'].label == 'good'""",
            "trace_annotation_0_label_00000000000000000000000000000000 == 'good'",
            id="trace-annotation-label",
        ),
        pytest.param(
            """trace_annotations['quality']""",
            "trace_annotation_0_exists_00000000000000000000000000000000",
            id="bare-trace-annotation-exists",
        ),
        pytest.param(
            """trace_annotations['q'].score > 0.5 and annotations['q'].score < 0.5""",
            "trace_annotation_0_score_00000000000000000000000000000000 > 0.5 "
            "and span_annotation_1_score_00000000000000000000000000000000 < 0.5",
            id="mixed-trace-and-span-annotation",
        ),
        pytest.param(
            """annotations['q'].score < 0.5 and trace_annotations['q'].score > 0.5""",
            "span_annotation_0_score_00000000000000000000000000000000 < 0.5 "
            "and trace_annotation_1_score_00000000000000000000000000000000 > 0.5",
            id="mixed-span-and-trace-annotation",
        ),
    ],
)
def test_apply_eval_aliasing(filter_condition: str, expected: str) -> None:
    with patch.object(
        phoenix.trace.dsl.filter,
        "uuid4",
        return_value=UUID(hex="00000000000000000000000000000000"),
    ):
        aliased, _ = _apply_eval_aliasing(filter_condition)
        assert aliased == expected


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("trace_annotations['quality'].score >= 0.5", id="score"),
        pytest.param("trace_annotations['quality'].label == 'good'", id="label"),
        pytest.param("trace_annotations['quality']", id="exists"),
    ],
)
async def test_trace_annotation_filter_joins_trace_annotation_relation(
    db: DbSessionFactory,
    condition: str,
    default_project: Any,
    abc_project: Any,
) -> None:
    span_filter = SpanFilter(condition)
    assert [relation.kind for relation in span_filter._aliased_annotation_relations] == ["trace"]
    statement = span_filter(select(models.Span.id)).order_by(models.Span.id)
    compiled = str(statement)
    assert "trace_annotations" in compiled
    assert "span_annotations" not in compiled
    async with db() as session:
        trace_rowid = await session.scalar(
            select(models.Trace.id).where(models.Trace.trace_id == "0123")
        )
        assert trace_rowid is not None
        expected = list(
            await session.scalars(
                select(models.Span.id)
                .where(models.Span.trace_rowid == trace_rowid)
                .order_by(models.Span.id)
            )
        )
        await session.execute(
            insert(models.TraceAnnotation).values(
                trace_rowid=trace_rowid,
                name="quality",
                label="good",
                score=0.75,
                explanation="clear rationale",
                metadata_={},
                annotator_kind="LLM",
                identifier="",
                source="APP",
                user_id=None,
            )
        )
        await session.execute(
            insert(models.TraceAnnotation).values(
                trace_rowid=trace_rowid,
                name="quality",
                label="good",
                score=0.9,
                explanation="clear secondary rationale",
                metadata_={},
                annotator_kind="LLM",
                identifier="secondary",
                source="APP",
                user_id=None,
            )
        )
        assert list(await session.scalars(statement)) == expected


async def test_annotation_syntax_in_string_literal_is_not_aliased(
    db: DbSessionFactory,
    default_project: Any,
) -> None:
    condition = '''name == "trace_annotations['quality'].score"'''
    span_filter = SpanFilter(condition)
    assert not span_filter._aliased_annotation_relations
    async with db() as session:
        await session.execute(span_filter(select(models.Span.id)))


def test_trace_annotation_name_with_escaped_quote() -> None:
    span_filter = SpanFilter(r'trace_annotations["reviewer \"A\""].score >= 0.5')
    assert [relation.name for relation in span_filter._aliased_annotation_relations] == [
        'reviewer "A"'
    ]


async def test_span_and_trace_annotations_join_distinct_relations(
    db: DbSessionFactory,
    default_project: Any,
    abc_project: Any,
) -> None:
    span_filter = SpanFilter(
        "annotations['quality'].score >= 0.5 and trace_annotations['quality'].score >= 0.5"
    )
    assert sorted(relation.kind for relation in span_filter._aliased_annotation_relations) == [
        "span",
        "trace",
    ]
    statement = span_filter(select(models.Span.id))
    compiled = str(statement)
    assert "trace_annotations" in compiled
    assert "span_annotations" in compiled
    async with db() as session:
        trace_rows = await session.execute(
            select(models.Trace.trace_id, models.Trace.id).where(
                models.Trace.trace_id.in_(["0123", "012"])
            )
        )
        trace_rowids: dict[str, int] = dict(trace_rows.tuples().all())
        span_rows = await session.execute(
            select(models.Span.span_id, models.Span.id).where(
                models.Span.span_id.in_(["2345", "4567", "234"])
            )
        )
        span_rowids: dict[str, int] = dict(span_rows.tuples().all())
        await session.execute(
            insert(models.TraceAnnotation),
            [
                {
                    "trace_rowid": trace_rowids["0123"],
                    "name": "quality",
                    "score": 0.9,
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "identifier": "",
                    "source": "APP",
                },
                {
                    "trace_rowid": trace_rowids["012"],
                    "name": "quality",
                    "score": 0.1,
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "identifier": "",
                    "source": "APP",
                },
            ],
        )
        await session.execute(
            insert(models.SpanAnnotation),
            [
                {
                    "span_rowid": span_rowids["2345"],
                    "name": "quality",
                    "score": 0.9,
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "identifier": "",
                    "source": "APP",
                },
                {
                    "span_rowid": span_rowids["4567"],
                    "name": "quality",
                    "score": 0.1,
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "identifier": "",
                    "source": "APP",
                },
                {
                    "span_rowid": span_rowids["234"],
                    "name": "quality",
                    "score": 0.9,
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "identifier": "",
                    "source": "APP",
                },
            ],
        )

        matched_span_rowids = list(await session.scalars(statement))

    assert matched_span_rowids == [span_rowids["2345"]]


class TestProjectorValidationGap:
    """
    Pins the closure of two structural defects ``Projector`` used to have in
    ``src/phoenix/trace/dsl/filter.py``:

    1. It ran no validation before translation, so AST shapes ``SpanFilter``
       rejects reached compilation (``10 ** 100000000`` compiled with an
       unbounded exponent). ``_validate_projection_expression`` now walks the
       tree against an allowlist of node types.
    2. Its ``eval()`` namespace did not pin ``__builtins__``, so CPython
       auto-populated the full builtins dict -- ``__import__``, ``open``,
       ``exec`` -- into the namespace. It is now pinned to ``{}``.

    These began as red tests demonstrating the vulnerability and are kept as
    regression pins. ``Projector`` validation remains narrower than
    ``SpanFilter``'s on purpose -- a projection is a value, not a predicate,
    so the operand-type and boolean-position rules do not apply -- but the
    structural allowlist and the sandbox must hold.

    ``SpanFilter.__call__`` evaluates through the same mechanism and gets the
    same pin below: the pinning is one dict literal that a refactor could
    "simplify" away while passing every grammar test.
    """

    def test_projector_rejects_confusable_identifiers(self) -> None:
        # Python NFKC-normalizes identifiers, so a full-width projection name
        # silently resolved to the ASCII field the user never spelled. The
        # projector now runs the same inherited-surface rules as the filter.
        with pytest.raises(SyntaxError, match="is interpreted as"):
            Projector("ｎａｍｅ")

    def test_span_filter_eval_namespace_has_no_builtins_access(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        span_filter = SpanFilter("name == 'x'")

        captured_globals: list[dict[str, Any]] = []
        real_eval = eval

        def spy_eval(code: Any, globals_dict: dict[str, Any], locals_dict: Any = None) -> Any:
            captured_globals.append(globals_dict)
            return real_eval(code, globals_dict, locals_dict)

        monkeypatch.setattr("phoenix.trace.dsl.filter.eval", spy_eval, raising=False)
        span_filter(select(models.Span.id))

        assert captured_globals
        for globals_dict in captured_globals:
            assert globals_dict.get("__builtins__") == {}, (
                "SpanFilter eval namespace must pin __builtins__ to {}; "
                "anything else exposes the full builtins dict to whatever "
                "survives the translator."
            )

    def test_projector_rejects_what_spanfilter_rejects(self) -> None:
        # ``SpanFilter`` rejects this via ``_validate_expression`` — but
        # ``Projector`` accepts it because it has no equivalent validation.
        # An attacker who reaches the projection code path (e.g. via the
        # SpanQuery REST/GraphQL projection key) can submit arbitrary AST
        # shapes that bypass the structural guardrails ``SpanFilter`` enforces.
        dangerous_expression = "10 ** 100000000"

        with pytest.raises(SyntaxError):
            SpanFilter(dangerous_expression)

        # This assertion FAILS on current code: ``Projector`` happily
        # compiles the unbounded-exponent expression with no validation.
        with pytest.raises(SyntaxError):
            Projector(dangerous_expression)

    def test_projector_eval_namespace_has_no_builtins_access(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # ``Projector.__call__`` evaluates the compiled AST inside an ``eval``
        # call. The eval namespace must pin ``__builtins__`` to ``{}``;
        # otherwise CPython auto-populates the full builtins dict, exposing
        # ``__import__``, ``open``, ``exec``, ``eval``, etc. to anything that
        # survives the AST translator.
        projector = Projector("name")

        captured_globals: list[dict[str, Any]] = []
        real_eval = eval

        def spy_eval(code: Any, globals_dict: dict[str, Any], locals_dict: Any = None) -> Any:
            captured_globals.append(globals_dict)
            return real_eval(code, globals_dict, locals_dict)

        # Inject the spy into the module's namespace; Python looks up bare
        # ``eval`` in module globals before falling back to builtins, so this
        # intercepts the call inside ``Projector.__call__``.
        monkeypatch.setattr("phoenix.trace.dsl.filter.eval", spy_eval, raising=False)
        projector()

        assert len(captured_globals) == 1
        builtins_obj = captured_globals[0].get("__builtins__")
        assert builtins_obj == {}, (
            "Projector eval namespace must pin __builtins__ to {} to prevent "
            "code-injection vectors; instead it exposes "
            f"{len(builtins_obj) if builtins_obj else 0} builtins."
        )


_PARENT_PREDICATE_TS = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")


@pytest.fixture
async def parent_predicate_project(db: DbSessionFactory) -> None:
    """
    A project whose single trace exercises every parent case:

    - ``A`` root span (``parent_id`` is NULL)
    - ``B`` child of ``A``
    - ``C`` orphan (``parent_id`` ``"GHOST"`` references a span absent from the table)
    - ``D`` child of the orphan ``C``
    """
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="parent-predicate").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace-parent-predicate",
                project_rowid=project_rowid,
                start_time=_PARENT_PREDICATE_TS,
                end_time=_PARENT_PREDICATE_TS,
            )
            .returning(models.Trace.id)
        )
        for span_id, parent_id, span_kind in (
            ("A", None, "CHAIN"),
            ("B", "A", "LLM"),
            ("C", "GHOST", "LLM"),
            ("D", "C", "LLM"),
        ):
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=parent_id,
                    name=span_id,
                    span_kind=span_kind,
                    start_time=_PARENT_PREDICATE_TS,
                    end_time=_PARENT_PREDICATE_TS,
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )


@pytest.mark.parametrize(
    "condition,expected",
    [
        # `parent_span is None` is orphan-aware: both the NULL-parent root and the orphan.
        ("parent_span is None", ["A", "C"]),
        ("parent_span is not None", ["B", "D"]),
        # `parent_id is None` stays strict (NULL pointer only), unchanged by this work.
        ("parent_id is None", ["A"]),
        ("parent_span is None and span_kind == 'LLM'", ["C"]),
        ("parent_span is not None or parent_id is None", ["A", "B", "D"]),
    ],
)
async def test_parent_root_predicate_selects_expected_spans(
    db: DbSessionFactory,
    parent_predicate_project: None,
    condition: str,
    expected: list[str],
) -> None:
    f = SpanFilter(condition)
    async with db() as session:
        span_ids = list(
            await session.scalars(f(select(models.Span.span_id)).order_by(models.Span.span_id))
        )
    assert span_ids == expected


@pytest.mark.parametrize(
    "condition",
    [
        "parent_span",  # bare keyword, not a comparison
        "parent_span == 'LLM'",  # compared to a non-None value
        "parent_span and span_kind == 'LLM'",  # used outside a None comparison
        "parent_span < None",  # unsupported operator with None
        # `parent.<field>` traversal is not supported yet; the reserved keyword is
        # fully locked down, so these must raise rather than silently resolve to
        # the pre-existing `attributes['parent_span'][...]` attribute path.
        "parent_span.span_kind == 'AGENT'",
        "parent_span.name == 'x'",
        "parent_span.a.b.c == 'z'",
        "parent_span.attributes['x'] == 'y'",
        "'x' in parent_span.name",
    ],
)
def test_parent_keyword_rejects_unsupported_usage(condition: str) -> None:
    with pytest.raises(SyntaxError):
        SpanFilter(condition)


def test_attribute_named_parent_span_still_reachable_explicitly() -> None:
    # Reserving `parent_span` does not remove access to a span attribute literally
    # named `parent_span`: it is still reachable via the explicit subscript form,
    # whose root is `attributes`, not the `parent_span` keyword.
    SpanFilter("attributes['parent_span'] == 'x'")  # does not raise


@pytest.mark.parametrize(
    "sentinel",
    ["__parent_is_null__", "__parent_is_not_null__"],
)
def test_parent_predicate_sentinels_unreachable_from_user_input(sentinel: str) -> None:
    """The names bound to the root-existence predicates in the eval namespace must
    not be reachable from user input. Because the translator rewrites every
    non-reserved bare identifier into an ``attributes[[...]]`` subscript before
    compilation, a user who types a sentinel name gets an ordinary attribute
    lookup, never the injected predicate. This locks that invariant so later
    translator changes (e.g. parent-column traversal) cannot regress it.
    """
    translated = unparse(SpanFilter(f"{sentinel} == 'x'").translated).strip()
    # resolves to an attribute path, not the bare injected name
    assert translated.startswith(f"attributes[['{sentinel}']]")


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param("", None, id="empty"),
        pytest.param("parent_span is None", "orphan_aware", id="orphan-aware"),
        pytest.param("parent_id is None", "strict", id="strict"),
        pytest.param("parent_span == None", "orphan_aware", id="eq-spelling"),
        pytest.param("None is parent_span", "orphan_aware", id="reversed-operands"),
        pytest.param("span_kind == 'LLM'", None, id="unrelated-condition"),
        pytest.param(
            "parent_span is None and span_kind == 'LLM'",
            "orphan_aware",
            id="leading-conjunct",
        ),
        pytest.param(
            "span_kind == 'LLM' and parent_id is None",
            "strict",
            id="trailing-conjunct",
        ),
        pytest.param(
            "(span_kind == 'LLM' and parent_span is None) and latency_ms > 5",
            "orphan_aware",
            id="nested-conjunct",
        ),
        # Conjoined restrictions compound, so the narrower one is what the
        # condition actually selects.
        pytest.param(
            "parent_span is None and parent_id is None",
            "strict",
            id="both-predicates-narrowest-wins",
        ),
        # A root predicate under `or` leaves non-root spans in the result set,
        # so the condition imposes no root restriction at all.
        pytest.param("parent_span is None or span_kind == 'LLM'", None, id="disjunction"),
        pytest.param("not (parent_span is None)", None, id="negation"),
        pytest.param("parent_span is not None", None, id="non-root-predicate"),
        # An in-progress edit must not raise.
        pytest.param("span_kind == 'LLM' and", None, id="unparseable"),
    ],
)
def test_root_span_scope_reports_what_the_condition_restricts_to(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # Every branch of the disjunction is root-scoped, so every matching row
        # is a root span even though no single conjunct binds the whole
        # expression.
        pytest.param(
            "(parent_id is None and span_kind == 'LLM') or (parent_id is None and latency_ms > 5)",
            "strict",
            id="all-branches-strict",
        ),
        # Branch scopes union rather than intersect, so the widest wins: a row
        # from the orphan-aware branch need not satisfy the strict one.
        pytest.param(
            "(parent_id is None and a == 1) or (parent_span is None and b == 2)",
            "orphan_aware",
            id="all-branches-widest-wins",
        ),
        # One unscoped branch admits non-root rows, so the whole is unscoped.
        pytest.param(
            "(parent_id is None and a == 1) or b == 2",
            None,
            id="one-branch-unscoped",
        ),
        # `not (x is not None)` is the double negative of a root predicate.
        pytest.param("not (parent_id is not None)", "strict", id="negated-is-not-none"),
        pytest.param("not (parent_span is not None)", "orphan_aware", id="negated-orphan-aware"),
        # Negating a root predicate selects non-root spans, the opposite.
        pytest.param("not (parent_id is None)", None, id="negated-root-predicate"),
    ],
)
def test_root_span_scope_handles_disjunctions_and_negations(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    assert root_span_scope(condition) == expected


# `root_span_scope` has two consumers with two different failure modes, so it
# owes two separate guarantees.
#
# SOUNDNESS, covered here: a non-None answer must be true. The query builders
# drop the `root_spans_only` flag's SQL on the strength of it, so an over-claim
# readmits the rows that flag would have excluded -- the only failure mode that
# changes a result set.
#
# COMPLETENESS, covered by the scope tests above: supported root-only forms must
# return a scope. This is *not* merely an optimization concern.
# `analyzeSpanFilterCondition` surfaces the same answer to the frontend, which
# reads None as "not root-scoped" and picks per-span rather than cumulative
# metric columns. So under-claiming cannot change which rows come back, but it
# is user-visible, and unsupported forms are a known gap rather than a
# non-issue.
#
# Below: conditions that admit at least one non-root span, all of which must
# return None.
_CONDITIONS_ADMITTING_NON_ROOT_SPANS = [
    "span_kind == 'LLM'",
    "parent_id is not None",
    "parent_span is not None",
    "not (parent_id is None)",
    "not (parent_span is None)",
    # compared to something other than None
    "parent_id == 'abc'",
    "parent_id != None",
    "'x' in parent_id",
    # an *attribute* that happens to be named parent_id is a different thing
    "attributes['parent_id'] is None",
    # one unscoped branch is enough to admit non-root rows
    "parent_id is None or span_kind == 'LLM'",
    "parent_id is None or True",
    "(parent_id is None and span_kind == 'CHAIN') or span_kind == 'LLM'",
    "parent_span is None or parent_id is not None",
    # a tautology matches everything, root or not
    "parent_id is None or parent_id is not None",
    # De Morgan: `parent_id is not None or span_kind != 'LLM'`, which admits
    # any span whose kind is not LLM, root or not.
    "not (parent_id is None and span_kind == 'LLM')",
]


@pytest.mark.parametrize("condition", _CONDITIONS_ADMITTING_NON_ROOT_SPANS)
def test_root_span_scope_never_over_claims_on_non_root_conditions(condition: str) -> None:
    assert root_span_scope(condition) is None


# Conditions restricting to orphan-aware roots but *not* to strict roots: they
# match spans whose parent_id is set but absent from the table. Reporting
# "strict" for any of these would let a caller drop a strict `root_spans_only`
# flag, readmitting the orphans that flag exists to exclude.
_ORPHAN_AWARE_BUT_NOT_STRICT_CONDITIONS = [
    "parent_span is None",
    "parent_span == None",
    "None is parent_span",
    "parent_span is None and span_kind == 'CHAIN'",
    "(parent_span is None and span_kind == 'CHAIN') or (parent_span is None and latency_ms > 5)",
    "not (parent_span is not None)",
]


@pytest.mark.parametrize("condition", _ORPHAN_AWARE_BUT_NOT_STRICT_CONDITIONS)
def test_root_span_scope_never_over_claims_strictness(condition: str) -> None:
    assert root_span_scope(condition) != "strict"


@pytest.mark.parametrize(
    "condition,expected",
    [
        # Double negation is the identity on which rows come back.
        pytest.param("not not (parent_id is None)", "strict", id="double-negation"),
        pytest.param("not not (parent_span is None)", "orphan_aware", id="double-negation-orphan"),
        # A chained comparison is a conjunction of its links.
        pytest.param("None is parent_id is None", "strict", id="chained-comparison"),
        pytest.param("None is parent_span is None", "orphan_aware", id="chained-comparison-orphan"),
        # ...so an unscoped link drops out rather than disqualifying the chain.
        pytest.param(
            "span_kind == 'CHAIN' and None is parent_id is None",
            "strict",
            id="chained-comparison-in-conjunction",
        ),
    ],
)
def test_root_span_scope_classifies_equivalent_rewrites(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    """Forms that mean the same thing as a plain root predicate must classify the
    same way, since the frontend picks metric columns off this answer."""
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # `not (A or B)` is `not A and not B`: one restricting conjunct bounds
        # the whole, so an unrestricting sibling drops out.
        pytest.param(
            "not (parent_id is not None or span_kind == 'LLM')",
            "strict",
            id="not-or-strict",
        ),
        pytest.param(
            "not (parent_span is not None or span_kind == 'LLM')",
            "orphan_aware",
            id="not-or-orphan-aware",
        ),
        # `not (A and B)` is `not A or not B`: a disjunction, so *every* negated
        # branch has to restrict.
        pytest.param(
            "not (parent_id is not None and parent_span is not None)",
            "orphan_aware",
            id="not-and-both-negated-branches-restrict",
        ),
        pytest.param(
            "not (parent_id is not None and span_kind == 'LLM')",
            None,
            id="not-and-one-branch-unrestricting",
        ),
        # Nested polarity: two negations restore the original sense.
        pytest.param(
            "not (not (parent_id is None) and span_kind == 'LLM')",
            None,
            id="nested-negation-disjunction",
        ),
        pytest.param(
            "not (not (parent_id is None) or span_kind == 'LLM')",
            "strict",
            id="nested-negation-conjunction",
        ),
        # A literal-True conjunct negates to a literal-False branch, which
        # contributes no rows and folds out of the disjunction.
        pytest.param(
            "not (parent_id is not None and True)",
            "strict",
            id="not-and-true-folds",
        ),
        # ...whereas negating a literal-False conjunct yields a branch matching
        # everything, so nothing is restricted.
        pytest.param(
            "not (parent_id is not None and False)",
            None,
            id="not-and-false-does-not-fold",
        ),
    ],
)
def test_root_span_scope_applies_de_morgan(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    """Negation is handled by flipping polarity during the descent, so `and` and
    `or` swap roles under a `not`. These pin both directions, including the ones
    that must stay unrestricted -- a swapped rule would over-claim there."""
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition,expected",
    [
        # A literal that can never be TRUE returns nothing, and an empty result
        # is vacuously root-scoped -- so such a branch cannot widen a disjunction
        # and drops out of one on its own.
        pytest.param("parent_id is None or False", "strict", id="or-false"),
        pytest.param("parent_id is None or None", "strict", id="or-null"),
        pytest.param("parent_id is None or not True", "strict", id="or-not-true"),
        pytest.param("not (parent_id is not None and None)", "strict", id="not-and-null"),
        pytest.param(
            "parent_span is None or (False and span_kind == 'LLM')",
            "orphan_aware",
            id="or-never-true-conjunction",
        ),
        # `None` is never TRUE in either sense -- `not NULL` is NULL, still not
        # TRUE -- whereas `not False` is always TRUE and restricts nothing.
        pytest.param("parent_id is None or not None", "strict", id="or-not-null"),
        pytest.param("parent_id is None or not False", None, id="or-not-false"),
        pytest.param("parent_id is None or True", None, id="or-true"),
        # A never-TRUE conjunct empties the whole conjunction, which is
        # vacuously root-scoped.
        pytest.param("span_kind == 'LLM' and False", "strict", id="and-false"),
        # ...but as a disjunct it leaves the other branch's rows, which are not
        # root-scoped.
        pytest.param("span_kind == 'LLM' or False", None, id="or-false-unscoped-sibling"),
    ],
)
def test_root_span_scope_treats_never_true_literals_as_vacuously_scoped(
    condition: str,
    expected: typing.Optional[RootSpanScope],
) -> None:
    """Constant folding is not special-cased: mapping a never-TRUE leaf to the
    narrowest scope makes it fall out of the same lattice rules as everything
    else."""
    assert root_span_scope(condition) == expected


@pytest.mark.parametrize(
    "condition",
    [
        pytest.param("not " * 2000 + "(parent_id is None)", id="deep-negation"),
        pytest.param("(" * 2000 + "parent_id is None" + ")" * 2000, id="deep-grouping"),
        pytest.param(" or ".join(["parent_id is None"] * 2000), id="wide-disjunction"),
    ],
)
def test_root_span_scope_survives_pathologically_nested_input(condition: str) -> None:
    """The analyzer is reachable from the API with an arbitrary string, so input
    deep enough to exhaust the stack has to read as "cannot tell" rather than
    escaping as a RecursionError."""
    assert root_span_scope(condition) in (None, "strict")


# Atoms for the generated corpus below. The root predicates appear in both
# spellings and both polarities; the ordinary predicates discriminate among the
# fixture's spans without saying anything about parentage; the constants exist
# to exercise the never-TRUE folding.
_CORPUS_ATOMS = (
    "parent_id is None",
    "parent_id is not None",
    "parent_span is None",
    "parent_span is not None",
    "span_kind == 'LLM'",
    "name == 'A'",
    "name == 'C'",
    "status_code == 'OK'",
    "True",
    "False",
    "None",
)


def _generate_expression(rand: random.Random, depth: int) -> str:
    if depth <= 0:
        return rand.choice(_CORPUS_ATOMS)
    kind = rand.choice(("atom", "atom", "and", "or", "not"))
    if kind == "atom":
        return rand.choice(_CORPUS_ATOMS)
    if kind == "not":
        return f"not ({_generate_expression(rand, depth - 1)})"
    joiner = " and " if kind == "and" else " or "
    operands = [_generate_expression(rand, depth - 1) for _ in range(rand.randint(2, 3))]
    return "(" + joiner.join(operands) + ")"


async def test_root_span_scope_never_over_claims_against_generated_expressions(
    db: DbSessionFactory,
    parent_predicate_project: None,
) -> None:
    """Checks soundness against the database rather than against expectations.

    Every other test here asserts a hand-authored answer, which only ever
    confirms the cases someone thought of. This one generates boolean
    expressions, and wherever the analyzer commits to a scope it runs the
    condition as SQL and requires that every row actually returned satisfies
    that scope. So the analyzer is checked against the translator and the
    database's own three-valued logic, not against a second model of them.

    Only over-claiming is a failure. A ``None`` verdict is allowed for anything,
    since under-claiming is the safe direction.
    """
    rand = random.Random(14497)
    # `A` is the only strict root; `C` is an orphan, a root only in the wider
    # sense; `B` and `D` have parents present in the table.
    allowed_by_scope = {"strict": {"A"}, "orphan_aware": {"A", "C"}}

    exercised: Counter[str] = Counter()
    async with db() as session:
        for _ in range(400):
            condition = _generate_expression(rand, depth=3)
            scope = root_span_scope(condition)
            if scope is None:
                continue
            try:
                span_filter = SpanFilter(condition)
            except SyntaxError:
                # e.g. a bare constant, which the DSL rejects as a whole condition
                continue
            returned = set(await session.scalars(span_filter(select(models.Span.span_id))))
            assert returned <= allowed_by_scope[scope], (
                f"{condition!r} was reported as {scope!r} but returned {sorted(returned)}"
            )
            exercised[scope] += 1
            if "not " in condition:
                exercised["negated"] += 1
            if any(literal in condition for literal in ("True", "False", "None")):
                exercised["with_literal"] += 1
            if returned:
                # The assertion above is vacuously satisfied by an empty result,
                # so at least some verdicts have to be checked against rows that
                # were actually returned.
                exercised["returned_rows"] += 1

    # Without this the assertions above could pass on a corpus that had
    # degenerated -- into expressions that never commit to a scope, that only
    # ever reach one verdict, or that all match nothing.
    minimums = {
        "strict": 5,
        "orphan_aware": 3,
        "negated": 3,
        "with_literal": 3,
        "returned_rows": 5,
    }
    missing = {k: (exercised[k], n) for k, n in minimums.items() if exercised[k] < n}
    assert not missing, f"corpus under-exercised (got, wanted): {missing}; all: {dict(exercised)}"


@pytest.mark.parametrize(
    "condition,expected_message",
    [
        pytest.param(
            "not " * 500 + "(parent_id is None)",
            "nested too deeply",
            id="deep-negation",
        ),
        # CPython's parser rejects deeply nested grouping on its own, before any
        # stack is exhausted, so this arrives as a SyntaxError already. Its
        # wording belongs to the interpreter and varies by version, so only the
        # type is asserted -- the invariant is the same either way.
        pytest.param(
            "(" * 500 + "parent_id is None" + ")" * 500,
            None,
            id="deep-grouping",
        ),
    ],
)
def test_span_filter_reports_deeply_nested_input_as_malformed(
    condition: str,
    expected_message: typing.Optional[str],
) -> None:
    """Every stage of construction recurses -- the parser, the validator, the
    translator, `compile` -- and conditions arrive from the API, so input deep
    enough to exhaust the stack has to surface as a malformed filter rather than
    as a RecursionError escaping from whichever stage ran out first."""
    with pytest.raises(SyntaxError, match=expected_message):
        SpanFilter(condition)
