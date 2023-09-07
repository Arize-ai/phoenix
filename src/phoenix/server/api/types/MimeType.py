from enum import Enum
from typing import Any, Optional

import strawberry

from phoenix.trace import semantic_conventions


@strawberry.enum
class MimeType(Enum):
    text = semantic_conventions.MimeType.TEXT
    json = semantic_conventions.MimeType.JSON

    @classmethod
    def _missing_(cls, v: Any) -> Optional["MimeType"]:
        return None if v else cls.text
