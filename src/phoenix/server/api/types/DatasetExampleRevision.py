from datetime import datetime
from enum import Enum

import strawberry

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
