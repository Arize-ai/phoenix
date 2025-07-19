from typing import Optional

import strawberry
from strawberry import UNSET


@strawberry.input
class CreateProjectInput:
    name: str
    description: Optional[str] = UNSET
    gradient_start_color: Optional[str] = UNSET
    gradient_end_color: Optional[str] = UNSET