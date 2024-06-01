from typing import List, Optional

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


@strawberry.input
class PatchDatasetExamplesInput:
    """
    Input type to the patchDatasetExamples mutation.
    """

    patches: List[DatasetExamplePatch]
    version_description: Optional[str] = UNSET
    version_metadata: Optional[JSON] = UNSET
