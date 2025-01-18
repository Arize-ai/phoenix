import strawberry
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import PromptJSONSchema


@strawberry.type
class JSONSchema:
    """A JSON schema definition used to guide an LLM's output"""

    definition: JSON


def to_gql_json_schema_from_pydantic(pydantic_json_schema: PromptJSONSchema) -> JSONSchema:
    return JSONSchema(**pydantic_json_schema.dict())
