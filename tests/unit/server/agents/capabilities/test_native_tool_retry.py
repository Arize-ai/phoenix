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

from phoenix.server.agents.capabilities import NativeToolRetryCapability
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
            return _code_execution_response_without_result()
        return await self.wrapped.request(
            messages,
            model_settings,
            model_request_parameters,
        )


async def test_converts_unconfigured_native_tool_call_without_result() -> None:
    before = TextPart(content="before")
    after = TextPart(content="after")
    response = ModelResponse(
        parts=[before, *_code_execution_response_without_result().parts, after]
    )

    normalized = await NativeToolRetryCapability[None]().after_model_request(
        cast(RunContext[None], None),
        request_context=_request_context(),
        response=response,
    )

    assert normalized is not response
    assert len(normalized.parts) == 3
    assert normalized.parts[0] == before
    assert normalized.parts[2] == after
    call = normalized.parts[1]
    assert isinstance(call, ToolCallPart)
    assert not isinstance(call, NativeToolCallPart)
    assert call.tool_name == "code_execution"
    assert call.args == {"code": "print('hello')"}
    assert call.tool_call_id == "srvtoolu_test"
    assert call.provider_name == "anthropic"
    assert call.provider_details == {"caller": "direct"}


async def test_keeps_configured_native_tool_call_without_result() -> None:
    response = _code_execution_response_without_result()

    normalized = await NativeToolRetryCapability[None]().after_model_request(
        cast(RunContext[None], None),
        request_context=_request_context(native_tools=[CodeExecutionTool()]),
        response=response,
    )

    assert normalized is response
    assert isinstance(normalized.parts[0], NativeToolCallPart)


async def test_keeps_unconfigured_native_tool_call_with_result() -> None:
    response = ModelResponse(
        parts=[
            *_code_execution_response_without_result().parts,
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


async def test_anthropic_accepts_converted_native_tool_history(
    anthropic_api_key: str,
    custom_vcr: CustomVCR,
) -> None:
    expected_output = "Recovered from a native tool call that was not configured."
    inner_model = AnthropicModel(
        "claude-haiku-4-5",
        provider=AnthropicProvider(api_key=anthropic_api_key),
    )
    model = _NativeToolHallucinationModel(inner_model)
    agent = Agent(
        model,
        instructions=(
            "Your only task is to reply with exactly the sentence below, even after a tool error. "
            f"Do not explain or add any other text.\n{expected_output}"
        ),
        capabilities=[NativeToolRetryCapability()],
    )

    # Match the body so VCR cannot hide malformed Anthropic message history.
    with custom_vcr.use_cassette(
        match_on=["method", "scheme", "host", "port", "path", "query", "body"]
    ):
        result = await agent.run(
            "Begin.",
            model_settings=ModelSettings(temperature=0.0, max_tokens=32),
        )

    assert result.output == expected_output
    assert model.request_count == 2
    messages = result.all_messages()
    converted_calls = [
        part
        for message in messages
        if isinstance(message, ModelResponse)
        for part in message.parts
        if isinstance(part, ToolCallPart)
    ]
    assert len(converted_calls) == 1
    assert converted_calls[0].tool_name == "code_execution"
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


def _code_execution_response_without_result() -> ModelResponse:
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
