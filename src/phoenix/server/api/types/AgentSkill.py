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
    summary: str = strawberry.field(
        description="The summary for this skill.",
    )
