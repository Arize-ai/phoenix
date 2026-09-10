from datetime import datetime
from enum import Enum
from typing import Any, cast

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.helpers.evaluator_calibration import get_expected_outputs
from phoenix.server.api.types.ExampleRevisionInterface import ExampleRevision


@strawberry.enum
class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"


@strawberry.type
class DatasetExampleCalibrationLabel:
    annotation_name: str
    label: str | None
    score: float | None
    explanation: str | None


@strawberry.type
class DatasetExampleRevision(ExampleRevision):
    """
    Represents a revision (i.e., update or alteration) of a dataset example.
    """

    revision_id: GlobalID
    revision_kind: RevisionKind
    created_at: datetime

    @strawberry.field
    def calibration_labels(self) -> list[DatasetExampleCalibrationLabel]:
        return [
            DatasetExampleCalibrationLabel(
                annotation_name=name,
                label=value.get("label"),
                score=value.get("score"),
                explanation=value.get("explanation"),
            )
            for name, value in get_expected_outputs(cast(dict[str, Any], self.metadata)).items()
        ]

    @classmethod
    def from_orm_revision(cls, revision: models.DatasetExampleRevision) -> "DatasetExampleRevision":
        return cls(
            revision_id=GlobalID("DatasetExampleRevision", str(revision.id)),
            input=JSON(revision.input),
            output=JSON(revision.output),
            metadata=JSON(revision.metadata_),
            revision_kind=RevisionKind(revision.revision_kind),
            created_at=revision.created_at,
        )
