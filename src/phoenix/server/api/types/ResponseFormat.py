import strawberry
from strawberry.scalars import JSON


@strawberry.type
class ResponseFormat:
    """A JSON schema definition used to guide an LLM's output"""

    definition: JSON
