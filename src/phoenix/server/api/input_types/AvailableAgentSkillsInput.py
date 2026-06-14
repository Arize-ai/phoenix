import strawberry


@strawberry.input(
    description=(
        "Inputs that determine which assistant skills are available given the current "
        "state of the UI."
    )
)
class AvailableAgentSkillsInput:
    has_playground_context: bool = strawberry.field(
        default=False,
        description="Whether a playground instance is mounted in the current UI context.",
    )
    has_dataset_context: bool = strawberry.field(
        default=False,
        description="Whether a dataset is mounted in the current UI context.",
    )
    has_llm_evaluator_context: bool = strawberry.field(
        default=False,
        description="Whether an LLM evaluator is mounted in the current UI context.",
    )
    has_code_evaluator_context: bool = strawberry.field(
        default=False,
        description="Whether a code evaluator is mounted in the current UI context.",
    )
