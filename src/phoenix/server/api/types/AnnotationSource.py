from enum import Enum

import strawberry


@strawberry.enum
class AnnotationSource(Enum):
    API = "API"
    APP = "APP"
