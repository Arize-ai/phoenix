from enum import Enum
from typing import Any, Optional

import strawberry

import phoenix.trace.semantic_conventions as sc


@strawberry.enum
class MimeType(Enum):
    text = sc.MimeType.TEXT
    json = sc.MimeType.JSON

    @classmethod
    def _missing_(cls, v: Any) -> Optional["MimeType"]:
        return None if v else cls.text
