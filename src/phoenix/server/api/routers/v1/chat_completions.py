"""OpenAI-compatible ``POST /v1/chat/completions`` proxy."""

import asyncio
import json
import logging
from secrets import token_hex
from typing import Annotated, Any, AsyncIterator, Callable, Coroutine, Literal, Optional, Union

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.routing import APIRoute
from pydantic import ConfigDict, Field
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
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_502_BAD_GATEWAY
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.exceptions import AgentError
from phoenix.server.agents.model_factory import build_model
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.types.node import from_global_id_with_expected_type

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
    error_type: Optional[str] = None,
    code: Optional[str] = None,
) -> JSONResponse:
    if error_type is None:
        error_type = "invalid_request_error" if status_code < 500 else "api_error"
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
    """Route class that keeps every failure in the OpenAI error shape."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def handle_with_openai_errors(request: Request) -> Response:
            try:
                return await handler(request)
            except _ChatCompletionError as exc:
                return _error_response(
                    str(exc), status_code=exc.status_code, error_type=exc.error_type, code=exc.code
                )
            except StarletteHTTPException:
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

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "model": "openai:gpt-4o",
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": "Say hello."},
                    ],
                }
            ]
        }
    )


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


class ChatCompletionChunkDelta(V1RoutesBaseModel):
    role: Optional[Literal["assistant"]] = None
    content: Optional[str] = None


class ChatCompletionChunkChoice(V1RoutesBaseModel):
    index: int = 0
    delta: ChatCompletionChunkDelta
    finish_reason: Optional[str] = None


class ChatCompletionChunk(V1RoutesBaseModel):
    id: str
    object: Literal["chat.completion.chunk"] = "chat.completion.chunk"
    created: int
    model: str
    choices: list[ChatCompletionChunkChoice]
    usage: Optional[ChatCompletionUsage] = None


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
        try:
            from_global_id_with_expected_type(
                GlobalID.from_id(provider_id),
                models.GenerativeModelCustomProvider.__name__,
            )
        except ValueError:
            raise _unknown_model_error(model_id) from None
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
        "payloads terminated by `data: [DONE]`. Tool calling is not supported.\n\n"
        "**Phoenix is not an AI gateway.** The same server also takes on trace "
        "ingestion traffic, so routing production LLM calls through it competes "
        "with ingestion. Use this endpoint only to quickly try out different "
        "models in non-production environments."
    ),
)
async def create_chat_completion(
    request: Request,
    body: CreateChatCompletionRequestBody,
) -> Response:
    selection = _parse_model_id(body.model)
    _reject_unsupported_parameters(body)
    try:
        model = await build_model(
            selection,
            db=request.app.state.db,
            decrypt=request.app.state.decrypt,
        )
    except AgentError as exc:
        return _error_response(str(exc), status_code=exc.status_code)
    except ValueError:
        raise _unknown_model_error(body.model) from None
    messages = _to_pydantic_ai_messages(body.messages)
    settings = merge_model_settings(model.settings, _to_model_settings(body))
    if body.stream:
        return await _create_streaming_response(
            model=model,
            messages=messages,
            settings=settings,
            model_id=body.model,
            include_usage=bool(body.stream_options and body.stream_options.include_usage),
        )
    try:
        response = await model.request(messages, settings, ModelRequestParameters())
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
    return Response(completion.model_dump_json(), media_type="application/json")


_HTTP_STATUS_CODE_LIMIT = 600


def _provider_error_response(exc: ModelAPIError) -> JSONResponse:
    if isinstance(exc, ModelHTTPError):
        provider_status_code = exc.status_code
        provider_status_is_forwardable = (
            HTTP_400_BAD_REQUEST <= provider_status_code < _HTTP_STATUS_CODE_LIMIT
        )
        response_status_code = (
            provider_status_code if provider_status_is_forwardable else HTTP_502_BAD_GATEWAY
        )
    else:
        # The provider never answered (DNS failure, refused connection, timeout).
        response_status_code = HTTP_502_BAD_GATEWAY
    return _error_response(str(exc), status_code=response_status_code)


async def _stream_events(
    stream: StreamedResponse,
    *,
    model_id: str,
    include_usage: bool,
) -> AsyncIterator[str]:
    """Render an entered model stream as OpenAI ``chat.completion.chunk`` SSE events."""
    completion_id = _completion_id(stream.provider_response_id)
    created = int(stream.timestamp.timestamp())

    def sse_chunk(
        choices: list[ChatCompletionChunkChoice],
        usage: Optional[ChatCompletionUsage] = None,
    ) -> str:
        chunk = ChatCompletionChunk(
            id=completion_id,
            object="chat.completion.chunk",
            created=created,
            model=model_id,
            choices=choices,
        )
        if include_usage:
            chunk.usage = usage
        return _sse_event(chunk.model_dump(exclude_unset=True))

    def delta_chunk(
        delta: ChatCompletionChunkDelta,
        finish_reason: Optional[str] = None,
    ) -> str:
        return sse_chunk(
            [ChatCompletionChunkChoice(index=0, delta=delta, finish_reason=finish_reason)]
        )

    yield delta_chunk(ChatCompletionChunkDelta(role="assistant", content=""))
    async for event in stream:
        text: Optional[str] = None
        if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
            text = event.part.content
        elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
            text = event.delta.content_delta
        if text:
            yield delta_chunk(ChatCompletionChunkDelta(content=text))
    yield delta_chunk(
        ChatCompletionChunkDelta(),
        finish_reason=_to_openai_finish_reason(stream.finish_reason),
    )
    if include_usage:
        yield sse_chunk([], usage=_to_openai_usage(stream.usage))


async def _create_streaming_response(
    *,
    model: Model,
    messages: list[ModelMessage],
    settings: Optional[ModelSettings],
    model_id: str,
    include_usage: bool,
) -> Response:
    provider_stream_opened: asyncio.Future[None] = asyncio.get_running_loop().create_future()
    sse_events: asyncio.Queue[Optional[str]] = asyncio.Queue(maxsize=16)

    async def produce() -> None:
        try:
            async with model.request_stream(messages, settings, ModelRequestParameters()) as stream:
                provider_stream_opened.set_result(None)
                try:
                    async for event in _stream_events(
                        stream, model_id=model_id, include_usage=include_usage
                    ):
                        await sse_events.put(event)
                except Exception as exc:
                    error = ChatCompletionErrorResponse(
                        error=ChatCompletionErrorDetail(message=str(exc), type="api_error")
                    )
                    await sse_events.put(_sse_event(error.model_dump(exclude_unset=True)))
        except Exception as exc:
            if not provider_stream_opened.done():
                provider_stream_opened.set_exception(exc)
                return
            logger.exception("Failed to close chat completion stream")
        await sse_events.put("data: [DONE]\n\n")
        await sse_events.put(None)

    producer = asyncio.create_task(produce())
    try:
        await provider_stream_opened
    except ModelAPIError as exc:
        return _provider_error_response(exc)
    except BaseException:
        producer.cancel()
        raise

    async def stream_body() -> AsyncIterator[str]:
        try:
            while (event := await sse_events.get()) is not None:
                yield event
        finally:
            producer.cancel()

    return StreamingResponse(
        stream_body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
