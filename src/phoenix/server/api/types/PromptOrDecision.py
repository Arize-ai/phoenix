from typing import Annotated, Union

import strawberry
from typing_extensions import TypeAlias

from phoenix.server.api.types.Decision import Decision
from phoenix.server.api.types.Prompt import Prompt

PromptOrDecision: TypeAlias = Annotated[
    Union[Prompt, Decision],
    strawberry.union(
        "PromptOrDecision",
        description="A saved, versioned task definition: either a Prompt or a Decision.",
    ),
]
