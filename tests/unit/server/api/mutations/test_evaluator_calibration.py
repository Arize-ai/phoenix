from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.helpers.evaluator_calibration import CALIBRATION_METADATA_KEY
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def calibration_example(db: DbSessionFactory) -> tuple[int, int, int]:
    async with db() as session:
        dataset = models.Dataset(name="calibration", metadata_={})
        session.add(dataset)
        await session.flush()
        example = models.DatasetExample(dataset_id=dataset.id)
        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        session.add_all([example, version])
        await session.flush()
        revision = models.DatasetExampleRevision(
            dataset_example_id=example.id,
            dataset_version_id=version.id,
            input={"question": "Hello"},
            output={"answer": "Hi"},
            metadata_={"team": "support"},
            revision_kind="CREATE",
        )
        session.add(revision)
        await session.flush()
    return dataset.id, example.id, revision.id


class TestCalibrationLabels:
    _MUTATION = """
      mutation SetLabel($input: SetDatasetExampleCalibrationLabelInput!) {
        setDatasetExampleCalibrationLabel(input: $input) {
          dataset { id }
          example { id revision { revisionId } }
          revision { revisionId input output metadata calibrationLabels { annotationName label } }
        }
      }
    """

    def _input(self, ids: tuple[int, int, int], **overrides: Any) -> dict[str, Any]:
        dataset_id, example_id, revision_id = ids
        return {
            "datasetId": str(GlobalID("Dataset", str(dataset_id))),
            "exampleId": str(GlobalID("DatasetExample", str(example_id))),
            "expectedRevisionId": str(GlobalID("DatasetExampleRevision", str(revision_id))),
            "annotationName": "quality",
            "label": "good",
            **overrides,
        }

    async def test_independent_expected_outputs(
        self,
        calibration_example: tuple[int, int, int],
        gql_client: AsyncGraphQLClient,
    ) -> None:
        revision_id = self._input(calibration_example)["expectedRevisionId"]
        mutation = self._MUTATION.replace(
            "annotationName label", "annotationName label score explanation"
        )
        for index in range(4):
            response = await gql_client.execute(
                mutation,
                variables={
                    "input": self._input(
                        calibration_example,
                        expectedRevisionId=revision_id,
                        annotationName=f"evaluator_{index}",
                        label=None,
                        score=index / 3,
                        explanation="Human review",
                    )
                },
            )
            assert response.data and not response.errors
            revision = response.data["setDatasetExampleCalibrationLabel"]["revision"]
            revision_id = revision["revisionId"]
            assert len(revision["calibrationLabels"]) == index + 1
            assert revision["calibrationLabels"][-1] == {
                "annotationName": f"evaluator_{index}",
                "label": None,
                "score": index / 3,
                "explanation": "Human review",
            }
            assert revision["metadata"]["team"] == "support"
        response = await gql_client.execute(
            mutation,
            variables={
                "input": self._input(
                    calibration_example,
                    expectedRevisionId=revision_id,
                    annotationName="evaluator_1",
                    label=None,
                )
            },
        )
        assert response.data and not response.errors
        outputs = response.data["setDatasetExampleCalibrationLabel"]["revision"][
            "calibrationLabels"
        ]
        assert [output["annotationName"] for output in outputs] == [
            "evaluator_0",
            "evaluator_2",
            "evaluator_3",
        ]

    async def test_set_merge_clear_and_provenance(
        self,
        calibration_example: tuple[int, int, int],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        expected_revision = self._input(calibration_example)["expectedRevisionId"]
        for annotation_name, label, expected_labels in [
            ("quality", "good", [{"annotationName": "quality", "label": "good"}]),
            (
                "refusal",
                "no",
                [
                    {"annotationName": "quality", "label": "good"},
                    {"annotationName": "refusal", "label": "no"},
                ],
            ),
            ("quality", None, [{"annotationName": "refusal", "label": "no"}]),
        ]:
            response = await gql_client.execute(
                self._MUTATION,
                variables={
                    "input": self._input(
                        calibration_example,
                        expectedRevisionId=expected_revision,
                        annotationName=annotation_name,
                        label=label,
                    )
                },
            )
            assert response.data and not response.errors
            payload = response.data["setDatasetExampleCalibrationLabel"]
            revision = payload["revision"]
            assert revision["input"] == {"question": "Hello"}
            assert revision["output"] == {"answer": "Hi"}
            assert revision["metadata"]["team"] == "support"
            assert revision["calibrationLabels"] == expected_labels
            assert revision["revisionId"] != expected_revision
            assert payload["example"]["revision"]["revisionId"] == revision["revisionId"]
            expected_revision = revision["revisionId"]
        async with db() as session:
            stored = await session.scalar(
                select(models.DatasetExampleRevision)
                .where(models.DatasetExampleRevision.dataset_example_id == calibration_example[1])
                .order_by(models.DatasetExampleRevision.id.desc())
                .limit(1)
            )
            assert stored is not None
            entry = stored.metadata_[CALIBRATION_METADATA_KEY]["labels"]["refusal"]
            assert entry["annotatorKind"] == "HUMAN"
            assert len(entry["sourceHash"]) == 64
            # Changing input, output, or mapping metadata invalidates the expected labels.
            for field in ("input", "output", "metadata_"):
                original = getattr(stored, field)
                setattr(stored, field, {**original, "changed": True})
                assert not DatasetExampleRevision.from_orm_revision(stored).calibration_labels()
                setattr(stored, field, original)

    async def test_stale_revision_is_rejected(
        self, calibration_example: tuple[int, int, int], gql_client: AsyncGraphQLClient
    ) -> None:
        variables = {"input": self._input(calibration_example)}
        response = await gql_client.execute(self._MUTATION, variables=variables)
        assert response.data and not response.errors
        response = await gql_client.execute(self._MUTATION, variables=variables)
        assert response.errors
        assert "has changed" in response.errors[0].message

    @pytest.mark.parametrize(
        "overrides, message",
        [
            ({"datasetId": str(GlobalID("Dataset", "999999"))}, "selected dataset"),
            ({"exampleId": str(GlobalID("DatasetExample", "999999"))}, "selected dataset"),
            ({"annotationName": " "}, "Annotation name"),
            ({"label": " "}, "Label must"),
            ({"label": "x" * 1025}, "Label must"),
        ],
    )
    async def test_rejects_invalid_requests(
        self,
        calibration_example: tuple[int, int, int],
        gql_client: AsyncGraphQLClient,
        overrides: dict[str, Any],
        message: str,
    ) -> None:
        response = await gql_client.execute(
            self._MUTATION, variables={"input": self._input(calibration_example, **overrides)}
        )
        assert response.errors
        assert message in response.errors[0].message

    @pytest.mark.parametrize("deleted", [False, True])
    async def test_rejects_deleted_or_malformed_examples(
        self,
        calibration_example: tuple[int, int, int],
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        deleted: bool,
    ) -> None:
        async with db() as session:
            revision = await session.get(models.DatasetExampleRevision, calibration_example[2])
            assert revision is not None
            if deleted:
                revision.revision_kind = "DELETE"
            else:
                revision.metadata_ = {CALIBRATION_METADATA_KEY: {"schemaVersion": 2}}
        response = await gql_client.execute(
            self._MUTATION, variables={"input": self._input(calibration_example)}
        )
        assert response.errors
        message = "Example not found" if deleted else "Unsupported calibration metadata"
        assert message in response.errors[0].message
        async with db() as session:
            revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_example_id == calibration_example[1]
                    )
                )
            ).all()
            assert len(revisions) == 1


async def test_calibration_labels_are_computed_only_when_requested(
    calibration_example: tuple[int, int, int], db: DbSessionFactory
) -> None:
    async with db() as session:
        stored = await session.get(models.DatasetExampleRevision, calibration_example[2])
        assert stored is not None
        with patch(
            "phoenix.server.api.types.DatasetExampleRevision.valid_calibration_outputs",
            return_value={"quality": {"label": "good"}},
        ) as validate_labels:
            revision = DatasetExampleRevision.from_orm_revision(stored)
            validate_labels.assert_not_called()
            assert revision.calibration_labels()[0].label == "good"
            validate_labels.assert_called_once_with(stored.input, stored.output, stored.metadata_)
