"""
OpenAI-compatible chat completions endpoint that proxies to configured LLM providers.

``POST /v1/chat/completions`` speaks the OpenAI chat completions wire format —
request and response bodies, SSE streaming, and ``{"error": {...}}`` payloads —
so any OpenAI client (the openai SDKs, the Vercel AI SDK's ``openai-compatible``
provider, curl) can point its base URL at ``{origin}/v1`` and call the models
Phoenix knows about. Credentials never reach the caller: the ``model`` string
selects a Phoenix model definition and the server resolves the provider
credentials exactly like the agents endpoints do (secret store first, process
environment second) via :func:`phoenix.server.agents.model_factory.build_model`.

The ``model`` string formats:

- ``{provider}:{model_name}`` — a built-in provider, e.g. ``openai:gpt-4o``,
  ``anthropic:claude-sonnet-4-5``, ``ollama:llama3:8b``. The provider segment is
  matched case-insensitively against :class:`ModelProvider`; everything after
  the first colon is the provider's model name, so model names containing
  colons survive intact.
- ``custom:{provider_id}:{model_name}`` — a stored custom provider record,
  where ``provider_id`` is the ``GenerativeModelCustomProvider`` Global ID.

This module deliberately deviates from the v1 ``{"data": ...}`` envelope and
response-model-exclusion conventions: OpenAI compatibility fixes the wire
format, defaults included.
"""

import json
from contextlib import AsyncExitStack
from secrets import token_hex
from typing import Annotated, Any, AsyncIterator, Literal, Optional, Union

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import Field
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import (
    FinishReason,
    ModelMessage,
    ModelRequest,
    PartDeltaEvent,
    PartStartEvent,
    SystemPromptPart,
    TextPart,
    TextPartDelta,
    UserPromptPart,
)
from pydantic_ai.messages import (
    ModelResponse as PydanticAIModelResponse,
)
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.settings import ModelSettings, merge_model_settings
from pydantic_ai.usage import RequestUsage

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import add_errors_to_responses

router = APIRouter(tags=["chat_completions"])

_CUSTOM_PROVIDER_PREFIX = "custom"

_MODEL_FORMAT_HELP = (
    "Model must be '{provider}:{model_name}' for a built-in provider "
    f"(one of {', '.join(sorted(p.value.lower() for p in ModelProvider))}) "
    "or 'custom:{provider_id}:{model_name}' for a stored custom provider, "
    "e.g. 'openai:gpt-4o' or 'anthropic:claude-sonnet-4-5'."
)


