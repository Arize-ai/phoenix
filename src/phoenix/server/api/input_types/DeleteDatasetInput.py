from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID


@strawberry.input
class DeleteDatasetInput:
    dataset_id: Optional[GlobalID] = UNSET
