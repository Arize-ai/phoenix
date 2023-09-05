from enum import Enum

import strawberry

import phoenix.trace.semantic_conventions as sc


@strawberry.enum
class MimeType(Enum):
    text = sc.MimeType.TEXT
    json = sc.MimeType.JSON