class _ChatCompletionError(Exception):
    """Maps directly to an OpenAI-style ``{"error": {...}}`` response."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_type: str = "invalid_request_error",
        code: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.code = code


def _error_response(
    message: str,
    *,
    status_code: int,
    error_type: str,
    code: Optional[str] = None,
) -> JSONResponse:
    return JSONResponse(
        {"error": {"message": message, "type": error_type, "param": None, "code": code}},
        status_code=status_code,
    )


class ChatCompletionTextPart(V1RoutesBaseModel):
    type: Literal["text"]
    text: str


class ChatCompletionRequestMessage(V1RoutesBaseModel):
    role: Literal["system", "developer", "user", "assistant"]
    content: Union[str, list[ChatCompletionTextPart]]


class CreateChatCompletionRequestBody(V1RoutesBaseModel):
    model: str = Field(description=_MODEL_FORMAT_HELP)
    messages: Annotated[list[ChatCompletionRequestMessage], Field(min_length=1)]
    stream: bool = False
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None
    max_completion_tokens: Optional[int] = None
    stop: Optional[Union[str, list[str]]] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    seed: Optional[int] = None
    n: Optional[int] = None
    stream_options: Optional[dict[str, Any]] = None
    tools: Optional[list[Any]] = None
    tool_choice: Optional[Any] = None
    response_format: Optional[dict[str, Any]] = None


class ChatCompletionMessage(V1RoutesBaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


class ChatCompletionChoice(V1RoutesBaseModel):
    index: int = 0
    message: ChatCompletionMessage
    finish_reason: str


class ChatCompletionUsage(V1RoutesBaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletion(V1RoutesBaseModel):
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage


def _parse_model_id(model_id: str) -> AgentModelSelection:
    prefix, sep, remainder = model_id.partition(":")
    if not sep or not prefix or not remainder:
        raise _ChatCompletionError(
            f"Unknown model {model_id!r}. {_MODEL_FORMAT_HELP}",
            status_code=404,
            code="model_not_found",
        )
    if prefix == _CUSTOM_PROVIDER_PREFIX:
        provider_id, sep, model_name = remainder.partition(":")
        if not sep or not provider_id or not model_name:
            raise _ChatCompletionError(
                f"Unknown model {model_id!r}. {_MODEL_FORMAT_HELP}",
                status_code=404,
                code="model_not_found",
            )
        return CustomProviderModelSelection(
            provider_type="custom",
            provider_id=provider_id,
            model_name=model_name,
        )
    try:
        provider = ModelProvider(prefix.upper())
    except ValueError:
        raise _ChatCompletionError(
            f"Unknown model provider {prefix!r} in model {model_id!r}. {_MODEL_FORMAT_HELP}",
            status_code=404,
            code="model_not_found",
        ) from None
    return BuiltInProviderModelSelection(
        provider_type="builtin",
        provider=provider,
        model_name=remainder,
        # This surface *is* a chat completions API; bridge OpenAI through the
        # same API type rather than translating to the Responses API.
        openai_api_type="chat_completions",
    )


def _reject_unsupported_parameters(body: CreateChatCompletionRequestBody) -> None:
    if body.tools or body.tool_choice is not None:
        raise _ChatCompletionError(
            "Tool calling is not supported by this endpoint.",
            status_code=400,
        )
    if body.n is not None and body.n != 1:
        raise _ChatCompletionError("Only n=1 is supported.", status_code=400)
    if body.response_format is not None and body.response_format.get("type", "text") != "text":
        raise _ChatCompletionError(
            "Only response_format of type 'text' is supported.",
            status_code=400,
        )


def _content_to_text(content: Union[str, list[ChatCompletionTextPart]]) -> str:
    if isinstance(content, str):
        return content
    return "".join(part.text for part in content)


def _to_pydantic_ai_messages(
    messages: list[ChatCompletionRequestMessage],
) -> list[ModelMessage]:
    out: list[ModelMessage] = []
    for message in messages:
        text = _content_to_text(message.content)
        if message.role in ("system", "developer"):
            out.append(ModelRequest(parts=[SystemPromptPart(content=text)]))
        elif message.role == "user":
            out.append(ModelRequest(parts=[UserPromptPart(content=text)]))
        else:
            out.append(PydanticAIModelResponse(parts=[TextPart(content=text)]))
    return out


def _to_model_settings(body: CreateChatCompletionRequestBody) -> Optional[ModelSettings]:
    settings: ModelSettings = {}
    if (max_tokens := body.max_completion_tokens or body.max_tokens) is not None:
        settings["max_tokens"] = max_tokens
    if body.temperature is not None:
        settings["temperature"] = body.temperature
    if body.top_p is not None:
        settings["top_p"] = body.top_p
    if body.seed is not None:
        settings["seed"] = body.seed
    if body.frequency_penalty is not None:
        settings["frequency_penalty"] = body.frequency_penalty
    if body.presence_penalty is not None:
        settings["presence_penalty"] = body.presence_penalty
    if body.stop is not None:
        settings["stop_sequences"] = [body.stop] if isinstance(body.stop, str) else body.stop
    return settings or None


def _to_openai_finish_reason(finish_reason: Optional[FinishReason]) -> str:
    # Providers don't always report one; OpenAI clients expect a terminal
    # finish_reason, so default to a normal stop.
    if finish_reason is None or finish_reason == "error":
        return "stop"
    if finish_reason == "tool_call":
        return "tool_calls"
    return finish_reason


def _to_openai_usage(usage: RequestUsage) -> ChatCompletionUsage:
    return ChatCompletionUsage(
        prompt_tokens=usage.input_tokens,
        completion_tokens=usage.output_tokens,
        total_tokens=usage.input_tokens + usage.output_tokens,
    )


def _response_text(response: PydanticAIModelResponse) -> str:
    return "".join(part.content for part in response.parts if isinstance(part, TextPart))


def _completion_id(provider_response_id: Optional[str]) -> str:
    return provider_response_id or f"chatcmpl-{token_hex(12)}"


def _sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"


@router.post(
    "/chat/completions",
    operation_id="createChatCompletion",
    response_model=None,
    responses={
        200: {"model": ChatCompletion},
        **add_errors_to_responses([400, 404, 422]),
    },
    summary="OpenAI-compatible chat completions",
    description=(
        "Creates a chat completion using the OpenAI wire format, proxying to the "
        "selected provider with credentials resolved on the server (secret store "
        "first, environment second) — callers never handle provider API keys. "
        f"{_MODEL_FORMAT_HELP} "
        "Set `stream: true` for server-sent events of `chat.completion.chunk` "
        "payloads terminated by `data: [DONE]`. Tool calling is not supported."
    ),
)
async def create_chat_completion(
    request: Request,
    body: CreateChatCompletionRequestBody,
) -> Response:
    try:
        selection = _parse_model_id(body.model)
        _reject_unsupported_parameters(body)
    except _ChatCompletionError as exc:
        return _error_response(
            str(exc), status_code=exc.status_code, error_type=exc.error_type, code=exc.code
        )
    try:
        # The session is only needed to resolve the model definition and its
        # credentials; release it before any provider call so a slow LLM
        # response never holds a database connection.
        async with request.app.state.db() as session:
            model = await build_model(
                selection,
                session=session,
                decrypt=request.app.state.decrypt,
            )
    except AgentError as exc:
        return _error_response(
            str(exc),
            status_code=exc.status_code,
            error_type="invalid_request_error" if exc.status_code < 500 else "api_error",
        )
    messages = _to_pydantic_ai_messages(body.messages)
    # Honor settings attached to the model itself (e.g. the Anthropic
    # max_tokens floor) the same way an agent run would.
    settings = merge_model_settings(model.settings, _to_model_settings(body))
    parameters = ModelRequestParameters()
    if body.stream:
        return await _create_streaming_response(
            model=model,
            messages=messages,
            settings=settings,
            parameters=parameters,
            model_id=body.model,
        )
    try:
        response = await model.request(messages, settings, parameters)
    except ModelHTTPError as exc:
        return _provider_error_response(exc)
    completion = ChatCompletion(
        id=_completion_id(response.provider_response_id),
        created=int(response.timestamp.timestamp()),
        model=body.model,
        choices=[
            ChatCompletionChoice(
                message=ChatCompletionMessage(content=_response_text(response)),
                finish_reason=_to_openai_finish_reason(response.finish_reason),
            )
        ],
        usage=_to_openai_usage(response.usage),
    )
    return JSONResponse(completion.model_dump())


def _provider_error_response(exc: ModelHTTPError) -> JSONResponse:
    # Surface the provider's own status when it is a valid HTTP error code so
    # callers can tell a bad model name (404) from bad server credentials (401).
    status_code = exc.status_code if 400 <= exc.status_code < 600 else 502
    return _error_response(
        str(exc),
        status_code=status_code,
        error_type="invalid_request_error" if status_code < 500 else "api_error",
    )


async def _create_streaming_response(
    *,
    model: Model,
    messages: list[ModelMessage],
    settings: Optional[ModelSettings],
    parameters: ModelRequestParameters,
    model_id: str,
) -> Response:
    stack = AsyncExitStack()
    try:
        # Enter the stream before responding so connection and auth failures
        # surface as proper HTTP errors instead of a 200 that errors mid-body.
        stream = await stack.enter_async_context(
            model.request_stream(messages, settings, parameters)
        )
    except ModelHTTPError as exc:
        await stack.aclose()
        return _provider_error_response(exc)
    except BaseException:
        await stack.aclose()
        raise

    completion_id = _completion_id(stream.provider_response_id)
    created = int(stream.timestamp.timestamp())

    def chunk(delta: dict[str, Any], finish_reason: Optional[str] = None) -> str:
        return _sse_event(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model_id,
                "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
            }
        )

    async def stream_chunks() -> AsyncIterator[str]:
        try:
            yield chunk({"role": "assistant", "content": ""})
            async for event in stream:
                text: Optional[str] = None
                if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
                    text = event.part.content
                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    text = event.delta.content_delta
                if text:
                    yield chunk({"content": text})
            yield _sse_event(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model_id,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {},
                            "finish_reason": _to_openai_finish_reason(stream.finish_reason),
                        }
                    ],
                    "usage": _to_openai_usage(stream.usage).model_dump(),
                }
            )
        except Exception as exc:
            # The 200 header is already on the wire — surface the failure as an
            # OpenAI-style error event rather than severing the connection.
            yield _sse_event({"error": {"message": str(exc), "type": "api_error"}})
        finally:
            await stack.aclose()
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_chunks(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
