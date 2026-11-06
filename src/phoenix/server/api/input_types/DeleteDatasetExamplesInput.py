from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class DeleteDatasetExamplesInput:
    example_ids: list[GlobalID]
    dataset_version_description: Optional[str] = UNSET
    dataset_version_metadata: Optional[JSON] = UNSET
    dataset_id: Optional[GlobalID] = strawberry.field(
        default=UNSET,
        description="When provided, every deleted example must belong to this dataset "
        "or the whole mutation is rejected — lets callers scope the write to the "
        "dataset they believe they are editing.",
    )
