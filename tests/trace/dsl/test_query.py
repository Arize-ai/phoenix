from collections import namedtuple
from random import random

import pandas as pd
import pytest
from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from pandas.testing import assert_frame_equal
from phoenix.trace.dsl.query import Concatenation, Explosion, Projection, SpanQuery
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX

DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

Context = namedtuple("Context", "span_id trace_id")
Span = namedtuple("Span", "context parent_id attributes")

SPAN_ID = "span_id"
TRACE_ID = "trace_id"


def test_projection(spans):
    for field in (TRACE_ID, f"{CONTEXT_PREFIX}{TRACE_ID}"):
        project = Projection(field)
        assert project(spans[0]) == "99"
        assert project(spans[1]) == "99"

    for field in (SPAN_ID, f"{CONTEXT_PREFIX}{SPAN_ID}"):
        project = Projection(field)
        assert project(spans[0]) == "0"
        assert project(spans[1]) == "1"

    for field in (INPUT_VALUE, f"{ATTRIBUTE_PREFIX}{INPUT_VALUE}"):
        project = Projection(field)
        assert project(spans[0]) == "000"
        assert project(spans[1]) is None

    for field in (RETRIEVAL_DOCUMENTS, f"{ATTRIBUTE_PREFIX}{RETRIEVAL_DOCUMENTS}"):
        project = Projection(field)
        assert project(spans[0]) == []
        assert project(spans[1]) == [
            {
                DOCUMENT_CONTENT: "10",
                DOCUMENT_SCORE: 100,
            }
        ]


def test_concatenation(spans):
    concat = Concatenation("12")
    assert list(concat(spans[2])) == [("12", "1\n\n2")]


def test_explosion(spans):
    explode = Explosion("12")
    assert list(explode(spans[2])) == [
        {
            "12": 1,
            "context.span_id": "2",
            "position": 0,
        },
        {
            "12": 2,
            "context.span_id": "2",
            "position": 1,
        },
    ]

    explode = Explosion(RETRIEVAL_DOCUMENTS)

    assert list(explode(spans[0])) == []
    assert list(explode(spans[1])) == [
        {
            DOCUMENT_CONTENT: "10",
            DOCUMENT_SCORE: 100,
            "context.span_id": "1",
            "document_position": 0,
        }
    ]
    assert list(explode(spans[2])) == [
        {
            DOCUMENT_CONTENT: "20",
            "context.span_id": "2",
            "document_position": 0,
        },
        {
            DOCUMENT_SCORE: 201,
            "context.span_id": "2",
            "document_position": 1,
        },
        {
            DOCUMENT_CONTENT: "22",
            DOCUMENT_SCORE: 203,
            "context.span_id": "2",
            "document_position": 3,
        },
    ]


def test_query_select(spans):
    query = SpanQuery().select(
        input=INPUT_VALUE,
        output=OUTPUT_VALUE,
    )
    actual = query(spans)
    desired = pd.DataFrame(
        {
            "context.span_id": ["0", "2"],
            "input": ["000", None],
            "output": [None, "222"],
        }
    ).set_index("context.span_id")
    assert_frame_equal(actual, desired)
    assert_frame_equal(SpanQuery.from_dict(query.to_dict())(spans), desired)
    del query, actual, desired


def test_query_concat(spans):
    sep = str(random())

    query = (
        SpanQuery()
        .concat(
            RETRIEVAL_DOCUMENTS,
            reference=DOCUMENT_CONTENT,
        )
        .with_concat_separator(separator=sep)
    )
    actual = query(spans)
    desired = pd.DataFrame(
        {
            "context.span_id": ["1", "2"],
            "reference": ["10", f"20{sep}22"],
        }
    ).set_index("context.span_id")
    assert_frame_equal(actual, desired)
    assert_frame_equal(SpanQuery.from_dict(query.to_dict())(spans), desired)
    del query, actual, desired

    query = (
        SpanQuery()
        .concat(
            RETRIEVAL_DOCUMENTS,
            score=DOCUMENT_SCORE,
        )
        .with_concat_separator(separator=sep)
    )
    actual = query(spans)
    desired = pd.DataFrame(
        {
            "context.span_id": ["1", "2"],
            "score": ["100", f"201{sep}203"],
        }
    ).set_index("context.span_id")
    assert_frame_equal(actual, desired)
    assert_frame_equal(SpanQuery.from_dict(query.to_dict())(spans), desired)
    del query, actual, desired


