import strawberry
from strawberry.scalars import JSON


@strawberry.type
class JSONSchema:
    """A JSON schema definition used to guide an LLM's output"""

    schema: JSON
