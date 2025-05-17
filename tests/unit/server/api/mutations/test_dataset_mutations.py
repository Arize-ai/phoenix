import textwrap
from datetime import datetime
from typing import Any

import pytest
import pytz
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def test_create_dataset(
    gql_client: AsyncGraphQLClient,
) -> None:
    create_dataset_mutation = """
      mutation ($name: String!, $description: String!, $metadata: JSON!) {
        createDataset(
          input: {name: $name, description: $description, metadata: $metadata}
        ) {
          dataset {
            id
            name
            description
            metadata
          }
        }
      }
    """
    response = await gql_client.execute(
        query=create_dataset_mutation,
        variables={
            "name": "original-dataset-name",
            "description": "original-dataset-description",
            "metadata": {"original-metadata-key": "original-metadata-value"},
        },
    )
    assert not response.errors
    assert response.data == {
        "createDataset": {
            "dataset": {
                "id": str(GlobalID(type_name="Dataset", node_id=str(1))),
                "name": "original-dataset-name",
                "description": "original-dataset-description",
                "metadata": {"original-metadata-key": "original-metadata-value"},
            }
        }
    }


class TestPatchDatasetMutation:
    MUTATION = """
      mutation ($datasetId: ID!, $name: String, $description: String, $metadata: JSON) {
        patchDataset(
          input: {datasetId: $datasetId, name: $name, description: $description, metadata: $metadata}
        ) {
          dataset {
            id
            name
            description
            metadata
          }
        }
      }
    """  # noqa: E501

    async def test_patch_all_dataset_fields(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_a_single_version: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
                "name": "patched-dataset-name",
                "description": "patched-dataset-description",
                "metadata": {"patched-metadata-key": "patched-metadata-value"},
            },
        )
        assert not response.errors
        assert response.data == {
            "patchDataset": {
                "dataset": {
                    "id": str(GlobalID(type_name="Dataset", node_id=str(1))),
                    "name": "patched-dataset-name",
                    "description": "patched-dataset-description",
                    "metadata": {"patched-metadata-key": "patched-metadata-value"},
                }
            }
        }

    async def test_only_description_field_can_be_set_to_null(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_a_single_version: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
                "name": None,
                "description": None,
                "metadata": None,
            },
        )
        assert not response.errors
        assert response.data == {
            "patchDataset": {
                "dataset": {
                    "id": str(GlobalID(type_name="Dataset", node_id=str(1))),
                    "name": "dataset-name",
                    "description": None,
                    "metadata": {"dataset-metadata-key": "dataset-metadata-value"},
                }
            }
        }

    async def test_updating_a_single_field_leaves_remaining_fields_unchannged(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_a_single_version: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
                "description": "patched-dataset-description",
            },
        )
        assert not response.errors
        assert response.data == {
            "patchDataset": {
                "dataset": {
                    "id": str(GlobalID(type_name="Dataset", node_id=str(1))),
                    "name": "dataset-name",
                    "description": "patched-dataset-description",
                    "metadata": {"dataset-metadata-key": "dataset-metadata-value"},
                }
            }
        }


async def test_add_span_to_dataset(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
    spans: list[models.Span],
    span_annotation: None,
) -> None:
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = """
      mutation ($datasetId: ID!, $spanIds: [ID!]!) {
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
    response = await gql_client.execute(
        query=mutation,
        variables={
            "datasetId": str(dataset_id),
            "spanIds": [str(GlobalID(type_name="Span", node_id=str(span.id))) for span in spans],
        },
    )
    assert not response.errors
    assert response.data == {
        "addSpansToDataset": {
            "dataset": {
                "id": str(dataset_id),
                "examples": {
                    "edges": [
                        {
                            "example": {
                                "revision": {
                                    "input": {
                                        "messages": [
                                            {"content": "user-message-content", "role": "user"}
                                        ]
                                    },
                                    "metadata": {
                                        "span_kind": "LLM",
                                        "annotations": {},
                                    },
                                    "output": {
                                        "messages": [
                                            {
                                                "content": "assistant-message-content",
                                                "role": "assistant",
                                            }
                                        ]
                                    },
                                }
                            }
                        },
                        {
                            "example": {
                                "revision": {
                                    "input": {"input": "retriever-span-input"},
                                    "output": {
                                        "documents": [
                                            {
                                                "content": "retrieved-document-content",
                                                "score": 1,
                                            }
                                        ]
                                    },
                                    "metadata": {
                                        "span_kind": "RETRIEVER",
                                        "annotations": {},
                                    },
                                }
                            }
                        },
                        {
                            "example": {
                                "revision": {
                                    "input": {"input": "chain-span-input-value"},
                                    "output": {"output": "chain-span-output-value"},
                                    "metadata": {
                                        "span_kind": "CHAIN",
                                        "annotations": {
                                            "test annotation": [
                                                {
                                                    "label": "ambiguous",
                                                    "score": 0.5,
                                                    "explanation": "meaningful words",
                                                    "metadata": {},
                                                    "annotator_kind": "HUMAN",
                                                    "user_id": None,
                                                    "username": None,
                                                    "email": None,
                                                }
                                            ]
                                        },
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
                    revisionKind
                  }
                }
              }
            }
          }
        }
      }"""

    async def test_happy_path(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
    ) -> None:
        # todo: update this test case to verify that version description and
        # metadata are updated once a versions resolver has been implemented
        # https://github.com/Arize-ai/phoenix/issues/3359
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
                    "id": str(GlobalID(type_name=DatasetExample.__name__, node_id=str(2))),
                    "revision": {
                        "input": {"input": "patched-example-2-input"},
                        "output": {"output": "patched-example-2-output"},
                        "metadata": {"metadata": "patched-example-2-metadata"},
                        "revisionKind": "PATCH",
                    },
                }
            },
            {
                "example": {
                    "id": str(GlobalID(type_name=DatasetExample.__name__, node_id=str(1))),
                    "revision": {
                        "input": {"input": "patched-example-1-input"},
                        "output": {"output": "original-example-1-version-1-output"},
                        "metadata": {"metadata": "original-example-1-version-1-metadata"},
                        "revisionKind": "PATCH",
                    },
                }
            },
        ]
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"input": mutation_input},
        )
        assert not response.errors
        assert (data := response.data) is not None
        actual_examples = data["patchDatasetExamples"]["dataset"]["examples"]["edges"]
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
                            "input": {"input": "value"},
                        },
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(1))
                            ),
                            "input": {"input": "value"},
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
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(1))
                            ),
                        },
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(2))
                            ),
                            "input": {"input": "value"},
                        },
                    ]
                },
                "Received one or more empty patches that contain no fields to update.",
                id="found-patch-with-nothing-to-update",
            ),
            pytest.param(
                {
                    "patches": [
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(500))
                            ),
                            "input": {"input": "value"},
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
                            "input": {"input": "value"},
                        },
                        {
                            "exampleId": str(
                                GlobalID(type_name=DatasetExample.__name__, node_id=str(4))
                            ),
                            "input": {"input": "value"},
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
                            "input": {"input": "value"},
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
        mutation_input: dict[str, Any],
        expected_error_message: str,
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
        dataset_with_a_single_version: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"input": mutation_input},
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == expected_error_message


