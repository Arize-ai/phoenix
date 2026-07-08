from __future__ import annotations

from pydantic import BaseModel
from pydantic_ai.messages import (
    InstructionPart,
    ModelMessage,
    ModelRequest,
    ToolCallPart,
    UserPromptPart,
)
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.exceptions import SummarizationError
from phoenix.server.agents.prompts import SUMMARIZATION_INSTRUCTIONS_TEMPLATE

SUMMARY_TOOL_NAME = "summary"


class Summary(BaseModel):
    summary: str


SUMMARY_TOOL_DEFINITION = ToolDefinition(
    name=SUMMARY_TOOL_NAME,
    description="Provide the conversation title.",
    parameters_json_schema=Summary.model_json_schema(),
)


async def summarize_messages(
    *,
    messages: list[ModelMessage],
    model: Model,
) -> Summary:
    request_params = ModelRequestParameters(
        function_tools=[],
        output_tools=[SUMMARY_TOOL_DEFINITION],
        output_mode="tool",
        allow_text_output=False,
        instruction_parts=[
            InstructionPart(content=SUMMARIZATION_INSTRUCTIONS_TEMPLATE.render(), dynamic=False),
        ],
    )
    final_request = ModelRequest(
        parts=[UserPromptPart(content="Summarize this conversation.")],
    )
    try:
        response = await model.request(
            [*messages, final_request],
            model_settings=None,
            model_request_parameters=request_params,
        )
    except Exception as exc:
        raise SummarizationError(str(exc)) from exc
    for part in response.parts:
        if isinstance(part, ToolCallPart) and part.tool_name == SUMMARY_TOOL_NAME:
            try:
                return Summary.model_validate(part.args_as_dict())
            except Exception as exc:
                raise SummarizationError(f"invalid summary tool arguments: {exc}") from exc
    raise SummarizationError("model did not call the summary tool")
