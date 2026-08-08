from typing import Any

import pytest
from sqlalchemy import func, insert, select, update
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestDeleteExperiment:
    MUTATION = """
      mutation ($experimentIds: [ID!]!) {
        deleteExperiments(input: {experimentIds: $experimentIds}) {
          experiments {
            id
            name
            description
            metadata
          }
        }
      }
    """

    async def test_deletes_and_returns_experiments(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        async with db() as session:
            assert (await session.scalar(func.count(models.Experiment.id))) == 2
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentIds": [
                    str(GlobalID(type_name="Experiment", node_id=str(1))),
                    str(GlobalID(type_name="Experiment", node_id=str(2))),
                ],
            },
        )
        assert (await session.scalar(func.count(models.Experiment.id))) == 0
        assert not response.errors
        assert response.data == {
            "deleteExperiments": {
                "experiments": [
                    {
                        "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                        "name": "experiment-1-name",
                        "description": "experiment-1-description",
                        "metadata": {"experiment-1-metadata-key": "experiment-1-metadata-value"},
                    },
                    {
                        "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                        "name": "experiment-2-name",
                        "description": "experiment-2-description",
                        "metadata": {"experiment-2-metadata-key": "experiment-2-metadata-value"},
                    },
                ]
            }
        }

    async def test_non_existent_experiment_id_results_in_no_deletions_and_returns_error(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        async with db() as session:
            assert (await session.scalar(func.count(models.Experiment.id))) == 2
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentIds": [
                    str(GlobalID(type_name="Experiment", node_id=str(1))),
                    str(GlobalID(type_name="Experiment", node_id=str(3))),
                ],
            },
        )
        async with db() as session:
            assert (await session.scalar(func.count(models.Experiment.id))) == 2
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == (
            "Failed to delete experiment(s), probably due to invalid input experiment ID(s): "
            f"['{str(GlobalID('Experiment', str(3)))}']"
        )


class TestPatchExperimentMutation:
    MUTATION = """
      mutation ($experimentId: ID!, $name: String, $description: String, $metadata: JSON) {
        patchExperiment(
          input: {
            experimentId: $experimentId
            name: $name
            description: $description
            metadata: $metadata
          }
        ) {
          experiment {
            id
            name
            description
            metadata
          }
        }
      }
    """

    async def test_patch_all_experiment_fields(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                "name": "patched-experiment-name",
                "description": "patched-experiment-description",
                "metadata": {"patched-metadata-key": "patched-metadata-value"},
            },
        )
        assert not response.errors
        assert response.data == {
            "patchExperiment": {
                "experiment": {
                    "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                    "name": "patched-experiment-name",
                    "description": "patched-experiment-description",
                    "metadata": {"patched-metadata-key": "patched-metadata-value"},
                }
            }
        }

    async def test_patching_only_metadata_leaves_name_and_description_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                "metadata": {"patched-metadata-key": "patched-metadata-value"},
            },
        )
        assert not response.errors
        assert response.data == {
            "patchExperiment": {
                "experiment": {
                    "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                    "name": "experiment-1-name",
                    "description": "experiment-1-description",
                    "metadata": {"patched-metadata-key": "patched-metadata-value"},
                }
            }
        }

    async def test_only_description_field_can_be_set_to_null(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        # description is the only nullable field: an explicit null clears it, while name and
        # metadata are left untouched.
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                "description": None,
            },
        )
        assert not response.errors
        assert response.data == {
            "patchExperiment": {
                "experiment": {
                    "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                    "name": "experiment-1-name",
                    "description": None,
                    "metadata": {"experiment-1-metadata-key": "experiment-1-metadata-value"},
                }
            }
        }

    async def test_null_name_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        # An explicit null name must be rejected even when paired with a valid field, rather
        # than being silently dropped while the other field updates.
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                "name": None,
                "description": "x",
            },
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == "name cannot be null"

    async def test_null_metadata_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                "metadata": None,
                "description": "x",
            },
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == "metadata cannot be null"

    async def test_empty_effective_patch_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        # No mutable fields supplied (all UNSET) -> nothing to patch.
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
            },
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == "No fields to patch."

    async def test_patching_a_nonexistent_experiment_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        experiment_id = GlobalID(type_name="Experiment", node_id=str(3))
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentId": str(experiment_id),
                "name": "patched-experiment-name",
            },
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == f"Experiment {experiment_id} not found"


