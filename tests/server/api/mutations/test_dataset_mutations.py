import textwrap
from datetime import datetime

import pytest
import pytz
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.DatasetExample import DatasetExample
from sqlalchemy import insert, select
from strawberry.relay import GlobalID


async def test_add_span_to_dataset(
    test_client,
    empty_dataset,
    spans,
) -> None:
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = """
mutation ($datasetId: GlobalID!, $spanIds: [GlobalID!]!) {
  addSpansToDataset(input: {datasetId: $datasetId, spanIds: $spanIds}) {
    dataset {
      id
      examples {
        edges {
          example: node {
            revision {
              input
              output
              metadata
            }
          }
        }
      }
    }
  }
}
"""
    response = await test_client.post(
        "/graphql",
        json={
            "query": mutation,
            "variables": {
                "datasetId": str(dataset_id),
                "spanIds": [
                    str(GlobalID(type_name="Span", node_id=span_id))
                    for span_id in map(str, range(1, 4))
                ],
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == {
        "addSpansToDataset": {
            "dataset": {
                "id": str(dataset_id),
                "examples": {
                    "edges": [
                        {
                            "example": {
                                "revision": {
                                    "input": {"input": "chain-span-input-value"},
                                    "output": {"output": "chain-span-output-value"},
                                    "metadata": {
                                        "input": {
                                            "value": "chain-span-input-value",
                                            "mime_type": "text/plain",
                                        },
                                        "output": {
                                            "value": "chain-span-output-value",
                                            "mime_type": "text/plain",
                                        },
                                    },
                                }
                            }
                        },
                        {
                            "example": {
                                "revision": {
                                    "input": {"input": "retriever-span-input"},
                                    "output": {
                                        "retrieval_documents": [
                                            {
                                                "document": {
                                                    "content": "retrieved-document-content",
                                                    "score": 1,
                                                }
                                            }
                                        ]
                                    },
                                    "metadata": {
                                        "input": {
                                            "value": "retriever-span-input",
                                            "mime_type": "text/plain",
                                        },
                                        "retrieval": {
                                            "documents": [
                                                {
                                                    "document": {
                                                        "content": "retrieved-document-content",
                                                        "score": 1,
                                                    }
                                                }
                                            ]
                                        },
                                    },
                                }
                            }
                        },
                        {
                            "example": {
                                "revision": {
                                    "input": {
                                        "input_messages": [
                                            {"content": "user-message-content", "role": "user"}
                                        ]
                                    },
                                    "metadata": {
                                        "llm": {
                                            "input_messages": [
                                                {"content": "user-message-content", "role": "user"}
                                            ],
                                            "invocation_parameters": {"temperature": 1},
                                            "output_messages": [
                                                {
                                                    "content": "assistant-message-content",
                                                    "role": "assistant",
                                                }
                                            ],
                                        }
                                    },
                                    "output": {
                                        "output_messages": [
                                            {
                                                "content": "assistant-message-content",
                                                "role": "assistant",
                                            }
                                        ]
                                    },
                                }
                            }
                        },
                    ]
                },
            }
        }
    }


class TestPatchDatasetExamples:
    MUTATION = """
      mutation ($input: PatchDatasetExamplesInput!) {
        patchDatasetExamples(input: $input) {
          dataset {
            examples {
              edges {
                example: node {
                  id
                  revision {
                    input
                    output
                    metadata
                  }
                }
              }
            }
          }
        }
      }"""

    async def test_happy_path(
        self,
        test_client,
        dataset_with_revisions,
    ) -> None:
        mutation_input = {
            "patches": [
                {
                    "exampleId": str(GlobalID(type_name=DatasetExample.__name__, node_id=str(1))),
                    "input": {"input": "patched-example-1-input"},
                },
                {
                    "exampleId": str(GlobalID(type_name=DatasetExample.__name__, node_id=str(2))),
                    "input": {"input": "patched-example-2-input"},
                    "output": {"output": "patched-example-2-output"},
                    "metadata": {"metadata": "patched-example-2-metadata"},
                },
            ]
        }
        expected_examples = [
            {
                "example": {
                    "id": str(GlobalID(type_name=DatasetExample.__name__, node_id=str(1))),
                    "revision": {
                        "input": {"input": "patched-example-1-input"},
                        "output": {"output": "original-example-1-version-1-output"},
                        "metadata": {"metadata": "original-example-1-version-1-metadata"},
                    },
                }
            },
            {
                "example": {
                    "id": str(GlobalID(type_name=DatasetExample.__name__, node_id=str(2))),
                    "revision": {
                        "input": {"input": "patched-example-2-input"},
                        "output": {"output": "patched-example-2-output"},
                        "metadata": {"metadata": "patched-example-2-metadata"},
                    },
                }
            },
        ]
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.MUTATION,
                "variables": {"input": mutation_input},
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        actual_examples = response_json["data"]["patchDatasetExamples"]["dataset"]["examples"][
            "edges"
        ]
        assert actual_examples == expected_examples

    @pytest.mark.parametrize(
        "mutation_input, expected_error_message",
        [
            pytest.param(
                {"patches": []},
                "Must provide examples to patch.",
                id="empty-example-patches",
            ),
            pytest.param(
                {
                    "patches": [
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(1))
                            ),
                        },
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(1))
                            ),
                        },
                    ]
                },
                "Cannot patch the same example more than once per mutation.",
                id="same-example-patched-twice",
            ),
            pytest.param(
                {
                    "patches": [
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(500))
                            ),
                        },
                    ]
                },
                "No examples found.",
                id="invalid-example-id",
            ),
            pytest.param(
                {
                    "patches": [
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(1))
                            ),
                        },
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(4))
                            )
                        },
                    ]
                },
                "Examples must come from the same dataset.",
                id="examples-from-different-datasets",
            ),
            pytest.param(
                {
                    "patches": [
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(3))
                            ),
                        },
                    ]
                },
                "1 example(s) could not be found.",
                id="deleted-example-id",
            ),
        ],
    )
    async def test_raises_value_error_for_invalid_input(
        self,
        mutation_input,
        expected_error_message,
        test_client,
        dataset_with_revisions,
        dataset_with_a_single_version,
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.MUTATION,
                "variables": {"input": mutation_input},
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert len(errors := response_json.get("errors")) == 1
        assert errors[0]["message"] == expected_error_message


async def test_delete_a_dataset(
    session,
    test_client,
    empty_dataset,
):
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = textwrap.dedent(
        """
        mutation ($datasetId: GlobalID!) {
          deleteDataset(input: { datasetId: $datasetId }) {
            dataset {
              id
            }
          }
        }
        """
    )

    response = await test_client.post(
        "/graphql",
        json={
            "query": mutation,
            "variables": {
                "datasetId": str(dataset_id),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"]["deleteDataset"]["dataset"] == {
        "id": str(dataset_id)
    }, "deleted dataset is returned"
    dataset = (await session.execute(select(models.Dataset).where(models.Dataset.id == 1))).first()
    assert not dataset


async def test_deleting_a_nonexistent_dataset_fails(
    session,
    test_client,
):
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = textwrap.dedent(
        """
        mutation ($datasetId: GlobalID!) {
          deleteDataset(input: { datasetId: $datasetId }) {
            dataset {
              id
            }
          }
        }
        """
    )

    response = await test_client.post(
        "/graphql",
        json={
            "query": mutation,
            "variables": {
                "datasetId": str(dataset_id),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")), "Dataset does not exist"
    assert f"Unknown dataset: {dataset_id}" in errors[0]["message"]


@pytest.fixture
async def empty_dataset(session):
    """
    Inserts an empty dataset.
    """

    dataset = models.Dataset(
        id=1,
        name="empty dataset",
        description=None,
        metadata_={},
    )
    session.add(dataset)
    await session.flush()


@pytest.fixture
async def spans(session):
    """
    Inserts three spans from a single trace: a chain root span, a retriever
    child span, and an llm child span.
    """
    project_row_id = await session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_row_id = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="1",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="1",
            parent_id=None,
            name="chain span",
            span_kind="CHAIN",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
            attributes={
                "input": {"value": "chain-span-input-value", "mime_type": "text/plain"},
                "output": {"value": "chain-span-output-value", "mime_type": "text/plain"},
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        .returning(models.Span.id)
    )
    await session.execute(
        insert(models.Span).values(
            trace_rowid=trace_row_id,
            span_id="2",
            parent_id="1",
            name="retriever span",
            span_kind="RETRIEVER",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "input": {
                    "value": "retriever-span-input",
                    "mime_type": "text/plain",
                },
                "retrieval": {
                    "documents": [
                        {"document": {"content": "retrieved-document-content", "score": 1}},
                    ],
                },
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
    )
    await session.execute(
        insert(models.Span).values(
            trace_rowid=trace_row_id,
            span_id="3",
            parent_id="1",
            name="llm span",
            span_kind="LLM",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "llm": {
                    "input_messages": [{"role": "user", "content": "user-message-content"}],
                    "output_messages": [
                        {"role": "assistant", "content": "assistant-message-content"}
                    ],
                    "invocation_parameters": {"temperature": 1},
                },
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
    )


@pytest.fixture
async def dataset_with_a_single_version(session):
    """
    A dataset with a single example and a single version.
    """

    # insert dataset
    dataset_id = await session.scalar(
        insert(models.Dataset)
        .returning(models.Dataset.id)
        .values(
            name="dataset-name",
            description=None,
            metadata_={},
        )
    )

    # insert example
    example_id = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        .returning(models.DatasetExample.id)
    )

    # insert version
    version_id = await session.scalar(
        insert(models.DatasetVersion)
        .returning(models.DatasetVersion.id)
        .values(
            dataset_id=dataset_id,
            description="original-description",
            metadata_={"metadata": "original-metadata"},
        )
    )

    # insert revision
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_id,
            dataset_version_id=version_id,
            input={"input": "first-input"},
            output={"output": "first-output"},
            metadata_={"metadata": "first-metadata"},
            revision_kind="CREATE",
        )
    )


@pytest.fixture
async def dataset_with_revisions(session):
    # insert dataset
    dataset_id = await session.scalar(
        insert(models.Dataset)
        .returning(models.Dataset.id)
        .values(
            name="original-dataset-name",
            description="original-dataset-description",
            metadata_={},
        )
    )

    # insert examples
    example_id_1 = await session.scalar(
        insert(models.DatasetExample)
        .values(dataset_id=dataset_id)
        .returning(models.DatasetExample.id)
    )
    example_id_2 = await session.scalar(
        insert(models.DatasetExample)
        .values(dataset_id=dataset_id)
        .returning(models.DatasetExample.id)
    )
    example_id_3 = await session.scalar(
        insert(models.DatasetExample)
        .values(dataset_id=dataset_id)
        .returning(models.DatasetExample.id)
    )

    # insert first version
    version_id_1 = await session.scalar(
        insert(models.DatasetVersion)
        .returning(models.DatasetVersion.id)
        .values(
            dataset_id=dataset_id,
            description="original-version-1-description",
            metadata_={"metadata": "original-version-1-metadata"},
            created_at=datetime.fromisoformat("2024-05-28T00:00:04+00:00"),
        )
    )

    # insert revisions for first version
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_id_1,
            dataset_version_id=version_id_1,
            input={"input": "original-example-1-version-1-input"},
            output={"output": "original-example-1-version-1-output"},
            metadata_={"metadata": "original-example-1-version-1-metadata"},
            revision_kind="CREATE",
        )
    )
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_id_2,
            dataset_version_id=version_id_1,
            input={"input": "original-example-2-version-1-input"},
            output={"output": "original-example-2-version-1-output"},
            metadata_={"metadata": "original-example-2-version-1-metadata"},
            revision_kind="CREATE",
        )
    )
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_id_3,
            dataset_version_id=version_id_1,
            input={"input": "original-example-3-version-1-input"},
            output={"output": "original-example-3-version-1-output"},
            metadata_={"metadata": "original-example-3-version-1-metadata"},
            revision_kind="CREATE",
        )
    )

    # insert second version
    version_id_2 = await session.scalar(
        insert(models.DatasetVersion)
        .returning(models.DatasetVersion.id)
        .values(
            dataset_id=dataset_id,
            description="original-version-2-description",
            metadata_={"metadata": "original-version-2-metadata"},
            created_at=datetime.fromisoformat("2024-05-28T00:00:04+00:00"),
        )
    )

    # insert revisions for second version
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_id_3,
            dataset_version_id=version_id_2,
            input={"input": "original-example-3-version-1-input"},
            output={"output": "original-example-3-version-1-output"},
            metadata_={"metadata": "original-example-3-version-1-metadata"},
            revision_kind="DELETE",
        )
    )
