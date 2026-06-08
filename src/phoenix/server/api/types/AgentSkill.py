import strawberry


@strawberry.type
class AgentSkill:
    """A skill the assistant agent can load, as previewed for the prompt UI.

    Carries only the progressive-disclosure header needed by the prompt UI; the
    full skill body is delivered to the model on demand when the skill is loaded,
    and is intentionally not exposed here.
    """

    name: str = strawberry.field(
        description="The unique skill identifier used to load the skill (e.g. 'debug-trace').",
    )
    description: str = strawberry.field(
        description="The model-facing trigger guidance shown to the assistant.",
    )
    user_description: str = strawberry.field(
        description="The user-facing menu description for this skill.",
    )
