"""
Converters from GraphQL input types to normalized experiment config types.

These functions convert denormalized GraphQL inputs (ChatCompletionMessageInput, etc.)
to the normalized Pydantic models used for database storage.

NOTE: This is a stopgap solution. We currently have two input formats:
- ChatCompletionMessageInput (flat structure with content, tool_calls, tool_call_id)
- PromptMessageInput (structured list[ContentPartInput])

These should be unified into a single format. Once unified, this module can be
removed in favor of reusing the conversion logic in PromptVersionInput.py.
"""

from typing import Any, Sequence, cast

from strawberry import UNSET

from phoenix.db.types.experiment_config import (
    PromptVersionConfig,
    TaskConfig,
)
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    ContentPart,
    PromptChatTemplate,
    PromptInvocationParameters,
    PromptMessage,
    PromptResponseFormat,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptTools,
    Role,
    TextContentPart,
    ToolCallContentPart,
    ToolCallFunction,
    ToolResultContentPart,
    normalize_response_format,
    normalize_tools,
    validate_invocation_parameters,
)
from phoenix.server.api.input_types.ChatCompletionMessageInput import ChatCompletionMessageInput
from phoenix.server.api.input_types.InvocationParameters import InvocationParameterInput
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


def messages_to_prompt_template(
    messages: list[ChatCompletionMessageInput],
) -> PromptChatTemplate:
    """
    Convert ChatCompletionMessageInput list to PromptChatTemplate.

    Mirrors the conversion in PromptVersionInput.to_pydantic_prompt_chat_template_v1
    but handles the ChatCompletionMessageInput format.
    """
    prompt_messages = [_convert_message(msg) for msg in messages]
    return PromptChatTemplate(type="chat", messages=prompt_messages)


def _convert_message(msg: ChatCompletionMessageInput) -> PromptMessage:
    """
    Convert a single ChatCompletionMessageInput to PromptMessage.

    Handles:
    - String content → TextContentPart
    - Tool role with tool_call_id → ToolResultContentPart
    - Assistant messages with tool_calls → ToolCallContentPart entries
    """
    role = _convert_role(msg.role)
    content_parts: list[ContentPart] = []

    # Handle tool result messages (tool role with tool_call_id)
    if msg.role == ChatCompletionMessageRole.TOOL and msg.tool_call_id not in (None, UNSET):
        content_parts.append(
            ToolResultContentPart(
                type="tool_result",
                tool_call_id=msg.tool_call_id,
                tool_result=msg.content,
            )
        )
    else:
        # Convert content to TextContentPart
        if msg.content is not None:
            text = msg.content if isinstance(msg.content, str) else str(msg.content)
            if text:
                content_parts.append(TextContentPart(type="text", text=text))

    # Handle tool calls (typically on assistant messages)
    if msg.tool_calls not in (None, UNSET) and msg.tool_calls:
        for tool_call in msg.tool_calls:
            if isinstance(tool_call, dict):
                content_parts.append(_convert_tool_call(tool_call))

    # Return with content parts list, or string if simple text-only
    if len(content_parts) == 1 and isinstance(content_parts[0], TextContentPart):
        # Optimization: use string content for simple text-only messages
        return PromptMessage(role=role, content=content_parts[0].text)

    return PromptMessage(role=role, content=content_parts if content_parts else "")


def _convert_tool_call(tool_call: dict[str, Any]) -> ToolCallContentPart:
    """Convert an OpenAI-format tool call dict to ToolCallContentPart."""
    tool_call_id = tool_call.get("id", "")
    function_info = tool_call.get("function", {})
    return ToolCallContentPart(
        type="tool_call",
        tool_call_id=tool_call_id,
        tool_call=ToolCallFunction(
            type="function",
            name=function_info.get("name", ""),
            arguments=function_info.get("arguments", "{}"),
        ),
    )


def _convert_role(role: ChatCompletionMessageRole) -> Role:
    """Convert GraphQL ChatCompletionMessageRole enum to normalized Role."""
    role_map: dict[ChatCompletionMessageRole, Role] = {
        ChatCompletionMessageRole.USER: "user",
        ChatCompletionMessageRole.AI: "ai",
        ChatCompletionMessageRole.SYSTEM: "system",
        ChatCompletionMessageRole.TOOL: "tool",
    }
    return role_map.get(role, "user")


