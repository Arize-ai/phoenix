import ast
import sys
from typing import List, Optional
from unittest.mock import patch

import phoenix.trace.dsl.filter
import pytest
from phoenix.db import models
from phoenix.trace.dsl.filter import SpanFilter, _apply_eval_aliasing, _get_attribute_keys_list
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

if sys.version_info >= (3, 9):
    from ast import unparse
else:
    from astunparse import unparse


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
def test_get_attribute_keys_list(expression: str, expected: Optional[List[str]]) -> None:
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
            "parent_id is not None and 'abc' in name or span_kind == 'LLM' and span_id in ('123',)",  # noqa E501
            "or_(and_(parent_id != None, TextContains(name, 'abc')), and_(span_kind == 'LLM', span_id.in_(('123',))))"  # noqa E501
            if sys.version_info >= (3, 9)
            else "or_(and_((parent_id != None), TextContains(name, 'abc')), and_((span_kind == 'LLM'), span_id.in_(('123',))))",  # noqa E501
        ),
        (
            "(parent_id is None or 'abc' not in name) and not (span_kind != 'LLM' or span_id not in ('123',))",  # noqa E501
            "and_(or_(parent_id == None, not_(TextContains(name, 'abc'))), not_(or_(span_kind != 'LLM', span_id.not_in(('123',)))))"  # noqa E501
            if sys.version_info >= (3, 9)
            else "and_(or_((parent_id == None), not_(TextContains(name, 'abc'))), not_(or_((span_kind != 'LLM'), span_id.not_in(('123',)))))",  # noqa E501
        ),
        (
            "1000 < latency_ms < 2000 or status_code == 'ERROR' or 2000 <= cumulative_llm_token_count_total",  # noqa E501
            "or_(and_(1000 < latency_ms, latency_ms < 2000), status_code == 'ERROR', 2000 <= cumulative_llm_token_count_total)"  # noqa E501
            if sys.version_info >= (3, 9)
            else "or_(and_((1000 < latency_ms), (latency_ms < 2000)), (status_code == 'ERROR'), (2000 <= cumulative_llm_token_count_total))",  # noqa E501
        ),
        (
            "llm.token_count.total - llm.token_count.prompt > 1000",
            "attributes[['llm', 'token_count', 'total']].as_float() - attributes[['llm', 'token_count', 'prompt']].as_float() > 1000"  # noqa E501
            if sys.version_info >= (3, 9)
            else "((attributes[['llm', 'token_count', 'total']].as_float() - attributes[['llm', 'token_count', 'prompt']].as_float()) > 1000)",  # noqa E501
        ),
        (
            "first.value in (1,) and second.value in ('2',) and '3' in third.value",
            "and_(attributes[['first', 'value']].as_float().in_((1,)), attributes[['second', 'value']].as_string().in_(('2',)), TextContains(attributes[['third', 'value']].as_string(), '3'))",  # noqa E501
        ),
        (
            "'1.0' < my.value < 2.0",
            "and_('1.0' < attributes[['my', 'value']].as_string(), attributes[['my', 'value']].as_float() < 2.0)"  # noqa E501
            if sys.version_info >= (3, 9)
            else "and_(('1.0' < attributes[['my', 'value']].as_string()), (attributes[['my', 'value']].as_float() < 2.0))",  # noqa E501
        ),
        (
            "first.value + 1 < second.value",
            "attributes[['first', 'value']].as_float() + 1 < attributes[['second', 'value']].as_float()"  # noqa E501
            if sys.version_info >= (3, 9)
            else "((attributes[['first', 'value']].as_float() + 1) < attributes[['second', 'value']].as_float())",  # noqa E501
        ),
        (
            "first.value * second.value > third.value",
            "attributes[['first', 'value']].as_float() * attributes[['second', 'value']].as_float() > attributes[['third', 'value']].as_float()"  # noqa E501
            if sys.version_info >= (3, 9)
            else "((attributes[['first', 'value']].as_float() * attributes[['second', 'value']].as_float()) > attributes[['third', 'value']].as_float())",  # noqa E501
        ),
        (
            "first.value + second.value > third.value",
            "cast(attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string(), String) > attributes[['third', 'value']].as_string()"  # noqa E501
            if sys.version_info >= (3, 9)
            else "(cast((attributes[['first', 'value']].as_string() + attributes[['second', 'value']].as_string()), String) > attributes[['third', 'value']].as_string())",  # noqa E501
        ),
        (
            "my.value == '1.0' or float(my.value) < 2.0",
            "or_(attributes[['my', 'value']].as_string() == '1.0', attributes[['my', 'value']].as_float() < 2.0)"  # noqa E501
            if sys.version_info >= (3, 9)
            else "or_((attributes[['my', 'value']].as_string() == '1.0'), (attributes[['my', 'value']].as_float() < 2.0))",  # noqa E501
        ),
        (
            "not(-metadata['a.b'] + float(metadata[['c.d']]) != metadata[['e.f', 'g.h']])",
            "not_(-attributes[['metadata', 'a.b']].as_float() + attributes[['metadata', 'c.d']].as_float() != attributes[['metadata', 'e.f', 'g.h']].as_float())"  # noqa E501
            if sys.version_info >= (3, 9)
            else "not_((((- attributes[['metadata', 'a.b']].as_float()) + attributes[['metadata', 'c.d']].as_float()) != attributes[['metadata', 'e.f', 'g.h']].as_float()))",  # noqa E501
        ),
        (
            "attributes['attributes'] == attributes[['attributes']] != attributes[['attributes', 'attributes']]",  # noqa E501
            "and_(attributes[['attributes']].as_string() == attributes[['attributes']].as_string(), attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string())"  # noqa E501
            if sys.version_info >= (3, 9)
            else "and_((attributes[['attributes']].as_string() == attributes[['attributes']].as_string()), (attributes[['attributes']].as_string() != attributes[['attributes', 'attributes']].as_string()))",  # noqa E501
        ),
    ],
)
async def test_filter_translated(
    session: AsyncSession, expression: str, expected: str, default_project: None, abc_project: None
) -> None:
    with patch.object(
        phoenix.trace.dsl.filter,
        "randint",
        return_value=0,
    ):
        f = SpanFilter(expression)
    assert unparse(f.translated).strip() == expected
    # next line is only to test that the syntax is accepted
    await session.execute(f(select(models.Span.id)))


