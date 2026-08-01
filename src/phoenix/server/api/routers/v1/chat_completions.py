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

import asyncio
import json
import logging
from secrets import token_hex
from typing import Annotated, Any, AsyncIterator, Callable, Coroutine, Literal, Optional, Union

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.routing import APIRoute
from pydantic import Field
from pydantic_ai.exceptions import ModelAPIError, ModelHTTPError
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
from pydantic_ai.models import Model, ModelRequestParameters, StreamedResponse
from pydantic_ai.settings import ModelSettings, merge_model_settings
from pydantic_ai.usage import RequestUsage
from starlette.exceptions import HTTPException as StarletteHTTPException

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel

logger = logging.getLogger(__name__)

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

    def to_response(self) -> JSONResponse:
        return _error_response(
            str(self), status_code=self.status_code, error_type=self.error_type, code=self.code
        )


class ChatCompletionErrorDetail(V1RoutesBaseModel):
    message: str
    type: str
    param: Optional[str] = None
    code: Optional[str] = None


class ChatCompletionErrorResponse(V1RoutesBaseModel):
    error: ChatCompletionErrorDetail


def _error_response(
    message: str,
    *,
    status_code: int,
    error_type: str,
    code: Optional[str] = None,
) -> JSONResponse:
    body = ChatCompletionErrorResponse(
        error=ChatCompletionErrorDetail(message=message, type=error_type, code=code)
    )
    return JSONResponse(body.model_dump(), status_code=status_code)


def _validation_error_message(exc: RequestValidationError) -> str:
    problems = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
        message = error.get("msg", "Invalid value")
        problems.append(f"{location}: {message}" if location else message)
    return "; ".join(problems) or "Invalid request body."


class _OpenAIErrorAPIRoute(APIRoute):
    """Route class that keeps every failure in the OpenAI error shape.

    FastAPI renders request-validation failures as ``{"detail": [...]}`` and
    unhandled exceptions as bare 500s, neither of which OpenAI clients can
    parse. Convert both into ``{"error": {...}}`` payloads here so the error
    contract holds on every path out of the endpoint.
    """

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def handle_with_openai_errors(request: Request) -> Response:
            try:
                return await handler(request)
            except StarletteHTTPException:
                # Auth and framework-level errors keep their app-wide handling.
                raise
            except RequestValidationError as exc:
                return _error_response(
                    _validation_error_message(exc),
                    status_code=422,
                    error_type="invalid_request_error",
                )
            except Exception:
                logger.exception("Unhandled error in chat completions endpoint")
                return _error_response(
                    "Internal server error.", status_code=500, error_type="api_error"
                )

        return handle_with_openai_errors


router = APIRouter(tags=["chat_completions"], route_class=_OpenAIErrorAPIRoute)


class ChatCompletionTextPart(V1RoutesBaseModel):
    type: Literal["text"]
    text: str


class ChatCompletionRequestMessage(V1RoutesBaseModel):
    role: Literal["system", "developer", "user", "assistant"]
    content: Union[str, list[ChatCompletionTextPart]]


class ChatCompletionStreamOptions(V1RoutesBaseModel):
    include_usage: bool = False


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
    stream_options: Optional[ChatCompletionStreamOptions] = None
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


def _unknown_model_error(model_id: str) -> _ChatCompletionError:
    return _ChatCompletionError(
        f"Unknown model {model_id!r}. {_MODEL_FORMAT_HELP}",
        status_code=404,
        code="model_not_found",
    )


def _parse_model_id(model_id: str) -> AgentModelSelection:
    prefix, sep, remainder = model_id.partition(":")
    if not sep or not prefix or not remainder:
        raise _unknown_model_error(model_id)
    if prefix.lower() == _CUSTOM_PROVIDER_PREFIX:
        provider_id, sep, model_name = remainder.partition(":")
        if not sep or not provider_id or not model_name:
            raise _unknown_model_error(model_id)
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
    if body.stream_options is not None and not body.stream:
        raise _ChatCompletionError(
            "stream_options is only allowed when stream is true.",
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
    max_tokens = (
        body.max_completion_tokens if body.max_completion_tokens is not None else body.max_tokens
    )
    if max_tokens is not None:
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
        400: {"model": ChatCompletionErrorResponse},
        404: {"model": ChatCompletionErrorResponse},
        422: {"model": ChatCompletionErrorResponse},
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
        return exc.to_response()
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
    except ValueError:
        # A malformed custom provider_id fails Global ID parsing inside
        # build_model with a ValueError before any AgentError can be raised;
        # to the caller it is simply an unknown model.
        return _unknown_model_error(body.model).to_response()
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
            include_usage=body.stream_options is not None and body.stream_options.include_usage,
        )
    try:
        response = await model.request(messages, settings, parameters)
    except ModelAPIError as exc:
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


