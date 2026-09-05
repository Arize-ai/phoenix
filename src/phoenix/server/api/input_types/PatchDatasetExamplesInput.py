from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class DatasetExamplePatch:
    """
    Contains the information needed to apply a patch revision to a dataset example.
    """

    example_id: GlobalID
    input: Optional[JSON] = UNSET
    output: Optional[JSON] = UNSET
    metadata: Optional[JSON] = UNSET

    def is_empty(self) -> bool:
        """
        Non-empty patches have at least one field set.
        """
        return all(field is UNSET for field in (self.input, self.output, self.metadata))


@strawberry.input
class DatasetExampleAddition:
    """
    Contains the information needed to add a new example to a dataset.
    """

    input: JSON
    output: JSON
    metadata: JSON
    external_id: Optional[str] = UNSET


@strawberry.input
class PatchDatasetExamplesInput:
    """
    Input type to the patchDatasetExamples mutation. The additions, patches, and
    deletions are committed together as one dataset version.
    """

    dataset_id: GlobalID
    additions: list[DatasetExampleAddition] = strawberry.field(default_factory=list)
    patches: list[DatasetExamplePatch] = strawberry.field(default_factory=list)
    example_ids_to_delete: list[GlobalID] = strawberry.field(default_factory=list)
    version_description: Optional[str] = UNSET
    version_metadata: Optional[JSON] = UNSET
