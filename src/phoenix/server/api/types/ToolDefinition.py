import strawberry
from strawberry.scalars import JSON

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.helpers.prompts.models import PromptToolsV1


@strawberry.type
class ToolDefinition:
    """The definition of a tool that a generative tool can invoke."""

    definition: JSON


def to_gql_tool_definitions_from_orm(orm_prompt_version: ORMPromptVersion) -> list[ToolDefinition]:
    prompt_tools = PromptToolsV1.model_validate(orm_prompt_version.tools)
    return [ToolDefinition(definition=tool) for tool in prompt_tools]
