from enum import Enum

import strawberry


@strawberry.enum
class TemplateLanguage(Enum):
    NONE = "NONE"
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"
