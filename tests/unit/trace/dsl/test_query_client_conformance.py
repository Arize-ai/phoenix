"""The client's dataframe export must match the legacy server-side ``SpanQuery`` export.

Each case runs the same client ``SpanQuery`` two ways against the same seeded database:
once through the retired server implementation, fed the query's wire form the way the
legacy ``POST /v1/spans`` route was, and once through ``get_spans_dataframe``, which pages
the span list endpoint and shapes the result in pandas. The frames must be equal.
"""

from datetime import datetime
from typing import Any, Optional
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pandas.testing import assert_frame_equal
from phoenix.client.resources.spans import AsyncSpans
from phoenix.client.types.spans import SpanQuery
from phoenix.client.utils.server_requirements import AsyncServerVersionGuard

from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl import SpanQuery as LegacySpanQuery

_LATENCY = {"Latency (milliseconds)": "latency_ms"}
_DOCUMENTS = "retrieval.documents"


def _kwargs(
    *,
    project_name: Optional[str] = "abc",
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 1000,
    root_spans_only: Optional[bool] = None,
) -> dict[str, Any]:
    return dict(
        project_name=project_name,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        root_spans_only=root_spans_only,
    )


def _case(name: str, query: SpanQuery, **kwargs: Any) -> Any:
    return pytest.param(query, _kwargs(**kwargs), True, id=name)


def _sqlite_legacy_only(name: str, query: SpanQuery) -> Any:
    """A case where the legacy export itself differed by dialect; the client follows SQLite."""
    return pytest.param(query, _kwargs(), False, id=name)


_ANNOTATION_CONDITIONS = [
    "evals['0'].score is not None",
    "evals['0'].score is None",
    "evals['0'].score == 0",
    "evals['0'].score != 0",
    "evals['0'].score != 0 or evals['0'].score is None",
    "evals['1'].label is not None",
    "evals['1'].label is None",
    "evals['1'].label == '1'",
    "evals['1'].label != '1'",
    "evals['1'].label != '1' or evals['1'].label is None",
    "evals['0'].score is not None or evals['1'].label is not None",
    "evals['0'].score is None or evals['1'].label is None",
    "evals['0'].score == 0 or evals['1'].label == '1'",
    "evals['0'].score != 0 or evals['1'].label != '1'",
    "evals['0'].score is not None or evals['1'].label is None",
    "evals['0'].score is None or evals['1'].label is not None",
    "evals['0'].score == 0 or evals['1'].label != '1'",
    "evals['0'].score != 0 or evals['1'].label == '1'",
    "evals['0']",
    "annotations['0']",
    "evals['1']",
    "annotations['1']",
]

_UNNESTABLE_METADATA_KEYS = pytest.mark.xfail(
    strict=True,
    reason=(
        "The span list endpoint flattens metadata into dotted paths, so a key that itself "
        "contains dots or is all digits, such as 'a.b.c' and '1.2.3' in the abc project, "
        "cannot be re-nested as the one key it was."
    ),
)


def _unnestable(name: str, query: SpanQuery) -> Any:
    return pytest.param(query, _kwargs(), True, id=name, marks=_UNNESTABLE_METADATA_KEYS)


