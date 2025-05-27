# ruff: noqa: E501
import base64
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from secrets import token_hex
from typing import Any, Dict, List, Optional

import httpx
import pytest
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.pagination import Cursor, CursorSortColumn, CursorSortColumnDataType
from phoenix.server.api.types.Project import Project
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace, _gid, _node

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
    async def _span_count_time_series_data(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        """Creates a minimal dataset for testing span_count_time_series.

        Creates spans across different hours to test:
        1. Basic time series grouping
        2. Time range filtering
        3. Edge cases with spans at hour boundaries
        4. Discontinuities in timestamps
        """
        projects, traces = [], []
        spans: List[models.Span] = []
        async with db() as session:
            # Create a test project
            projects.append(models.Project(name=token_hex(8)))
            session.add(projects[-1])
            await session.flush()

            # Create spans across different hours
            base_time = datetime.fromisoformat("2024-01-01T00:00:00+00:00")

            # Create spans in first hour (2 spans)
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=projects[-1].id,
                start_time=base_time,
                end_time=base_time + timedelta(minutes=30),
            )
            session.add(trace)
            await session.flush()

            spans.extend(
                [
                    models.Span(
                        trace_rowid=trace.id,
                        span_id=token_hex(8),
                        parent_id=None,
                        name="span1",
                        span_kind="CHAIN",
                        start_time=base_time + timedelta(minutes=15),
                        end_time=base_time + timedelta(minutes=30),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    ),
                    models.Span(
                        trace_rowid=trace.id,
                        span_id=token_hex(8),
                        parent_id=None,
                        name="span2",
                        span_kind="CHAIN",
                        start_time=base_time + timedelta(minutes=45),
                        end_time=base_time + timedelta(minutes=60),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    ),
                ]
            )
            traces.append(trace)

            # Create spans in second hour (3 spans)
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=projects[-1].id,
                start_time=base_time + timedelta(hours=1),
                end_time=base_time + timedelta(hours=1, minutes=30),
            )
            session.add(trace)
            await session.flush()

            spans.extend(
                [
                    models.Span(
                        trace_rowid=trace.id,
                        span_id=token_hex(8),
                        parent_id=None,
                        name="span3",
                        span_kind="CHAIN",
                        start_time=base_time + timedelta(hours=1, minutes=15),
                        end_time=base_time + timedelta(hours=1, minutes=30),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    ),
                    models.Span(
                        trace_rowid=trace.id,
                        span_id=token_hex(8),
                        parent_id=None,
                        name="span4",
                        span_kind="CHAIN",
                        start_time=base_time + timedelta(hours=1, minutes=30),
                        end_time=base_time + timedelta(hours=1, minutes=45),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    ),
                    models.Span(
                        trace_rowid=trace.id,
                        span_id=token_hex(8),
                        parent_id=None,
                        name="span5",
                        span_kind="CHAIN",
                        start_time=base_time + timedelta(hours=1, minutes=45),
                        end_time=base_time + timedelta(hours=2),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    ),
                ]
            )
            traces.append(trace)

            # Create a span exactly at hour boundary (2:00:00)
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=projects[-1].id,
                start_time=base_time + timedelta(hours=2),
                end_time=base_time + timedelta(hours=2, minutes=30),
            )
            session.add(trace)
            await session.flush()

            spans.append(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,
                    name="span6",
                    span_kind="CHAIN",
                    start_time=base_time + timedelta(hours=2),  # Exactly at 2:00:00
                    end_time=base_time + timedelta(hours=2, minutes=30),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
            traces.append(trace)

            # Create a span in hour 4 (skipping hour 3 to create a discontinuity)
            trace = models.Trace(
                trace_id=token_hex(16),
                project_rowid=projects[-1].id,
                start_time=base_time + timedelta(hours=4),
                end_time=base_time + timedelta(hours=4, minutes=30),
            )
            session.add(trace)
            await session.flush()

            spans.append(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=token_hex(8),
                    parent_id=None,
                    name="span7",
                    span_kind="CHAIN",
                    start_time=base_time + timedelta(hours=4, minutes=15),
                    end_time=base_time + timedelta(hours=4, minutes=30),
                    attributes={},
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
            traces.append(trace)

            session.add_all(spans)
            await session.flush()

        return _Data(
            spans=spans,
            traces=traces,
            projects=projects,
        )

    @pytest.mark.parametrize(
        "time_range,expected_counts,description",
        [
            pytest.param(
                None,
                {
                    datetime.fromisoformat("2024-01-01T00:00:00+00:00"): 2,
                    datetime.fromisoformat("2024-01-01T01:00:00+00:00"): 3,
                    datetime.fromisoformat("2024-01-01T02:00:00+00:00"): 1,
                    datetime.fromisoformat("2024-01-01T04:00:00+00:00"): 1,
                },
                "no time range",
                id="no_time_range",
            ),
            pytest.param(
                {
                    "start": datetime.fromisoformat("2024-01-01T01:00:00+00:00"),
                    "end": datetime.fromisoformat("2024-01-01T02:00:00+00:00"),
                },
                {
                    datetime.fromisoformat("2024-01-01T01:00:00+00:00"): 3,
                },
                "middle hour only",
                id="middle_hour_only",
            ),
            pytest.param(
                {
                    "start": datetime.fromisoformat("2024-01-01T01:45:00+00:00"),
                    "end": datetime.fromisoformat("2024-01-01T02:15:00+00:00"),
                },
                {
                    datetime.fromisoformat("2024-01-01T01:00:00+00:00"): 3,  # All spans in hour 1
                    datetime.fromisoformat("2024-01-01T02:00:00+00:00"): 1,  # Span at 2:00:00
                },
                "span at hour boundary",
                id="span_at_hour_boundary",
            ),
            pytest.param(
                {
                    "start": datetime.fromisoformat("2024-01-01T01:00:00+00:00"),
                    "end": datetime.fromisoformat("2024-01-01T01:30:00+00:00"),
                },
                {
                    datetime.fromisoformat("2024-01-01T01:00:00+00:00"): 3,  # All spans in hour 1
                },
                "start at hour boundary",
                id="start_at_hour_boundary",
            ),
            pytest.param(
                {
                    "start": datetime.fromisoformat("2024-01-01T01:30:00+00:00"),
                    "end": datetime.fromisoformat("2024-01-01T02:00:00+00:00"),
                },
                {
                    datetime.fromisoformat("2024-01-01T01:00:00+00:00"): 3,  # All spans in hour 1
                },
                "end at hour boundary",
                id="end_at_hour_boundary",
            ),
            pytest.param(
                {
                    "start": datetime.fromisoformat("2024-01-01T03:00:00+00:00"),
                    "end": datetime.fromisoformat("2024-01-01T04:00:00+00:00"),
                },
                {},
                "no spans in range",
                id="no_spans_in_range",
            ),
            pytest.param(
                {
                    "start": datetime.fromisoformat("2024-01-01T02:00:00+00:00"),
                    "end": datetime.fromisoformat("2024-01-01T05:00:00+00:00"),
                },
                {
                    datetime.fromisoformat("2024-01-01T02:00:00+00:00"): 1,
                    datetime.fromisoformat("2024-01-01T04:00:00+00:00"): 1,
                },
                "time range with discontinuity",
                id="time_range_with_discontinuity",
            ),
        ],
    )
    async def test_span_count_time_series(
        self,
        _span_count_time_series_data: _Data,
        httpx_client: httpx.AsyncClient,
        time_range: Optional[Dict[str, datetime]],
        expected_counts: Dict[datetime, int],
        description: str,
    ) -> None:
        """Test the span_count_time_series field.

        This test verifies that:
        1. The field returns the correct time series data grouped by hour
        2. The time range filtering works correctly
        3. Edge cases with spans at hour boundaries are handled correctly
        4. Empty result sets are handled correctly
        5. Time range edge cases are handled correctly

        Args:
            time_range: The time range to filter spans by, or None for no filtering
            expected_counts: The expected counts for each hour in the time range
            description: A description of the test case
        """
        project = _span_count_time_series_data.projects[0]

        # Construct the GraphQL query based on whether a time range is provided
        if time_range is None:
            field = "spanCountTimeSeries{data{timestamp value}}"
        else:
            # Format the datetime in a way that Strawberry accepts
            start_str = time_range["start"].strftime("%Y-%m-%dT%H:%M:%S.000000+00:00")
            end_str = time_range["end"].strftime("%Y-%m-%dT%H:%M:%S.000000+00:00")
            field = f'spanCountTimeSeries(timeRange:{{start:"{start_str}",end:"{end_str}"}}){{data{{timestamp value}}}}'

        res = await self._node(field, project, httpx_client)

        # Verify the structure of the response
        assert "data" in res
        assert isinstance(res["data"], list)

        if not expected_counts:
            assert len(res["data"]) == 0, f"Expected empty data for {description}"
            return

        # Verify the data points
        for data_point in res["data"]:
            timestamp = datetime.fromisoformat(data_point["timestamp"])
            value = data_point["value"]
            assert (
                timestamp in expected_counts
            ), f"Unexpected timestamp: {timestamp} for {description}"
            assert (
                value == expected_counts[timestamp]
            ), f"Expected count {expected_counts[timestamp]} for hour {timestamp}, got {value} for {description}"

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
