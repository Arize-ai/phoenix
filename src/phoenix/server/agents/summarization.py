from __future__ import annotations

from dataclasses import replace
from typing import Any, TypeVar, cast

from pydantic import BaseModel, Field, field_validator
from pydantic_ai.messages import (
    BaseToolReturnPart,
    InstructionPart,
    ModelMessage,
    ModelRequest,
    ToolCallPart,
    UserPromptPart,
)
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.exceptions import CompactionError, SummarizationError
from phoenix.server.agents.prompts import (
    COMPACTION_INSTRUCTIONS_TEMPLATE,
    COMPACTION_MESSAGE_TEMPLATE,
    SUMMARIZATION_INSTRUCTIONS_TEMPLATE,
)
from phoenix.server.agents.session_titles import (
    MAX_AGENT_SESSION_TITLE_LENGTH,
    truncate_agent_session_title,
)

SUMMARY_TOOL_NAME = "summary"
COMPACTION_TOOL_NAME = "conversation_checkpoint"

MAX_SUMMARIZED_TOOL_RESULT_LENGTH = 2_000
"""How much of each tool result the summarizer is allowed to see."""

_ToolReturnPartT = TypeVar("_ToolReturnPartT", bound=BaseToolReturnPart)


def _truncate_tool_result(part: _ToolReturnPartT) -> _ToolReturnPartT:
    """Cap a tool result's text, keeping any multimodal files intact."""
    text = part.model_response_str(wrap_if_error=False)
    if len(text) <= MAX_SUMMARIZED_TOOL_RESULT_LENGTH:
        return part
    elided = len(text) - MAX_SUMMARIZED_TOOL_RESULT_LENGTH
    truncated = (
        f"{text[:MAX_SUMMARIZED_TOOL_RESULT_LENGTH]}"
        f"\n[... {elided} characters truncated for summarization]"
    )
    files = part.files
    return replace(part, content=[truncated, *files] if files else truncated)


def _truncate_tool_results(messages: list[ModelMessage]) -> list[ModelMessage]:
    """Return a copy of ``messages`` with every tool result capped in size.

    Tool output is usually the bulk of a session's context and the reason a session needs
    compacting in the first place, but a checkpoint or a title only needs durable facts, so
    the summarizer sees a truncated copy. The persisted history is never modified.
    """
    truncated_messages: list[ModelMessage] = []
    for message in messages:
        parts = [
            _truncate_tool_result(part) if isinstance(part, BaseToolReturnPart) else part
            for part in message.parts
        ]
        if any(new is not old for new, old in zip(parts, message.parts)):
            message = replace(message, parts=cast(Any, parts))
        truncated_messages.append(message)
    return truncated_messages


class _Summary(BaseModel):
    summary: str = Field(max_length=MAX_AGENT_SESSION_TITLE_LENGTH)

    @field_validator("summary", mode="before")
    @classmethod
    def truncate_summary(cls, value: object) -> object:
        return truncate_agent_session_title(value) if isinstance(value, str) else value


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
            InstructionPart(
                content=SUMMARIZATION_INSTRUCTIONS_TEMPLATE.render(
                    max_title_length=MAX_AGENT_SESSION_TITLE_LENGTH
                ),
                dynamic=False,
            ),
        ],
    )
    try:
        response = await model.request(
            [
                *_truncate_tool_results(messages),
                ModelRequest(
                    # Explicitly add user message to support anthropic models that forbid assistant
                    # message prefill
                    parts=[UserPromptPart(content="Create the conversation title now.")]
                ),
            ],
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
            [
                *_truncate_tool_results(messages),
                ModelRequest(
                    # Explicitly add user message to support anthropic models that forbid assistant
                    # message prefill
                    parts=[UserPromptPart(content="Create the conversation checkpoint now.")]
                ),
            ],
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