class TestSetExperimentBaselineMutation:
    MUTATION = """
      mutation ($experimentId: ID!, $baseline: Boolean!) {
        setExperimentBaseline(experimentId: $experimentId, baseline: $baseline) {
          dataset {
            id
            baselineExperiment {
              id
              isBaseline
            }
          }
          experiment {
            id
            isBaseline
          }
          previousBaselineExperiment {
            id
            isBaseline
          }
        }
      }
    """
    SET_THEN_UNSET_MUTATION = """
      mutation ($experimentId: ID!) {
        set: setExperimentBaseline(experimentId: $experimentId, baseline: true) {
          experiment {
            id
            isBaseline
          }
        }
        unset: setExperimentBaseline(experimentId: $experimentId, baseline: false) {
          experiment {
            id
            isBaseline
          }
        }
      }
    """

    async def test_marks_experiment_as_baseline(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))
        dataset_id = str(GlobalID(type_name="Dataset", node_id=str(1)))
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": experiment_id, "baseline": True},
        )
        assert not response.errors
        assert response.data == {
            "setExperimentBaseline": {
                "dataset": {
                    "id": dataset_id,
                    "baselineExperiment": {"id": experiment_id, "isBaseline": True},
                },
                "experiment": {"id": experiment_id, "isBaseline": True},
                "previousBaselineExperiment": None,
            }
        }
        async with db() as session:
            tag = await session.scalar(
                select(models.ExperimentTag).where(models.ExperimentTag.name == "baseline")
            )
            assert tag is not None
            assert tag.experiment_id == 1

    async def test_moves_baseline_within_dataset(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        first_experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))
        second_experiment_id = str(GlobalID(type_name="Experiment", node_id=str(2)))
        dataset_id = str(GlobalID(type_name="Dataset", node_id=str(1)))
        await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": first_experiment_id, "baseline": True},
        )
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": second_experiment_id, "baseline": True},
        )
        assert not response.errors
        assert response.data == {
            "setExperimentBaseline": {
                "dataset": {
                    "id": dataset_id,
                    "baselineExperiment": {
                        "id": second_experiment_id,
                        "isBaseline": True,
                    },
                },
                "experiment": {"id": second_experiment_id, "isBaseline": True},
                "previousBaselineExperiment": {
                    "id": first_experiment_id,
                    "isBaseline": False,
                },
            }
        }
        async with db() as session:
            tags = list(
                await session.scalars(
                    select(models.ExperimentTag).where(models.ExperimentTag.name == "baseline")
                )
            )
            assert len(tags) == 1
            assert tags[0].experiment_id == 2

    async def test_removes_baseline_idempotently(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))
        dataset_id = str(GlobalID(type_name="Dataset", node_id=str(1)))
        await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": experiment_id, "baseline": True},
        )
        for _ in range(2):
            response = await gql_client.execute(
                query=self.MUTATION,
                variables={"experimentId": experiment_id, "baseline": False},
            )
            assert not response.errors
            assert response.data == {
                "setExperimentBaseline": {
                    "dataset": {"id": dataset_id, "baselineExperiment": None},
                    "experiment": {"id": experiment_id, "isBaseline": False},
                    "previousBaselineExperiment": None,
                }
            }
        async with db() as session:
            assert (
                await session.scalar(
                    select(models.ExperimentTag.id).where(models.ExperimentTag.name == "baseline")
                )
            ) is None

    async def test_removing_non_baseline_experiment_leaves_existing_baseline(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        baseline_experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))
        non_baseline_experiment_id = str(GlobalID(type_name="Experiment", node_id=str(2)))
        dataset_id = str(GlobalID(type_name="Dataset", node_id=str(1)))
        await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": baseline_experiment_id, "baseline": True},
        )

        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": non_baseline_experiment_id, "baseline": False},
        )

        assert not response.errors
        assert response.data == {
            "setExperimentBaseline": {
                "dataset": {
                    "id": dataset_id,
                    "baselineExperiment": {
                        "id": baseline_experiment_id,
                        "isBaseline": True,
                    },
                },
                "experiment": {"id": non_baseline_experiment_id, "isBaseline": False},
                "previousBaselineExperiment": None,
            }
        }
        async with db() as session:
            tag = await session.scalar(
                select(models.ExperimentTag).where(models.ExperimentTag.name == "baseline")
            )
            assert tag is not None
            assert tag.experiment_id == 1

    async def test_set_then_unset_in_same_request_returns_current_baseline_state(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))

        response = await gql_client.execute(
            query=self.SET_THEN_UNSET_MUTATION,
            variables={"experimentId": experiment_id},
        )

        assert not response.errors
        assert response.data == {
            "set": {"experiment": {"id": experiment_id, "isBaseline": True}},
            "unset": {"experiment": {"id": experiment_id, "isBaseline": False}},
        }
        async with db() as session:
            assert (
                await session.scalar(
                    select(models.ExperimentTag.id).where(models.ExperimentTag.name == "baseline")
                )
            ) is None

    async def test_allows_one_baseline_per_dataset(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        first_dataset_experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))
        async with db() as session:
            second_dataset_id = await session.scalar(
                insert(models.Dataset)
                .returning(models.Dataset.id)
                .values(name="dataset-2-name", description=None, metadata_={})
            )
            second_version_id = await session.scalar(
                insert(models.DatasetVersion)
                .returning(models.DatasetVersion.id)
                .values(
                    dataset_id=second_dataset_id,
                    description="dataset-2-version",
                    metadata_={},
                )
            )
            second_dataset_experiment_rowid = await session.scalar(
                insert(models.Experiment)
                .returning(models.Experiment.id)
                .values(
                    dataset_id=second_dataset_id,
                    dataset_version_id=second_version_id,
                    name="dataset-2-experiment",
                    description=None,
                    metadata_={},
                    repetitions=1,
                )
            )
        assert second_dataset_experiment_rowid is not None
        second_dataset_experiment_id = str(
            GlobalID(type_name="Experiment", node_id=str(second_dataset_experiment_rowid))
        )
        second_dataset_global_id = str(
            GlobalID(type_name="Dataset", node_id=str(second_dataset_id))
        )

        first_response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": first_dataset_experiment_id, "baseline": True},
        )
        second_response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": second_dataset_experiment_id, "baseline": True},
        )

        assert not first_response.errors
        assert not second_response.errors
        assert second_response.data == {
            "setExperimentBaseline": {
                "dataset": {
                    "id": second_dataset_global_id,
                    "baselineExperiment": {
                        "id": second_dataset_experiment_id,
                        "isBaseline": True,
                    },
                },
                "experiment": {"id": second_dataset_experiment_id, "isBaseline": True},
                "previousBaselineExperiment": None,
            }
        }
        async with db() as session:
            tags = list(
                await session.scalars(
                    select(models.ExperimentTag).where(models.ExperimentTag.name == "baseline")
                )
            )
            assert len(tags) == 2

    async def test_nonexistent_experiment_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        experiment_id = GlobalID(type_name="Experiment", node_id=str(3))
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": str(experiment_id), "baseline": True},
        )
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == f"Experiment {experiment_id} not found"

    async def test_ephemeral_experiment_cannot_be_marked_as_baseline(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        experiment_id = GlobalID(type_name="Experiment", node_id=str(1))
        async with db() as session:
            await session.execute(
                update(models.Experiment).where(models.Experiment.id == 1).values(is_ephemeral=True)
            )

        response = await gql_client.execute(
            query=self.MUTATION,
            variables={"experimentId": str(experiment_id), "baseline": True},
        )

        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == "Ephemeral experiments cannot be marked as baseline"


@pytest.fixture
async def simple_experiments(db: DbSessionFactory) -> None:
    """
    A dataset with one example and two experiments.
    """

    async with db() as session:
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

        # insert two experiments
        await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-1-name",
                description="experiment-1-description",
                metadata_={"experiment-1-metadata-key": "experiment-1-metadata-value"},
                repetitions=1,
            )
        )
        await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-2-name",
                description="experiment-2-description",
                metadata_={"experiment-2-metadata-key": "experiment-2-metadata-value"},
                repetitions=1,
            )
        )
