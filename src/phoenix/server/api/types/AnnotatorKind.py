from enum import Enum

import strawberry


@strawberry.enum
class ExperimentRunAnnotatorKind(Enum):
    LLM = "LLM"
    HUMAN = "HUMAN"
    CODE = "CODE"
    DECISION = "DECISION"
    AGENT = "AGENT"


@strawberry.enum
class AnnotatorKind(Enum):
    LLM = "LLM"
    HUMAN = "HUMAN"
    CODE = "CODE"
    DECISION = "DECISION"
    AGENT = "AGENT"
