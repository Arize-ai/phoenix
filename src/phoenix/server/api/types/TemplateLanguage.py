from enum import Enum

import strawberry


@strawberry.enum
class TemplateLanguage(Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"
