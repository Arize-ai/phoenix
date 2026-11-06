from enum import Enum
from typing import Any

import strawberry

import phoenix.trace.schemas as trace_schemas


@strawberry.enum
class MimeType(Enum):
    text = trace_schemas.MimeType.TEXT.value
    json = trace_schemas.MimeType.JSON.value

    @classmethod
    def _missing_(cls, v: Any) -> "MimeType":
        # Unrecognized or empty mime types fall back to text instead of raising.
        return cls.text
