from typing import Optional

import strawberry


@strawberry.type
class AgentSkill:
    """A skill the assistant agent can load."""

    name: str = strawberry.field(
        description="The unique skill identifier used to load the skill (e.g. 'debug-trace').",
    )
    description: str = strawberry.field(
        description="The model-facing trigger guidance shown to the assistant.",
    )
    summary: Optional[str] = strawberry.field(
        description=(
            "A short human-facing label for this skill, shown in the skill picker. "
            "Absent when the skill does not define one; `description` is model-facing "
            "trigger guidance and is not a substitute."
        ),
    )
