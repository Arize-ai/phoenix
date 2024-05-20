# ruff: noqa: E501

from datetime import datetime

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.pagination import Cursor
from sqlalchemy import insert
from strawberry.relay import GlobalID

PROJECT_SPANS_QUERY = """
query ($projectId: GlobalID!, $after: String = null, $before: String = null, $filterCondition: String = null, $first: Int = null, $last: Int = null, $sort: SpanSort = null) {
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
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
}
"""
PROJECT_ID = str(GlobalID(type_name="Project", node_id="1"))


@pytest.mark.parametrize(
    "variables, expected_response",
    [
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "first": 2,
            },
            {
                "node": {
                    "spans": {
                        "edges": [
                            {"cursor": str(Cursor(rowid=1))},
                            {"cursor": str(Cursor(rowid=2))},
                        ],
                        "pageInfo": {
                            "startCursor": str(Cursor(rowid=1)),
                            "endCursor": str(Cursor(rowid=2)),
                            "hasNextPage": True,
                            "hasPreviousPage": False,
                        },
                    }
                }
            },
            id="basic-query",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "after": str(Cursor(rowid=13)),
                "first": 2,
            },
            {
                "node": {
                    "spans": {
                        "edges": [
                            {"cursor": str(Cursor(rowid=14))},
                            {"cursor": str(Cursor(rowid=15))},
                        ],
                        "pageInfo": {
                            "startCursor": str(Cursor(rowid=14)),
                            "endCursor": str(Cursor(rowid=15)),
                            "hasNextPage": False,
                            "hasPreviousPage": False,
                        },
                    }
                }
            },
            id="page-ends-exactly-on-last-record",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "after": str(Cursor(14)),
                "first": 2,
            },
            {
                "node": {
                    "spans": {
                        "edges": [
                            {"cursor": str(Cursor(rowid=15))},
                        ],
                        "pageInfo": {
                            "startCursor": str(Cursor(rowid=15)),
                            "endCursor": str(Cursor(rowid=15)),
                            "hasNextPage": False,
                            "hasPreviousPage": False,
                        },
                    }
                }
            },
            id="page-ends-before-it-reaches-limit",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "first": 2,
                "filterCondition": "span_kind == 'LLM'",
            },
            {
                "node": {
                    "spans": {
                        "edges": [
                            {"cursor": str(Cursor(rowid=5))},
                            {"cursor": str(Cursor(rowid=10))},
                        ],
                        "pageInfo": {
                            "startCursor": str(Cursor(rowid=5)),
                            "endCursor": str(Cursor(rowid=10)),
                            "hasNextPage": True,
                            "hasPreviousPage": False,
                        },
                    }
                }
            },
            id="filter-condition",
        ),
        pytest.param(
            {
                "projectId": PROJECT_ID,
                "first": 2,
                "after": str(Cursor(5)),  # skip the first span satisfying the filter condition
                "filterCondition": "span_kind == 'LLM'",
            },
            {
                "node": {
                    "spans": {
                        "edges": [
                            {"cursor": str(Cursor(rowid=10))},
                            {"cursor": str(Cursor(rowid=15))},
                        ],
                        "pageInfo": {
                            "startCursor": str(Cursor(rowid=10)),
                            "endCursor": str(Cursor(rowid=15)),
                            "hasNextPage": False,
                            "hasPreviousPage": False,
                        },
                    }
                }
            },
            id="filter-condition",
        ),
    ],
)
async def test_project_spans(
    variables,
    expected_response,
    test_client,
    llama_index_rag_spans,
) -> None:
    response = await test_client.post(
        "/graphql",
        json={
            "query": PROJECT_SPANS_QUERY,
            "variables": variables,
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == expected_response


@pytest.fixture
async def llama_index_rag_spans(session):
    # Inserts the first three traces from the llama-index-rag trace fixture (minus embeddings).
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
    (
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
                            "token_count": {"prompt": 240.0, "total": 296.0, "completion": 56.0},
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
                            "token_count": {"prompt": 315.0, "total": 336.0, "completion": 21.0},
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
