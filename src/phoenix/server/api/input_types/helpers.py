import re
from typing import Optional

from phoenix.server.api.exceptions import BadRequest

_HEX_COLOR_PATTERN = re.compile(r"^#([0-9a-fA-F]{6})$")


def validate_hex_color(value: Optional[str], field_name: str) -> None:
    if value and not _HEX_COLOR_PATTERN.match(value):
        raise BadRequest(f"{field_name} must be a valid hex color")
