from datetime import datetime

import strawberry
from strawberry.types import Info

from phoenix.server.api.context import Context

from .Evaluator import Evaluator
from .Prompt import Prompt


@strawberry.type
class LLMEvaluator(Evaluator):
    @strawberry.field
    async def prompt(self, info: Info[Context, None]) -> Prompt:
        return Prompt(
            id_attr=1,
            source_prompt_id=None,
            name="bogus",
            description="fake",
            created_at=datetime.now(),
        )