async def test_delete_a_dataset(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = textwrap.dedent(
        """
        mutation ($datasetId: ID!) {
          deleteDataset(input: { datasetId: $datasetId }) {
            dataset {
              id
            }
          }
        }
        """
    )

    response = await gql_client.execute(
        query=mutation,
        variables={
            "datasetId": str(dataset_id),
        },
    )
    assert not response.errors
    assert (data := response.data) is not None
    assert data["deleteDataset"]["dataset"] == {
        "id": str(dataset_id)
    }, "deleted dataset is returned"
    async with db() as session:
        dataset = (
            await session.execute(select(models.Dataset).where(models.Dataset.id == 1))
        ).first()
    assert not dataset


async def test_deleting_a_nonexistent_dataset_fails(gql_client: AsyncGraphQLClient) -> None:
    dataset_id = GlobalID(type_name="Dataset", node_id=str(1))
    mutation = textwrap.dedent(
        """
        mutation ($datasetId: ID!) {
          deleteDataset(input: { datasetId: $datasetId }) {
            dataset {
              id
            }
          }
        }
        """
    )
    response = await gql_client.execute(
        query=mutation,
        variables={
            "datasetId": str(dataset_id),
        },
    )
    assert (errors := response.errors)
    assert len(errors) == 1
    assert f"Unknown dataset: {dataset_id}" in errors[0].message


@pytest.fixture
async def empty_dataset(db: DbSessionFactory) -> None:
    """
    Inserts an empty dataset.
    """
    async with db() as session:
        dataset = models.Dataset(
            id=1,
            name="empty dataset",
            description=None,
            metadata_={},
        )
        session.add(dataset)
        await session.flush()


@pytest.fixture
async def spans(db: DbSessionFactory) -> list[models.Span]:
    """
    Inserts three spans from a single trace: a chain root span, a retriever
    child span, and an llm child span.
    """
    spans = []
    async with db() as session:
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
        span = await session.scalar(
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
            .returning(models.Span)
        )
        assert span is not None
        spans.append(span)
        span = await session.scalar(
            insert(models.Span)
            .values(
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
            .returning(models.Span)
        )
        assert span is not None
        spans.append(span)
        span = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_row_id,
                span_id="3",
                parent_id="1",
                name="llm span",
                span_kind="LLM",
                start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
                attributes={
                    "llm": {
                        "input_messages": [
                            {"message": {"role": "user", "content": "user-message-content"}}
                        ],
                        "output_messages": [
                            {
                                "message": {
                                    "role": "assistant",
                                    "content": "assistant-message-content",
                                }
                            },
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
            .returning(models.Span)
        )
        assert span is not None
        spans.append(span)
    return spans


@pytest.fixture
async def span_annotation(db: DbSessionFactory) -> None:
    async with db() as session:
        span_annotation = models.SpanAnnotation(
            span_rowid=1,
            name="test annotation",
            annotator_kind="HUMAN",
            label="ambiguous",
            score=0.5,
            explanation="meaningful words",
            identifier="",
            source="APP",
            user_id=None,
        )
        session.add(span_annotation)
        await session.flush()


@pytest.fixture
async def dataset_with_a_single_version(
    db: DbSessionFactory,
) -> None:
    """
    A dataset with a single example and a single version.
    """
    async with db() as session:
        # insert dataset
        dataset_id = await session.scalar(
            insert(models.Dataset)
            .returning(models.Dataset.id)
            .values(
                name="dataset-name",
                description="dataset-description",
                metadata_={"dataset-metadata-key": "dataset-metadata-value"},
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
async def dataset_with_revisions(db: DbSessionFactory) -> None:
    """
    A dataset with three examples and two versions. The first version creates
    all three examples, and the second version deletes the third example.
    """

    async with db() as session:
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