CASES = [
    _unnestable("select_all", SpanQuery()),
    _case("select_all_default_project", SpanQuery(), project_name=None),
    _case("select_all_with_no_data", SpanQuery(), project_name="opq"),
    _case("select", SpanQuery().select("name", tcp="llm.token_count.prompt")),
    _case("select_parent_id_as_span_id", SpanQuery().select("name", span_id="parent_id")),
    _case("select_trace_id_as_index", SpanQuery().select("span_id").with_index("trace_id")),
    _case("select_nonexistent", SpanQuery().select("name", "opq", "opq.rst")),
    _case("select_the_index_key", SpanQuery().select("context.span_id")),
    _case(
        "default_project",
        SpanQuery().select("name", **_LATENCY),
        project_name=None,
        root_spans_only=True,
    ),
    _case("root_spans_only", SpanQuery().select("name", **_LATENCY), root_spans_only=True),
    _case(
        "start_time",
        SpanQuery().select("name"),
        start_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
    ),
    _case(
        "end_time",
        SpanQuery().select("name"),
        end_time=datetime.fromisoformat("2021-01-01T00:00:01.000+00:00"),
    ),
    _case("limit", SpanQuery(), limit=2),
    _case("filter_for_none", SpanQuery().select("name").where("parent_id is None")),
    _case("filter_for_not_none", SpanQuery().select("name").where("output.value is not None")),
    *(
        _case(
            f"filter_for_substring_{needle}",
            SpanQuery().select("input.value").where(f"'{needle}' in input.value"),
        )
        for needle in ("y%*", "Y%*")
    ),
    *(
        _case(
            f"filter_for_not_substring_{needle}",
            SpanQuery().select("input.value").where(f"'{needle}' not in input.value"),
        )
        for needle in ("y%*", "Y%*")
    ),
    _case("filter_for_equality", SpanQuery().select("input.value").where("input.value == 'xy%*z'")),
    _case(
        "filter_on_nonexistent_is_not_none",
        SpanQuery().select("name").where("opq is not None or opq.rst is not None"),
    ),
    _case(
        "filter_on_nonexistent_is_none",
        SpanQuery().select("name").where("opq is None or opq.rst is None"),
    ),
    _case(
        "filter_on_latency",
        SpanQuery().select("name", **_LATENCY).where("9_000 < latency_ms < 11_000"),
    ),
    _case(
        "filter_on_cumulative_token_count",
        SpanQuery()
        .select("name")
        .where("290 < cumulative_token_count.total < 310 and llm.token_count.prompt is None"),
    ),
    _case(
        "filter_on_metadata_with_arithmetic",
        SpanQuery().select("metadata['a.b.c']").where("12 - metadata['a.b.c'] == -111"),
    ),
    _case(
        "filter_on_metadata_cast_as_int",
        SpanQuery().select("metadata['a.b.c']").where("12 - int(metadata['a.b.c']) == -111"),
    ),
    _unnestable(
        "filter_on_metadata_substring_search",
        SpanQuery().select("metadata['1.2.3']").where("'b' in metadata['1.2.3']"),
    ),
    _unnestable(
        "filter_on_metadata_cast_as_str",
        SpanQuery().select("metadata['1.2.3']").where("'b' in str(metadata['1.2.3'])"),
    ),
    _unnestable(
        "filter_on_metadata_using_subscript_key",
        SpanQuery().select("metadata['1.2.3']").where("metadata['1.2.3'] == 'abc'"),
    ),
    _unnestable(
        "filter_on_metadata_using_subscript_keys_list_with_single_key",
        SpanQuery().select("metadata[['1.2.3']]").where("metadata[['1.2.3']] == 'abc'"),
    ),
    _unnestable(
        "filter_on_metadata_using_subscript_keys_list_with_multiple_keys",
        SpanQuery()
        .select("metadata[['x.y', 'z.a']]")
        .where("metadata[['x.y', 'z.a', 'b.c']] == 321"),
    ),
    _case(
        "filter_on_attribute_using_subscript_key",
        SpanQuery()
        .select("attributes['attributes']")
        .where("attributes['attributes'] == 'attributes'"),
    ),
    _case(
        "filter_on_attribute_using_subscript_keys_list_with_single_key",
        SpanQuery()
        .select("attributes[['attributes']]")
        .where("attributes[['attributes']] == 'attributes'"),
    ),
    _case(
        "filter_on_attribute_using_subscript_keys_list_with_multiple_keys",
        SpanQuery()
        .select("attributes[['attributes', 'attributes']]")
        .where("attributes[['attributes', 'attributes']] == 'attributes'"),
    ),
    _case(
        "filter_on_span_id_single",
        SpanQuery().select("embedding.model_name").where("span_id == '345'"),
    ),
    _case(
        "filter_on_span_id_multiple",
        SpanQuery().select("embedding.model_name").where("span_id in ['345', '567']"),
    ),
    _case("filter_on_trace_id_single", SpanQuery().select("trace_id").where("trace_id == '012'")),
    _case(
        "filter_on_trace_id_multiple",
        SpanQuery().select("trace_id").where("trace_id in ('012',)"),
    ),
    *(
        _case(f"filter_on_span_annotation_{i}", SpanQuery().select("span_id").where(condition))
        for i, condition in enumerate(_ANNOTATION_CONDITIONS)
    ),
    _case("explode_embeddings_no_select", SpanQuery().explode("embedding.embeddings")),
    _case(
        "explode_embeddings_with_select_and_no_kwargs",
        SpanQuery().select("embedding.model_name").explode("embedding.embeddings"),
    ),
    _case(
        "explode_documents_no_select",
        SpanQuery().explode(_DOCUMENTS, content="document.content", score="document.score"),
    ),
    pytest.param(
        SpanQuery().explode(_DOCUMENTS, content="document.content", score="document.score"),
        _kwargs(project_name=None),
        True,
        id="explode_documents_with_empty_elements",
        marks=pytest.mark.xfail(
            strict=True,
            reason=(
                "An empty dict leaves no trace in the span list endpoint's flattened "
                "attributes, so the documents after it move up a position."
            ),
        ),
    ),
    _case(
        "explode_documents_with_select_and_non_ascii_kwargs",
        SpanQuery()
        .select("trace_id")
        .explode(_DOCUMENTS, **{"콘텐츠": "document.content", "スコア": "document.score"}),
    ),
    _case("concat_documents_no_select", SpanQuery().concat(_DOCUMENTS, content="document.content")),
    _case(
        "concat_documents_no_select_but_no_data",
        SpanQuery().concat(_DOCUMENTS, content="document.content"),
        project_name="opq",
    ),
    _case(
        "concat_documents_with_select",
        SpanQuery().select("trace_id").concat(_DOCUMENTS, content="document.content"),
    ),
    _case(
        "concat_documents_with_select_but_no_data",
        SpanQuery().select("trace_id").concat(_DOCUMENTS, content="document.content"),
        project_name="opq",
    ),
    _case(
        "concat_documents_with_select_but_with_typo_in_array_name",
        SpanQuery().select("trace_id").concat("retriever.documents", content="document.content"),
    ),
    _case(
        "concat_documents_with_select_and_non_default_separator",
        SpanQuery()
        .with_index("name")
        .with_concat_separator(",")
        .concat("embedding.embeddings", text="embedding.text"),
    ),
    _case(
        "explode_and_concat_on_same_array",
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode(_DOCUMENTS, score="document.score"),
    ),
    _case(
        "explode_and_concat_on_same_array_but_no_data",
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode(_DOCUMENTS, score="document.score"),
        project_name="opq",
    ),
    _sqlite_legacy_only(
        "explode_and_concat_on_same_array_with_same_label",
        SpanQuery()
        .concat(_DOCUMENTS, content="document.content")
        .explode(_DOCUMENTS, content="document.content"),
    ),
    _case(
        "explode_and_concat_on_same_array_but_with_typo_in_concat_array_name",
        SpanQuery()
        .concat("retriever.documents", content="document.content")
        .explode(_DOCUMENTS, score="document.score"),
    ),
]


