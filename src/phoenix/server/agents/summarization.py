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

_SUMMARIZATION_SYSTEM_PROMPT_LINES = (
    "<role>",
    "  You generate a short title for a Phoenix chat session. The title",
    "  appears as a sidebar label in a list of conversations - like a tab",
    "  name, not a description of what was said. Call the `summary` tool",
    "  with the title.",
    "</role>",
    "",
    "<rules>",
    "  - 2-6 words. Shorter is better.",
    "  - Either a short noun phrase or a short imperative naming the user's",
    "    task is acceptable.",
    "  - Use sentence case: only the first letter of the title is",
    "    capitalized. Proper nouns and acronyms keep their natural casing.",
    "    Do NOT use Title Case where every major word is capitalized.",
    "  - Do NOT start with a gerund (-ing form). Use the bare imperative",
    "    instead.",
    "  - Phoenix is the implied subject of every conversation, so prefer to",
    '    omit the word "Phoenix" when the title still reads cleanly without',
    "    it. Use it only when the title would be ambiguous or grammatically",
    "    broken otherwise.",
    "  - No quotes, no trailing punctuation.",
    "</rules>",
)

SUMMARIZATION_SYSTEM_PROMPT = "\n".join(_SUMMARIZATION_SYSTEM_PROMPT_LINES)

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
            InstructionPart(content=SUMMARIZATION_SYSTEM_PROMPT, dynamic=False),
        ],
    )
    final_request = ModelRequest(
        parts=[UserPromptPart(content="Summarize this conversation.")],
    )
    response = await model.request(
        [*messages, final_request],
        model_settings=None,
        model_request_parameters=request_params,
    )
    for part in response.parts:
        if isinstance(part, ToolCallPart) and part.tool_name == SUMMARY_TOOL_NAME:
            return Summary.model_validate(part.args_as_dict())
    raise SummarizationError("model did not call the summary tool")
