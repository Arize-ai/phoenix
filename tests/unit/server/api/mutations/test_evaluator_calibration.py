from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.DatasetExampleRevision import (
    DatasetExampleRevision,
    get_calibration_labels,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def calibration_dataset(db: DbSessionFactory) -> tuple[int, list[tuple[int, int]]]:
    """A dataset with two examples; returns (dataset_id, [(example_id, revision_id)])."""
    async with db() as session:
        dataset = models.Dataset(name="calibration", metadata_={})
        session.add(dataset)
        await session.flush()
        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add(version)
        await session.flush()
        examples: list[tuple[int, int]] = []
        for index in range(2):
            example = models.DatasetExample(dataset_id=dataset.id)
            session.add(example)
            await session.flush()
            revision = models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=version.id,
                input={"question": f"Hello {index}"},
                output={"answer": "Hi"},
                metadata_={"team": "support"},
                revision_kind="CREATE",
            )
            session.add(revision)
            await session.flush()
            examples.append((example.id, revision.id))
    return dataset.id, examples


_MUTATION = """
  mutation SetLabels($input: SetDatasetExampleCalibrationLabelsInput!) {
    setDatasetExampleCalibrationLabels(input: $input) {
      dataset { id }
      version { id description }
      examples {
        id
        revision {
          revisionId input output metadata
          calibrationLabels { annotationName label score explanation }
        }
      }
    }
  }
"""


def _label(example: tuple[int, int], **overrides: Any) -> dict[str, Any]:
    example_id, revision_id = example
    return {
        "exampleId": str(GlobalID("DatasetExample", str(example_id))),
        "expectedRevisionId": str(GlobalID("DatasetExampleRevision", str(revision_id))),
        "annotationName": "quality",
        "label": "good",
        **overrides,
    }


def _input(dataset_id: int, *labels: dict[str, Any]) -> dict[str, Any]:
    return {"input": {"datasetId": str(GlobalID("Dataset", str(dataset_id))), "labels": labels}}


async def _count_versions(db: DbSessionFactory, dataset_id: int) -> int:
    async with db() as session:
        return (
            await session.scalar(
                select(func.count(models.DatasetVersion.id)).where(
                    models.DatasetVersion.dataset_id == dataset_id
                )
            )
            or 0
        )


