import strawberry
from strawberry.scalars import JSON


@strawberry.type
class ToolDefinition:
    """The definition of a tool that a generative tool can invoke."""

    definition: JSON
