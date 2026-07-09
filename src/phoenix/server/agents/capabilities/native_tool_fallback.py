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
    """Route unavailable, unfulfilled native tool calls through function-tool handling."""

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

        parts = [
            _as_function_tool_call(part)
            if (
                isinstance(part, NativeToolCallPart)
                and part.tool_name not in available_native_tool_names
                and part.tool_call_id not in fulfilled_native_tool_call_ids
            )
            else part
            for part in response.parts
        ]
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
