from enum import Enum
from typing import Any, Optional

import strawberry

import phoenix.trace.schemas


@strawberry.enum
class MimeType(Enum):
    text = phoenix.trace.schemas.MimeType.TEXT
    json = phoenix.trace.schemas.MimeType.JSON

    @classmethod
    def _missing_(cls, v: Any) -> Optional["MimeType"]:
        return None if v else cls.text
