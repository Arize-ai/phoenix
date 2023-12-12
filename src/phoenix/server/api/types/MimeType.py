from enum import Enum
from typing import Any, Optional

import strawberry

import phoenix.trace.schemas as trace_schemas


@strawberry.enum
class MimeType(Enum):
    text = trace_schemas.MimeType.TEXT
    json = trace_schemas.MimeType.JSON

    @classmethod
    def _missing_(cls, v: Any) -> Optional["MimeType"]:
        return None if v else cls.text
