import re
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.server.api.exceptions import BadRequest

_HEX_COLOR_PATTERN = re.compile(r"^#([0-9a-fA-F]{6})$")


@strawberry.input
class PatchProjectInput:
    id: GlobalID
    description: Optional[str] = UNSET
    gradient_start_color: Optional[str] = UNSET
    gradient_end_color: Optional[str] = UNSET

    def __post_init__(self) -> None:
        if self.gradient_start_color and not _HEX_COLOR_PATTERN.match(self.gradient_start_color):
            raise BadRequest("Gradient start color must be a valid hex color")
        if self.gradient_end_color and not _HEX_COLOR_PATTERN.match(self.gradient_end_color):
            raise BadRequest("Gradient end color must be a valid hex color")