def invocation_parameters_to_prompt(
    params: Sequence[InvocationParameterInput],
    provider: ModelProvider,
) -> "PromptInvocationParameters | None":
    """
    Convert InvocationParameterInput list to provider-specific PromptInvocationParameters.
    Reuses validate_invocation_parameters from prompts/models.py.
    """
    if not params:
        return None

    # Tool-related and response_format params are handled separately, not in invocation parameters
    excluded_params = {"tool_choice", "tools", "parallel_tool_calls", "response_format"}

    param_dict: dict[str, Any] = {}
    for p in params:
        if p.invocation_name in excluded_params:
            continue  # Skip params handled elsewhere
        value = _extract_param_value(p)
        if value is not None:
            param_dict[p.invocation_name] = value

    if not param_dict:
        return None

    return validate_invocation_parameters(param_dict, provider)


def _extract_param_value(param: InvocationParameterInput) -> Any:
    """Extract the actual value from an InvocationParameterInput."""
    if param.value_json is not None and param.value_json is not UNSET:
        return param.value_json
    if param.value_int is not None and param.value_int is not UNSET:
        return param.value_int
    if param.value_float is not None and param.value_float is not UNSET:
        return param.value_float
    if param.value_bool is not None and param.value_bool is not UNSET:
        return param.value_bool
    if param.value_boolean is not None and param.value_boolean is not UNSET:
        return param.value_boolean
    if param.value_string is not None and param.value_string is not UNSET:
        return param.value_string
    if param.value_string_list is not None and param.value_string_list is not UNSET:
        return param.value_string_list
    return None


def tools_to_prompt_tools(
    tools: list[dict[str, Any]] | None,
    provider: ModelProvider,
    tool_choice: str | dict[str, Any] | None = None,
) -> PromptTools | None:
    """
    Convert tool definitions to PromptTools.
    Reuses normalize_tools from prompts/models.py.
    """
    if not tools:
        return None
    return normalize_tools(tools, provider, tool_choice=tool_choice)


def create_task_config(
    messages: list[ChatCompletionMessageInput],
    template_format: PromptTemplateFormat,
    template_variables_path: str | None,
    invocation_parameters: Sequence[InvocationParameterInput],
    tools: list[dict[str, Any]] | None,
    model_provider: ModelProvider,
    model_name: str,
    custom_provider_id: int | None = None,
    appended_messages_path: str | None = None,
) -> TaskConfig:
    """
    Create a TaskConfig from GraphQL inputs.
    Main entry point for converting to normalized DB storage format.
    """
    # Extract tool_choice and response_format from invocation parameters
    # (they're handled in their own config fields, not as invocation parameters)
    tool_choice = _extract_tool_choice(invocation_parameters)
    response_format = _extract_response_format(invocation_parameters, model_provider)

    # Build prompt version config (mirrors models.PromptVersion structure)
    prompt_version = PromptVersionConfig(
        template_type=PromptTemplateType.CHAT,  # Chat template from messages
        template_format=template_format,
        template=messages_to_prompt_template(messages),
        model_provider=model_provider,
        model_name=model_name,
        invocation_parameters=invocation_parameters_to_prompt(
            invocation_parameters, model_provider
        ),
        tools=tools_to_prompt_tools(tools, model_provider, tool_choice=tool_choice),
        response_format=response_format,
        custom_provider_id=custom_provider_id,
    )

    return TaskConfig(
        prompt_version=prompt_version,
        template_variables_path=template_variables_path,
        appended_messages_path=appended_messages_path,
    )


def _extract_tool_choice(
    params: Sequence[InvocationParameterInput],
) -> str | dict[str, Any] | None:
    """Extract tool_choice from invocation parameters."""
    for p in params:
        if p.invocation_name == "tool_choice":
            value = _extract_param_value(p)
            if value is not None:
                return cast(str | dict[str, Any], value)
    return None


def _extract_response_format(
    params: Sequence[InvocationParameterInput],
    provider: ModelProvider,
) -> PromptResponseFormat | None:
    """Extract and normalize response_format from invocation parameters."""
    for p in params:
        if p.invocation_name == "response_format":
            value = _extract_param_value(p)
            if value is not None and isinstance(value, dict):
                try:
                    return normalize_response_format(value, provider)
                except (ValueError, Exception):
                    # If normalization fails, skip response_format
                    return None
    return None
