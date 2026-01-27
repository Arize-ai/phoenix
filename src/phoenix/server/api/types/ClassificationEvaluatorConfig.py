from typing import Optional

import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.types.OptimizationDirection import OptimizationDirection
from phoenix.server.api.types.PromptVersionTemplate import PromptMessage


@strawberry.type
class ClassificationEvaluatorConfig:
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection
    messages: list[PromptMessage]
    choices: JSON
