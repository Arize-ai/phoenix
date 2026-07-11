from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.input_types.PatchDatasetExamplesInput import DatasetExamplePatch


@strawberry.input
class DatasetExampleAddition:
    input: JSON
    output: JSON
    metadata: JSON
    external_id: Optional[str] = UNSET


@strawberry.input
class ApplyDatasetExampleChangesInput:
    """A mixed dataset example diff that is committed as one dataset version."""

    dataset_id: GlobalID
    additions: list[DatasetExampleAddition] = strawberry.field(default_factory=list)
    patches: list[DatasetExamplePatch] = strawberry.field(default_factory=list)
    example_ids_to_delete: list[GlobalID] = strawberry.field(default_factory=list)
    version_description: Optional[str] = UNSET
    version_metadata: Optional[JSON] = UNSET