@pytest.mark.parametrize(
    "filter_condition,expected",
    [
        pytest.param(
            """evals["Q&A Correctness"].label is not None""",
            "span_annotation_0_label_000000 is not None",
            id="double-quoted-eval-name",
        ),
        pytest.param(
            """evals['Q&A Correctness'].label is not None""",
            "span_annotation_0_label_000000 is not None",
            id="single-quoted-eval-name",
        ),
        pytest.param(
            """evals[""].label is not None""",
            "span_annotation_0_label_000000 is not None",
            id="empty-eval-name",
        ),
        pytest.param(
            """evals['Hallucination'].label == 'correct' or evals['Hallucination'].score < 0.5""",  # noqa E501
            "span_annotation_0_label_000000 == 'correct' or span_annotation_0_score_000000 < 0.5",  # noqa E501
            id="repeated-single-quoted-eval-name",
        ),
        pytest.param(
            """evals["Hallucination"].label == 'correct' or evals["Hallucination"].score < 0.5""",  # noqa E501
            "span_annotation_0_label_000000 == 'correct' or span_annotation_0_score_000000 < 0.5",  # noqa E501
            id="repeated-double-quoted-eval-name",
        ),
        pytest.param(
            """evals['Hallucination'].label == 'correct' or evals["Hallucination"].score < 0.5""",  # noqa E501
            "span_annotation_0_label_000000 == 'correct' or span_annotation_0_score_000000 < 0.5",  # noqa E501
            id="repeated-mixed-quoted-eval-name",
        ),
        pytest.param(
            """evals['Q&A Correctness'].label == 'correct' and evals["Hallucination"].score < 0.5""",  # noqa E501
            "span_annotation_0_label_000000 == 'correct' and span_annotation_1_score_000000 < 0.5",  # noqa E501
            id="distinct-mixed-quoted-eval-names",
        ),
        pytest.param(
            """evals["Hallucination].label is not None""",
            """evals["Hallucination].label is not None""",
            id="missing-right-quotation-mark",
        ),
        pytest.param(
            """evals["Hallucination"].label == 'correct' orevals["Hallucination"].score < 0.5""",  # noqa E501
            """span_annotation_0_label_000000 == 'correct' orevals["Hallucination"].score < 0.5""",  # noqa E501
            id="no-word-boundary-on-the-left",
        ),
        pytest.param(
            """evals["Hallucination"].scoreq < 0.5""",  # noqa E501
            """evals["Hallucination"].scoreq < 0.5""",  # noqa E501
            id="no-word-boundary-on-the-right",
        ),
        pytest.param(
            """0.5 <evals["Hallucination"].score""",  # noqa E501
            """0.5 <span_annotation_0_score_000000""",  # noqa E501
            id="left-word-boundary-without-space",
        ),
        pytest.param(
            """evals["Hallucination"].score< 0.5""",  # noqa E501
            """span_annotation_0_score_000000< 0.5""",  # noqa E501
            id="right-word-boundary-without-space",
        ),
    ],
)
def test_apply_eval_aliasing(filter_condition: str, expected: str) -> None:
    with patch.object(phoenix.trace.dsl.filter, "randint", return_value=0):
        aliased, _ = _apply_eval_aliasing(filter_condition)
    assert aliased == expected
