from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Union

from openinference.instrumentation import (
    PromptDetails,
    TokenCount,
    get_input_attributes,
    get_llm_attributes,
    get_metadata_attributes,
    get_output_attributes,
    get_span_kind_attributes,
    safe_json_dumps,
)
from openinference.instrumentation._types import Message, Tool, ToolCall
from openinference.semconv.trace import (
    OpenInferenceLLMProviderValues,
    OpenInferenceLLMSystemValues,
    OpenInferenceMimeTypeValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry import context as context_api
from opentelemetry.trace import Status, StatusCode, Tracer
from pydantic_ai import RunContext
from pydantic_ai._instrumentation import get_instructions
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    NativeToolCallPart,
    NativeToolReturnPart,
    RetryPromptPart,
    SystemPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import Model, ModelRequestParameters, StreamedResponse
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.settings import ModelSettings
from pydantic_ai.usage import RequestUsage

_PROVIDERS_BY_VALUE: dict[str, OpenInferenceLLMProviderValues] = {
    p.value: p for p in OpenInferenceLLMProviderValues
}
_SYSTEMS_BY_VALUE: dict[str, OpenInferenceLLMSystemValues] = {
    s.value: s for s in OpenInferenceLLMSystemValues
}


@dataclass(init=False)
class OpenInferenceModelWrapper(WrapperModel):
    """Pydantic-ai ``Model`` wrapper that emits OpenInference ``LLM`` spans.

    Wraps both ``request`` and ``request_stream`` with a single span carrying
    OpenInference attributes derived from the pydantic-ai request/response
    using the ``openinference.instrumentation.get_llm_attributes`` helper.
    """

    tracer: Tracer

    def __init__(self, wrapped: Model, *, tracer: Tracer) -> None:
        super().__init__(wrapped)
        self.tracer = tracer

    async def request(
        self,
        messages: list[ModelMessage],
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> ModelResponse:
        with self._span(
            messages=messages,
            model_settings=model_settings,
            model_request_parameters=model_request_parameters,
        ) as set_response:
            response = await super().request(messages, model_settings, model_request_parameters)
            set_response(response)
            return response

    @asynccontextmanager
    async def request_stream(
        self,
        messages: list[ModelMessage],
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
        run_context: RunContext[Any] | None = None,
    ) -> AsyncIterator[StreamedResponse]:
        with self._span(
            messages=messages,
            model_settings=model_settings,
            model_request_parameters=model_request_parameters,
        ) as set_response:
            stream: StreamedResponse | None = None
            try:
                async with super().request_stream(
                    messages,
                    model_settings,
                    model_request_parameters,
                    run_context,
                ) as stream:
                    yield stream
            finally:
                if stream is not None:
                    set_response(stream.get())

    @contextmanager
    def _span(
        self,
        *,
        messages: list[ModelMessage],
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> Iterator[Callable[[ModelResponse], None]]:
        input_messages: list[Message] = []
        instructions = get_instructions(messages, model_request_parameters)
        if instructions:
            input_messages.append(Message(role="system", content=instructions))
        for msg in messages:
            if isinstance(msg, ModelRequest):
                input_messages.extend(_request_to_oi_messages(msg))
            elif isinstance(msg, ModelResponse):
                input_messages.append(_response_to_oi_message(msg))
        invocation_parameters = dict(model_settings) if model_settings is not None else None
        tools = _to_oi_tools(model_request_parameters)
        input_value = {
            "messages": messages,
            "model_settings": model_settings,
            "model_request_parameters": model_request_parameters,
        }
        parent_context = context_api.get_current()
        attributes = {
            **get_span_kind_attributes("llm"),
            **get_llm_attributes(
                provider=_to_oi_provider(self.system),
                system=_to_oi_system(self.system),
                model_name=self.model_name,
                invocation_parameters=invocation_parameters,
                input_messages=input_messages,
                tools=tools or None,
            ),
            **get_input_attributes(
                input_value,
                mime_type=OpenInferenceMimeTypeValues.JSON,
            ),
        }
        with self.tracer.start_as_current_span(
            name=self.model_name,
            attributes=attributes,
        ) as span:

            def set_response(response: ModelResponse) -> None:
                self._emit_native_tool_spans(
                    response=response,
                    parent_context=parent_context,
                )
                span.set_attributes(
                    {
                        **get_llm_attributes(
                            output_messages=[_response_to_oi_message(response)],
                            token_count=_to_oi_token_count(response.usage),
                        ),
                        **get_output_attributes(response),
                    }
                )

            yield set_response
            span.set_status(Status(StatusCode.OK))

    def _emit_native_tool_spans(
        self,
        *,
        response: ModelResponse,
        parent_context: context_api.Context,
    ) -> None:
        """Emit TOOL spans for provider-executed native tools.

        Native tools, such as provider-side web search, do not flow through the
        local toolset wrapper. Pydantic AI records them as model response parts,
        so synthesize TOOL spans as soon as each model response is observed.
        """
        calls_by_id: dict[str, NativeToolCallPart] = {}
        returns_by_id: dict[str, NativeToolReturnPart] = {}
        for part in response.parts:
            if isinstance(part, NativeToolCallPart):
                calls_by_id[part.tool_call_id] = part
            elif isinstance(part, NativeToolReturnPart):
                returns_by_id[part.tool_call_id] = part

        for tool_call_id, call_part in calls_by_id.items():
            self._emit_native_tool_span(
                call_part=call_part,
                return_part=returns_by_id.get(tool_call_id),
                parent_context=parent_context,
                fallback_timestamp=response.timestamp,
            )

    def _emit_native_tool_span(
        self,
        *,
        call_part: NativeToolCallPart,
        return_part: NativeToolReturnPart | None,
        parent_context: context_api.Context,
        fallback_timestamp: datetime,
    ) -> None:
        metadata = {
            "native_tool": {
                "provider_name": call_part.provider_name,
                "provider_details": call_part.provider_details,
                "tool_kind": call_part.tool_kind,
            }
        }
        attributes: dict[str, Any] = {
            **get_span_kind_attributes("tool"),
            SpanAttributes.TOOL_NAME: call_part.tool_name,
            **get_input_attributes(
                call_part.args_as_dict(),
                mime_type=OpenInferenceMimeTypeValues.JSON,
            ),
            **get_metadata_attributes(metadata=metadata),
            ToolCallAttributes.TOOL_CALL_ID: call_part.tool_call_id,
        }
        if return_part is not None:
            attributes.update(get_output_attributes(return_part.content))
        span_timestamp = _to_unix_nano(
            return_part.timestamp if return_part is not None else fallback_timestamp
        )
        span = self.tracer.start_span(
            name=call_part.tool_name,
            context=parent_context,
            attributes=attributes,
            start_time=span_timestamp,
        )
        try:
            if return_part is None or return_part.outcome == "success":
                span.set_status(Status(StatusCode.OK))
                return
            error_message = (
                str(return_part.content) if return_part.content is not None else return_part.outcome
            )
            span.record_exception(Exception(error_message))
            span.set_status(
                Status(StatusCode.ERROR, f"native tool {return_part.outcome}: {error_message}")
            )
        finally:
            span.end(end_time=span_timestamp)


def _to_oi_provider(
    pydantic_system: str | None,
) -> Union[OpenInferenceLLMProviderValues, str, None]:
    if pydantic_system is None:
        return None
    return _PROVIDERS_BY_VALUE.get(pydantic_system.lower(), pydantic_system)


def _to_oi_system(
    pydantic_system: str | None,
) -> Union[OpenInferenceLLMSystemValues, str, None]:
    if pydantic_system is None:
        return None
    return _SYSTEMS_BY_VALUE.get(pydantic_system.lower(), pydantic_system)


def _to_unix_nano(timestamp: datetime) -> int:
    return int(timestamp.timestamp() * 1_000_000_000)


def _to_oi_messages(messages: list[ModelMessage]) -> list[Message]:
    out: list[Message] = []
    for msg in messages:
        if isinstance(msg, ModelRequest):
            out.extend(_request_to_oi_messages(msg))
        elif isinstance(msg, ModelResponse):
            out.append(_response_to_oi_message(msg))
    return out


def _request_to_oi_messages(msg: ModelRequest) -> list[Message]:
    out: list[Message] = []
    for part in msg.parts:
        if isinstance(part, SystemPromptPart):
            out.append({"role": "system", "content": part.content})
        elif isinstance(part, UserPromptPart):
            out.append(_user_part_to_oi_message(part))
        elif isinstance(part, ToolReturnPart):
            content = (
                part.content if isinstance(part.content, str) else safe_json_dumps(part.content)
            )
            out.append(
                {
                    "role": "tool",
                    "tool_call_id": part.tool_call_id,
                    "content": content,
                }
            )
        elif isinstance(part, RetryPromptPart):
            content = (
                part.content if isinstance(part.content, str) else safe_json_dumps(part.content)
            )
            out.append({"role": "user", "content": content})
    return out


def _user_part_to_oi_message(part: UserPromptPart) -> Message:
    if isinstance(part.content, str):
        return {"role": "user", "content": part.content}
    contents: list[Any] = []
    for piece in part.content:
        if isinstance(piece, str):
            contents.append({"type": "text", "text": piece})
        else:
            contents.append({"type": "text", "text": safe_json_dumps(piece)})
    return {"role": "user", "contents": contents}


def _response_to_oi_message(msg: ModelResponse) -> Message:
    text_chunks: list[str] = []
    tool_calls: list[ToolCall] = []
    for part in msg.parts:
        if isinstance(part, TextPart):
            text_chunks.append(part.content)
        elif isinstance(part, (ToolCallPart, NativeToolCallPart)):
            arguments: Union[str, dict[str, Any]]
            if isinstance(part.args, dict):
                arguments = part.args
            elif isinstance(part.args, str):
                arguments = part.args
            else:
                arguments = {}
            tool_calls.append(
                {
                    "id": part.tool_call_id,
                    "function": {"name": part.tool_name, "arguments": arguments},
                }
            )
    entry: Message = {"role": "assistant"}
    if text_chunks:
        entry["content"] = "".join(text_chunks)
    if tool_calls:
        entry["tool_calls"] = tool_calls
    return entry


def _to_oi_tools(params: ModelRequestParameters) -> list[Tool]:
    tools: list[Tool] = []
    for tool_def in params.function_tools or []:
        schema: dict[str, Any] = {**tool_def.parameters_json_schema}
        schema.setdefault("title", tool_def.name)
        if tool_def.description:
            schema.setdefault("description", tool_def.description)
        tools.append({"json_schema": schema})
    return tools


def _to_oi_token_count(usage: RequestUsage) -> TokenCount:
    token_count: TokenCount = {
        "prompt": usage.input_tokens,
        "completion": usage.output_tokens,
        "total": usage.input_tokens + usage.output_tokens,
    }
    details: PromptDetails = {}
    if usage.input_audio_tokens:
        details["audio"] = usage.input_audio_tokens
    if usage.cache_read_tokens:
        details["cache_read"] = usage.cache_read_tokens
    if usage.cache_write_tokens:
        details["cache_write"] = usage.cache_write_tokens
    if details:
        token_count["prompt_details"] = details
    return token_count
