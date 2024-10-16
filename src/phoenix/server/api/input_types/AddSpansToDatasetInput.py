from typing import List, Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON


@strawberry.input
class AddSpansToDatasetInput:
    dataset_id: GlobalID
    span_ids: List[GlobalID]
    dataset_version_description: Optional[str] = UNSET
    dataset_version_metadata: Optional[JSON] = UNSET
