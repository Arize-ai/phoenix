"""OpenAI Responses API streaming constants.

We centralize streaming event type strings here so the client implementation
doesn't hard-code them throughout the control flow.

Docs:
- https://platform.openai.com/docs/api-reference/responses-streaming
"""

from enum import StrEnum

class OpenAIResponsesStreamEventType(StrEnum):
    """Responses API server-sent streaming event types."""

    # Completion streaming
    COMPLETED = "response.completed"
    FAILED = "response.failed"
    INCOMPLETE = "response.incomplete"

    # Text streaming
    OUTPUT_TEXT_DELTA = "response.output_text.delta"
    OUTPUT_TEXT_DONE = "response.output_text.done"

    # Output item streaming
    OUTPUT_ITEM_ADDED = "response.output_item.added"
    OUTPUT_ITEM_DONE = "response.output_item.done"

    # Function call arguments streaming
    FUNCTION_CALL_ARGUMENTS_DELTA = "response.function_call_arguments.delta"
    FUNCTION_CALL_ARGUMENTS_DONE = "response.function_call_arguments.done"

    # Custom tool call input streaming
    CUSTOM_TOOL_CALL_INPUT_DELTA = "response.custom_tool_call_input.delta"
    CUSTOM_TOOL_CALL_INPUT_DONE = "response.custom_tool_call_input.done"

    # Code interpreter call code streaming
    CODE_INTERPRETER_CALL_CODE_DELTA = "response.code_interpreter_call_code.delta"
    CODE_INTERPRETER_CALL_CODE_DONE = "response.code_interpreter_call_code.done"

    # Image generation call streaming
    IMAGE_GENERATION_CALL_GENERATING = "response.image_generation_call.generating"
    IMAGE_GENERATION_CALL_COMPLETED = "response.image_generation_call.completed"

    # MCP call streaming
    MCP_CALL_ARGUMENTS_DELTA = "response.mcp_call_arguments.delta"
    MCP_CALL_ARGUMENTS_DONE = "response.mcp_call_arguments.done"

    # Web search call streaming
    WEB_SEARCH_CALL_IN_PROGRESS = "response.web_search_call.in_progress"
    WEB_SEARCH_CALL_COMPLETED = "response.web_search_call.completed"


__all__ = ["OpenAIResponsesStreamEventType"]