def test_query_explode(spans):
    query = (
        SpanQuery()
        .select(
            input=INPUT_VALUE,
            output=OUTPUT_VALUE,
        )
        .explode(RETRIEVAL_DOCUMENTS)
    )
    actual = query(spans)
    desired = pd.DataFrame(
        {
            "context.span_id": ["1", "2", "2", "2"],
            "document_position": [0, 0, 1, 3],
            "input": [None, None, None, None],
            "output": [None, "222", "222", "222"],
            DOCUMENT_CONTENT: ["10", "20", None, "22"],
            DOCUMENT_SCORE: [100, None, 201, 203],
        }
    ).set_index(["context.span_id", "document_position"])
    assert_frame_equal(actual, desired)
    assert_frame_equal(SpanQuery.from_dict(query.to_dict())(spans), desired)
    del query, actual, desired

    query = SpanQuery().explode(RETRIEVAL_DOCUMENTS)
    actual = query(spans)
    desired = pd.DataFrame(
        {
            "context.span_id": ["1", "2", "2", "2"],
            "document_position": [0, 0, 1, 3],
            DOCUMENT_CONTENT: ["10", "20", None, "22"],
            DOCUMENT_SCORE: [100, None, 201, 203],
        }
    ).set_index(["context.span_id", "document_position"])
    assert_frame_equal(actual, desired)
    assert_frame_equal(SpanQuery.from_dict(query.to_dict())(spans), desired)
    del query, actual, desired

    query = SpanQuery().explode(
        RETRIEVAL_DOCUMENTS,
        reference=DOCUMENT_CONTENT,
    )
    actual = query(spans)
    desired = pd.DataFrame(
        {
            "context.span_id": ["1", "2", "2"],
            "document_position": [0, 0, 3],
            "reference": ["10", "20", "22"],
        }
    ).set_index(["context.span_id", "document_position"])
    assert_frame_equal(actual, desired)
    assert_frame_equal(SpanQuery.from_dict(query.to_dict())(spans), desired)
    del query, actual, desired


def test_join(spans):
    left_query = SpanQuery().select(input=INPUT_VALUE)
    right_query = (
        SpanQuery()
        .select(span_id="parent_id")
        .concat(
            RETRIEVAL_DOCUMENTS,
            reference=DOCUMENT_CONTENT,
        )
    )
    left_result = left_query(spans)
    right_result = right_query(spans)
    actual = pd.concat(
        [left_result, right_result],
        axis=1,
        join="outer",
    )
    desired = pd.DataFrame(
        {
            "context.span_id": ["0", "1"],
            "input": ["000", None],
            "reference": ["10", "20\n\n22"],
        }
    ).set_index("context.span_id")
    assert_frame_equal(actual, desired)
    assert_frame_equal(
        pd.concat(
            [
                SpanQuery.from_dict(left_query.to_dict())(spans),
                SpanQuery.from_dict(right_query.to_dict())(spans),
            ],
            axis=1,
            join="outer",
        ),
        desired,
    )


@pytest.fixture(scope="module")
def spans():
    return (
        Span(
            context=Context(span_id="0", trace_id="99"),
            parent_id=None,
            attributes={
                INPUT_VALUE: "000",
                RETRIEVAL_DOCUMENTS: [],
            },
        ),
        Span(
            context=Context(span_id="1", trace_id="99"),
            parent_id="0",
            attributes={
                RETRIEVAL_DOCUMENTS: [
                    {
                        DOCUMENT_CONTENT: "10",
                        DOCUMENT_SCORE: 100,
                    }
                ],
            },
        ),
        Span(
            context=Context(span_id="2", trace_id="99"),
            parent_id="1",
            attributes={
                "12": [1, 2],
                OUTPUT_VALUE: "222",
                RETRIEVAL_DOCUMENTS: [
                    {
                        DOCUMENT_CONTENT: "20",
                    },
                    {
                        DOCUMENT_SCORE: 201,
                    },
                    None,
                    {
                        DOCUMENT_CONTENT: "22",
                        DOCUMENT_SCORE: 203,
                    },
                ],
            },
        ),
    )
