from typing import List, Optional

import strawberry
from strawberry import ID, UNSET


@strawberry.input
class ClusterInput:
    event_ids: List[ID]
    id: Optional[ID] = UNSET
