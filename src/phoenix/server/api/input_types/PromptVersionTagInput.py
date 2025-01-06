from typing import Optional

import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class SetPromptVersionTagInput:
    """Fields required to create a PromptVersionTag."""

    prompt_version_id: GlobalID
    name: str
    description: Optional[str] = None
