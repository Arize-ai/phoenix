from typing import Optional

import strawberry
from strawberry import ID, UNSET


@strawberry.input
class ClusterInput:
    event_ids: list[ID]
    id: Optional[ID] = UNSET
