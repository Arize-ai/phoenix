from enum import Enum

import strawberry


@strawberry.enum
class AnnotatorKind(Enum):
    LLM = "LLM"
    HUMAN = "HUMAN"
    CODE = "CODE"
