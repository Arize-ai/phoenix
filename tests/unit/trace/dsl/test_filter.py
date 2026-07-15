import ast
import sys
from ast import unparse
from typing import Any, Optional
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy import select

import phoenix.trace.dsl.filter
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import (
    Projector,
    SpanFilter,
    _apply_eval_aliasing,
    _get_attribute_keys_list,
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
            "or_(and_(parent_id != None, TextContains(name, 'abc')), and_(span_kind == 'LLM', span_id.in_(('123',))))"
            if sys.version_info >= (3, 9)
            else "or_(and_((parent_id != None), TextContains(name, 'abc')), and_((span_kind == 'LLM'), span_id.in_(('123',))))",
        ),
        (
            "(parent_id is None or 'abc' not in name) and not (span_kind != 'LLM' or span_id not in ('123',))",
            "and_(or_(parent_id == None, not_(TextContains(name, 'abc'))), not_(or_(span_kind != 'LLM', span_id.not_in(('123',)))))"
            if sys.version_info >= (3, 9)
            else "and_(or_((parent_id == None), not_(TextContains(name, 'abc'))), not_(or_((span_kind != 'LLM'), span_id.not_in(('123',)))))",
        ),
        (
            "1000 < latency_ms < 2000 or status_code == 'ERROR' or 2000 <= cumulative_llm_token_count_total",
            "or_(and_(1000 < latency_ms, latency_ms < 2000), status_code == 'ERROR', 2000 <= cumulative_llm_token_count_total)"
            if sys.version_info >= (3, 9)
            else "or_(and_((1000 < latency_ms), (latency_ms < 2000)), (status_code == 'ERROR'), (2000 <= cumulative_llm_token_count_total))",
        ),
        (
            "llm.token_count.total - llm.token_count.prompt > 1000",
            "SafeJsonFloat(attributes[['llm', 'token_count', 'total']]) - SafeJsonFloat(attributes[['llm', 'token_count', 'prompt']]) > 1000"
            if sys.version_info >= (3, 9)
            else "((SafeJsonFloat(attributes[['llm', 'token_count', 'total']]) - SafeJsonFloat(attributes[['llm', 'token_count', 'prompt']])) > 1000)",
        ),
        (
            "first.value in (1,) and second.value in ('2',) and '3' in third.value",
            "and_(SafeJsonFloat(attributes[['first', 'value']]).in_((1,)), attributes[['second', 'value']].as_string().in_(('2',)), TextContains(attributes[['third', 'value']].as_string(), '3'))",
        ),
        (
            "'1.0' < my.value < 2.0",
            "and_('1.0' < attributes[['my', 'value']].as_string(), SafeJsonFloat(attributes[['my', 'value']]) < 2.0)"
            if sys.version_info >= (3, 9)
            else "and_(('1.0' < attributes[['my', 'value']].as_string()), (SafeJsonFloat(attributes[['my', 'value']]) < 2.0))",
        ),
        (
            "first.value + 1 < second.value",
            "SafeJsonFloat(attributes[['first', 'value']]) + 1 < SafeJsonFloat(attributes[['second', 'value']])"
            if sys.version_info >= (3, 9)
            else "((SafeJsonFloat(attributes[['first', 'value']]) + 1) < SafeJsonFloat(attributes[['second', 'value']]))",
        ),
        (
            "first.value * second.value > third.value",
            "SafeJsonFloat(attributes[['first', 'value']]) * SafeJsonFloat(attributes[['second', 'value']]) > SafeJsonFloat(attributes[['third', 'value']])"
            if sys.version_info >= (3, 9)
            else "((SafeJsonFloat(attributes[['first', 'value']]) * SafeJsonFloat(attributes[['second', 'value']])) > SafeJsonFloat(attributes[['third', 'value']]))",
        ),
        (
            "first.value + second.value > third.value",
            "cast(attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string(), String) > attributes[['third', 'value']].as_string()"
            if sys.version_info >= (3, 9)
            else "(cast((attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string()), String) > attributes[['third', 'value']].as_string())",
        ),
        (
            "my.value == '1.0' or float(my.value) < 2.0",
            "or_(attributes[['my', 'value']].as_string() == '1.0', SafeJsonFloat(attributes[['my', 'value']]) < 2.0)"
            if sys.version_info >= (3, 9)
            else "or_((attributes[['my', 'value']].as_string() == '1.0'), (SafeJsonFloat(attributes[['my', 'value']]) < 2.0))",
        ),
        (
            "not(-metadata['a.b'] + float(metadata[['c.d']]) != metadata[['e.f', 'g.h']])",
            "not_(-SafeJsonFloat(attributes[['metadata', 'a.b']]) + SafeJsonFloat(attributes[['metadata', 'c.d']]) != SafeJsonFloat(attributes[['metadata', 'e.f', 'g.h']]))"
            if sys.version_info >= (3, 9)
            else "not_((((- SafeJsonFloat(attributes[['metadata', 'a.b']])) + SafeJsonFloat(attributes[['metadata', 'c.d']])) != SafeJsonFloat(attributes[['metadata', 'e.f', 'g.h']])))",
        ),
        (
            "attributes['attributes'] == attributes[['attributes']] != attributes[['attributes', 'attributes']]",
            "and_(attributes[['attributes']].as_string() == attributes[['attributes']].as_string(), attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string())"
            if sys.version_info >= (3, 9)
            else "and_((attributes[['attributes']].as_string() == attributes[['attributes']].as_string()), (attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string()))",
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
            "TextContains(span_kind, 'CHA')",
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
            "TextContains(status_code, 'ERR')",
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


def test_filter_rejects_non_boolean_logical_operands() -> None:
    with pytest.raises(SyntaxError, match="logical operands must be boolean"):
        SpanFilter("name and status_code")


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
        "latency_ms > '100'",
        "'100' < latency_ms",
        "annotations['quality'].score >= '0.5'",
        "start_time < '2024-01-01T00:00:00Z'",
        "metadata['flag'] and name == 'x'",
        "not metadata['flag']",
        "latency_ms == None",
    ],
)
def test_filter_accepts_previously_valid_conditions(condition: str) -> None:
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


class TestProjectorValidationGap:
    """
    Pins the two structural defects in ``Projector`` in
    ``src/phoenix/trace/dsl/filter.py``:

    1. Unlike ``SpanFilter``, ``Projector`` does NOT call
       ``_validate_expression``. It only runs ``_ProjectionTranslator.visit()``,
       which leaves many AST constructs unchecked.
    2. The ``eval()`` namespace is ``{**_NAMES}`` — it does not pin
       ``__builtins__`` to ``{}``, so Python auto-populates the full
       builtins dict into the namespace.

    These tests assert that ``Projector`` rejects dangerous inputs the
    same way ``SpanFilter`` does, and that the eval namespace is
    sandboxed. They are expected to FAIL on the current code,
    demonstrating the vulnerability.
    """

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
