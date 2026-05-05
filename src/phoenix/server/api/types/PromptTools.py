from __future__ import annotations

from typing import TYPE_CHECKING

import strawberry
from strawberry.scalars import JSON

from phoenix.db.types.db_helper_types import UNDEFINED

from .PromptToolChoice import PromptToolChoice

if TYPE_CHECKING:
    from phoenix.db.types import prompts as orm


@strawberry.type
class PromptToolFunctionDefinition:
    name: str
    description: str | None
    parameters: JSON
    strict: bool | None

    @classmethod
    def from_orm(cls, d: orm.PromptToolFunctionDefinition) -> PromptToolFunctionDefinition:
        return cls(
            name=d.name,
            description=d.description if d.description else None,
            parameters=JSON(d.parameters),
            strict=d.strict if isinstance(d.strict, bool) else None,
        )


@strawberry.type(
    description=(
        "A normalized function tool: a JSON-Schema-typed function the model can "
        "call by name. Phoenix knows the shape of `function` and converts it to "
        "each provider's native function-tool format at request time."
    )
)
class PromptToolFunction:
    function: PromptToolFunctionDefinition

    @classmethod
    def from_orm(cls, t: orm.PromptToolFunction) -> PromptToolFunction:
        return cls(function=PromptToolFunctionDefinition.from_orm(t.function))


@strawberry.type(
    description=(
        "A vendor passthrough tool: an opaque JSON object that Phoenix forwards "
        "to the target provider SDK without normalization. Used for built-in "
        "tools like OpenAI Responses' `web_search`, Anthropic's `computer_use`, "
        "or any provider-specific tool whose shape Phoenix doesn't model."
    )
)
class PromptToolRaw:
    raw: JSON

    @classmethod
    def from_orm(cls, t: orm.PromptToolRaw) -> PromptToolRaw:
        return cls(raw=JSON(t.raw))


@strawberry.type
class PromptTools:
    tools: list[PromptToolFunction | PromptToolRaw]
    tool_choice: PromptToolChoice | None
    disable_parallel_tool_calls: bool | None

    @classmethod
    def from_orm(cls, orm_tools: orm.PromptTools) -> PromptTools:
        tools: list[PromptToolFunction | PromptToolRaw] = [
            PromptToolFunction.from_orm(t) if t.type == "function" else PromptToolRaw.from_orm(t)
            for t in orm_tools.tools
        ]
        tool_choice = (
            PromptToolChoice.from_orm(orm_tools.tool_choice)
            if orm_tools.tool_choice is not UNDEFINED and orm_tools.tool_choice is not None
            else None
        )
        disable_parallel = (
            orm_tools.disable_parallel_tool_calls
            if isinstance(orm_tools.disable_parallel_tool_calls, bool)
            else None
        )
        return cls(
            tools=tools,
            tool_choice=tool_choice,
            disable_parallel_tool_calls=disable_parallel,
        )
