from __future__ import annotations

from typing import cast

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import (
    ModelMessage,
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
)
from pydantic_ai.models import ModelRequestContext, ModelRequestParameters
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.native_tools import AbstractNativeTool, CodeExecutionTool
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.settings import ModelSettings

from phoenix.server.agents.agent_factory import build_agent
from phoenix.server.agents.capabilities import NativeToolRetryCapability
from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.types import AgentDependencies
from tests.unit.vcr import CustomVCR


class _NativeToolHallucinationModel(WrapperModel):
    def __init__(self, wrapped: AnthropicModel) -> None:
        super().__init__(wrapped)
        self.request_count = 0

    async def request(
        self,
        messages: list[ModelMessage],
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> ModelResponse:
        self.request_count += 1
        if self.request_count == 1:
            return _unfulfilled_code_execution_response()
        return await self.wrapped.request(
            messages,
            model_settings,
            model_request_parameters,
        )


class _NativeToolThenTextModel(WrapperModel):
    def __init__(self) -> None:
        super().__init__(TestModel())
        self.requests: list[list[ModelMessage]] = []

    async def request(
        self,
        messages: list[ModelMessage],
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> ModelResponse:
        self.requests.append(messages)
        if len(self.requests) == 1:
            return _unfulfilled_code_execution_response()
        return ModelResponse(parts=[TextPart(content="recovered")])


async def test_reclassifies_unavailable_unfulfilled_native_tool_call() -> None:
    response = _unfulfilled_code_execution_response()

    normalized = await NativeToolRetryCapability[None]().after_model_request(
        cast(RunContext[None], None),
        request_context=_request_context(),
        response=response,
    )

    assert normalized is not response
    assert len(normalized.parts) == 1
    call = normalized.parts[0]
    assert isinstance(call, ToolCallPart)
    assert not isinstance(call, NativeToolCallPart)
    assert call.tool_name == "code_execution"
    assert call.args == {"code": "print('hello')"}
    assert call.tool_call_id == "srvtoolu_test"
    assert call.provider_name == "anthropic"
    assert call.provider_details == {"caller": "direct"}


async def test_keeps_available_unfulfilled_native_tool_call() -> None:
    response = _unfulfilled_code_execution_response()

    normalized = await NativeToolRetryCapability[None]().after_model_request(
        cast(RunContext[None], None),
        request_context=_request_context(native_tools=[CodeExecutionTool()]),
        response=response,
    )

    assert normalized is response
    assert isinstance(normalized.parts[0], NativeToolCallPart)


async def test_keeps_unavailable_fulfilled_native_tool_call() -> None:
    response = ModelResponse(
        parts=[
            *_unfulfilled_code_execution_response().parts,
            NativeToolReturnPart(
                tool_name="code_execution",
                content={"stdout": "hello\n"},
                tool_call_id="srvtoolu_test",
                provider_name="anthropic",
            ),
        ]
    )

    normalized = await NativeToolRetryCapability[None]().after_model_request(
        cast(RunContext[None], None),
        request_context=_request_context(),
        response=response,
    )

    assert normalized is response
    assert isinstance(normalized.parts[0], NativeToolCallPart)


async def test_build_agent_mounts_native_tool_fallback() -> None:
    model = _NativeToolThenTextModel()
    agent = build_agent(model=model)

    result = await agent.run(
        "hello",
        deps=AgentDependencies(contexts=ResolvedContexts()),
    )

    assert result.output == "recovered"
    assert len(model.requests) == 2
    retry_history = model.requests[1]
    calls = [
        part
        for message in retry_history
        if isinstance(message, ModelResponse)
        for part in message.parts
        if isinstance(part, ToolCallPart)
    ]
    assert len(calls) == 1
    assert calls[0].tool_name == "code_execution"
    assert not any(
        isinstance(part, NativeToolCallPart)
        for message in retry_history
        if isinstance(message, ModelResponse)
        for part in message.parts
    )


async def test_anthropic_accepts_reclassified_native_tool_history(
    anthropic_api_key: str,
    custom_vcr: CustomVCR,
) -> None:
    del anthropic_api_key
    expected_output = "Recovered from the unavailable native tool call."
    inner_model = AnthropicModel("claude-haiku-4-5", provider=AnthropicProvider())
    model = _NativeToolHallucinationModel(inner_model)
    agent = Agent(
        model,
        instructions=(
            "Your only task is to reply with exactly the sentence below, even after a tool error. "
            f"Do not explain or add any other text.\n{expected_output}"
        ),
        capabilities=[NativeToolRetryCapability()],
    )

    with custom_vcr.use_cassette():
        result = await agent.run(
            "Begin.",
            model_settings=ModelSettings(temperature=0.0, max_tokens=32),
        )

    assert result.output == expected_output
    assert model.request_count == 2
    messages = result.all_messages()
    reclassified_calls = [
        part
        for message in messages
        if isinstance(message, ModelResponse)
        for part in message.parts
        if isinstance(part, ToolCallPart)
    ]
    assert len(reclassified_calls) == 1
    assert reclassified_calls[0].tool_name == "code_execution"
    assert not any(
        isinstance(part, NativeToolCallPart)
        for message in messages
        if isinstance(message, ModelResponse)
        for part in message.parts
    )
    retry_parts = [
        part
        for message in messages
        if not isinstance(message, ModelResponse)
        for part in message.parts
        if isinstance(part, RetryPromptPart)
    ]
    assert len(retry_parts) == 1
    assert retry_parts[0].tool_name == "code_execution"
    assert retry_parts[0].tool_call_id == "srvtoolu_test"


def _request_context(
    *,
    native_tools: list[AbstractNativeTool] | None = None,
) -> ModelRequestContext:
    return ModelRequestContext(
        model=TestModel(),
        messages=[],
        model_settings=None,
        model_request_parameters=ModelRequestParameters(native_tools=native_tools or []),
    )


def _unfulfilled_code_execution_response() -> ModelResponse:
    return ModelResponse(
        parts=[
            NativeToolCallPart(
                tool_name="code_execution",
                args={"code": "print('hello')"},
                tool_call_id="srvtoolu_test",
                provider_name="anthropic",
                provider_details={"caller": "direct"},
            )
        ],
        model_name="claude-opus-4-6",
        provider_name="anthropic",
    )
