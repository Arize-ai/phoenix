from __future__ import annotations

from dataclasses import dataclass, replace

from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.messages import (
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    ToolCallPart,
)
from pydantic_ai.models import ModelRequestContext
from pydantic_ai.tools import AgentDepsT


@dataclass
class NativeToolRetryCapability(AbstractCapability[AgentDepsT]):
    """Recover from hallucinated native tool calls that would produce invalid history.

    A model can call a provider-native tool that was not enabled and return no matching
    native tool result. Pydantic AI replays that unfulfilled call, causing the provider to
    reject the next request. This capability reclassifies the call as a function tool call
    so the standard unknown-tool retry path can give the model valid error feedback.

    See https://github.com/pydantic/pydantic-ai/issues/6401 for the upstream issue.
    """

    async def after_model_request(
        self,
        ctx: RunContext[AgentDepsT],
        *,
        request_context: ModelRequestContext,
        response: ModelResponse,
    ) -> ModelResponse:
        available_native_tool_names = {
            tool.unique_id for tool in request_context.model_request_parameters.native_tools
        }
        fulfilled_native_tool_call_ids = {
            part.tool_call_id for part in response.parts if isinstance(part, NativeToolReturnPart)
        }

        parts = []
        for part in response.parts:
            if isinstance(part, NativeToolCallPart):
                should_retry_as_function_tool = (
                    part.tool_name not in available_native_tool_names
                    and part.tool_call_id not in fulfilled_native_tool_call_ids
                )
                if should_retry_as_function_tool:
                    part = _as_function_tool_call(part)
            parts.append(part)
        return replace(response, parts=parts) if parts != response.parts else response


def _as_function_tool_call(part: NativeToolCallPart) -> ToolCallPart:
    return ToolCallPart(
        tool_name=part.tool_name,
        args=part.args,
        tool_call_id=part.tool_call_id,
        tool_kind=part.tool_kind,
        id=part.id,
        provider_name=part.provider_name,
        provider_details=part.provider_details,
    )
