import textwrap
from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy import func, insert, select
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


async def test_create_dataset_with_duplicate_name_returns_conflict(
    gql_client: AsyncGraphQLClient,
) -> None:
    mutation = """
      mutation ($name: String!) {
        createDataset(input: {name: $name, metadata: {}}) {
          dataset {
            id
          }
        }
      }
    """
    first = await gql_client.execute(query=mutation, variables={"name": "dupe-dataset"})
    assert not first.errors
    second = await gql_client.execute(query=mutation, variables={"name": "dupe-dataset"})
    assert (errors := second.errors)
    assert len(errors) == 1
    assert errors[0].message == "A dataset named 'dupe-dataset' already exists."


class TestPatchDatasetMutation:
    _MUTATION = """
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
    """

    async def test_patch_all_dataset_fields(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_a_single_version: None,
    ) -> None:
        response = await gql_client.execute(
            query=self._MUTATION,
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
            query=self._MUTATION,
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
            query=self._MUTATION,
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
                    ]
                },
            }
        }
    }


class TestPatchDatasetExamples:
    _MUTATION = """
      mutation ($input: PatchDatasetExamplesInput!) {
        patchDatasetExamples(input: $input) {
          dataset {
            id
            exampleCount
          }
        }
      }
    """

    @staticmethod
    def _example_id(rowid: str) -> str:
        return str(GlobalID(DatasetExample.__name__, rowid))

    @staticmethod
    def _add(input: Any, output: Any = None, metadata: Any = None, **rest: Any) -> dict[str, Any]:
        return {
            "add": {
                "value": {
                    "input": input,
                    "output": {} if output is None else output,
                    "metadata": {} if metadata is None else metadata,
                    **rest,
                }
            }
        }

    @classmethod
    def _replace(cls, rowid: str, field: str, value: Any) -> dict[str, Any]:
        return {"replace": {"exampleId": cls._example_id(rowid), "field": field, "value": value}}

    @classmethod
    def _remove(cls, rowid: str) -> dict[str, Any]:
        return {"remove": {"exampleId": cls._example_id(rowid)}}

    async def _patch(
        self,
        gql_client: AsyncGraphQLClient,
        operations: list[dict[str, Any]],
        **rest: Any,
    ) -> Any:
        return await gql_client.execute(
            query=self._MUTATION,
            variables={
                "input": {
                    "datasetId": str(GlobalID("Dataset", "1")),
                    "operations": operations,
                    **rest,
                }
            },
        )

    async def test_applies_mixed_operations_as_one_version(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        response = await self._patch(
            gql_client,
            [
                self._add(
                    {"input": "added-input"},
                    {"output": "added-output"},
                    {"metadata": "added-metadata"},
                ),
                self._replace("1", "INPUT", {"input": "edited-input"}),
                self._remove("2"),
            ],
            versionDescription="Edited examples in the table",
            versionMetadata={"source": "editable-table"},
        )

        assert response.data and not response.errors
        # The fixture starts with 2 live examples, and this change set adds one and
        # removes one — so the count alone proves nothing. Assert which examples
        # survive, and that the added one is a genuinely new row.
        assert response.data["patchDatasetExamples"]["dataset"]["exampleCount"] == 2
        async with db() as session:
            versions = (
                await session.scalars(
                    select(models.DatasetVersion)
                    .where(models.DatasetVersion.dataset_id == 1)
                    .order_by(models.DatasetVersion.id)
                )
            ).all()
            assert len(versions) == 3
            saved_version = versions[-1]
            assert saved_version.description == "Edited examples in the table"
            assert saved_version.metadata_ == {"source": "editable-table"}
            revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_version_id == saved_version.id
                    )
                )
            ).all()

        revision_kind_by_example_id = {
            revision.dataset_example_id: revision.revision_kind for revision in revisions
        }
        # Example 1 was replaced, example 2 removed, and a brand-new example created.
        assert revision_kind_by_example_id[1] == "PATCH"
        assert revision_kind_by_example_id[2] == "DELETE"
        created_example_ids = [
            example_id
            for example_id, revision_kind in revision_kind_by_example_id.items()
            if revision_kind == "CREATE"
        ]
        assert len(created_example_ids) == 1
        assert created_example_ids[0] not in (1, 2, 3)
        patched_revision = next(
            revision for revision in revisions if revision.revision_kind == "PATCH"
        )
        assert patched_revision.input == {"input": "edited-input"}
        assert patched_revision.output == {"output": "original-example-1-version-1-output"}
        assert patched_revision.metadata_ == {"metadata": "original-example-1-version-1-metadata"}

    async def test_pairs_each_operation_with_its_own_example(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        # Replacements are supplied in descending example-ID order, and there is
        # more than one of everything, so a resolver that lines changes up
        # positionally against a sorted or re-queried list would swap their payloads.
        response = await self._patch(
            gql_client,
            [
                self._add({"input": "first-added-input"}, externalId="first-added"),
                self._add({"input": "second-added-input"}, externalId="second-added"),
                self._replace("2", "INPUT", {"input": "patched-example-2-input"}),
                self._replace("1", "INPUT", {"input": "patched-example-1-input"}),
            ],
        )

        assert response.data and not response.errors
        async with db() as session:
            examples = (
                await session.scalars(
                    select(models.DatasetExample).where(models.DatasetExample.dataset_id == 1)
                )
            ).all()
            revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_example_id.in_(
                            [example.id for example in examples]
                        )
                    )
                )
            ).all()

        latest_input_by_example_id = {
            revision.dataset_example_id: revision.input
            for revision in sorted(revisions, key=lambda revision: revision.id)
        }
        external_id_by_example_id = {example.id: example.external_id for example in examples}

        # Each replaced example carries its own new input, not its neighbor's.
        assert latest_input_by_example_id[1] == {"input": "patched-example-1-input"}
        assert latest_input_by_example_id[2] == {"input": "patched-example-2-input"}
        # Each added example carries the payload that came with its custom ID.
        added_input_by_external_id = {
            external_id_by_example_id[example_id]: revision_input
            for example_id, revision_input in latest_input_by_example_id.items()
            if external_id_by_example_id.get(example_id) is not None
        }
        assert added_input_by_external_id == {
            "first-added": {"input": "first-added-input"},
            "second-added": {"input": "second-added-input"},
        }

    async def test_folds_replacements_of_one_example_into_one_revision(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        # Two fields replaced, then one of them replaced again: the example gets a
        # single PATCH revision carrying the last value of each field.
        response = await self._patch(
            gql_client,
            [
                self._replace("1", "INPUT", {"input": "first"}),
                self._replace("1", "OUTPUT", {"output": "edited-output"}),
                self._replace("1", "INPUT", {"input": "last"}),
            ],
        )

        assert response.data and not response.errors
        async with db() as session:
            latest_version_id = await session.scalar(
                select(func.max(models.DatasetVersion.id)).where(
                    models.DatasetVersion.dataset_id == 1
                )
            )
            revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_version_id == latest_version_id
                    )
                )
            ).all()
        assert len(revisions) == 1
        revision = revisions[0]
        assert revision.dataset_example_id == 1
        assert revision.revision_kind == "PATCH"
        assert revision.input == {"input": "last"}
        assert revision.output == {"output": "edited-output"}
        assert revision.metadata_ == {"metadata": "original-example-1-version-1-metadata"}

    async def test_a_removal_discards_earlier_replacements_of_the_example(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        response = await self._patch(
            gql_client,
            [
                self._replace("1", "INPUT", {"input": "edited-then-removed"}),
                self._remove("1"),
            ],
        )

        assert response.data and not response.errors
        async with db() as session:
            latest_version_id = await session.scalar(
                select(func.max(models.DatasetVersion.id)).where(
                    models.DatasetVersion.dataset_id == 1
                )
            )
            revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_version_id == latest_version_id
                    )
                )
            ).all()
        assert [
            (revision.dataset_example_id, revision.revision_kind) for revision in revisions
        ] == [(1, "DELETE")]

    async def test_a_removed_examples_custom_id_stays_taken(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        # Removing an example writes a DELETE revision; the row — and its custom ID
        # — survives. Reusing that ID is therefore a conflict, and the message has
        # to say so, or the user sees a collision with an example they cannot find.
        add = await self._patch(gql_client, [self._add({"input": "value"}, externalId="case-42")])
        assert add.data and not add.errors

        async with db() as session:
            reused_example_id = await session.scalar(
                select(models.DatasetExample.id).where(
                    models.DatasetExample.external_id == "case-42"
                )
            )
        assert reused_example_id is not None

        response = await self._patch(
            gql_client,
            [
                self._remove(str(reused_example_id)),
                self._add({"input": "replacement"}, externalId="case-42"),
            ],
        )

        assert response.errors
        message = response.errors[0].message
        assert "already taken" in message
        assert "stays taken even after its example is deleted" in message

    async def test_persists_a_custom_id_for_an_added_example(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        response = await self._patch(
            gql_client, [self._add({"input": "added-input"}, externalId="my-custom-id")]
        )

        assert response.data and not response.errors
        async with db() as session:
            external_ids = (
                await session.scalars(
                    select(models.DatasetExample.external_id).where(
                        models.DatasetExample.dataset_id == 1
                    )
                )
            ).all()
        assert "my-custom-id" in external_ids

    async def test_rejects_a_custom_id_that_already_exists_in_the_dataset(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
    ) -> None:
        operations = [self._add({"input": "added-input"}, externalId="my-custom-id")]
        first_response = await self._patch(gql_client, operations)
        assert first_response.data and not first_response.errors

        async with db() as session:
            version_count_before = await session.scalar(
                select(func.count(models.DatasetVersion.id))
            )
            example_count_before = await session.scalar(
                select(func.count(models.DatasetExample.id))
            )

        response = await self._patch(gql_client, operations)

        assert response.errors
        assert "my-custom-id" in response.errors[0].message
        async with db() as session:
            version_count_after = await session.scalar(select(func.count(models.DatasetVersion.id)))
            example_count_after = await session.scalar(select(func.count(models.DatasetExample.id)))
        assert version_count_after == version_count_before
        assert example_count_after == example_count_before

    @pytest.mark.parametrize(
        "cross_dataset_operation",
        [
            pytest.param(
                {
                    "replace": {
                        "exampleId": str(GlobalID(DatasetExample.__name__, "4")),
                        "field": "INPUT",
                        "value": {"should": "fail"},
                    }
                },
                id="replaced-example-in-another-dataset",
            ),
            pytest.param(
                {"remove": {"exampleId": str(GlobalID(DatasetExample.__name__, "4"))}},
                id="removed-example-in-another-dataset",
            ),
        ],
    )
    async def test_rejects_cross_dataset_ids_without_partial_writes(
        self,
        cross_dataset_operation: dict[str, Any],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        dataset_with_revisions: None,
        dataset_with_a_single_version: None,
    ) -> None:
        async with db() as session:
            version_count_before = await session.scalar(
                select(func.count(models.DatasetVersion.id))
            )
            example_count_before = await session.scalar(
                select(func.count(models.DatasetExample.id))
            )

        response = await self._patch(
            gql_client, [self._add({"new": True}), cross_dataset_operation]
        )

        assert response.errors
        assert "could not be found in this dataset" in response.errors[0].message
        assert str(GlobalID(DatasetExample.__name__, "4")) in response.errors[0].message
        async with db() as session:
            version_count_after = await session.scalar(select(func.count(models.DatasetVersion.id)))
            example_count_after = await session.scalar(select(func.count(models.DatasetExample.id)))
        assert version_count_after == version_count_before
        assert example_count_after == example_count_before

    @pytest.mark.parametrize(
        "changes, expected_error_message",
        [
            pytest.param(
                {"operations": []},
                "Must provide at least one operation.",
                id="empty-operation-list",
            ),
            pytest.param(
                {
                    "operations": [
                        {"remove": {"exampleId": str(GlobalID(DatasetExample.__name__, "1"))}},
                        {"remove": {"exampleId": str(GlobalID(DatasetExample.__name__, "1"))}},
                    ]
                },
                (
                    f"operations[1] removes example {GlobalID(DatasetExample.__name__, '1')}, "
                    "which an earlier operation already removed."
                ),
                id="same-example-removed-twice",
            ),
            pytest.param(
                {
                    "operations": [
                        {"remove": {"exampleId": str(GlobalID(DatasetExample.__name__, "1"))}},
                        {
                            "replace": {
                                "exampleId": str(GlobalID(DatasetExample.__name__, "1")),
                                "field": "INPUT",
                                "value": {"input": "value"},
                            }
                        },
                    ]
                },
                (
                    f"operations[1] replaces example {GlobalID(DatasetExample.__name__, '1')}, "
                    "which an earlier operation removed."
                ),
                id="replace-after-remove",
            ),
            pytest.param(
                {
                    "operations": [
                        {"add": {"value": {"input": "not-an-object", "output": {}, "metadata": {}}}}
                    ]
                },
                "operations[0].add.value: input, output, and metadata must be JSON objects.",
                id="add-with-non-object-input",
            ),
            pytest.param(
                {
                    "operations": [
                        {
                            "replace": {
                                "exampleId": str(GlobalID(DatasetExample.__name__, "1")),
                                "field": "INPUT",
                                "value": "not-an-object",
                            }
                        }
                    ]
                },
                "operations[0].replace.value must be a JSON object.",
                id="replace-with-non-object-value",
            ),
            pytest.param(
                {"operations": [{"remove": {"exampleId": str(GlobalID("Dataset", "1"))}}]},
                "operations[0].remove.exampleId is not a dataset example ID.",
                id="example-id-of-the-wrong-type",
            ),
            pytest.param(
                {
                    "operations": [
                        {
                            "add": {
                                "value": {"input": {"input": "value"}, "output": {}, "metadata": {}}
                            }
                        }
                    ],
                    "versionMetadata": ["not", "an", "object"],
                },
                "Version metadata must be a JSON object.",
                id="non-object-version-metadata",
            ),
            pytest.param(
                {
                    "operations": [
                        {
                            "add": {
                                "value": {
                                    "input": {"input": "value"},
                                    "output": {},
                                    "metadata": {},
                                    "externalId": "duplicate-custom-id",
                                }
                            }
                        },
                        {
                            "add": {
                                "value": {
                                    "input": {"input": "value"},
                                    "output": {},
                                    "metadata": {},
                                    "externalId": "duplicate-custom-id",
                                }
                            }
                        },
                    ]
                },
                "Custom ID 'duplicate-custom-id' appears more than once in the input.",
                id="duplicate-custom-ids-within-the-operation-list",
            ),
            pytest.param(
                {
                    "operations": [
                        {
                            "replace": {
                                "exampleId": str(GlobalID(DatasetExample.__name__, "500")),
                                "field": "INPUT",
                                "value": {"input": "value"},
                            }
                        }
                    ]
                },
                (
                    f"Examples {GlobalID(DatasetExample.__name__, '500')} "
                    "could not be found in this dataset."
                ),
                id="unknown-example-id",
            ),
            pytest.param(
                {
                    "operations": [
                        {
                            "replace": {
                                "exampleId": str(GlobalID(DatasetExample.__name__, "3")),
                                "field": "INPUT",
                                "value": {"input": "value"},
                            }
                        }
                    ]
                },
                (f"Examples {GlobalID(DatasetExample.__name__, '3')} have already been deleted."),
                id="already-deleted-example",
            ),
        ],
    )
    async def test_rejects_invalid_operation_lists(
        self,
        changes: dict[str, Any],
        expected_error_message: str,
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
    ) -> None:
        response = await gql_client.execute(
            query=self._MUTATION,
            variables={"input": {"datasetId": str(GlobalID("Dataset", "1")), **changes}},
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == expected_error_message

    @pytest.mark.parametrize(
        "operation",
        [
            pytest.param({}, id="no-variant"),
            pytest.param(
                {
                    "remove": {"exampleId": str(GlobalID(DatasetExample.__name__, "1"))},
                    "replace": {
                        "exampleId": str(GlobalID(DatasetExample.__name__, "1")),
                        "field": "INPUT",
                        "value": {},
                    },
                },
                id="two-variants",
            ),
        ],
    )
    async def test_the_schema_requires_exactly_one_variant_per_operation(
        self,
        operation: dict[str, Any],
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
    ) -> None:
        # `DatasetExampleOperation` is a @oneOf input, so GraphQL validation rejects
        # a malformed operation before the resolver runs.
        response = await self._patch(gql_client, [operation])
        assert response.errors
        assert "DatasetExampleOperation" in response.errors[0].message

    async def test_rejects_an_unknown_dataset(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
    ) -> None:
        response = await gql_client.execute(
            query=self._MUTATION,
            variables={
                "input": {
                    "datasetId": str(GlobalID("Dataset", "999")),
                    "operations": [self._add({"input": "value"})],
                }
            },
        )
        assert response.errors
        assert "Unknown dataset" in response.errors[0].message


class TestDeleteDatasetExamplesScope:
    _MUTATION = """
      mutation ($input: DeleteDatasetExamplesInput!) {
        deleteDatasetExamples(input: $input) {
          dataset {
            id
          }
        }
      }
    """

    async def test_matching_dataset_scope_is_accepted(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
    ) -> None:
        response = await gql_client.execute(
            query=self._MUTATION,
            variables={
                "input": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "exampleIds": [
                        str(GlobalID(type_name=DatasetExample.__name__, node_id=str(1)))
                    ],
                }
            },
        )
        assert not response.errors

    async def test_mismatched_dataset_scope_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_revisions: None,
    ) -> None:
        response = await gql_client.execute(
            query=self._MUTATION,
            variables={
                "input": {
                    "datasetId": str(GlobalID("Dataset", str(999))),
                    "exampleIds": [
                        str(GlobalID(type_name=DatasetExample.__name__, node_id=str(1)))
                    ],
                }
            },
        )
        assert response.errors
        assert "not the specified dataset" in response.errors[0].message


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
    assert data["deleteDataset"]["dataset"] == {"id": str(dataset_id)}, (
        "deleted dataset is returned"
    )
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


async def test_add_examples_with_intra_batch_duplicate_external_id_returns_conflict_error(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    dataset_id = str(GlobalID(type_name="Dataset", node_id=str(1)))
    mutation = """
      mutation ($input: AddExamplesToDatasetInput!) {
        addExamplesToDataset(input: $input) {
          dataset {
            id
          }
        }
      }
    """
    response = await gql_client.execute(
        query=mutation,
        variables={
            "input": {
                "datasetId": dataset_id,
                "examples": [
                    {"input": {"x": 1}, "output": {"y": 1}, "metadata": {}, "externalId": "dup"},
                    {"input": {"x": 2}, "output": {"y": 2}, "metadata": {}, "externalId": "dup"},
                ],
            }
        },
    )
    assert (errors := response.errors)
    assert len(errors) == 1
    assert errors[0].message == "Custom ID 'dup' appears more than once in the input."


async def test_add_examples_reports_all_conflicting_external_ids(
    gql_client: AsyncGraphQLClient,
    empty_dataset: None,
) -> None:
    dataset_id = str(GlobalID(type_name="Dataset", node_id=str(1)))
    mutation = """
      mutation ($input: AddExamplesToDatasetInput!) {
        addExamplesToDataset(input: $input) {
          dataset {
            id
          }
        }
      }
    """
    seed = await gql_client.execute(
        query=mutation,
        variables={
            "input": {
                "datasetId": dataset_id,
                "examples": [
                    {"input": {"x": 1}, "output": {"y": 1}, "metadata": {}, "externalId": "a"},
                    {"input": {"x": 2}, "output": {"y": 2}, "metadata": {}, "externalId": "b"},
                    {"input": {"x": 3}, "output": {"y": 3}, "metadata": {}, "externalId": "c"},
                ],
            }
        },
    )
    assert not seed.errors
    response = await gql_client.execute(
        query=mutation,
        variables={
            "input": {
                "datasetId": dataset_id,
                "examples": [
                    {"input": {"x": 4}, "output": {"y": 4}, "metadata": {}, "externalId": "a"},
                    {"input": {"x": 5}, "output": {"y": 5}, "metadata": {}, "externalId": "b"},
                    {"input": {"x": 6}, "output": {"y": 6}, "metadata": {}, "externalId": "novel"},
                    {"input": {"x": 7}, "output": {"y": 7}, "metadata": {}, "externalId": "c"},
                ],
            }
        },
    )
    assert (errors := response.errors)
    assert len(errors) == 1
    message = errors[0].message
    assert message.startswith("Custom IDs [")
    assert "are already taken in this dataset" in message
    for conflicting_id in ("a", "b", "c"):
        assert repr(conflicting_id) in message
    assert repr("novel") not in message


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
                created_at=datetime(
                    year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc
                ),
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
