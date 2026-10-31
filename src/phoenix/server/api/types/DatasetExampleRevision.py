from datetime import datetime
from enum import Enum
from typing import Any, cast

import strawberry
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db import models
from phoenix.server.api.helpers.dataset_helpers import dataset_example_eval_context
from phoenix.server.api.helpers.expected_outputs import get_expected_outputs
from phoenix.server.api.types.ExampleRevisionInterface import ExampleRevision


@strawberry.enum
class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"


@strawberry.type
class DatasetExampleExpectedOutput:
    annotation_name: str
    label: str | None
    score: float | None
    explanation: str | None


def to_gql_expected_outputs(metadata: Any) -> list[DatasetExampleExpectedOutput]:
    """The expected outputs stored on an example's metadata, one per annotation name."""
    return [
        DatasetExampleExpectedOutput(
            annotation_name=name,
            label=value.get("label"),
            score=value.get("score"),
            explanation=value.get("explanation"),
        )
        for name, value in get_expected_outputs(cast(dict[str, Any], metadata)).items()
    ]


@strawberry.type
class DatasetExampleRevision(ExampleRevision):
    """
    Represents a revision (i.e., update or alteration) of a dataset example.
    """

    revision_id: GlobalID
    revision_kind: RevisionKind
    created_at: datetime

    @strawberry.field
    def evaluation_context(self) -> JSON:
        return JSON(
            dataset_example_eval_context(
                input=self.input, output=self.output, metadata=self.metadata
            )
        )

    @strawberry.field
    def expected_outputs(self) -> list[DatasetExampleExpectedOutput]:
        return to_gql_expected_outputs(self.metadata)

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
