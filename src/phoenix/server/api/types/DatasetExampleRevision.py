from datetime import datetime
from enum import Enum

import strawberry
from strawberry.scalars import JSON


@strawberry.type
class RevisionKind(Enum):
    CREATE = "CREATE"
    PATCH = "PATCH"
    DELETE = "DELETE"


@strawberry.type
class DatasetExampleRevision:
    """
    Represents a revision (i.e., update or alteration) of a dataset example.
    """

    input: JSON
    output: JSON
    metadata: JSON
    revision_kind: RevisionKind
    created_at: datetime
