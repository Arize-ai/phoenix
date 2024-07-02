from datetime import datetime
from enum import Enum

import strawberry

from phoenix.db import models
from phoenix.server.api.types.ExampleRevisionInterface import ExampleRevision


@strawberry.enum
class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"


@strawberry.type
class DatasetExampleRevision(ExampleRevision):
    """
    Represents a revision (i.e., update or alteration) of a dataset example.
    """

    revision_kind: RevisionKind
    created_at: datetime

    @classmethod
    def from_orm_revision(cls, revision: models.DatasetExampleRevision) -> "DatasetExampleRevision":
        return cls(
            input=revision.input,
            output=revision.output,
            metadata=revision.metadata_,
            revision_kind=RevisionKind(revision.revision_kind),
            created_at=revision.created_at,
        )
