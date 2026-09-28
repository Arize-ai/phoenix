from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.exceptions import BadRequest

MAX_SPANS_PER_DATASET_EXPORT = 200


@strawberry.input
class CreateDatasetFromSpansInput:
    project_id: GlobalID
    name: str
    filter_condition: str = strawberry.field(
        default="",
        description="A span filter condition; the empty string matches every span.",
    )
    limit: int = strawberry.field(
        default=50,
        description=(
            "How many of the latest matching spans, by start time, to add as examples. "
            f"At most {MAX_SPANS_PER_DATASET_EXPORT}."
        ),
    )
    description: Optional[str] = UNSET
    metadata: Optional[JSON] = UNSET

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Dataset name cannot be empty")
        if not 1 <= self.limit <= MAX_SPANS_PER_DATASET_EXPORT:
            raise BadRequest(f"limit must be between 1 and {MAX_SPANS_PER_DATASET_EXPORT}")