def _comparable(df: Any) -> Any:
    """Order rows by content, since duplicate index values make ``sort_index`` unstable."""
    rows = sorted(range(len(df)), key=lambda i: (str(df.index[i]), tuple(map(str, df.iloc[i]))))
    return df.iloc[rows].sort_index(axis=1)


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
@pytest.mark.parametrize("query,kwargs,legacy_agrees_across_dialects", CASES)
async def test_client_export_matches_legacy_query(
    query: SpanQuery,
    kwargs: dict[str, Any],
    legacy_agrees_across_dialects: bool,
    dialect: str,
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    default_project: Any,
    abc_project: Any,
) -> None:
    if dialect == "postgresql" and not legacy_agrees_across_dialects:
        pytest.xfail("the legacy PostgreSQL export never matched its SQLite counterpart here")
    legacy = LegacySpanQuery.from_dict(query.to_dict())
    async with db() as session:
        expected = await session.run_sync(legacy, **kwargs)

    with patch.object(AsyncServerVersionGuard, "require", AsyncMock()):
        actual = await AsyncSpans(httpx_client).get_spans_dataframe(
            query=query,
            project_identifier=kwargs["project_name"],
            start_time=kwargs["start_time"],
            end_time=kwargs["end_time"],
            limit=kwargs["limit"],
            root_spans_only=kwargs["root_spans_only"],
        )

    assert_frame_equal(_comparable(actual), _comparable(expected))