class TestCalibrationLabels:
    async def test_batch_writes_one_version_for_many_examples_and_names(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, (first, second) = calibration_dataset
        response = await gql_client.execute(
            _MUTATION,
            variables=_input(
                dataset_id,
                _label(first, annotationName="quality", label="good"),
                _label(first, annotationName="refusal", label=None, score=0.5),
                _label(second, annotationName="quality", label="bad", explanation="Human review"),
            ),
        )
        assert response.data and not response.errors
        payload = response.data["setDatasetExampleCalibrationLabels"]
        assert payload["version"]["description"] == "Update expected outputs for 2 examples"
        assert await _count_versions(db, dataset_id) == 2  # the seed version plus this batch
        by_id = {example["id"]: example["revision"] for example in payload["examples"]}
        first_revision = by_id[str(GlobalID("DatasetExample", str(first[0])))]
        second_revision = by_id[str(GlobalID("DatasetExample", str(second[0])))]
        # Two names on one example land in one revision.
        assert first_revision["calibrationLabels"] == [
            {"annotationName": "quality", "label": "good", "score": None, "explanation": None},
            {"annotationName": "refusal", "label": None, "score": 0.5, "explanation": None},
        ]
        assert second_revision["calibrationLabels"] == [
            {
                "annotationName": "quality",
                "label": "bad",
                "score": None,
                "explanation": "Human review",
            }
        ]
        assert first_revision["input"] == {"question": "Hello 0"}
        assert first_revision["metadata"]["team"] == "support"
        assert first_revision["revisionId"] != _label(first)["expectedRevisionId"]

    async def test_set_merge_clear_and_annotation_shape(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, (example, _) = calibration_dataset
        expected_revision = _label(example)["expectedRevisionId"]
        for annotation_name, label, expected_labels in [
            ("quality", "good", ["quality:good"]),
            ("refusal", "no", ["quality:good", "refusal:no"]),
            ("quality", None, ["refusal:no"]),
        ]:
            response = await gql_client.execute(
                _MUTATION,
                variables=_input(
                    dataset_id,
                    {
                        **_label(example, annotationName=annotation_name, label=label),
                        "expectedRevisionId": expected_revision,
                    },
                ),
            )
            assert response.data and not response.errors
            payload = response.data["setDatasetExampleCalibrationLabels"]
            (revision,) = [item["revision"] for item in payload["examples"]]
            assert [
                f"{item['annotationName']}:{item['label']}"
                for item in revision["calibrationLabels"]
            ] == expected_labels
            assert revision["revisionId"] != expected_revision
            expected_revision = revision["revisionId"]
        async with db() as session:
            stored = await session.scalar(
                select(models.DatasetExampleRevision)
                .where(models.DatasetExampleRevision.dataset_example_id == example[0])
                .order_by(models.DatasetExampleRevision.id.desc())
                .limit(1)
            )
            assert stored is not None
            # One human record per name, in the span→example annotation shape, and
            # a cleared name leaves no empty list behind.
            annotations = stored.metadata_["annotations"]
            assert list(annotations) == ["refusal"]
            assert annotations["refusal"] == [
                {
                    "label": "no",
                    "score": None,
                    "explanation": None,
                    "metadata": {},
                    "annotator_kind": "HUMAN",
                    "user_id": None,
                    "username": None,
                    "email": None,
                }
            ]

    async def test_keeps_other_annotators_and_reads_only_human_records(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, (example, _) = calibration_dataset
        llm_record = {
            "label": "bad",
            "score": 0.0,
            "explanation": "judge",
            "metadata": {},
            "annotator_kind": "LLM",
            "user_id": None,
            "username": None,
            "email": None,
        }
        async with db() as session:
            revision = await session.get(models.DatasetExampleRevision, example[1])
            assert revision is not None
            revision.metadata_ = {"team": "support", "annotations": {"quality": [llm_record]}}
        response = await gql_client.execute(
            _MUTATION, variables=_input(dataset_id, _label(example))
        )
        assert response.data and not response.errors
        (saved,) = response.data["setDatasetExampleCalibrationLabels"]["examples"]
        assert [
            (item["annotationName"], item["label"])
            for item in saved["revision"]["calibrationLabels"]
        ] == [("quality", "good")]
        records = saved["revision"]["metadata"]["annotations"]["quality"]
        assert records[0] == llm_record
        assert records[1]["annotator_kind"] == "HUMAN" and records[1]["label"] == "good"
        # Clearing removes only the human record.
        response = await gql_client.execute(
            _MUTATION,
            variables=_input(
                dataset_id,
                {
                    **_label(example, label=None),
                    "expectedRevisionId": saved["revision"]["revisionId"],
                },
            ),
        )
        assert response.data and not response.errors
        (cleared,) = response.data["setDatasetExampleCalibrationLabels"]["examples"]
        assert cleared["revision"]["calibrationLabels"] == []
        assert cleared["revision"]["metadata"]["annotations"] == {"quality": [llm_record]}

    async def test_stale_revision_rejects_the_whole_batch(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, (first, second) = calibration_dataset
        response = await gql_client.execute(_MUTATION, variables=_input(dataset_id, _label(first)))
        assert response.data and not response.errors
        versions = await _count_versions(db, dataset_id)
        # `first` is now stale; `second` is current. Nothing may be written.
        response = await gql_client.execute(
            _MUTATION, variables=_input(dataset_id, _label(first), _label(second))
        )
        assert response.errors
        assert "has changed" in response.errors[0].message
        assert await _count_versions(db, dataset_id) == versions
        async with db() as session:
            second_revisions = await session.scalar(
                select(func.count(models.DatasetExampleRevision.id)).where(
                    models.DatasetExampleRevision.dataset_example_id == second[0]
                )
            )
        assert second_revisions == 1

    @pytest.mark.parametrize(
        "overrides, message",
        [
            ({"exampleId": str(GlobalID("DatasetExample", "999999"))}, "selected dataset"),
            ({"annotationName": " "}, "Annotation name"),
            ({"label": " "}, "Label must"),
            ({"label": "x" * 1025}, "Label must"),
        ],
    )
    async def test_rejects_invalid_labels(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
        overrides: dict[str, Any],
        message: str,
    ) -> None:
        dataset_id, (example, _) = calibration_dataset
        response = await gql_client.execute(
            _MUTATION, variables=_input(dataset_id, _label(example, **overrides))
        )
        assert response.errors
        assert message in response.errors[0].message

    async def test_rejects_wrong_dataset_empty_and_duplicate_batches(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
    ) -> None:
        dataset_id, (example, _) = calibration_dataset
        response = await gql_client.execute(_MUTATION, variables=_input(999999, _label(example)))
        assert response.errors and "selected dataset" in response.errors[0].message
        response = await gql_client.execute(_MUTATION, variables=_input(dataset_id))
        assert response.errors and "at least one" in response.errors[0].message
        response = await gql_client.execute(
            _MUTATION, variables=_input(dataset_id, _label(example), _label(example, label="bad"))
        )
        assert response.errors and "once per batch" in response.errors[0].message

    @pytest.mark.parametrize("deleted", [False, True])
    async def test_rejects_deleted_or_malformed_examples(
        self,
        calibration_dataset: tuple[int, list[tuple[int, int]]],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        deleted: bool,
    ) -> None:
        dataset_id, (example, _) = calibration_dataset
        async with db() as session:
            revision = await session.get(models.DatasetExampleRevision, example[1])
            assert revision is not None
            if deleted:
                revision.revision_kind = "DELETE"
            else:
                revision.metadata_ = {"annotations": "not-an-object"}
        response = await gql_client.execute(
            _MUTATION, variables=_input(dataset_id, _label(example))
        )
        assert response.errors
        message = "Example not found" if deleted else "must be an object"
        assert message in response.errors[0].message
        async with db() as session:
            revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_example_id == example[0]
                    )
                )
            ).all()
            assert len(revisions) == 1


async def test_calibration_labels_are_computed_only_when_requested(
    calibration_dataset: tuple[int, list[tuple[int, int]]], db: DbSessionFactory
) -> None:
    async with db() as session:
        stored = await session.get(models.DatasetExampleRevision, calibration_dataset[1][0][1])
        assert stored is not None
        with patch(
            "phoenix.server.api.types.DatasetExampleRevision.get_expected_outputs",
            return_value={"quality": {"label": "good"}},
        ) as read_expected:
            revision = DatasetExampleRevision.from_orm_revision(stored)
            read_expected.assert_not_called()
            assert get_calibration_labels(revision.metadata)[0].label == "good"
            read_expected.assert_called_once_with(stored.metadata_)
