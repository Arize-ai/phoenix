import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import PromptOutputSchema


@strawberry.type
class OutputSchema:
    """A JSON schema definition used to guide an LLM's output"""

    definition: JSON


def to_gql_output_schema_from_pydantic(pydantic_output_schema: PromptOutputSchema) -> OutputSchema:
    return OutputSchema(**pydantic_output_schema.dict())
