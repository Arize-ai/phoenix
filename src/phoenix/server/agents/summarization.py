from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic_ai.messages import (
    InstructionPart,
    ModelMessage,
    ToolCallPart,
)
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.exceptions import CompactionError, SummarizationError
from phoenix.server.agents.prompts import (
    COMPACTION_INSTRUCTIONS_TEMPLATE,
    COMPACTION_MESSAGE_TEMPLATE,
    SUMMARIZATION_INSTRUCTIONS_TEMPLATE,
)

SUMMARY_TOOL_NAME = "summary"
COMPACTION_TOOL_NAME = "conversation_checkpoint"


class _Summary(BaseModel):
    summary: str


SUMMARY_TOOL_DEFINITION = ToolDefinition(
    name=SUMMARY_TOOL_NAME,
    description="Provide the conversation title.",
    parameters_json_schema=_Summary.model_json_schema(),
)


class _ConversationCheckpoint(BaseModel):
    objectives: list[str] = Field(description="The user's current goals.")
    constraints_and_preferences: list[str] = Field(
        description="User requirements, constraints, and preferences that remain relevant."
    )
    decisions: list[str] = Field(description="Decisions made and their rationale when known.")
    completed_work: list[str] = Field(description="Completed work and verified findings.")
    active_work: list[str] = Field(description="Work currently in progress.")
    blockers: list[str] = Field(description="Unresolved blockers, failures, and unknowns.")
    next_steps: list[str] = Field(description="Concrete next actions.")
    important_details: list[str] = Field(
        description="Exact identifiers, URLs, filters, commands, errors, and other durable context."
    )


COMPACTION_TOOL_DEFINITION = ToolDefinition(
    name=COMPACTION_TOOL_NAME,
    description="Provide a durable conversation checkpoint for a future assistant.",
    parameters_json_schema=_ConversationCheckpoint.model_json_schema(),
)


async def summarize_messages(
    *,
    messages: list[ModelMessage],
    model: Model,
) -> str | None:
    request_params = ModelRequestParameters(
        function_tools=[],
        output_tools=[SUMMARY_TOOL_DEFINITION],
        output_mode="tool",
        allow_text_output=False,
        instruction_parts=[
            InstructionPart(content=SUMMARIZATION_INSTRUCTIONS_TEMPLATE.render(), dynamic=False),
        ],
    )
    try:
        response = await model.request(
            [*messages],
            model_settings=None,
            model_request_parameters=request_params,
        )
    except Exception as exc:
        raise SummarizationError(str(exc)) from exc
    for part in response.parts:
        if isinstance(part, ToolCallPart) and part.tool_name == SUMMARY_TOOL_NAME:
            try:
                return _Summary.model_validate(part.args_as_dict()).summary.strip() or None
            except Exception as exc:
                raise SummarizationError(f"invalid summary tool arguments: {exc}") from exc
    raise SummarizationError("model did not call the summary tool")


async def summarize_messages_for_compaction(
    *,
    messages: list[ModelMessage],
    model: Model,
) -> str:
    """Create a provider-neutral checkpoint from historical messages."""
    request_params = ModelRequestParameters(
        function_tools=[],
        output_tools=[COMPACTION_TOOL_DEFINITION],
        output_mode="tool",
        allow_text_output=False,
        instruction_parts=[
            InstructionPart(content=COMPACTION_INSTRUCTIONS_TEMPLATE.render(), dynamic=False),
        ],
    )
    try:
        response = await model.request(
            messages,
            model_settings=None,
            model_request_parameters=request_params,
        )
    except Exception as exc:
        raise CompactionError(str(exc)) from exc
    for part in response.parts:
        if isinstance(part, ToolCallPart) and part.tool_name == COMPACTION_TOOL_NAME:
            try:
                checkpoint = _ConversationCheckpoint.model_validate(part.args_as_dict())
            except Exception as exc:
                raise CompactionError(f"invalid compaction tool arguments: {exc}") from exc
            return COMPACTION_MESSAGE_TEMPLATE.render(
                checkpoint={
                    key: [item.strip() for item in items if item.strip()]
                    for key, items in checkpoint.model_dump().items()
                }
            ).strip()
    raise CompactionError("model did not call the conversation checkpoint tool")
