from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.server.api.input_types.helpers import validate_hex_color


@strawberry.input
class PatchProjectInput:
    id: GlobalID
    description: Optional[str] = UNSET
    gradient_start_color: Optional[str] = UNSET
    gradient_end_color: Optional[str] = UNSET

    def __post_init__(self) -> None:
        validate_hex_color(self.gradient_start_color, "Gradient start color")
        validate_hex_color(self.gradient_end_color, "Gradient end color")
