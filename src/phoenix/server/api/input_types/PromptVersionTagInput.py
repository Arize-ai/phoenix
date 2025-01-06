from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID


@strawberry.input
class CreatePromptVersionTagInput:
    """Fields required to create a PromptVersionTag."""

    name: str
    description: Optional[str] = None
    prompt_id: GlobalID


@strawberry.input
class PatchPromptVersionTagInput:
    """Fields that can be updated on a PromptVersionTag."""

    version_tag_id: GlobalID
    name: Optional[str] = UNSET
    description: Optional[str] = UNSET
