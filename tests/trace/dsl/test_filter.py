import sys
from typing import Any

import pytest
from phoenix.db import models
from phoenix.trace.dsl.filter import SpanFilter
from sqlalchemy import select
from sqlalchemy.orm import Session

if sys.version_info >= (3, 9):
    from ast import unparse
else:
    from astunparse import unparse


@pytest.mark.parametrize(
    "expression,expected",
    [
        (
            "parent_id is not None and 'abc' in name or span_kind == 'LLM' and span_id in ('123',)",  # noqa E501
            "or_(and_(parent_id != None, name.contains('abc')), and_(span_kind == 'LLM', span_id.in_(('123',))))"  # noqa E501
            if sys.version_info >= (3, 9)
            else "or_(and_((parent_id != None), name.contains('abc')), and_((span_kind == 'LLM'), span_id.in_(('123',))))",  # noqa E501
        ),
        (
            "(parent_id is None or 'abc' not in name) and not (span_kind != 'LLM' or span_id not in ('123',))",  # noqa E501
            "and_(or_(parent_id == None, not_(name.contains('abc'))), not_(or_(span_kind != 'LLM', span_id.not_in(('123',)))))"  # noqa E501
            if sys.version_info >= (3, 9)
            else "and_(or_((parent_id == None), not_(name.contains('abc'))), not_(or_((span_kind != 'LLM'), span_id.not_in(('123',)))))",  # noqa E501
        ),
        (
            "1000 < latency_ms < 2000 or status_code == 'ERROR' or 2000 <= cumulative_llm_token_count_total",  # noqa E501
            "or_(and_(1000 < latency_ms, latency_ms < 2000), status_code == 'ERROR', 2000 <= cumulative_llm_token_count_total)"  # noqa E501
            if sys.version_info >= (3, 9)
            else "or_(and_((1000 < latency_ms), (latency_ms < 2000)), (status_code == 'ERROR'), (2000 <= cumulative_llm_token_count_total))",  # noqa E501
        ),
        (
            "llm.token_count.total - llm.token_count.prompt > 1000",
            "cast(attributes[['llm', 'token_count', 'total']].as_float() - attributes[['llm', 'token_count', 'prompt']].as_float(), Float) > 1000"  # noqa E501
            if sys.version_info >= (3, 9)
            else "cast((attributes[['llm', 'token_count', 'total']].as_float() - attributes[['llm', 'token_count', 'prompt']].as_float()), Float) > 1000",  # noqa E501
        ),
        (
            "first.value in (1,) and second.value in ('2',) and '3' in third.value",
            "and_(attributes[['first', 'value']].as_float().in_((1,)), attributes[['second', 'value']].as_string().in_(('2',)), attributes[['third', 'value']].as_string().contains('3'))",  # noqa E501
        ),
        (
            "'1.0' < my.value < 2.0",
            "and_('1.0' < attributes[['my', 'value']].as_string(), attributes[['my', 'value']].as_float() < 2.0)"  # noqa E501
            if sys.version_info >= (3, 9)
            else "and_(('1.0' < attributes[['my', 'value']].as_string()), (attributes[['my', 'value']].as_float() < 2.0))",  # noqa E501
        ),
        (
            "first.value + 1 < second.value",
            "cast(attributes[['first', 'value']].as_float() + 1, Float) < attributes[['second', 'value']].as_float()"  # noqa E501
            if sys.version_info >= (3, 9)
            else "cast((attributes[['first', 'value']].as_float() + 1), Float) < attributes[['second', 'value']].as_float()",  # noqa E501
        ),
        (
            "my.value == '1.0' or float(my.value) < 2.0",
            "or_(attributes[['my', 'value']].as_string() == '1.0', attributes[['my', 'value']].as_float() < 2.0)"  # noqa E501
            if sys.version_info >= (3, 9)
            else "or_((attributes[['my', 'value']].as_string() == '1.0'), (attributes[['my', 'value']].as_float() < 2.0))",  # noqa E501
        ),
    ],
)
def test_translated(session: Session, expression: str, expected: str) -> None:
    f = SpanFilter(expression)
    assert _unparse(f.translated) == expected
    # next line is only to test that the syntax is accepted
    session.scalar(f(select(models.Span.id)))


def _unparse(exp: Any) -> str:
    # `unparse` for python 3.8 outputs differently,
    # otherwise this function is unnecessary.
    s = unparse(exp).strip()
    if s[0] == "(" and s[-1] == ")":
        return s[1:-1]
    return s
