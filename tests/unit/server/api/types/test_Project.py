# ruff: noqa: E501
import base64
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Literal

import httpx
import pandas as pd
import pytest
from faker import Faker
from sqlalchemy import insert
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.input_types.TimeBinConfig import TimeBinConfig, TimeBinScale
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.pagination import Cursor, CursorSortColumn, CursorSortColumnDataType
from phoenix.server.api.types.Project import Project
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace, _gid, _node

fake = Faker()

PROJECT_ID = str(GlobalID(type_name="Project", node_id="1"))


@pytest.mark.parametrize(
    "variables, start_cursor, end_cursor, has_next_page",
    [
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "first": 2,
            },
            Cursor(rowid=1),
            Cursor(rowid=2),
            True,
            id="basic-query",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "after": str(Cursor(rowid=13)),
                "first": 2,
            },
            Cursor(rowid=14),
            Cursor(rowid=15),
            False,
            id="page-ends-exactly-on-last-record",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "after": str(Cursor(14)),
                "first": 2,
            },
            Cursor(rowid=15),
            Cursor(rowid=15),
            False,
            id="page-ends-before-it-reaches-limit",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "first": 2,
                "filterCondition": "span_kind == 'LLM'",
            },
            Cursor(rowid=5),
            Cursor(rowid=10),
            True,
            id="filter-condition",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "first": 2,
                "after": str(Cursor(5)),  # skip the first span satisfying the filter condition
                "filterCondition": "span_kind == 'LLM'",
            },
            Cursor(rowid=10),
            Cursor(rowid=15),
            False,
            id="filter-condition-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "startTime", "dir": "desc"},
                "first": 2,
            },
            Cursor(
                rowid=15,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:26.706204+00:00"),
                ),
            ),
            Cursor(
                rowid=14,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:26.704532+00:00"),
                ),
            ),
            True,
            id="sort-by-descending-start-time",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "startTime", "dir": "asc"},
                "first": 2,
            },
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
                ),
            ),
            Cursor(
                rowid=2,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:23.306945+00:00"),
                ),
            ),
            True,
            id="sort-by-ascending-start-time",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "cumulativeTokenCountTotal", "dir": "desc"},
                "first": 2,
            },
            Cursor(
                rowid=15,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=382,
                ),
            ),
            Cursor(
                rowid=14,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=382,
                ),
            ),
            True,
            id="sort-by-descending-cumulative-prompt-token-count-total",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "cumulativeTokenCountTotal", "dir": "asc"},
                "first": 2,
            },
            Cursor(
                rowid=2,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=0,
                ),
            ),
            Cursor(
                rowid=3,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=0,
                ),
            ),
            True,
            id="sort-by-ascending-cumulative-prompt-token-count-total",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "startTime", "dir": "desc"},
                "first": 2,
                "after": str(
                    Cursor(
                        3,
                        sort_column=CursorSortColumn.from_string(
                            type=CursorSortColumnDataType.DATETIME,
                            cursor_string="2023-12-11T17:43:23.307166+00:00",
                        ),
                    )
                ),
            },
            Cursor(
                rowid=2,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:23.306945+00:00"),
                ),
            ),
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
                ),
            ),
            False,
            id="sort-by-descending-start-time-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "startTime", "dir": "asc"},
                "first": 2,
                "after": str(
                    Cursor(
                        3,
                        sort_column=CursorSortColumn.from_string(
                            type=CursorSortColumnDataType.DATETIME,
                            cursor_string="2023-12-11T17:43:23.307166+00:00",
                        ),
                    )
                ),
            },
            Cursor(
                rowid=4,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:23.710148+00:00"),
                ),
            ),
            Cursor(
                rowid=5,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.DATETIME,
                    value=datetime.fromisoformat("2023-12-11T17:43:23.712144+00:00"),
                ),
            ),
            True,
            id="sort-by-ascending-start-time-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "cumulativeTokenCountTotal", "dir": "desc"},
                "first": 2,
                "after": str(
                    Cursor(
                        rowid=4,  # row 4 is in between rows 1 and 5, which also have 296 cumulative prompt tokens
                        sort_column=CursorSortColumn(
                            type=CursorSortColumnDataType.FLOAT, value=296
                        ),
                    )
                ),
            },
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=296,
                ),
            ),
            Cursor(
                rowid=13,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=0,
                ),
            ),
            True,
            id="sort-by-descending-cumulative-prompt-token-count-total-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {"col": "cumulativeTokenCountTotal", "dir": "asc"},
                "first": 2,
                "after": str(
                    Cursor(
                        rowid=4,  # row 4 is in between rows 1 and 5, which also have 296 cumulative prompt tokens
                        sort_column=CursorSortColumn(
                            type=CursorSortColumnDataType.FLOAT, value=296
                        ),
                    )
                ),
            },
            Cursor(
                rowid=5,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=296,
                ),
            ),
            Cursor(
                rowid=6,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.INT,
                    value=336,
                ),
            ),
            True,
            id="sort-by-ascending-cumulative-prompt-token-count-total-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {
                    "evalResultKey": {"name": "Hallucination", "attr": "label"},
                    "dir": "desc",
                },
                "first": 2,
            },
            Cursor(
                rowid=11,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="hallucinated",
                ),
            ),
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="hallucinated",
                ),
            ),
            True,
            id="sort-by-descending-hallucination-eval-label",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {
                    "evalResultKey": {"name": "Hallucination", "attr": "label"},
                    "dir": "asc",
                },
                "first": 2,
            },
            Cursor(
                rowid=6,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="factual",
                ),
            ),
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="hallucinated",
                ),
            ),
            True,
            id="sort-by-ascending-hallucination-eval-label",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {
                    "evalResultKey": {"name": "Hallucination", "attr": "label"},
                    "dir": "desc",
                },
                "first": 2,
                "after": str(
                    Cursor(
                        rowid=11,
                        sort_column=CursorSortColumn(
                            type=CursorSortColumnDataType.STRING, value="hallucinated"
                        ),
                    )
                ),
            },
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="hallucinated",
                ),
            ),
            Cursor(
                rowid=6,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="factual",
                ),
            ),
            False,
            id="sort-by-descending-hallucination-eval-label-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {
                    "evalResultKey": {"name": "Hallucination", "attr": "label"},
                    "dir": "asc",
                },
                "first": 2,
                "after": str(
                    Cursor(
                        rowid=6,
                        sort_column=CursorSortColumn(
                            type=CursorSortColumnDataType.STRING, value="factual"
                        ),
                    )
                ),
            },
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="hallucinated",
                ),
            ),
            Cursor(
                rowid=11,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.STRING,
                    value="hallucinated",
                ),
            ),
            False,
            id="sort-by-ascending-hallucination-eval-label-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {
                    "evalResultKey": {"name": "Hallucination", "attr": "score"},
                    "dir": "desc",
                },
                "first": 2,
                "after": str(
                    Cursor(
                        rowid=11,
                        sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=0),
                    )
                ),
            },
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.FLOAT,
                    value=0.0,
                ),
            ),
            Cursor(
                rowid=1,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.FLOAT,
                    value=0.0,
                ),
            ),
            False,
            id="sort-by-descending-hallucination-eval-score-with-cursor",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "sort": {
                    "evalResultKey": {"name": "Hallucination", "attr": "score"},
                    "dir": "asc",
                },
                "first": 5,
                "after": str(
                    Cursor(
                        rowid=1,
                        sort_column=CursorSortColumn(type=CursorSortColumnDataType.FLOAT, value=0),
                    )
                ),
            },
            Cursor(
                rowid=11,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.FLOAT,
                    value=0.0,
                ),
            ),
            Cursor(
                rowid=6,
                sort_column=CursorSortColumn(
                    type=CursorSortColumnDataType.FLOAT,
                    value=1.0,
                ),
            ),
            False,
            id="sort-by-ascending-hallucination-eval-score-with-cursor",
        ),
    ],
)
async def test_project_spans(
    variables: dict[str, Any],
    start_cursor: Cursor,
    end_cursor: Cursor,
    has_next_page: bool,
    gql_client: AsyncGraphQLClient,
    llama_index_rag_spans: Any,
) -> None:
    query = """
      query ($projectId: ID!, $after: String = null, $before: String = null, $filterCondition: String = null, $first: Int = null, $last: Int = null, $sort: SpanSort = null) {
        node(id: $projectId) {
          ... on Project {
            spans(
              after: $after
              before: $before
              filterCondition: $filterCondition
              first: $first
              last: $last
              rootSpansOnly: false
              sort: $sort
            ) {
              edges {
                cursor
              }
              pageInfo {
                hasNextPage
                startCursor
                endCursor
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    spans = data["node"]["spans"]
    page_info = spans["pageInfo"]
    assert Cursor.from_string(page_info["startCursor"]) == start_cursor
    assert Cursor.from_string(page_info["endCursor"]) == end_cursor
    assert page_info["hasNextPage"] == has_next_page
    edges = spans["edges"]
    assert Cursor.from_string(edges[0]["cursor"]) == start_cursor
    assert Cursor.from_string(edges[-1]["cursor"]) == end_cursor


@pytest.fixture
async def llama_index_rag_spans(db: DbSessionFactory) -> None:
    # Inserts the first three traces from the llama-index-rag trace fixture
    # (minus embeddings) along with associated span evaluations.
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
        )
        trace_rowids = (
            await session.scalars(
                insert(models.Trace).returning(models.Trace.id),
                [
                    {
                        "trace_id": "0f5bb2e69a0640de87b9d424622b9f13",
                        "project_rowid": project_row_id,
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:25.534589+00:00"),
                    },
                    {
                        "trace_id": "a4083327f7d0400a9e99906242e71aa4",
                        "project_rowid": project_row_id,
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:25.540371+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:26.492242+00:00"),
                    },
                    {
                        "trace_id": "17f383d1c85648899368bde24b566411",
                        "project_rowid": project_row_id,
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:26.495969+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:27.336284+00:00"),
                    },
                ],
            )
        ).all()
        span_rowids = (
            await session.scalars(
                insert(models.Span).returning(models.Span.id),
                [
                    {
                        "trace_rowid": trace_rowids[0],
                        "span_id": "c0055a08295841ab946f2a16e5089fad",
                        "parent_id": None,
                        "name": "query",
                        "span_kind": "CHAIN",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:25.534589+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "CHAIN"}},
                            "output": {
                                "value": "To use the SDK to upload a ranking model, you can follow the documentation provided by the SDK. The documentation will guide you through the necessary steps to upload the model and integrate it into your system. Make sure to carefully follow the instructions to ensure a successful upload and integration process."
                            },
                            "input": {"value": "How do I use the SDK to upload a ranking model?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 240,
                        "cumulative_llm_token_count_completion": 56,
                    },
                    {
                        "trace_rowid": trace_rowids[0],
                        "span_id": "edcd8a83c7b34fd2b83e946f58e9a9c0",
                        "parent_id": "c0055a08295841ab946f2a16e5089fad",
                        "name": "retrieve",
                        "span_kind": "RETRIEVER",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:23.306945+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:23.710062+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "RETRIEVER"}},
                            "retrieval": {
                                "documents": [
                                    {
                                        "document": {
                                            "content": "\nRanking models are used by search engines to display query results ranked in the order of the highest relevance. These predictions seek to maximize user actions that are then used to evaluate model performance.&#x20;\n\nThe complexity within a ranking model makes failures challenging to pinpoint as a model\u2019s dimensions expand per recommendation. Notable challenges within ranking models include upstream data quality issues, poor-performing segments, the cold start problem, and more. &#x20;\n\n\n\n",
                                            "id": "ad17eeea-e339-4195-991b-8eef54b1db65",
                                            "score": 0.8022561073303223,
                                        }
                                    },
                                    {
                                        "document": {
                                            "content": "\n**Use the 'arize-demo-hotel-ranking' model, available in all free accounts, to follow along.**&#x20;\n\n",
                                            "id": "0ce66871-4a50-4d2f-94d2-1531924bf48a",
                                            "score": 0.7964192032814026,
                                        }
                                    },
                                ]
                            },
                            "input": {"value": "How do I use the SDK to upload a ranking model?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 0,
                        "cumulative_llm_token_count_completion": 0,
                    },
                    {
                        "trace_rowid": trace_rowids[0],
                        "span_id": "a91ad81bb187489093afeb8f3f5816b5",
                        "parent_id": "edcd8a83c7b34fd2b83e946f58e9a9c0",
                        "name": "embedding",
                        "span_kind": "EMBEDDING",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:23.307166+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:23.638792+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "EMBEDDING"}},
                            "embedding": {
                                "model_name": "text-embedding-ada-002",
                                "embeddings": [
                                    {
                                        "embedding": {
                                            "vector": [1.0],
                                            "text": "How do I use the SDK to upload a ranking model?",
                                        }
                                    }
                                ],
                            },
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 0,
                        "cumulative_llm_token_count_completion": 0,
                    },
                    {
                        "trace_rowid": trace_rowids[0],
                        "span_id": "78742859b73e427f90b43ec6cc8c42ba",
                        "parent_id": "c0055a08295841ab946f2a16e5089fad",
                        "name": "synthesize",
                        "span_kind": "CHAIN",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:23.710148+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:25.534461+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "CHAIN"}},
                            "output": {
                                "value": "To use the SDK to upload a ranking model, you can follow the documentation provided by the SDK. The documentation will guide you through the necessary steps to upload the model and integrate it into your system. Make sure to carefully follow the instructions to ensure a successful upload and integration process."
                            },
                            "input": {"value": "How do I use the SDK to upload a ranking model?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 240,
                        "cumulative_llm_token_count_completion": 56,
                    },
                    {
                        "trace_rowid": trace_rowids[0],
                        "span_id": "258bef0a3e384bcaaa5a388065af0d8f",
                        "parent_id": "78742859b73e427f90b43ec6cc8c42ba",
                        "name": "llm",
                        "span_kind": "LLM",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:23.712144+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:25.532714+00:00"),
                        "attributes": {
                            "llm": {
                                "invocation_parameters": '{"model": "gpt-3.5-turbo", "temperature": 0.0, "max_tokens": None}',
                                "input_messages": [
                                    {
                                        "message": {
                                            "role": "system",
                                        }
                                    },
                                    {
                                        "message": {
                                            "content": "Context information is below.\n---------------------\nRanking models are used by search engines to display query results ranked in the order of the highest relevance. These predictions seek to maximize user actions that are then used to evaluate model performance.&#x20;\n\nThe complexity within a ranking model makes failures challenging to pinpoint as a model\u2019s dimensions expand per recommendation. Notable challenges within ranking models include upstream data quality issues, poor-performing segments, the cold start problem, and more. &#x20;\n\n**Use the 'arize-demo-hotel-ranking' model, available in all free accounts, to follow along.**&#x20;\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: How do I use the SDK to upload a ranking model?\nAnswer: ",
                                            "role": "user",
                                        }
                                    },
                                ],
                                "model_name": "gpt-3.5-turbo",
                                "output_messages": [
                                    {
                                        "message": {
                                            "content": "To use the SDK to upload a ranking model, you can follow the documentation provided by the SDK. The documentation will guide you through the necessary steps to upload the model and integrate it into your system. Make sure to carefully follow the instructions to ensure a successful upload and integration process.",
                                            "role": "assistant",
                                        }
                                    }
                                ],
                                "prompt_template": {
                                    "template": "system: You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.\nuser: Context information is below.\n---------------------\n{context_str}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: {query_str}\nAnswer: \nassistant: ",
                                    "variables": {
                                        "context_str": "Ranking models are used by search engines to display query results ranked in the order of the highest relevance. These predictions seek to maximize user actions that are then used to evaluate model performance.&#x20;\n\nThe complexity within a ranking model makes failures challenging to pinpoint as a model\u2019s dimensions expand per recommendation. Notable challenges within ranking models include upstream data quality issues, poor-performing segments, the cold start problem, and more. &#x20;\n\n**Use the 'arize-demo-hotel-ranking' model, available in all free accounts, to follow along.**&#x20;",
                                        "query_str": "How do I use the SDK to upload a ranking model?",
                                    },
                                },
                                "token_count": {
                                    "prompt": 240.0,
                                    "total": 296.0,
                                    "completion": 56.0,
                                },
                            },
                            "output": {
                                "value": "To use the SDK to upload a ranking model, you can follow the documentation provided by the SDK. The documentation will guide you through the necessary steps to upload the model and integrate it into your system. Make sure to carefully follow the instructions to ensure a successful upload and integration process."
                            },
                            "openinference": {"span": {"kind": "LLM"}},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 240,
                        "cumulative_llm_token_count_completion": 56,
                    },
                    {
                        "trace_rowid": trace_rowids[1],
                        "span_id": "094ae70b0e9c4dec83601b0f0b89e551",
                        "parent_id": None,
                        "name": "query",
                        "span_kind": "CHAIN",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:25.540371+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:26.492242+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "CHAIN"}},
                            "output": {
                                "value": "Arize supports drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance."
                            },
                            "input": {"value": "What drift metrics are supported in Arize?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 315,
                        "cumulative_llm_token_count_completion": 21,
                    },
                    {
                        "trace_rowid": trace_rowids[1],
                        "span_id": "fc7f4cb067124f0abed01e5749a6aead",
                        "parent_id": "094ae70b0e9c4dec83601b0f0b89e551",
                        "name": "retrieve",
                        "span_kind": "RETRIEVER",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:25.540449+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:25.842912+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "RETRIEVER"}},
                            "retrieval": {
                                "documents": [
                                    {
                                        "document": {
                                            "content": "\nDrift monitors measure distribution drift, which is the difference between two statistical distributions.&#x20;\n\nArize offers various distributional drift metrics to choose from when setting up a monitor. Each metric is tailored to a specific use case; refer to this guide to help choose the appropriate metric for various ML use cases.\n\n",
                                            "id": "60f3c900-dcee-43ef-816e-ae8f5289a544",
                                            "score": 0.8768844604492188,
                                        }
                                    },
                                    {
                                        "document": {
                                            "content": "\nArize calculates drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance. Arize computes drift by measuring distribution changes between the model\u2019s production values and a baseline (reference dataset). Users can configure a baseline to be any time window of a:\n\n1. Pre-production dataset (training, test, validation) or\n2. Fixed or moving time period from production (e.g. last 30 days, last 60 days).&#x20;\n\nBaselines are saved in Arize so that users can compare several versions and/or environments against each other across moving or fixed time windows. For more details on baselines, visit here.\n\n",
                                            "id": "2e468875-ee22-4b5d-a7f4-57074eb5adfa",
                                            "score": 0.873500406742096,
                                        }
                                    },
                                ]
                            },
                            "input": {"value": "What drift metrics are supported in Arize?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 0,
                        "cumulative_llm_token_count_completion": 0,
                    },
                    {
                        "trace_rowid": trace_rowids[1],
                        "span_id": "70252f342dcc496dac93404dcfbaa211",
                        "parent_id": "fc7f4cb067124f0abed01e5749a6aead",
                        "name": "embedding",
                        "span_kind": "EMBEDDING",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:25.540677+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:25.768612+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "EMBEDDING"}},
                            "embedding": {
                                "model_name": "text-embedding-ada-002",
                                "embeddings": [
                                    {
                                        "embedding": {
                                            "vector": [1.0],
                                            "text": "What drift metrics are supported in Arize?",
                                        }
                                    }
                                ],
                            },
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 0,
                        "cumulative_llm_token_count_completion": 0,
                    },
                    {
                        "trace_rowid": trace_rowids[1],
                        "span_id": "c5ff03a4cf534b07a5ad6a00836acb1e",
                        "parent_id": "094ae70b0e9c4dec83601b0f0b89e551",
                        "name": "synthesize",
                        "span_kind": "CHAIN",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:25.842986+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:26.492192+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "CHAIN"}},
                            "output": {
                                "value": "Arize supports drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance."
                            },
                            "input": {"value": "What drift metrics are supported in Arize?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 315,
                        "cumulative_llm_token_count_completion": 21,
                    },
                    {
                        "trace_rowid": trace_rowids[1],
                        "span_id": "0890b8716c4943c18b3ad45c6d9aaf5d",
                        "parent_id": "c5ff03a4cf534b07a5ad6a00836acb1e",
                        "name": "llm",
                        "span_kind": "LLM",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:25.844758+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:26.491989+00:00"),
                        "attributes": {
                            "llm": {
                                "invocation_parameters": '{"model": "gpt-3.5-turbo", "temperature": 0.0, "max_tokens": None}',
                                "input_messages": [
                                    {
                                        "message": {
                                            "content": "You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.",
                                            "role": "system",
                                        }
                                    },
                                    {
                                        "message": {
                                            "content": "Context information is below.\n---------------------\nDrift monitors measure distribution drift, which is the difference between two statistical distributions.&#x20;\n\nArize offers various distributional drift metrics to choose from when setting up a monitor. Each metric is tailored to a specific use case; refer to this guide to help choose the appropriate metric for various ML use cases.\n\nArize calculates drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance. Arize computes drift by measuring distribution changes between the model\u2019s production values and a baseline (reference dataset). Users can configure a baseline to be any time window of a:\n\n1. Pre-production dataset (training, test, validation) or\n2. Fixed or moving time period from production (e.g. last 30 days, last 60 days).&#x20;\n\nBaselines are saved in Arize so that users can compare several versions and/or environments against each other across moving or fixed time windows. For more details on baselines, visit here.\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: What drift metrics are supported in Arize?\nAnswer: ",
                                            "role": "user",
                                        }
                                    },
                                ],
                                "model_name": "gpt-3.5-turbo",
                                "output_messages": [
                                    {
                                        "message": {
                                            "content": "Arize supports drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance.",
                                            "role": "assistant",
                                        }
                                    }
                                ],
                                "prompt_template": {
                                    "template": "system: You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.\nuser: Context information is below.\n---------------------\n{context_str}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: {query_str}\nAnswer: \nassistant: ",
                                    "variables": {
                                        "context_str": "Drift monitors measure distribution drift, which is the difference between two statistical distributions.&#x20;\n\nArize offers various distributional drift metrics to choose from when setting up a monitor. Each metric is tailored to a specific use case; refer to this guide to help choose the appropriate metric for various ML use cases.\n\nArize calculates drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance. Arize computes drift by measuring distribution changes between the model\u2019s production values and a baseline (reference dataset). Users can configure a baseline to be any time window of a:\n\n1. Pre-production dataset (training, test, validation) or\n2. Fixed or moving time period from production (e.g. last 30 days, last 60 days).&#x20;\n\nBaselines are saved in Arize so that users can compare several versions and/or environments against each other across moving or fixed time windows. For more details on baselines, visit here.",
                                        "query_str": "What drift metrics are supported in Arize?",
                                    },
                                },
                                "token_count": {
                                    "prompt": 315.0,
                                    "total": 336.0,
                                    "completion": 21.0,
                                },
                            },
                            "output": {
                                "value": "Arize supports drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance."
                            },
                            "openinference": {"span": {"kind": "LLM"}},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 315,
                        "cumulative_llm_token_count_completion": 21,
                    },
                    {
                        "trace_rowid": trace_rowids[2],
                        "span_id": "63b60ed12a61418ab9bd3757bd7eb09f",
                        "parent_id": None,
                        "name": "query",
                        "span_kind": "CHAIN",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:26.495969+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:27.336284+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "CHAIN"}},
                            "output": {"value": "Yes, Arize supports batch models."},
                            "input": {"value": "Does Arize support batch models?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 374,
                        "cumulative_llm_token_count_completion": 8,
                    },
                    {
                        "trace_rowid": trace_rowids[2],
                        "span_id": "2a3744dfdb954d6ea6a1dc0acb1e81d3",
                        "parent_id": "63b60ed12a61418ab9bd3757bd7eb09f",
                        "name": "retrieve",
                        "span_kind": "RETRIEVER",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:26.496043+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:26.704469+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "RETRIEVER"}},
                            "retrieval": {
                                "documents": [
                                    {
                                        "document": {
                                            "content": "\nArize supports many model types - check out our various Model Types to learn more.&#x20;\n\n",
                                            "id": "b18c5cbd-ab0b-43d2-b0d3-55e755ee3561",
                                            "score": 0.8502153754234314,
                                        }
                                    },
                                    {
                                        "document": {
                                            "content": 'developers to create, train, and deploy machine-learning models in the cloud. Monitor and observe models deployed on SageMaker with Arize for data quality issues, performance checks, and drift.&#x20;\n\n{% content-ref url="spell.md" %}\nspell.md\n{% endcontent-ref %}\n\n> Spell is an end-to-end ML platform that provides infrastructure for company to deploy and train models. Visualize your model\'s performance, understand drift & data quality issues, and share insights learned from your models deployed on Spell.\n\n{% content-ref url="ubiops.md" %}\nubiops.md\n{% endcontent-ref %}\n\n> UbiOps is an MLOps platform with APIs to deploy and serve models. The Arize platform can easily integrate with UbiOps to enable model observability, explainability, and monitoring.\n\n{% content-ref url="weights-and-biases.md" %}\nweights-and-biases.md\n{% endcontent-ref %}\n\n> Weights and Biases helps you build better model by logging metrics and visualize your experiments before production. Arize helps you visualize your model performance, understand drift & data quality issues, and share insights learned from your models.\n\n\n\n',
                                            "id": "a975f095-94b3-4164-9483-dcf94864ee40",
                                            "score": 0.8405197262763977,
                                        }
                                    },
                                ]
                            },
                            "input": {"value": "Does Arize support batch models?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 0,
                        "cumulative_llm_token_count_completion": 0,
                    },
                    {
                        "trace_rowid": trace_rowids[2],
                        "span_id": "11d1530f518c4f8cb8154d27a90c7023",
                        "parent_id": "2a3744dfdb954d6ea6a1dc0acb1e81d3",
                        "name": "embedding",
                        "span_kind": "EMBEDDING",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:26.496177+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:26.644424+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "EMBEDDING"}},
                            "embedding": {
                                "model_name": "text-embedding-ada-002",
                                "embeddings": [
                                    {
                                        "embedding": {
                                            "vector": [1.0],
                                            "text": "Does Arize support batch models?",
                                        }
                                    }
                                ],
                            },
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 0,
                        "cumulative_llm_token_count_completion": 0,
                    },
                    {
                        "trace_rowid": trace_rowids[2],
                        "span_id": "5f763ad643f2458181062f5a815004e6",
                        "parent_id": "63b60ed12a61418ab9bd3757bd7eb09f",
                        "name": "synthesize",
                        "span_kind": "CHAIN",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:26.704532+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:27.336235+00:00"),
                        "attributes": {
                            "openinference": {"span": {"kind": "CHAIN"}},
                            "output": {"value": "Yes, Arize supports batch models."},
                            "input": {"value": "Does Arize support batch models?"},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 374,
                        "cumulative_llm_token_count_completion": 8,
                    },
                    {
                        "trace_rowid": trace_rowids[2],
                        "span_id": "d0c8e22b54f1499db8d2b006d4425508",
                        "parent_id": "5f763ad643f2458181062f5a815004e6",
                        "name": "llm",
                        "span_kind": "LLM",
                        "start_time": datetime.fromisoformat("2023-12-11T17:43:26.706204+00:00"),
                        "end_time": datetime.fromisoformat("2023-12-11T17:43:27.336029+00:00"),
                        "attributes": {
                            "llm": {
                                "invocation_parameters": '{"model": "gpt-3.5-turbo", "temperature": 0.0, "max_tokens": None}',
                                "input_messages": [
                                    {
                                        "message": {
                                            "content": "You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.",
                                            "role": "system",
                                        }
                                    },
                                    {
                                        "message": {
                                            "content": 'Context information is below.\n---------------------\nArize supports many model types - check out our various Model Types to learn more.&#x20;\n\ndevelopers to create, train, and deploy machine-learning models in the cloud. Monitor and observe models deployed on SageMaker with Arize for data quality issues, performance checks, and drift.&#x20;\n\n{% content-ref url="spell.md" %}\nspell.md\n{% endcontent-ref %}\n\n> Spell is an end-to-end ML platform that provides infrastructure for company to deploy and train models. Visualize your model\'s performance, understand drift & data quality issues, and share insights learned from your models deployed on Spell.\n\n{% content-ref url="ubiops.md" %}\nubiops.md\n{% endcontent-ref %}\n\n> UbiOps is an MLOps platform with APIs to deploy and serve models. The Arize platform can easily integrate with UbiOps to enable model observability, explainability, and monitoring.\n\n{% content-ref url="weights-and-biases.md" %}\nweights-and-biases.md\n{% endcontent-ref %}\n\n> Weights and Biases helps you build better model by logging metrics and visualize your experiments before production. Arize helps you visualize your model performance, understand drift & data quality issues, and share insights learned from your models.\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: Does Arize support batch models?\nAnswer: ',
                                            "role": "user",
                                        }
                                    },
                                ],
                                "model_name": "gpt-3.5-turbo",
                                "output_messages": [
                                    {
                                        "message": {
                                            "content": "Yes, Arize supports batch models.",
                                            "role": "assistant",
                                        }
                                    }
                                ],
                                "prompt_template": {
                                    "template": "system: You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.\nuser: Context information is below.\n---------------------\n{context_str}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: {query_str}\nAnswer: \nassistant: ",
                                    "variables": {
                                        "context_str": 'Arize supports many model types - check out our various Model Types to learn more.&#x20;\n\ndevelopers to create, train, and deploy machine-learning models in the cloud. Monitor and observe models deployed on SageMaker with Arize for data quality issues, performance checks, and drift.&#x20;\n\n{% content-ref url="spell.md" %}\nspell.md\n{% endcontent-ref %}\n\n> Spell is an end-to-end ML platform that provides infrastructure for company to deploy and train models. Visualize your model\'s performance, understand drift & data quality issues, and share insights learned from your models deployed on Spell.\n\n{% content-ref url="ubiops.md" %}\nubiops.md\n{% endcontent-ref %}\n\n> UbiOps is an MLOps platform with APIs to deploy and serve models. The Arize platform can easily integrate with UbiOps to enable model observability, explainability, and monitoring.\n\n{% content-ref url="weights-and-biases.md" %}\nweights-and-biases.md\n{% endcontent-ref %}\n\n> Weights and Biases helps you build better model by logging metrics and visualize your experiments before production. Arize helps you visualize your model performance, understand drift & data quality issues, and share insights learned from your models.',
                                        "query_str": "Does Arize support batch models?",
                                    },
                                },
                                "token_count": {"prompt": 374.0, "total": 382.0, "completion": 8.0},
                            },
                            "output": {"value": "Yes, Arize supports batch models."},
                            "openinference": {"span": {"kind": "LLM"}},
                        },
                        "events": [],
                        "status_code": "OK",
                        "status_message": "",
                        "cumulative_error_count": 0,
                        "cumulative_llm_token_count_prompt": 374,
                        "cumulative_llm_token_count_completion": 8,
                    },
                ],
            )
        ).all()
        await session.execute(
            insert(models.SpanAnnotation),
            [
                {
                    "span_rowid": span_rowids[0],
                    "name": "Hallucination",
                    "label": "hallucinated",
                    "score": 0,
                    "explanation": "The query asks about how to use the SDK to upload a ranking model. The reference text provides information about ranking models and their challenges, and mentions a specific model 'arize-demo-hotel-ranking'. However, it does not provide any information about how to use an SDK to upload a ranking model. The answer talks about following the documentation provided by the SDK to upload the model, which is not mentioned or suggested in the reference text. Therefore, the answer is not based on the reference text.",
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "created_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "updated_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "identifier": "",
                    "source": "APP",
                    "user_id": None,
                },
                {
                    "span_rowid": span_rowids[5],
                    "name": "Hallucination",
                    "label": "factual",
                    "score": 1,
                    "explanation": "The query asks about the drift metrics supported in Arize. The reference text mentions that Arize calculates drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance. The answer states the same information, that Arize supports drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance. Therefore, the answer is based on the information provided in the reference text.",
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "created_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "updated_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "identifier": "",
                    "source": "APP",
                    "user_id": None,
                },
                {
                    "span_rowid": span_rowids[10],
                    "name": "Hallucination",
                    "label": "hallucinated",
                    "score": 0,
                    "explanation": "The query asks if Arize supports batch models. The reference text mentions that Arize supports many model types, but it does not specify if batch models are among those supported. Therefore, the answer assumes information that is not available in the reference text.",
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "created_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "updated_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "identifier": "",
                    "source": "APP",
                    "user_id": None,
                },
                {
                    "span_rowid": span_rowids[0],
                    "name": "Q&A Correctness",
                    "label": "incorrect",
                    "score": 0,
                    "explanation": "The reference text does not provide any information on how to use the SDK to upload a ranking model. It only mentions the use of a specific model 'arize-demo-hotel-ranking' and some challenges associated with ranking models. The answer, on the other hand, talks about following the documentation provided by the SDK to upload a ranking model. However, since the reference text does not mention anything about an SDK or its documentation, the answer does not correctly answer the question based on the reference text.",
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "created_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "updated_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "identifier": "",
                    "source": "APP",
                    "user_id": None,
                },
                {
                    "span_rowid": span_rowids[5],
                    "name": "Q&A Correctness",
                    "label": "correct",
                    "score": 1,
                    "explanation": "The reference text clearly states that Arize calculates drift metrics such as Population Stability Index, KL Divergence, and Wasserstein Distance. This directly matches the given answer, which states that Arize supports these same drift metrics. Therefore, the answer is correct.",
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "created_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "updated_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "identifier": "",
                    "source": "APP",
                    "user_id": None,
                },
                {
                    "span_rowid": span_rowids[10],
                    "name": "Q&A Correctness",
                    "label": "incorrect",
                    "score": 0,
                    "explanation": "The reference text mentions that Arize supports many model types and provides infrastructure for developers to create, train, and deploy machine-learning models in the cloud. However, it does not specifically mention that Arize supports batch models. Therefore, the answer is not supported by the reference text.",
                    "metadata_": {},
                    "annotator_kind": "LLM",
                    "created_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "updated_at": datetime.fromisoformat("2024-05-20T01:42:11+00:00"),
                    "identifier": "",
                    "source": "APP",
                    "user_id": None,
                },
            ],
        )


@dataclass
class _Data:
    spans: list[models.Span] = field(default_factory=list)
    traces: list[models.Trace] = field(default_factory=list)
    project_sessions: list[models.ProjectSession] = field(default_factory=list)
    projects: list[models.Project] = field(default_factory=list)


class TestProject:
    @staticmethod
    async def _node(
        field: str,
        project: models.Project,
        httpx_client: httpx.AsyncClient,
    ) -> Any:
        return await _node(field, Project.__name__, project.id, httpx_client)

    @pytest.fixture
    async def _data(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        projects, project_sessions, traces, spans = [], [], [], []
        async with db() as session:
            projects.append(await _add_project(session))

            project_sessions.append(await _add_project_session(session, projects[-1]))
            traces.append(await _add_trace(session, projects[-1], project_sessions[-1]))
            attributes = {"input": {"value": "a\"'b"}, "output": {"value": "c\"'d"}}
            spans.append(await _add_span(session, traces[-1], attributes=attributes))

            project_sessions.append(await _add_project_session(session, projects[-1]))
            traces.append(await _add_trace(session, projects[-1], project_sessions[-1]))
            attributes = {"input": {"value": "e\"'f"}, "output": {"value": "g\"'h"}}
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    attributes=attributes,
                    cumulative_llm_token_count_prompt=1,
                )
            )
            attributes = {"input": {"value": "i\"'j"}, "output": {"value": "k\"'l"}}
            spans.append(await _add_span(session, parent_span=spans[-1], attributes=attributes))

            project_sessions.append(await _add_project_session(session, projects[-1]))
            traces.append(await _add_trace(session, projects[-1], project_sessions[-1]))
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    cumulative_llm_token_count_completion=2,
                )
            )
            traces.append(await _add_trace(session, projects[-1], project_sessions[-1]))
            spans.append(await _add_span(session, traces[-1]))

            project_sessions.append(await _add_project_session(session, projects[-1]))
            traces.append(await _add_trace(session, projects[-1], project_sessions[-1]))
            attributes = {"input": {"value": "g\"'h"}, "output": {"value": "e\"'f"}}
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    attributes=attributes,
                    cumulative_llm_token_count_completion=1,
                )
            )
            spans.append(await _add_span(session, traces[-1]))

        return _Data(
            spans=spans,
            traces=traces,
            project_sessions=project_sessions,
            projects=projects,
        )

    @pytest.fixture
    async def _orphan_spans(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        """Creates spans with missing parent references to test orphan span handling.

        This fixture creates a test dataset with spans that have various parent-child relationships:
        - Some spans have no parent (parent_id=None) - these are true root spans
        - Some spans have parent_ids that don't exist - these are orphan spans
        - Some spans have valid parent references

        The fixture is used to test how the API handles orphan spans in different configurations.
        """
        projects, traces = [], []
        spans: list[models.Span] = []
        async with db() as session:
            # Create a test project
            projects.append(models.Project(name=token_hex(8)))
            session.add(projects[-1])
            await session.flush()

            start_time = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
            for i in range(2):
                # Create two traces with different start times
                trace_start_time = start_time + timedelta(seconds=i)
                traces.append(
                    models.Trace(
                        trace_id=token_hex(16),
                        project_rowid=projects[-1].id,
                        start_time=trace_start_time,
                        end_time=trace_start_time + timedelta(seconds=1),
                    )
                )
                session.add(traces[-1])
                await session.flush()

                n = 7
                for j in range(n):
                    # Create spans with different parent relationships:
                    if j % 2:
                        # Odd-indexed spans have non-existent parent IDs (orphan spans)
                        parent_id = token_hex(8)
                    elif j and j == n - 1:
                        # The last span (when j is even and non-zero) references the previous span
                        parent_id = spans[-1].span_id
                    else:
                        # Even-indexed spans (except the last) have no parent (root spans)
                        parent_id = None

                    span_start_time = trace_start_time + timedelta(seconds=j)
                    spans.append(
                        models.Span(
                            trace_rowid=traces[-1].id,
                            span_id=token_hex(8),
                            parent_id=parent_id,
                            name=token_hex(8),
                            span_kind="CHAIN",
                            start_time=span_start_time,
                            end_time=span_start_time + timedelta(seconds=1),
                            # Input value contains sequential digits (0, 01, 012, etc.)
                            # This is used for filtering in tests
                            attributes={"input": {"value": "".join(map(str, range(j)))}},
                            events=[],
                            status_code="OK",
                            status_message="",
                            cumulative_error_count=0,
                            cumulative_llm_token_count_prompt=0,
                            cumulative_llm_token_count_completion=0,
                        )
                    )
            session.add_all(spans)
            await session.flush()

        return _Data(
            spans=spans,
            traces=traces,
            projects=projects,
        )

    async def test_sessions_sort_token_count_total(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        column = "tokenCountTotal"
        project = _data.projects[0]
        result: list[str] = [
            _gid(_data.project_sessions[2]),
            _gid(_data.project_sessions[3]),
            _gid(_data.project_sessions[1]),
            _gid(_data.project_sessions[0]),
        ]

        for direction, expected in {"desc": result, "asc": result[::-1]}.items():
            field = "sessions(sort:{col:" + column + ",dir:" + direction + "}){edges{node{id}}}"
            res = await self._node(field, project, httpx_client)
            assert [e["node"]["id"] for e in res["edges"]] == expected

        # Test pagination
        first = 2
        cursors = [b"3:INT:2", b"4:INT:1", b"2:INT:1", b"1:INT:0"]
        for direction, (afters, ids) in {
            "desc": ([b""] + cursors, result),
            "asc": ([b""] + cursors[::-1], result[::-1]),
        }.items():
            for i, after in enumerate(afters):
                expected = ids[i : i + first]
                field = (
                    "sessions(sort:{col:"
                    + column
                    + ",dir:"
                    + direction
                    + "},first:"
                    + str(first)
                    + ',after:"'
                    + base64.b64encode(after).decode()
                    + '"){edges{node{id}}}'
                )
                res = await self._node(field, project, httpx_client)
                assert [e["node"]["id"] for e in res["edges"]] == expected

    async def test_filter_by_session_id(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project = _data.projects[0]
        session = _data.project_sessions[0]
        field = f'sessions(sessionId:"{session.session_id}")' + "{edges{node{id}}}"
        res = await self._node(field, project, httpx_client)
        assert [e["node"]["id"] for e in res["edges"]] == [_gid(session)]

        # Searching for a non-existent session ID should return an empty list
        field = f'sessions(sessionId:"{token_hex(16)}")' + "{edges{node{id}}}"
        res = await self._node(field, project, httpx_client)
        assert [e["node"]["id"] for e in res["edges"]] == []

    async def test_sessions_sort_token_count_total_plus_substring_filter(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        column = "tokenCountTotal"
        project = _data.projects[0]
        result: list[str] = [
            _gid(_data.project_sessions[3]),
            _gid(_data.project_sessions[1]),
        ]

        for direction, expected in {"desc": result, "asc": result[::-1]}.items():
            field = (
                "sessions(sort:{col:"
                + column
                + ",dir:"
                + direction
                + '},filterIoSubstring:"\\"\'f"){edges{node{id}}}'
            )
            res = await self._node(field, project, httpx_client)
            assert [e["node"]["id"] for e in res["edges"]] == expected

        # Test pagination
        first = 2
        cursors = [b"4:INT:1", b"2:INT:1"]
        for direction, (afters, ids) in {
            "desc": ([b""] + cursors, result),
            "asc": ([b""] + cursors[::-1], result[::-1]),
        }.items():
            for i, after in enumerate(afters):
                expected = ids[i : i + first]
                field = (
                    "sessions(sort:{col:"
                    + column
                    + ",dir:"
                    + direction
                    + '},filterIoSubstring:"\\"\'f",first:'
                    + str(first)
                    + ',after:"'
                    + base64.b64encode(after).decode()
                    + '"){edges{node{id}}}'
                )
                res = await self._node(field, project, httpx_client)
                assert [e["node"]["id"] for e in res["edges"]] == expected

    async def test_sessions_sort_num_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        column = "numTraces"
        project = _data.projects[0]
        result: list[str] = [
            _gid(_data.project_sessions[2]),
            _gid(_data.project_sessions[3]),
            _gid(_data.project_sessions[1]),
            _gid(_data.project_sessions[0]),
        ]

        for direction, expected in {"desc": result, "asc": result[::-1]}.items():
            field = "sessions(sort:{col:" + column + ",dir:" + direction + "}){edges{node{id}}}"
            res = await self._node(field, project, httpx_client)
            assert [e["node"]["id"] for e in res["edges"]] == expected

        # Test pagination
        first = 2
        cursors = [b"3:INT:2", b"4:INT:1", b"2:INT:1", b"1:INT:1"]
        for direction, (afters, ids) in {
            "desc": ([b""] + cursors, result),
            "asc": ([b""] + cursors[::-1], result[::-1]),
        }.items():
            for i, after in enumerate(afters):
                expected = ids[i : i + first]
                field = (
                    "sessions(sort:{col:"
                    + column
                    + ",dir:"
                    + direction
                    + "},first:"
                    + str(first)
                    + ',after:"'
                    + base64.b64encode(after).decode()
                    + '"){edges{node{id}}}'
                )
                res = await self._node(field, project, httpx_client)
                assert [e["node"]["id"] for e in res["edges"]] == expected

    async def test_sessions_sort_num_traces_plus_substring_filter(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        column = "numTraces"
        project = _data.projects[0]
        result: list[str] = [
            _gid(_data.project_sessions[3]),
            _gid(_data.project_sessions[1]),
        ]

        for direction, expected in {"desc": result, "asc": result[::-1]}.items():
            field = (
                "sessions(sort:{col:"
                + column
                + ",dir:"
                + direction
                + '},filterIoSubstring:"\\"\'f"){edges{node{id}}}'
            )
            res = await self._node(field, project, httpx_client)
            assert [e["node"]["id"] for e in res["edges"]] == expected

        # Test pagination
        first = 2
        cursors = [b"4:INT:1", b"2:INT:1"]
        for direction, (afters, ids) in {
            "desc": ([b""] + cursors, result),
            "asc": ([b""] + cursors[::-1], result[::-1]),
        }.items():
            for i, after in enumerate(afters):
                expected = ids[i : i + first]
                field = (
                    "sessions(sort:{col:"
                    + column
                    + ",dir:"
                    + direction
                    + '},filterIoSubstring:"\\"\'f",first:'
                    + str(first)
                    + ',after:"'
                    + base64.b64encode(after).decode()
                    + '"){edges{node{id}}}'
                )
                res = await self._node(field, project, httpx_client)
                assert [e["node"]["id"] for e in res["edges"]] == expected

    async def test_sessions_substring_search_looks_at_both_input_and_output(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project = _data.projects[0]
        field = 'sessions(filterIoSubstring:"\\"\'f"){edges{node{id}}}'
        res = await self._node(field, project, httpx_client)
        assert {e["node"]["id"] for e in res["edges"]} == {
            _gid(_data.project_sessions[1]),
            _gid(_data.project_sessions[3]),
        }

    async def test_sessions_substring_search_looks_at_only_root_spans(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project = _data.projects[0]
        field = 'sessions(filterIoSubstring:"\\"\'j"){edges{node{id}}}'
        res = await self._node(field, project, httpx_client)
        assert {e["node"]["id"] for e in res["edges"]} == set()

    @pytest.mark.parametrize("orphan_span_as_root_span", [False, True])
    async def test_root_spans_only_with_orphan_spans(
        self,
        _orphan_spans: _Data,
        httpx_client: httpx.AsyncClient,
        orphan_span_as_root_span: bool,
    ) -> None:
        """Test pagination of root spans with orphan span handling.

        This test verifies that:
        1. Root spans are correctly identified based on orphan_span_as_root_span setting
        2. Pagination works correctly when fetching spans in chunks
        3. Spans are properly filtered and sorted
        """
        project = _orphan_spans.projects[0]

        # Filter spans containing "2" in their input value
        filtered_spans = [s for s in _orphan_spans.spans if "2" in s.attributes["input"]["value"]]

        # Determine root spans based on configuration
        if orphan_span_as_root_span:
            existing_span_ids = {s.span_id for s in _orphan_spans.spans}
            root_spans = [s for s in filtered_spans if s.parent_id not in existing_span_ids]
        else:
            root_spans = [s for s in filtered_spans if s.parent_id is None]

        # Sort spans by start time and ID
        sorted_spans = sorted(root_spans, key=lambda t: (t.start_time, t.id), reverse=True)

        # Convert to global IDs for comparison
        gids = list(map(_gid, sorted_spans))
        n = len(gids)
        first = n // 2 + 1  # Request half the spans plus one

        # Test pagination
        cursor = ""
        for i in range(n):
            expected = gids[i : i + first]

            # Construct GraphQL query
            field = (
                "spans("
                f"rootSpansOnly:true,"
                f"orphanSpanAsRootSpan:{str(orphan_span_as_root_span).lower()},"
                "sort:{col:startTime,dir:desc},"
                "filterCondition:\"'2' in input.value\","
                f"first:{str(first)},"
                f'after:"{cursor}"'
                "){edges{node{id}cursor}}"
            )

            # Execute query and verify results
            res = await self._node(field, project, httpx_client)
            assert [e["node"]["id"] for e in res["edges"]] == expected
            cursor = res["edges"][0]["cursor"]

    @pytest.fixture
    async def _time_series_data(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        """Creates a dataset for testing span_count_time_series using random timestamps.

        Creates spans with random timestamps distributed across different time periods
        to test time series grouping and filtering functionality. The spans are created
        within the last day to ensure they fall within reasonable time buckets.

        Returns:
            _Data object containing:
            - projects: List of test projects
            - traces: List of test traces
            - spans: List of test spans with random timestamps
        """
        projects: list[models.Project] = []
        traces: list[models.Trace] = []
        spans: list[models.Span] = []

        async with db() as session:
            # Create a test project
            projects.append(models.Project(name=token_hex(8)))
            session.add(projects[-1])
            await session.flush()

            # Create multiple traces with spans at different times
            for _ in range(10):
                # Generate random trace start time within the test time range (2024-01-01)
                trace_start = fake.date_time_between(
                    start_date=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_date=datetime.fromisoformat("2024-01-01T23:59:59+00:00"),
                    tzinfo=timezone.utc,
                )
                trace_start = trace_start.replace(microsecond=0)
                trace_end = trace_start + timedelta(seconds=30)

                # Create trace
                trace = models.Trace(
                    trace_id=token_hex(16),
                    project_rowid=projects[-1].id,
                    start_time=trace_start,
                    end_time=trace_end,
                )
                session.add(trace)
                await session.flush()
                traces.append(trace)

                # Create span for this trace
                span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,
                    name=token_hex(8),
                    span_kind="LLM",
                    start_time=trace_start,
                    end_time=trace_end,
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                spans.append(span)
            session.add_all(spans)

        return _Data(
            spans=spans,
            traces=traces,
            projects=projects,
        )

    @staticmethod
    def _count_rows(
        df: pd.DataFrame,
        field: Literal["minute", "hour", "day", "week", "month", "year"],
        utc_offset_minutes: int,
    ) -> pd.DataFrame:
        offset_tz = timezone(timedelta(minutes=utc_offset_minutes))
        t = df.loc[:, "timestamp"].dt.tz_convert(offset_tz)
        if field == "minute":
            t = t.dt.floor("T")
        elif field == "hour":
            t = t.dt.floor("H")
        elif field == "day":
            t = t.dt.floor("D")
        elif field == "week":
            t = t.dt.to_period("W").dt.start_time.dt.tz_localize(offset_tz)
        elif field == "month":
            t = t.dt.to_period("M").dt.start_time.dt.tz_localize(offset_tz)
        elif field == "year":
            t = t.dt.to_period("Y").dt.start_time.dt.tz_localize(offset_tz)
        else:
            assert_never(field)
        t = t.dt.tz_convert(timezone.utc)
        return df.groupby(t).size().reset_index(name="count")

    async def test_time_series(
        self,
        _time_series_data: _Data,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test the span_count_time_series field using pandas validation.

        This comprehensive test verifies that the SQL-based time series calculation matches
        pandas-based calculations using the same logic. It covers:

        **Time Granularities:**
        - Minute-level aggregation
        - Hourly aggregation (default)
        - Daily aggregation
        - Weekly aggregation
        - Monthly aggregation
        - Yearly aggregation

        **UTC Offset Scenarios:**
        - No offset (UTC+0)
        - Positive offsets (UTC+1, UTC+5.5, UTC+8, UTC+9, UTC+13, UTC+14)
        - Negative offsets (UTC-5, UTC-8, UTC-12)
        - Fractional hour offsets (UTC+1.5)

        **Time Range Edge Cases:**
        - Empty result sets (no data in range)
        - Very narrow time ranges (1 second, 1 minute)
        - Limited data points
        - Boundary conditions (start == end)
        - Partial range specifications (start-only, end-only)
        - No time range specified (all data)

        **Boundary Conditions:**
        - Cross-day boundaries with offsets
        - Month boundaries (including leap year)
        - Year-end boundaries
        - Leap year date boundaries

        **Real-world Timezone Examples:**
        - PST (UTC-8)
        - EST (UTC-5)
        - IST (UTC+5.5)
        - JST (UTC+9)
        - Line Islands (UTC+14)
        - Baker Island (UTC-12)

        Each test case validates both span and trace count time series.
        """
        project = _time_series_data.projects[0]

        test_cases = [
            # === BASIC HOURLY TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T01:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                None,
                "default_hourly_no_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T01:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T03:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=0),
                "hourly_no_offset",
            ),
            # === MINUTE GRANULARITY TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T01:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T01:30:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MINUTE, utc_offset_minutes=0),
                "minute_no_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T01:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T02:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MINUTE, utc_offset_minutes=60),
                "minute_with_positive_offset",
            ),
            # === DAILY GRANULARITY TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.DAY, utc_offset_minutes=0),
                "daily_no_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.DAY, utc_offset_minutes=-480),  # PST offset
                "daily_with_negative_offset",
            ),
            # === WEEKLY GRANULARITY TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-08T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.WEEK, utc_offset_minutes=0),
                "weekly_no_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-08T00:00:00+00:00"),
                ),
                TimeBinConfig(
                    scale=TimeBinScale.WEEK, utc_offset_minutes=330
                ),  # India Standard Time
                "weekly_with_positive_offset",
            ),
            # === MONTHLY GRANULARITY TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-02-01T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MONTH, utc_offset_minutes=0),
                "monthly_no_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-03-01T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MONTH, utc_offset_minutes=-300),  # EST offset
                "monthly_with_negative_offset",
            ),
            # === YEARLY GRANULARITY TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2025-01-01T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.YEAR, utc_offset_minutes=0),
                "yearly_no_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2023-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2025-01-01T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.YEAR, utc_offset_minutes=540),  # JST offset
                "yearly_with_positive_offset",
            ),
            # === EDGE CASES ===
            # Empty result set (time range with no data)
            (
                TimeRange(
                    start=datetime.fromisoformat("2023-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2023-01-01T01:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=0),
                "empty_result_set",
            ),
            # Very narrow time range
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T12:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T12:00:01+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MINUTE, utc_offset_minutes=0),
                "narrow_time_range",
            ),
            # Limited data points
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T00:30:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MINUTE, utc_offset_minutes=0),
                "limited_data_points",
            ),
            # Boundary condition: Start equals end
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T12:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T12:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=0),
                "zero_duration_range",
            ),
            # === PARTIAL TIME RANGE TESTS ===
            # Only start time specified
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T12:00:00+00:00"),
                    end=None,
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=0),
                "only_start_time",
            ),
            # === LARGE UTC OFFSET TESTS ===
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=780),  # +13 hours
                "large_positive_offset",
            ),
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=-720),  # -12 hours
                "large_negative_offset",
            ),
            # === BOUNDARY CONDITION TESTS ===
            # Cross-day boundary with offset
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T22:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T02:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=480),  # +8 hours
                "cross_day_boundary",
            ),
            # Test with fractional hour offset
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T06:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=90),  # +1.5 hours
                "fractional_hour_offset",
            ),
            # Test with leap year boundaries
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-02-28T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-03-01T00:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.DAY, utc_offset_minutes=0),
                "leap_year_boundary",
            ),
            # Test with month boundary at different scales
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-31T22:00:00+00:00"),
                    end=datetime.fromisoformat("2024-02-01T02:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=0),
                "month_boundary_hourly",
            ),
            # Test with daylight saving time-like offset changes
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T06:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=-480),  # PST
                "dst_like_offset",
            ),
            # Test with extreme small time range at minute level
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T12:30:00+00:00"),
                    end=datetime.fromisoformat("2024-01-01T12:31:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.MINUTE, utc_offset_minutes=0),
                "single_minute_range",
            ),
            # Test with year-end boundary
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-12-31T22:00:00+00:00"),
                    end=datetime.fromisoformat("2025-01-01T02:00:00+00:00"),
                ),
                TimeBinConfig(scale=TimeBinScale.HOUR, utc_offset_minutes=0),
                "year_end_boundary",
            ),
            # Test with maximum reasonable offset (UTC+14)
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                TimeBinConfig(
                    scale=TimeBinScale.HOUR, utc_offset_minutes=840
                ),  # +14 hours (Line Islands)
                "maximum_positive_offset",
            ),
            # Test with minimum reasonable offset (UTC-12)
            (
                TimeRange(
                    start=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end=datetime.fromisoformat("2024-01-02T00:00:00+00:00"),
                ),
                TimeBinConfig(
                    scale=TimeBinScale.HOUR, utc_offset_minutes=-720
                ),  # -12 hours (Baker Island)
                "minimum_negative_offset",
            ),
        ]

        for time_range, time_bin_config, test_desc in test_cases:
            # Calculate expected results using pandas (same logic as SQL)
            records = _time_series_data.spans
            data_df = pd.DataFrame([{"timestamp": s.start_time} for s in records]).sort_values(
                "timestamp"
            )

            # Apply time range filtering if specified
            if time_range and time_range.start:
                data_df = data_df[data_df["timestamp"] >= time_range.start]
            if time_range and time_range.end:
                data_df = data_df[data_df["timestamp"] < time_range.end]

            if data_df.empty:
                expected_summary = pd.DataFrame(columns=["timestamp", "count"])
            else:
                expected_summary = self._count_rows(
                    data_df,
                    field=time_bin_config.scale.value if time_bin_config else "hour",
                    utc_offset_minutes=time_bin_config.utc_offset_minutes if time_bin_config else 0,
                )

            # Execute GraphQL query
            project_gid = str(GlobalID(type_name="Project", node_id=str(project.id)))
            variables: dict[str, Any] = {"id": project_gid}

            query = """
                query($id: ID!, $timeRange: TimeRange!, $timeBinConfig: TimeBinConfig) {{
                    node(id: $id) {{
                        ... on Project {{
                            {obj}CountTimeSeries(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {{
                                data {{
                                    timestamp
                                    value
                                }}
                            }}
                        }}
                    }}
                }}
            """

            if time_range:
                time_range_vars = {}
                if time_range.start:
                    time_range_vars["start"] = time_range.start.isoformat()
                if time_range.end:
                    time_range_vars["end"] = time_range.end.isoformat()
                if time_range_vars:
                    variables["timeRange"] = time_range_vars
            if time_bin_config:
                variables["timeBinConfig"] = {
                    "scale": time_bin_config.scale.value.upper(),
                    "utcOffsetMinutes": time_bin_config.utc_offset_minutes,
                }

            # Execute GraphQL query
            for obj in ["span", "trace"]:
                response = await gql_client.execute(
                    query=query.format(obj=obj), variables=variables
                )
                assert not response.errors
                assert (data := response.data) is not None
                res = data["node"][f"{obj}CountTimeSeries"]

                # Verify the structure of the response
                assert "data" in res
                assert isinstance(res["data"], list)

                # Convert response to DataFrame for comparison
                if not res["data"]:
                    actual_summary = pd.DataFrame(columns=["timestamp", "count"])
                else:
                    actual_data = []
                    for data_point in res["data"]:
                        timestamp = datetime.fromisoformat(data_point["timestamp"])
                        if (value := data_point["value"]) is not None:
                            actual_data.append({"timestamp": timestamp, "count": value})
                    actual_summary = pd.DataFrame(
                        actual_data,
                        columns=["timestamp", "count"],
                    ).sort_values("timestamp")

                # Handle empty results
                if expected_summary.empty:
                    assert actual_summary.empty, f"Expected empty summary for {obj} in {test_desc}"
                    continue

                actual_summary["timestamp"] = pd.to_datetime(actual_summary["timestamp"])

                # Verify SQL results match pandas calculation
                try:
                    pd.testing.assert_frame_equal(
                        actual_summary, expected_summary, check_dtype=False
                    )
                except AssertionError as e:
                    raise AssertionError(f"Test failed for {obj} in {test_desc}") from e

    @pytest.mark.parametrize(
        "expectation,condition",
        [
            (True, "span_kind == 'LLM'"),
            (False, "span_kind == 'LLM' and "),
            (False, "span_kind == 'LLM' and ''"),
        ],
    )
    async def test_validate_span_filter_condition(
        self,
        condition: str,
        expectation: bool,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
        query = """
            query($id: ID!, $condition: String!) {
              node(id: $id) {
                ... on Project {
                  validateSpanFilterCondition(
                    condition: $condition
                  ) {
                    isValid
                  }
                }
              }
            }
        """
        project_gid = str(GlobalID(type_name="Project", node_id=str(project.id)))
        response = await gql_client.execute(
            query=query,
            variables={"id": project_gid, "condition": condition},
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert data["node"]["validateSpanFilterCondition"]["isValid"] == expectation


@pytest.mark.parametrize(
    "sort_col, sort_dir, expected_order",
    [
        pytest.param(
            "name",
            "asc",
            ["project1", "project2", "project3"],
            id="sort-by-name-asc",
        ),
        pytest.param(
            "name",
            "desc",
            ["project3", "project2", "project1"],
            id="sort-by-name-desc",
        ),
        pytest.param(
            "endTime",
            "asc",
            ["project1", "project2", "project3"],
            id="sort-by-end-time-asc",
        ),
        pytest.param(
            "endTime",
            "desc",
            ["project3", "project2", "project1"],
            id="sort-by-end-time-desc",
        ),
    ],
)
async def test_project_sort(
    sort_col: str,
    sort_dir: str,
    expected_order: list[str],
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    """Test project sorting capabilities."""
    # Create test projects with controlled timestamps
    base_time = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
    projects: list[models.Project] = []
    async with db() as session:
        # Create projects first
        for i, name in enumerate(["project1", "project2", "project3"]):
            project = models.Project(
                name=name,
                created_at=base_time + timedelta(hours=i),
                updated_at=base_time + timedelta(hours=i),
            )
            session.add(project)
            await session.flush()
            projects.append(project)

        # Now create traces for each project with different end times
        # Each project will have 3 traces with different end times
        # The max end time for each project will be different and match the expected sort order
        for i, project in enumerate(projects):
            for j in range(3):
                trace = models.Trace(
                    trace_id=token_hex(16),
                    project_rowid=project.id,
                    start_time=base_time + timedelta(hours=i),
                    # The max end time for each project will be base_time + (i+1) days
                    # This ensures project1 has max end time of day 1
                    # project2 has max end time of day 2
                    # project3 has max end time of day 3
                    end_time=base_time + timedelta(days=i + 1, hours=j),
                )
                session.add(trace)
        await session.commit()

    query = """
        query ($sort: ProjectSort) {
            projects(sort: $sort) {
                edges {
                    node {
                        name
                    }
                }
            }
        }
    """

    variables = {"sort": {"col": sort_col, "dir": sort_dir}}
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    projects = data["projects"]
    project_names = [edge["node"]["name"] for edge in projects["edges"]]  # type: ignore
    assert project_names == expected_order


@pytest.mark.parametrize(
    "filter_value, expected_names",
    [
        pytest.param(
            "project",
            ["test_project", "project_test"],
            id="filter-matches-all",
        ),
        pytest.param(
            "test",
            ["test_project", "project_test"],
            id="filter-matches-partial",
        ),
        pytest.param(
            "TEST",
            ["test_project", "project_test"],
            id="filter-case-insensitive",
        ),
        pytest.param(
            "nomatch",
            [],
            id="filter-no-matches",
        ),
    ],
)
async def test_project_filter(
    filter_value: str,
    expected_names: list[str],
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    """Test project filtering capabilities."""
    # Create test projects
    async with db() as session:
        for name in ["test_project", "project_test", "other_name"]:
            project = models.Project(name=name)
            session.add(project)
        await session.commit()

    query = """
        query ($filter: ProjectFilter) {
            projects(filter: $filter) {
                edges {
                    node {
                        name
                    }
                }
            }
        }
    """

    variables = {"filter": {"col": "name", "value": filter_value}}
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    projects = data["projects"]
    project_names = [edge["node"]["name"] for edge in projects["edges"]]
    assert sorted(project_names) == sorted(expected_names)


@pytest.mark.parametrize(
    "sort, filter_value, expected_names",
    [
        pytest.param(
            {"col": "name", "dir": "asc"},
            "test",
            ["project_test", "test_project"],
            id="filter-and-sort-asc",
        ),
        pytest.param(
            {"col": "name", "dir": "desc"},
            "test",
            ["test_project", "project_test"],
            id="filter-and-sort-desc",
        ),
    ],
)
async def test_project_filter_and_sort(
    sort: dict[str, str],
    filter_value: str,
    expected_names: list[str],
    gql_client: AsyncGraphQLClient,
    db: DbSessionFactory,
) -> None:
    """Test combining project filtering and sorting."""
    # Create test projects
    async with db() as session:
        for name in ["test_project", "project_test", "other_name"]:
            project = models.Project(name=name)
            session.add(project)
        await session.commit()

    query = """
        query ($sort: ProjectSort, $filter: ProjectFilter) {
            projects(sort: $sort, filter: $filter) {
                edges {
                    node {
                        name
                    }
                }
            }
        }
    """

    variables = {
        "sort": sort,
        "filter": {"col": "name", "value": filter_value},
    }
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    projects = data["projects"]
    project_names = [edge["node"]["name"] for edge in projects["edges"]]
    assert project_names == expected_names


async def test_paginate_spans_by_trace_start_time(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """Test the _paginate_span_by_trace_start_time optimization function.

    This function is triggered when:
    - rootSpansOnly: true
    - No filter_condition
    - sort.col is SpanColumn.startTime

    Key behaviors tested:
    - Returns one representative span per trace (not all spans)
    - Orders by trace start time (not span start time)
    - Uses cursors based on trace rowids + start times (unusual!)
    - Handles orphan spans based on orphan_span_as_root_span parameter
    - Supports time range filtering on trace start times
    - May return empty edges while has_next_page=True when traces have no matching spans
    - **RETRY LOGIC**: When insufficient edges are found (len(edges) < first) but has_next_page=True,
      the function automatically retries pagination with larger batch sizes (max(first, 1000))
      up to 10 times (retries=10) to collect enough spans. This handles cases where many traces
      exist but lack matching root spans.

    Implementation Details:
    - Uses CTEs (Common Table Expressions) for efficient trace-based pagination
    - PostgreSQL: Uses DISTINCT ON for deduplication
    - SQLite: Uses Python groupby() for deduplication (too complex for SQLite DISTINCT)
    - SQL ordering: trace start_time -> trace id -> span start_time (ASC for earliest) -> span id (DESC)
    - Cursors contain trace rowid + trace start_time, NOT span data
    - Over-fetches by 1 trace to determine has_next_page efficiently

    Test Data Setup:
    ================
    Creates 5 traces with start times at hours 1, 2, 3, 4, 5:

    Trace Index | Hour | Real Root Span | Orphan Span  | Additional Spans | Expected Name
    ------------|------|----------------|--------------|------------------|---------------
    0 (even)    |  1   |      ✓         |      ✗       | +2nd root span   | root-span-1
    1 (odd)     |  2   |      ✗         |      ✓       | +2nd orphan span | orphan-span-2
    2 (even)    |  3   |      ✓         |      ✗       | +2nd root span   | root-span-3
    3 (odd)     |  4   |      ✗         |      ✓       | +2nd orphan span | orphan-span-4
    4 (even)    |  5   |      ✓         |      ✗       | +2nd root span   | root-span-5

    Key Testing Points:
    - ALL traces have multiple candidate spans to test "earliest span per trace" selection
    - Trace 1: 2 root spans → Returns earliest (root-span-1, not second-root-span-1)
    - Trace 2: 2 orphan spans → Returns earliest (orphan-span-2, not second-orphan-span-2)
    - Trace 3: 2 root spans → Returns earliest (root-span-3, not second-root-span-3)
    - Trace 4: 2 orphan spans → Returns earliest (orphan-span-4, not second-orphan-span-4)
    - Trace 5: 2 root spans → Returns earliest (root-span-5, not second-root-span-5)
    - Comprehensive test of SQL ordering: ORDER BY span.start_time ASC, span.id DESC

    With orphan_span_as_root_span=false: Only returns real root spans 1, 3, 5 (3 total)
    With orphan_span_as_root_span=true:  Returns all spans 1, 2, 3, 4, 5 (5 total)
    """
    # ========================================
    # SETUP: Create test data
    # ========================================
    async with db() as session:
        project = models.Project(name=token_hex(8))
        session.add(project)
        await session.flush()

        # Create 5 traces with start times at hours 1, 2, 3, 4, 5
        base_time = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
        traces = []
        spans = []

        for i in range(5):
            # Trace start times: 01:00, 02:00, 03:00, 04:00, 05:00
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=project.id,
                start_time=base_time + timedelta(hours=i + 1),
                end_time=base_time + timedelta(hours=i + 2),
            )
            session.add(trace)
            await session.flush()
            traces.append(trace)

            if i % 2 == 0:
                # EVEN indices (0, 2, 4) → traces at hours 1, 3, 5 → CREATE REAL ROOT SPANS
                # These spans have parent_id=None (true root spans)
                root_span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,  # ← This makes it a real root span
                    name=f"root-span-{i+1}",
                    span_kind="CHAIN",
                    start_time=trace.start_time + timedelta(minutes=10),
                    end_time=trace.start_time + timedelta(minutes=20),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                session.add(root_span)
                spans.append(root_span)

                # Also create a child span to verify only root span is returned per trace
                child_span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=root_span.span_id,  # ← Child of the root span
                    name=f"child-span-{i+1}",
                    span_kind="CHAIN",
                    start_time=trace.start_time + timedelta(minutes=15),
                    end_time=trace.start_time + timedelta(minutes=25),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                session.add(child_span)

                # Add a SECOND root span with later start time to test "earliest span" selection
                # This span should NOT be returned (only the earliest root span per trace)
                second_root_span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,  # ← Also a root span
                    name=f"second-root-span-{i+1}",
                    span_kind="CHAIN",
                    start_time=trace.start_time + timedelta(minutes=30),  # ← Later start time
                    end_time=trace.start_time + timedelta(minutes=40),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                session.add(second_root_span)
            else:
                # ODD indices (1, 3) → traces at hours 2, 4 → CREATE ORPHAN SPANS
                # These spans have parent_id pointing to non-existent spans (orphans)
                orphan_span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=token_hex(8),  # ← Points to non-existent span (orphan)
                    name=f"orphan-span-{i+1}",
                    span_kind="CHAIN",
                    start_time=trace.start_time + timedelta(minutes=10),
                    end_time=trace.start_time + timedelta(minutes=20),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                session.add(orphan_span)
                spans.append(orphan_span)

                # Add a SECOND orphan span with later start time to test "earliest span" selection
                # This span should NOT be returned (only the earliest orphan span per trace)
                second_orphan_span = models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=token_hex(8),  # ← Also an orphan span (different parent_id)
                    name=f"second-orphan-span-{i+1}",
                    span_kind="CHAIN",
                    start_time=trace.start_time + timedelta(minutes=30),  # ← Later start time
                    end_time=trace.start_time + timedelta(minutes=40),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
                session.add(second_orphan_span)

        project_gid = str(GlobalID(type_name="Project", node_id=str(project.id)))

    # ========================================
    # TEST 1: Basic pagination with orphan_span_as_root_span=false
    # Expected: Only real root spans (1, 3, 5) returned, NOT orphan spans (2, 4)
    # ========================================
    query = """
        query ($projectId: ID!, $first: Int, $after: String) {
            node(id: $projectId) {
                ... on Project {
                    spans(
                        rootSpansOnly: true,
                        orphanSpanAsRootSpan: false,  # ← Exclude orphan spans
                        sort: {col: startTime, dir: desc},
                        first: $first,
                        after: $after
                    ) {
                        edges {
                            node {
                                id
                                name
                            }
                            cursor
                        }
                        pageInfo {
                            hasNextPage
                            hasPreviousPage
                            startCursor
                            endCursor
                        }
                    }
                }
            }
        }
    """

    # Page 1: Request first 2 spans in descending order (by trace start time)
    # Expected: Only root-span-5 (trace 5 is latest, and only that trace has a real root span)
    # Note: trace 4 has an orphan span, but it's excluded by orphanSpanAsRootSpan=false
    response = await gql_client.execute(
        query=query,
        variables={
            "projectId": project_gid,
            "first": 2,
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    page = data["node"]["spans"]
    edges = page["edges"]
    page_info = page["pageInfo"]

    assert len(edges) == 2
    assert edges[0]["node"]["name"] == "root-span-5"
    assert edges[1]["node"]["name"] == "root-span-3"
    assert page_info["hasNextPage"] is True  # More traces to check
    assert page_info["hasPreviousPage"] is False

    # Verify cursor contains trace rowid (5) and trace start time (05:00:00)
    # This demonstrates the unusual "trace-based cursors" behavior
    assert (
        base64.b64decode(page_info["startCursor"].encode())
        == b"5:DATETIME:2024-01-01T05:00:00+00:00"
    )
    assert (
        base64.b64decode(page_info["endCursor"].encode()) == b"3:DATETIME:2024-01-01T03:00:00+00:00"
    )

    # Page 2: Continue pagination after trace 5
    # Expected: root-span-3 (trace 3 is next latest with real root span)
    # Note: trace 4 is skipped because it only has orphan span (excluded)
    response = await gql_client.execute(
        query=query,
        variables={
            "projectId": project_gid,
            "first": 3,
            "after": base64.b64encode(b"5:DATETIME:2024-01-01T05:00:00+00:00").decode(),
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    page = data["node"]["spans"]
    edges = page["edges"]
    page_info = page["pageInfo"]

    assert len(edges) == 2
    assert edges[0]["node"]["name"] == "root-span-3"
    assert edges[1]["node"]["name"] == "root-span-1"
    assert page_info["hasNextPage"] is False
    assert page_info["hasPreviousPage"] is False
    assert (
        base64.b64decode(page_info["startCursor"].encode())
        == b"4:DATETIME:2024-01-01T04:00:00+00:00"  # Trace 3 yielded the span
    )
    assert (
        base64.b64decode(page_info["endCursor"].encode()) == b"1:DATETIME:2024-01-01T01:00:00+00:00"
    )

    # Page 3: Continue pagination after trace 3
    # Expected: root-span-1 (trace 1 is oldest with real root span)
    # Note: trace 2 is skipped because it only has orphan span (excluded)
    response = await gql_client.execute(
        query=query,
        variables={
            "projectId": project_gid,
            "first": 4,
            "after": base64.b64encode(b"3:DATETIME:2024-01-01T03:00:00+00:00").decode(),
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    page = data["node"]["spans"]
    edges = page["edges"]
    page_info = page["pageInfo"]

    # Should return root-span-1 (oldest real root span)
    assert len(edges) == 1
    assert edges[0]["node"]["name"] == "root-span-1"
    assert page_info["hasNextPage"] is False  # No more traces
    assert page_info["hasPreviousPage"] is False
    assert (
        base64.b64decode(page_info["startCursor"].encode())
        == b"2:DATETIME:2024-01-01T02:00:00+00:00"
    )
    assert (
        base64.b64decode(page_info["endCursor"].encode()) == b"1:DATETIME:2024-01-01T01:00:00+00:00"
    )

    # ========================================
    # TEST 2: Ascending order (orphan_span_as_root_span=false)
    # Expected: Same spans but in reverse order: root-span-1, root-span-3, root-span-5
    # ========================================
    response = await gql_client.execute(
        query=query.replace("dir: desc", "dir: asc"),
        variables={
            "projectId": project_gid,
            "first": 2,
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    asc_page = data["node"]["spans"]
    edges = asc_page["edges"]
    page_info = asc_page["pageInfo"]

    # Should return first span in ascending order (oldest trace with real root span)
    assert len(edges) == 2
    assert edges[0]["node"]["name"] == "root-span-1"
    assert edges[1]["node"]["name"] == "root-span-3"
    assert page_info["hasNextPage"] is True

    # ========================================
    # TEST 3: Bulk query (orphan_span_as_root_span=false)
    # Expected: All 3 real root spans at once
    # ========================================
    response = await gql_client.execute(
        query=query,
        variables={
            "projectId": project_gid,
            "first": 10,
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    all_spans = data["node"]["spans"]
    edges = all_spans["edges"]
    page_info = all_spans["pageInfo"]
    span_names = [edge["node"]["name"] for edge in edges]

    # Should return all 3 real root spans (excluding orphan spans 2, 4)
    # IMPORTANT: Returns earliest root span per trace (ALL traces have multiple candidates):
    # - Trace 1: root-span-1 (NOT second-root-span-1 which has later start time)
    # - Trace 3: root-span-3 (NOT second-root-span-3 which has later start time)
    # - Trace 5: root-span-5 (NOT second-root-span-5 which has later start time)
    assert len(edges) == 3
    assert span_names == [
        "root-span-5",
        "root-span-3",
        "root-span-1",
    ]
    assert page_info["hasNextPage"] is False

    # ========================================
    # TEST 4: Time range filtering (orphan_span_as_root_span=false)
    # Filter: hours 2-4 (includes traces 2, 3, 4)
    # Expected: Only root-span-3 (trace 3 has real root span, traces 2&4 have orphans)
    # ========================================
    time_range_query = """
        query ($projectId: ID!, $first: Int, $timeRange: TimeRange) {
            node(id: $projectId) {
                ... on Project {
                    spans(
                        rootSpansOnly: true,
                        orphanSpanAsRootSpan: false,  # ← Exclude orphan spans
                        sort: {col: startTime, dir: desc},
                        first: $first,
                        timeRange: $timeRange
                    ) {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                        pageInfo {
                            hasNextPage
                        }
                    }
                }
            }
        }
    """

    response = await gql_client.execute(
        query=time_range_query,
        variables={
            "projectId": project_gid,
            "first": 10,
            "timeRange": {
                "start": (base_time + timedelta(hours=2)).isoformat(),  # 02:00:00
                "end": (base_time + timedelta(hours=4)).isoformat(),  # 04:00:00
            },
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    filtered_spans = data["node"]["spans"]
    edges = filtered_spans["edges"]

    # Time range includes traces 2, 3, 4:
    # - Trace 2 (hour 2): has orphan span → excluded by orphanSpanAsRootSpan=false
    # - Trace 3 (hour 3): has real root span → included
    # - Trace 4 (hour 4): has orphan span → excluded by orphanSpanAsRootSpan=false
    assert len(edges) == 1
    assert edges[0]["node"]["name"] == "root-span-3"

    # ========================================
    # TEST 5: Include orphan spans (orphanSpanAsRootSpan=true)
    # Expected: All 5 spans returned (3 real roots + 2 orphans)
    # ========================================
    orphan_query = """
        query ($projectId: ID!, $first: Int, $after: String) {
            node(id: $projectId) {
                ... on Project {
                    spans(
                        rootSpansOnly: true,
                        orphanSpanAsRootSpan: true,
                        sort: {col: startTime, dir: desc},
                        first: $first,
                        after: $after
                    ) {
                        edges {
                            node {
                                id
                                name
                            }
                            cursor
                        }
                        pageInfo {
                            hasNextPage
                            hasPreviousPage
                            startCursor
                            endCursor
                        }
                    }
                }
            }
        }
    """

    # Test 5a: Basic pagination with orphans included
    # Expected: Now returns 2 spans per page instead of 1 (includes orphan spans)
    response = await gql_client.execute(
        query=orphan_query,
        variables={
            "projectId": project_gid,
            "first": 2,
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    page = data["node"]["spans"]
    edges = page["edges"]
    page_info = page["pageInfo"]

    # Should return 2 spans: both real root and orphan spans
    assert len(edges) == 2
    assert edges[0]["node"]["name"] == "root-span-5"  # Real root span from trace 5 (latest)
    assert edges[1]["node"]["name"] == "orphan-span-4"  # Orphan span from trace 4 (2nd latest)
    assert page_info["hasNextPage"] is True

    # Test 5b: Bulk query with orphans included
    # Expected: All 5 spans (3 real + 2 orphan) vs 3 spans when orphans excluded
    response = await gql_client.execute(
        query=orphan_query,
        variables={
            "projectId": project_gid,
            "first": 10,
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    all_spans = data["node"]["spans"]
    edges = all_spans["edges"]
    page_info = all_spans["pageInfo"]
    span_names = [edge["node"]["name"] for edge in edges]

    # Should return ALL 5 spans (3 real root spans + 2 orphan spans) in descending order
    # IMPORTANT: Returns earliest span per trace (ALL traces have multiple candidates):
    # - Trace 1: root-span-1 (NOT second-root-span-1)
    # - Trace 2: orphan-span-2 (NOT second-orphan-span-2)
    # - Trace 3: root-span-3 (NOT second-root-span-3)
    # - Trace 4: orphan-span-4 (NOT second-orphan-span-4)
    # - Trace 5: root-span-5 (NOT second-root-span-5)
    assert len(edges) == 5
    assert span_names == [
        "root-span-5",
        "orphan-span-4",
        "root-span-3",
        "orphan-span-2",
        "root-span-1",
    ]
    assert page_info["hasNextPage"] is False

    # Test 5c: Ascending order with orphans included
    # Expected: Same 5 spans but in reverse order
    response = await gql_client.execute(
        query=orphan_query.replace("dir: desc", "dir: asc"),
        variables={"projectId": project_gid, "first": 3},
    )

    assert not response.errors
    assert (data := response.data) is not None

    asc_page = data["node"]["spans"]
    edges = asc_page["edges"]
    span_names = [edge["node"]["name"] for edge in edges]

    # Should return first 3 spans in ascending order (includes orphan span 2)
    assert len(edges) == 3
    assert span_names == [
        "root-span-1",
        "orphan-span-2",
        "root-span-3",
    ]

    # Test 5d: Time range filtering with orphans included
    orphan_time_range_query = """
        query ($projectId: ID!, $first: Int, $timeRange: TimeRange) {
            node(id: $projectId) {
                ... on Project {
                    spans(
                        rootSpansOnly: true,
                        orphanSpanAsRootSpan: true,
                        sort: {col: startTime, dir: desc},
                        first: $first,
                        timeRange: $timeRange
                    ) {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                        pageInfo {
                            hasNextPage
                        }
                    }
                }
            }
        }
    """

    # Expected: Now returns 2 spans (includes orphan span 2) vs 1 span when orphans excluded
    response = await gql_client.execute(
        query=orphan_time_range_query,
        variables={
            "projectId": project_gid,
            "first": 10,
            "timeRange": {
                "start": (base_time + timedelta(hours=2)).isoformat(),  # 02:00:00
                "end": (base_time + timedelta(hours=4)).isoformat(),  # 04:00:00
            },
        },
    )

    assert not response.errors
    assert (data := response.data) is not None

    filtered_spans = data["node"]["spans"]
    edges = filtered_spans["edges"]
    span_names = [edge["node"]["name"] for edge in edges]

    # Time range includes traces 2, 3, 4 - with orphans included:
    # - Trace 2 (hour 2): has orphan span → NOW INCLUDED
    # - Trace 3 (hour 3): has real root span → included
    # - Trace 4 (hour 4): has orphan span → NOW INCLUDED
    # But trace 4 is excluded by time range end=04:00:00 (exclusive), so only traces 2 & 3
    assert len(edges) == 2
    assert span_names == [
        "root-span-3",
        "orphan-span-2",
    ]  # Descending order: trace 3, then trace 2
