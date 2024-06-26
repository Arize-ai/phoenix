from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID


@strawberry.input
class ClearProjectInput:
    id: GlobalID
    end_time: Optional[str] = UNSET