def _provider_error_response(exc: ModelAPIError) -> JSONResponse:
    if isinstance(exc, ModelHTTPError):
        # Surface the provider's own status when it is a valid HTTP error code
        # so callers can tell a bad model name (404) from bad server
        # credentials (401).
        status_code = exc.status_code if 400 <= exc.status_code < 600 else 502
    else:
        # Connection-level failure (DNS, refused connection, timeout): the
        # provider never answered, which makes this proxy a bad gateway.
        status_code = 502
    return _error_response(
        str(exc),
        status_code=status_code,
        error_type="invalid_request_error" if status_code < 500 else "api_error",
    )


async def _stream_events(
    stream: StreamedResponse,
    *,
    model_id: str,
    include_usage: bool,
) -> AsyncIterator[str]:
    """Render an entered model stream as OpenAI ``chat.completion.chunk`` SSE events."""
    envelope: dict[str, Any] = {
        "id": _completion_id(stream.provider_response_id),
        "object": "chat.completion.chunk",
        "created": int(stream.timestamp.timestamp()),
        "model": model_id,
    }

    def chunk(delta: dict[str, Any], finish_reason: Optional[str] = None) -> str:
        payload = {
            **envelope,
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
        }
        if include_usage:
            # Per stream_options.include_usage, every chunk carries a null
            # usage; the numbers arrive in a dedicated final chunk.
            payload["usage"] = None
        return _sse_event(payload)

    yield chunk({"role": "assistant", "content": ""})
    async for event in stream:
        text: Optional[str] = None
        if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
            text = event.part.content
        elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
            text = event.delta.content_delta
        if text:
            yield chunk({"content": text})
    yield chunk({}, finish_reason=_to_openai_finish_reason(stream.finish_reason))
    if include_usage:
        yield _sse_event(
            {**envelope, "choices": [], "usage": _to_openai_usage(stream.usage).model_dump()}
        )


async def _create_streaming_response(
    *,
    model: Model,
    messages: list[ModelMessage],
    settings: Optional[ModelSettings],
    parameters: ModelRequestParameters,
    model_id: str,
    include_usage: bool,
) -> Response:
    # The OpenInference span inside ``model.request_stream`` attaches OTel
    # context on entry and must detach it in the task that attached it, but
    # starlette consumes streaming bodies in a child task. A dedicated producer
    # task therefore owns the stream's entire lifecycle and hands rendered SSE
    # events over a queue, while ``startup`` lets connection and auth failures
    # still surface as proper HTTP errors instead of a 200 that errors
    # mid-body.
    startup: asyncio.Future[Optional[JSONResponse]] = asyncio.get_running_loop().create_future()
    # maxsize=1 preserves generator-style backpressure: the provider stream is
    # consumed no faster than the client reads.
    events: asyncio.Queue[Optional[str]] = asyncio.Queue(maxsize=1)

    async def produce() -> None:
        try:
            async with model.request_stream(messages, settings, parameters) as stream:
                startup.set_result(None)
                try:
                    async for event in _stream_events(
                        stream, model_id=model_id, include_usage=include_usage
                    ):
                        await events.put(event)
                except Exception as exc:
                    # The 200 header is already on the wire — surface the
                    # failure as an OpenAI-style error event rather than
                    # severing the connection.
                    await events.put(
                        _sse_event({"error": {"message": str(exc), "type": "api_error"}})
                    )
        except Exception as exc:
            if not startup.done():
                # Stream entry failed before anything was sent; let the
                # endpoint turn it into a proper HTTP error response.
                if isinstance(exc, ModelAPIError):
                    startup.set_result(_provider_error_response(exc))
                else:
                    startup.set_exception(exc)
                return
            logger.exception("Failed to close chat completion stream")
        await events.put("data: [DONE]\n\n")
        await events.put(None)

    producer = asyncio.create_task(produce())
    try:
        if (error := await startup) is not None:
            return error
    except BaseException:
        # Startup failed or this request was cancelled; either way the
        # producer must not outlive the request.
        producer.cancel()
        raise

    async def stream_body() -> AsyncIterator[str]:
        try:
            while (event := await events.get()) is not None:
                yield event
        finally:
            # Client disconnects cancel this generator; take the producer (and
            # the provider stream it holds open) down with it.
            producer.cancel()

    return StreamingResponse(
        stream_body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
