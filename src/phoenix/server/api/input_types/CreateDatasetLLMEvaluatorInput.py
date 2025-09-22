from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from .PromptVersionInput import ChatPromptVersionInput


@strawberry.input
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: str
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput
