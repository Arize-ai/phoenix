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

    See https://github.com/pydantic/pydantic-ai/issues/6401 for the upstream issue.
    """

    async def after_model_request(
        self,
        ctx: RunContext[AgentDepsT],
        *,
        request_context: ModelRequestContext,
        response: ModelResponse,
    ) -> ModelResponse:
        configured_native_tool_names = {
            tool.unique_id for tool in request_context.model_request_parameters.native_tools
        }
        native_tool_call_ids_with_results = {
            part.tool_call_id for part in response.parts if isinstance(part, NativeToolReturnPart)
        }

        parts = []
        for part in response.parts:
            if isinstance(part, NativeToolCallPart):
                is_configured = part.tool_name in configured_native_tool_names
                has_result = part.tool_call_id in native_tool_call_ids_with_results
                if not is_configured and not has_result:
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
