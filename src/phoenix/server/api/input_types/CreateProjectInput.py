import re
from typing import Optional

import strawberry
from strawberry import UNSET

from phoenix.server.api.exceptions import BadRequest


@strawberry.input
class CreateProjectInput:
    name: str
    description: Optional[str] = UNSET
    gradient_start_color: Optional[str] = UNSET
    gradient_end_color: Optional[str] = UNSET

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise BadRequest("Name cannot be empty")
        if self.gradient_start_color and not re.match(
            r"^#([0-9a-fA-F]{6})$", self.gradient_start_color
        ):
            raise BadRequest("Gradient start color must be a valid hex color")
        if self.gradient_end_color and not re.match(
            r"^#([0-9a-fA-F]{6})$", self.gradient_end_color
        ):
            raise BadRequest("Gradient end color must be a valid hex color")
