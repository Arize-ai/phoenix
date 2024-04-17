from datetime import datetime

import pandas as pd
from pandas.testing import assert_frame_equal
from phoenix.trace.dsl import SpanQuery
from sqlalchemy.orm import Session


def test_select_all(session: Session) -> None:
    # i.e. `get_spans_dataframe`
    sq = SpanQuery()
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "context.trace_id": ["012", "012", "012", "012"],
            "parent_id": ["123", "234", "234", "234"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
            "span_kind": ["UNKNOWN", "EMBEDDING", "RETRIEVER", "LLM"],
            "status_code": ["OK", "OK", "OK", "ERROR"],
            "status_message": ["okay", "no problemo", "okay", "uh-oh"],
            "start_time": [
                datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
                datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            ],
            "end_time": [
                datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
                datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
                datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
            ],
            "attributes.input.value": ["210", None, "xyz", None],
            "attributes.output.value": ["321", None, None, None],
            "attributes.llm.token_count.prompt": [None, None, None, 100.0],
            "attributes.llm.token_count.completion": [None, None, None, 200.0],
            "attributes.metadata": [None, {"a.b.c": 123, "1.2.3": "abc"}, None, None],
            "attributes.embedding.model_name": [None, "xyz", None, None],
            "attributes.embedding.embeddings": [
                None,
                [
                    {"embedding.vector": [1, 2, 3], "embedding.text": "123"},
                    {"embedding.vector": [2, 3, 4], "embedding.text": "234"},
                ],
                None,
                None,
            ],
            "attributes.retrieval.documents": [
                None,
                None,
                [
                    {"document.content": "A", "document.score": 1.0},
                    {"document.content": "B", "document.score": 2.0},
                    {"document.content": "C", "document.score": 3.0},
                ],
                None,
            ],
            "events": [[], [], [], []],
        }
    ).set_index("context.span_id", drop=False)
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_select(session: Session) -> None:
    sq = SpanQuery().select("name", tcp="llm.token_count.prompt")
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
            "tcp": [None, None, None, 100.0],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = SpanQuery().select("name", span_id="parent_id")
    expected = pd.DataFrame(
        {
            "context.span_id": ["123", "234", "234", "234"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = SpanQuery().select("span_id").with_index("trace_id")
    expected = pd.DataFrame(
        {
            "context.trace_id": ["012", "012", "012", "012"],
            "context.span_id": ["234", "345", "456", "567"],
        }
    ).set_index("context.trace_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1).sort_values("context.span_id"),
        expected.sort_index().sort_index(axis=1).sort_values("context.span_id"),
    )
    del sq, actual, expected


def test_select_nonexistent(session: Session) -> None:
    sq = SpanQuery().select("name", "opq", "opq.rst")
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
            "opq": [None, None, None, None],
            "opq.rst": [None, None, None, None],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_default_project(session: Session) -> None:
    sq = SpanQuery().select(
        "name",
        **{"Latency (milliseconds)": "latency_ms"},
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["2345"],
            "name": ["root span"],
            "Latency (milliseconds)": [30000.0],
        }
    ).set_index("context.span_id")
    actual = sq(session, root_spans_only=True)
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_root_spans_only(session: Session) -> None:
    sq = SpanQuery().select(
        "name",
        **{"Latency (milliseconds)": "latency_ms"},
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "name": ["root span"],
            "Latency (milliseconds)": [30000.0],
        }
    ).set_index("context.span_id")
    actual = sq(
        session,
        project_name="abc",
        root_spans_only=True,
    )
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_start_time(session: Session) -> None:
    sq = SpanQuery().select("name")
    expected = pd.DataFrame(
        {
            "context.span_id": ["567"],
            "name": ["llm span"],
        }
    ).set_index("context.span_id")
    actual = sq(
        session,
        project_name="abc",
        start_time=datetime.fromisoformat(
            "2021-01-01T00:00:20.000+00:00",
        ),
    )
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_stop_time(session: Session) -> None:
    sq = SpanQuery().select("name")
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345"],
            "name": ["root span", "embedding span"],
        }
    ).set_index("context.span_id")
    actual = sq(
        session,
        project_name="abc",
        stop_time=datetime.fromisoformat(
            "2021-01-01T00:00:01.000+00:00",
        ),
    )
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_for_none(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("name")
        .where(
            "parent_id is None",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": [],
            "name": [],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
        check_dtype=False,
        check_column_type=False,
        check_frame_type=False,
        check_index_type=False,
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("name")
        .where(
            "output.value is not None",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "name": ["root span"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_for_substring(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("input.value")
        .where(
            "'y' in input.value",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "input.value": ["xyz"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("input.value")
        .where(
            "'y' not in input.value",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "input.value": ["210"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_on_nonexistent(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("name")
        .where(
            "opq is not None or opq.rst is not None",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": [],
            "name": [],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
        check_dtype=False,
        check_column_type=False,
        check_frame_type=False,
        check_index_type=False,
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("name")
        .where(
            "opq is None or opq.rst is None",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "name": ["root span", "embedding span", "retriever span", "llm span"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_on_latency(session: Session) -> None:
    sq = (
        SpanQuery()
        .select(
            "name",
            **{"Latency (milliseconds)": "latency_ms"},
        )
        .where("9_000 < latency_ms < 11_000")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["567"],
            "name": ["llm span"],
            "Latency (milliseconds)": [10000.0],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_on_cumulative_token_count(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("name")
        .where("290 < cumulative_token_count.total < 310 and llm.token_count.prompt is None")
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234"],
            "name": ["root span"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_on_metadata(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("embedding.model_name")
        .where(
            "12 - metadata['a.b.c'] == -111",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "embedding.model_name": ["xyz"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("embedding.model_name")
        .where(
            "'b' in metadata['1.2.3']",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "embedding.model_name": ["xyz"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_on_span_id(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("embedding.model_name")
        .where(
            "span_id == '345'",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345"],
            "embedding.model_name": ["xyz"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("embedding.model_name")
        .where(
            "span_id in ['345', '567']",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "567"],
            "embedding.model_name": ["xyz", None],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_filter_on_trace_id(session: Session) -> None:
    sq = (
        SpanQuery()
        .select("metadata")
        .where(
            "trace_id == '012'",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "metadata": [None, {"a.b.c": 123, "1.2.3": "abc"}, None, None],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("metadata")
        .where(
            "trace_id in ('012',)",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["234", "345", "456", "567"],
            "metadata": [None, {"a.b.c": 123, "1.2.3": "abc"}, None, None],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_explode(session: Session) -> None:
    sq = SpanQuery().explode("embedding.embeddings")
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "345"],
            "position": [0, 1],
            "embedding.text": ["123", "234"],
            "embedding.vector": [[1, 2, 3], [2, 3, 4]],
        }
    ).set_index(["context.span_id", "position"])
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("embedding.model_name")
        .explode(
            "embedding.embeddings",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["345", "345"],
            "position": [0, 1],
            "embedding.model_name": ["xyz", "xyz"],
            "embedding.text": ["123", "234"],
            "embedding.vector": [[1, 2, 3], [2, 3, 4]],
        }
    ).set_index(["context.span_id", "position"])
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = SpanQuery().explode(
        "retrieval.documents",
        content="document.content",
        score="document.score",
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "content": ["A", "B", "C"],
            "score": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("trace_id")
        .explode(
            "retrieval.documents",
            **{
                "콘텐츠": "document.content",
                "スコア": "document.score",
            },
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "context.trace_id": ["012", "012", "012"],
            "콘텐츠": ["A", "B", "C"],
            "スコア": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_concat(session: Session) -> None:
    sq = SpanQuery().concat(
        "retrieval.documents",
        content="document.content",
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "content": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("trace_id")
        .concat(
            "retrieval.documents",
            content="document.content",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456"],
            "context.trace_id": ["012"],
            "content": ["A\n\nB\n\nC"],
        }
    ).set_index("context.span_id")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .with_index("name")
        .with_concat_separator(",")
        .concat(
            "embedding.embeddings",
            text="embedding.text",
        )
    )
    expected = pd.DataFrame(
        {
            "name": ["embedding span"],
            "text": ["123,234"],
        }
    ).set_index("name")
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected


def test_explode_and_concat(session: Session) -> None:
    sq = (
        SpanQuery()
        .concat(
            "retrieval.documents",
            content="document.content",
        )
        .explode(
            "retrieval.documents",
            score="document.score",
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "content": ["A\n\nB\n\nC", "A\n\nB\n\nC", "A\n\nB\n\nC"],
            "score": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected

    sq = (
        SpanQuery()
        .select("trace_id")
        .concat(
            "retrieval.documents",
            **{"콘텐츠": "document.content"},
        )
        .explode(
            "retrieval.documents",
            **{"スコア": "document.score"},
        )
    )
    expected = pd.DataFrame(
        {
            "context.span_id": ["456", "456", "456"],
            "document_position": [0, 1, 2],
            "context.trace_id": ["012", "012", "012"],
            "콘텐츠": ["A\n\nB\n\nC", "A\n\nB\n\nC", "A\n\nB\n\nC"],
            "スコア": [1, 2, 3],
        }
    ).set_index(["context.span_id", "document_position"])
    actual = sq(session, project_name="abc")
    assert_frame_equal(
        actual.sort_index().sort_index(axis=1),
        expected.sort_index().sort_index(axis=1),
    )
    del sq, actual, expected
