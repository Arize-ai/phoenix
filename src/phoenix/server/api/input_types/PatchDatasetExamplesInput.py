from typing import List, Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class PatchDatasetExample:
    """
    Contains the information needed to apply a patch revision to a dataset example.
    """

    example_id: GlobalID
    input: Optional[JSON] = UNSET
    output: Optional[JSON] = UNSET
    metadata: Optional[JSON] = UNSET


@strawberry.input
class PatchDatasetExamplesInput:
    """
    Input type to the patchDatasetExamples mutation.
    """

    example_patches: List[PatchDatasetExample]
    dataset_version_description: Optional[str] = UNSET
    dataset_version_metadata: Optional[JSON] = UNSET
