from enum import Enum
from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.db.types.annotation_configs import OptimizationDirection
from phoenix.server.api.types.Evaluator import EvaluatorKind
from phoenix.server.api.types.PromptVersionTemplate import PromptMessage


@strawberry.enum
class EvaluatorScope(Enum):
    SPAN = "span"
    TRACE = "trace"
    SESSION = "session"


@strawberry.enum(
    description="Stable category identifiers whose display labels are supplied by clients."
)
class EvaluatorCategory(Enum):
    GROUNDING_AND_RETRIEVAL = "grounding_and_retrieval"
    AGENTS = "agents"
    RESPONSE_QUALITY = "response_quality"
    SAFETY_AND_SECURITY = "safety_and_security"
    USER_EXPERIENCE = "user_experience"


@strawberry.type(name="EvaluatorInput")
class EvaluatorInputDescriptor:
    name: str
    description: str
    format: Optional[str] = None


@strawberry.type
class ClassificationEvaluatorConfig:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    messages: list[PromptMessage]
    choices: JSON
    labels: list[str]
    scope: Optional[EvaluatorScope]
    recommended: bool
    category: Optional[EvaluatorCategory]
    kind: EvaluatorKind
    details: Optional[str]
    inputs: Optional[list[EvaluatorInputDescriptor]]
