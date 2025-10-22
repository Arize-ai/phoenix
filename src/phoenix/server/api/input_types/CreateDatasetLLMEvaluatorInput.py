from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.types.Identifier import Identifier

from .PromptVersionInput import ChatPromptVersionInput


@strawberry.input
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = None
    prompt_version: ChatPromptVersionInput
