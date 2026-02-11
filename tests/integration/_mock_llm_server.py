"""Mock LLM server for integration testing.

This module provides a lightweight HTTP server implementing minimal OpenAI,
Anthropic, and AWS Bedrock streaming API endpoints for Phoenix integration
testing. The server runs in a separate thread and handles real HTTP connections.

Design Principles:
- Maximum logging for debuggability (not production code)
- Simple, readable structure over performance
- No configuration - just fulfill requests with mock data
- Streaming only (no non-streaming support)
- Explicit SDK type dependencies for type safety
"""

from __future__ import annotations

import json
import logging
import random
import struct
import threading
import time
import uuid
from binascii import crc32
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import TracebackType
from typing import Any, Iterator, Type, cast

from anthropic.types import (
    ContentBlockStartEvent,
    ContentBlockStopEvent,
    InputJSONDelta,
    Message,
    MessageDeltaEvent,
    MessageStartEvent,
    MessageStopEvent,
    RawContentBlockDeltaEvent,
    TextBlock,
    TextDelta,
    ToolUseBlock,
)
from anthropic.types import (
    Usage as AnthropicUsage,
)

# Request validation types (TypedDict from SDKs)
from anthropic.types.message_create_params import (
    MessageCreateParamsStreaming,
)
from anthropic.types.message_create_params import (  # type: ignore[attr-defined]
    ToolUnionParam as AnthropicToolUnionParam,
)

# Additional types
from anthropic.types.message_delta_usage import MessageDeltaUsage
from anthropic.types.raw_message_delta_event import Delta as MessageDelta

# Google GenAI types (already Pydantic models with validation)
from google.genai.types import Candidate as GenAICandidate
from google.genai.types import Content as GenAIContent
from google.genai.types import FinishReason as GenAIFinishReason
from google.genai.types import FunctionCall as GenAIFunctionCall
from google.genai.types import FunctionDeclarationDict as GenAIFunctionDeclarationDict
from google.genai.types import GenerateContentResponse as GenAIGenerateContentResponse
from google.genai.types import GenerateContentResponseUsageMetadata as GenAIUsageMetadata
from google.genai.types import Part as GenAIPart
from google.genai.types import ToolDict as GenAIToolDict
from google.genai.types import _GenerateContentParameters as GenAIGenerateContentParams
from hypothesis_jsonschema import from_schema
from openai.types.chat import (
    ChatCompletionChunk,
    ChatCompletionMessageParam,
)
from openai.types.chat.chat_completion_chunk import (
    Choice,
    ChoiceDelta,
    ChoiceDeltaToolCall,
    ChoiceDeltaToolCallFunction,
)
from openai.types.chat.completion_create_params import (  # type: ignore[attr-defined]
    ChatCompletionToolUnionParam,
    CompletionCreateParamsStreaming,
)
from openai.types.completion_usage import CompletionUsage
from openai.types.responses import (
    Response,
    ResponseCompletedEvent,
    ResponseContentPartAddedEvent,
    ResponseContentPartDoneEvent,
    ResponseCreatedEvent,
    ResponseCreateParams,
    ResponseFunctionCallArgumentsDeltaEvent,
    ResponseFunctionCallArgumentsDoneEvent,
    ResponseFunctionToolCall,
    ResponseOutputItemAddedEvent,
    ResponseOutputItemDoneEvent,
    ResponseOutputMessage,
    ResponseOutputText,
    ResponseTextDeltaEvent,
    ResponseTextDoneEvent,
    ResponseUsage,
    ToolParam,
)
from openai.types.responses.response_usage import InputTokensDetails, OutputTokensDetails
from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError
from types_aiobotocore_bedrock_runtime.type_defs import (
    ContentBlockDeltaEventTypeDef,
    ContentBlockDeltaTypeDef,
    ContentBlockStartEventTypeDef,
    ContentBlockStartTypeDef,
    ContentBlockStopEventTypeDef,
    ConverseStreamMetadataEventTypeDef,
    ConverseStreamMetricsTypeDef,
    ConverseStreamRequestTypeDef,
    MessageStartEventTypeDef,
    MessageStopEventTypeDef,
    TokenUsageTypeDef,
    ToolUseBlockDeltaTypeDef,
    ToolUseBlockStartTypeDef,
)
from types_aiobotocore_bedrock_runtime.type_defs import (
    ToolTypeDef as BedrockToolTypeDef,
)
from typing_extensions import Self

# Type alias for Bedrock streaming events
BedrockStreamEvent = (
    MessageStartEventTypeDef
    | MessageStopEventTypeDef
    | ContentBlockStartEventTypeDef
    | ContentBlockDeltaEventTypeDef
    | ContentBlockStopEventTypeDef
    | ConverseStreamMetadataEventTypeDef
)

# Configure debug logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


# =============================================================================
# Bedrock Request Validation
# =============================================================================
# The SDK's ConverseStreamRequestTypeDef includes IO[Any] for document/video
# streaming, which Pydantic can't handle by default. We wrap it in a BaseModel
# with arbitrary_types_allowed=True to allow validation while ignoring IO[Any].


class _BedrockConverseRequest(BaseModel):
    """Wrapper for Bedrock ConverseStream request validation.

    Uses arbitrary_types_allowed to handle IO[Any] in document/video fields.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)
    request: ConverseStreamRequestTypeDef


# Request validators using Pydantic TypeAdapter
_OPENAI_CHAT_VALIDATOR: TypeAdapter[CompletionCreateParamsStreaming] = TypeAdapter(
    CompletionCreateParamsStreaming
)
_OPENAI_RESPONSES_VALIDATOR: TypeAdapter[ResponseCreateParams] = TypeAdapter(ResponseCreateParams)
_ANTHROPIC_MESSAGES_VALIDATOR: TypeAdapter[MessageCreateParamsStreaming] = TypeAdapter(
    MessageCreateParamsStreaming
)


# =============================================================================
# AWS Event Stream Binary Encoder
# =============================================================================
# Implements the application/vnd.amazon.eventstream format for Bedrock
# See: https://smithy.io/2.0/aws/amazon-eventstream.html


class _EventStreamEncoder:
    """Pure Python encoder for AWS Event Stream binary format.

    The wire format is:
    ┌─────────────────┬─────────────────┬─────────────────┐
    │ total_length(4) │ headers_len(4)  │ prelude_crc(4)  │
    ├─────────────────┴─────────────────┴─────────────────┤
    │ headers (binary encoded)                            │
    ├─────────────────────────────────────────────────────┤
    │ payload (JSON bytes)                                │
    ├─────────────────────────────────────────────────────┤
    │ message_crc(4)                                      │
    └─────────────────────────────────────────────────────┘
    """

    # Header type indicators per AWS spec
    HEADER_TYPE_BOOL_TRUE = 0
    HEADER_TYPE_BOOL_FALSE = 1
    HEADER_TYPE_BYTE = 2
    HEADER_TYPE_SHORT = 3
    HEADER_TYPE_INT = 4
    HEADER_TYPE_LONG = 5
    HEADER_TYPE_BYTES = 6
    HEADER_TYPE_STRING = 7
    HEADER_TYPE_TIMESTAMP = 8
    HEADER_TYPE_UUID = 9

    @staticmethod
    def _encode_header(name: str, value: Any) -> bytes:
        """Encode a single header to binary format."""
        name_bytes = name.encode("utf-8")
        if len(name_bytes) > 255:
            raise ValueError(f"Header name too long: {name}")

        # Header name: 1-byte length + name bytes
        result = struct.pack("!B", len(name_bytes)) + name_bytes

        # Header value based on type
        if isinstance(value, bool):
            type_byte = (
                _EventStreamEncoder.HEADER_TYPE_BOOL_TRUE
                if value
                else _EventStreamEncoder.HEADER_TYPE_BOOL_FALSE
            )
            result += struct.pack("!B", type_byte)
        elif isinstance(value, int):
            # Use int32 for integers
            result += struct.pack("!B", _EventStreamEncoder.HEADER_TYPE_INT)
            result += struct.pack("!i", value)
        elif isinstance(value, str):
            value_bytes = value.encode("utf-8")
            result += struct.pack("!B", _EventStreamEncoder.HEADER_TYPE_STRING)
            result += struct.pack("!H", len(value_bytes)) + value_bytes
        elif isinstance(value, bytes):
            result += struct.pack("!B", _EventStreamEncoder.HEADER_TYPE_BYTES)
            result += struct.pack("!H", len(value)) + value
        else:
            raise ValueError(f"Unsupported header value type: {type(value)}")

        return result

    @staticmethod
    def _encode_headers(headers: dict[str, Any]) -> bytes:
        """Encode all headers to binary format."""
        result = b""
        for name, value in headers.items():
            result += _EventStreamEncoder._encode_header(name, value)
        return result

    @staticmethod
    def encode_message(payload: bytes, headers: dict[str, Any]) -> bytes:
        """Encode a complete event stream message.

        Args:
            payload: The message payload (usually JSON bytes)
            headers: Dictionary of header name -> value

        Returns:
            Complete binary-encoded message
        """
        headers_bytes = _EventStreamEncoder._encode_headers(headers)
        headers_length = len(headers_bytes)

        # Calculate total length: prelude(12) + headers + payload + message_crc(4)
        total_length = 12 + headers_length + len(payload) + 4

        # Build prelude: total_length(4) + headers_length(4)
        prelude = struct.pack("!II", total_length, headers_length)

        # Calculate prelude CRC
        prelude_crc = crc32(prelude) & 0xFFFFFFFF
        prelude_with_crc = prelude + struct.pack("!I", prelude_crc)

        # Build message without final CRC
        message_without_crc = prelude_with_crc + headers_bytes + payload

        # Calculate message CRC (over everything including prelude)
        message_crc = crc32(message_without_crc) & 0xFFFFFFFF

        return message_without_crc + struct.pack("!I", message_crc)

    @staticmethod
    def encode_event(
        event_type: str, payload: dict[str, Any], content_type: str = "application/json"
    ) -> bytes:
        """Encode a Bedrock-style event with standard headers.

        Args:
            event_type: The :event-type header value (e.g., "messageStart")
            payload: The event payload dictionary
            content_type: The :content-type header value

        Returns:
            Complete binary-encoded event message
        """
        headers = {
            ":message-type": "event",
            ":event-type": event_type,
            ":content-type": content_type,
        }
        payload_bytes = json.dumps(payload).encode("utf-8")
        return _EventStreamEncoder.encode_message(payload_bytes, headers)


def _generate_id(prefix: str = "chatcmpl") -> str:
    """Generate a unique ID for responses."""
    return f"{prefix}-{uuid.uuid4().hex[:24]}"


def _generate_tool_call_id() -> str:
    """Generate OpenAI-style tool call ID (call_XXXX...)."""
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "call_" + "".join(random.choice(chars) for _ in range(24))


def _generate_anthropic_tool_use_id() -> str:
    """Generate Anthropic-style tool use ID (toolu_01XXXX...)."""
    chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    return "toolu_01" + "".join(random.choice(chars) for _ in range(22))


def _generate_bedrock_tool_use_id() -> str:
    """Generate Bedrock-style tool use ID (tooluse_XXXX...)."""
    return f"tooluse_{uuid.uuid4().hex[:24]}"


def _estimate_tokens(text: str) -> int:
    """Rough token estimation (4 chars per token)."""
    return max(1, len(text) // 4)


def _google_schema_to_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Convert Google GenAI schema format to standard JSON Schema.

    Google uses uppercase types (STRING, NUMBER, etc.) while JSON Schema
    uses lowercase types (string, number, etc.).
    """
    if not schema:
        return {}

    # Map Google types to JSON Schema types
    type_map = {
        "STRING": "string",
        "NUMBER": "number",
        "INTEGER": "integer",
        "BOOLEAN": "boolean",
        "ARRAY": "array",
        "OBJECT": "object",
    }

    result: dict[str, Any] = {}
    for key, value in schema.items():
        if key == "type" and isinstance(value, str):
            result[key] = type_map.get(value, value.lower())
        elif key in ("properties", "items") and isinstance(value, dict):
            if key == "properties":
                result[key] = {k: _google_schema_to_json_schema(v) for k, v in value.items()}
            else:
                result[key] = _google_schema_to_json_schema(value)
        else:
            result[key] = value

    return result


def _sanitize_for_postgres(data: Any) -> Any:
    """Sanitize generated data to remove characters that PostgreSQL can't handle.

    PostgreSQL UTF-8 encoding doesn't accept null bytes (0x00) and some
    invalid Unicode sequences that hypothesis-jsonschema might generate.
    """
    if isinstance(data, str):
        # Remove null bytes and other problematic characters
        # Replace with empty string to keep data valid
        return data.replace("\x00", "").encode("utf-8", errors="replace").decode("utf-8")
    elif isinstance(data, dict):
        return {k: _sanitize_for_postgres(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_sanitize_for_postgres(item) for item in data]
    return data


def _generate_fake_data(schema: dict[str, Any]) -> Any:
    """Generate fake data from a JSON schema using hypothesis-jsonschema.

    Note: We use .example() which is meant for interactive use, but it's fine here
    since we're just generating mock data, not doing property-based testing.
    """
    import warnings

    from hypothesis.errors import NonInteractiveExampleWarning

    if not schema:
        return {}
    try:
        strategy = from_schema(schema)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", NonInteractiveExampleWarning)
            data = strategy.example()
        # Sanitize to remove null bytes and invalid Unicode for PostgreSQL
        return _sanitize_for_postgres(data)
    except Exception as e:
        logger.warning(f"Failed to generate fake data from schema: {e}")
        return {}


# Default response when no user message can be extracted
DEFAULT_RESPONSE = "Hello! This is the mock LLM server response."


def _extract_last_user_message(messages: list[Any]) -> str:
    """Extract the content of the last user message for echo responses.

    Works with message formats from OpenAI, Anthropic, Bedrock, and Google GenAI.
    Returns the default response if no user message is found.
    """
    for message in reversed(messages):
        role = message.get("role", "")
        if role == "user":
            # Handle OpenAI/Anthropic/Bedrock format with "content"
            content = message.get("content", "")
            if content:
                # Handle string content directly
                if isinstance(content, str):
                    return content
                # Handle list of content blocks (Anthropic/Bedrock style)
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict):
                            # Text block
                            if "text" in block:
                                return str(block["text"])
                            # Type-based block
                            if block.get("type") == "text" and "text" in block:
                                return str(block["text"])
                        elif isinstance(block, str):
                            return block
                    return str(content) if content else ""

            # Handle Google GenAI format with "parts"
            # Google uses: {"role": "user", "parts": [{"text": "..."}]}
            parts = message.get("parts", [])
            if parts and isinstance(parts, list):
                for part in parts:
                    if isinstance(part, dict):
                        # Text part
                        if "text" in part:
                            return str(part["text"])
                    elif isinstance(part, str):
                        return part

            return str(content) if content else ""
    return DEFAULT_RESPONSE


@dataclass
class _MockLLMServer:
    """Mock LLM server for integration testing.

    Implements minimal streaming OpenAI and Anthropic APIs for testing:
    - POST /v1/chat/completions (OpenAI Chat Completions)
    - POST /v1/responses (OpenAI Responses API)
    - POST /v1/messages (Anthropic Messages)

    Usage:
        with _MockLLMServer(port=8080) as server:
            # Server available at http://127.0.0.1:8080
            # Use server.url as base_url for SDK clients
    """

    port: int
    host: str = "127.0.0.1"

    _server: ThreadingHTTPServer | None = None
    _thread: threading.Thread | None = None

    @property
    def url(self) -> str:
        """Server base URL."""
        return f"http://{self.host}:{self.port}"

    @property
    def openai_url(self) -> str:
        """OpenAI-compatible base URL (same as url, SDK adds /v1)."""
        return f"http://{self.host}:{self.port}/v1"

    def __enter__(self) -> Self:
        """Start the HTTP server."""
        logger.info(f"Starting mock LLM server at {self.url}")

        # Create request handler with access to this server's state
        server_instance = self

        class Handler(_LLMRequestHandler):
            server_ref = server_instance

        # Use ThreadingHTTPServer for concurrent connection handling
        self._server = ThreadingHTTPServer((self.host, self.port), Handler)

        # Run server in background thread
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

        logger.info(f"Mock LLM server listening on {self.url}")
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Stop the HTTP server."""
        logger.info("Shutting down mock LLM server")
        if self._server:
            self._server.shutdown()
            self._server.server_close()
        if self._thread:
            self._thread.join(timeout=1.0)
        logger.info("Mock LLM server stopped")


class _LLMRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for LLM API endpoints (streaming only)."""

    server_ref: _MockLLMServer  # Set by __enter__

    def log_message(self, format: str, *args: Any) -> None:
        """Override to use our logger."""
        logger.debug(f"{self.address_string()} - {format % args}")

    def _send_json_response(self, data: dict[str, Any], status: int = 200) -> None:
        """Send a JSON response."""
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_sse_chunk(self, data: str) -> None:
        """Send a Server-Sent Events chunk."""
        chunk = f"data: {data}\n\n"
        self.wfile.write(chunk.encode("utf-8"))
        self.wfile.flush()

    def _read_json_body(self) -> dict[str, Any]:
        """Read and parse JSON request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        return json.loads(body) if body else {}

    def do_POST(self) -> None:
        """Handle POST requests."""
        logger.info(f"POST {self.path}")

        try:
            if self.path == "/v1/chat/completions":
                self._handle_chat_completions()
            elif self.path == "/v1/responses":
                self._handle_openai_responses()
            elif self.path == "/v1/messages":
                self._handle_anthropic_messages()
            elif self.path.startswith("/model/") and self.path.endswith("/converse-stream"):
                self._handle_bedrock_converse_stream()
            # Google GenAI endpoints (v1 and v1beta)
            elif self.path.startswith("/v1/models/") and ":streamGenerateContent" in self.path:
                self._handle_genai_stream_generate_content()
            elif self.path.startswith("/v1beta/models/") and ":streamGenerateContent" in self.path:
                self._handle_genai_stream_generate_content()
            else:
                self._send_json_response({"error": "Not found"}, status=404)
        except Exception as e:
            logger.exception(f"Error handling request: {e}")
            self._send_json_response({"error": str(e)}, status=500)

    def do_GET(self) -> None:
        """Handle GET requests (health check)."""
        if self.path == "/health":
            self._send_json_response({"status": "ok"})
        else:
            self._send_json_response({"error": "Not found"}, status=404)

    # -------------------------------------------------------------------------
    # OpenAI Chat Completions (streaming)
    # -------------------------------------------------------------------------

    def _handle_chat_completions(self) -> None:
        """Handle OpenAI chat completions endpoint (streaming)."""
        raw_body = self._read_json_body()

        # Validate request against OpenAI SDK types
        try:
            req = _OPENAI_CHAT_VALIDATOR.validate_python(raw_body)
        except ValidationError as e:
            logger.error(f"Invalid OpenAI chat completion request: {e}")
            self._send_json_response(
                {"error": {"message": str(e), "type": "invalid_request_error"}},
                status=400,
            )
            return

        model = req.get("model", "gpt-5-nano")
        messages = list(req.get("messages", []))  # Convert from iterator
        tools: list[ChatCompletionToolUnionParam] = list(req.get("tools") or [])
        tool_choice: Any = req.get("tool_choice", "auto")

        logger.info(f"Chat completion: model={model}, messages={len(messages)}, tools={len(tools)}")

        completion_id = _generate_id("chatcmpl")
        created = int(time.time())

        # Send SSE headers
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        # Decide whether to make a tool call
        should_use_tools = tools and tool_choice != "none"

        if should_use_tools:
            self._stream_openai_tool_call(req, completion_id, created, model, tools, messages)
        else:
            self._stream_openai_text(req, completion_id, created, model, messages)

    def _stream_openai_text(
        self,
        req: CompletionCreateParamsStreaming,
        completion_id: str,
        created: int,
        model: str,
        messages: list[ChatCompletionMessageParam],
    ) -> None:
        """Stream text content for OpenAI using Pydantic models.

        Echoes the last user message as the response.
        """
        content = _extract_last_user_message(messages)

        # Stream content in chunks
        for chunk_text in self._chunk_text(content):
            chunk = ChatCompletionChunk(
                id=completion_id,
                object="chat.completion.chunk",
                created=created,
                model=model,
                choices=[
                    Choice(
                        index=0,
                        delta=ChoiceDelta(content=chunk_text),
                        finish_reason=None,
                        logprobs=None,
                    )
                ],
            )
            self._send_sse_chunk(chunk.model_dump_json())

        # Send final chunk with finish_reason
        final_chunk = ChatCompletionChunk(
            id=completion_id,
            object="chat.completion.chunk",
            created=created,
            model=model,
            choices=[
                Choice(
                    index=0,
                    delta=ChoiceDelta(),
                    finish_reason="stop",
                    logprobs=None,
                )
            ],
        )
        self._send_sse_chunk(final_chunk.model_dump_json())

        # Send usage if requested
        stream_options = req.get("stream_options") or {}
        if stream_options.get("include_usage"):
            prompt_text = " ".join(
                str(m.get("content", "")) if m.get("content") else "" for m in messages
            )
            prompt_tokens = _estimate_tokens(prompt_text)
            completion_tokens = _estimate_tokens(content)
            usage_chunk = ChatCompletionChunk(
                id=completion_id,
                object="chat.completion.chunk",
                created=created,
                model=model,
                choices=[],
                usage=CompletionUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                ),
            )
            self._send_sse_chunk(usage_chunk.model_dump_json())

        self._send_sse_chunk("[DONE]")

    def _stream_openai_tool_call(
        self,
        req: CompletionCreateParamsStreaming,
        completion_id: str,
        created: int,
        model: str,
        tools: list[ChatCompletionToolUnionParam],
        messages: list[ChatCompletionMessageParam],
    ) -> None:
        """Stream a tool call for OpenAI using Pydantic models."""
        # Pick a random tool and generate args
        tool = random.choice(tools)
        # ChatCompletionFunctionToolParam has required "function" field (FunctionDefinition)
        # Skip CustomToolParam which doesn't have "function" key
        function = tool["function"]  # type: ignore[typeddict-item]
        # FunctionDefinition.parameters is optional
        parameters = function.get("parameters", {})
        args = _generate_fake_data(dict(parameters))
        args_str = json.dumps(args)
        tool_call_id = _generate_tool_call_id()
        # FunctionDefinition has required "name" field
        function_name = function["name"]

        # First chunk: tool call start with id and function name
        first_chunk = ChatCompletionChunk(
            id=completion_id,
            object="chat.completion.chunk",
            created=created,
            model=model,
            choices=[
                Choice(
                    index=0,
                    delta=ChoiceDelta(
                        role="assistant",
                        content=None,
                        tool_calls=[
                            ChoiceDeltaToolCall(
                                index=0,
                                id=tool_call_id,
                                type="function",
                                function=ChoiceDeltaToolCallFunction(
                                    name=function_name,
                                    arguments="",
                                ),
                            )
                        ],
                    ),
                    finish_reason=None,
                    logprobs=None,
                )
            ],
        )
        self._send_sse_chunk(first_chunk.model_dump_json())

        # Stream arguments in chunks
        for chunk_text in self._chunk_text(args_str):
            chunk = ChatCompletionChunk(
                id=completion_id,
                object="chat.completion.chunk",
                created=created,
                model=model,
                choices=[
                    Choice(
                        index=0,
                        delta=ChoiceDelta(
                            tool_calls=[
                                ChoiceDeltaToolCall(
                                    index=0,
                                    function=ChoiceDeltaToolCallFunction(arguments=chunk_text),
                                )
                            ]
                        ),
                        finish_reason=None,
                        logprobs=None,
                    )
                ],
            )
            self._send_sse_chunk(chunk.model_dump_json())

        # Final chunk with finish_reason
        final_chunk = ChatCompletionChunk(
            id=completion_id,
            object="chat.completion.chunk",
            created=created,
            model=model,
            choices=[
                Choice(
                    index=0,
                    delta=ChoiceDelta(),
                    finish_reason="tool_calls",
                    logprobs=None,
                )
            ],
        )
        self._send_sse_chunk(final_chunk.model_dump_json())

        # Send usage if requested
        stream_options = req.get("stream_options") or {}
        if stream_options.get("include_usage"):
            prompt_text = " ".join(
                str(m.get("content", "")) if m.get("content") else "" for m in messages
            )
            prompt_tokens = _estimate_tokens(prompt_text)
            completion_tokens = _estimate_tokens(args_str)
            usage_chunk = ChatCompletionChunk(
                id=completion_id,
                object="chat.completion.chunk",
                created=created,
                model=model,
                choices=[],
                usage=CompletionUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                ),
            )
            self._send_sse_chunk(usage_chunk.model_dump_json())

        self._send_sse_chunk("[DONE]")

    # -------------------------------------------------------------------------
    # OpenAI Responses API (streaming)
    # -------------------------------------------------------------------------

    def _handle_openai_responses(self) -> None:
        """Handle OpenAI Responses API endpoint (streaming)."""
        raw_body = self._read_json_body()

        # Validate request against OpenAI SDK types
        try:
            req = _OPENAI_RESPONSES_VALIDATOR.validate_python(raw_body)
        except ValidationError as e:
            logger.error(f"Invalid OpenAI Responses API request: {e}")
            self._send_json_response(
                {"error": {"message": str(e), "type": "invalid_request_error"}},
                status=400,
            )
            return

        model = req.get("model", "gpt-5-nano")
        tools: list[ToolParam] = list(req.get("tools") or [])
        tool_choice: Any = req.get("tool_choice", "auto")

        logger.info(f"Responses API: model={model}, tools={len(tools)}")

        response_id = _generate_id("resp")
        created_at = int(time.time())

        # Send SSE headers
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        # Decide whether to make a tool call
        should_use_tools = tools and tool_choice != "none"

        if should_use_tools:
            self._stream_responses_api_tool_call(req, response_id, created_at, model, tools)
        else:
            self._stream_responses_api_text(req, response_id, created_at, model)

    def _stream_responses_api_text(
        self,
        req: ResponseCreateParams,
        response_id: str,
        created_at: int,
        model: str,
    ) -> None:
        """Stream text content for OpenAI Responses API using Pydantic models.

        Echoes the last user message as the response.
        """
        # Extract messages from input (can be string or list of messages)
        input_data = req.get("input", [])
        if isinstance(input_data, str):
            content = input_data
        else:
            content = _extract_last_user_message(list(input_data))
        item_id = _generate_id("item")
        seq = 0  # sequence number counter

        # Helper to create base Response
        def make_response(
            status: str, output: list[Any], usage: ResponseUsage | None = None
        ) -> Response:
            return Response(
                id=response_id,
                created_at=float(created_at),
                model=model,
                object="response",
                output=output,
                parallel_tool_calls=True,
                tool_choice="auto",
                tools=[],
                status=status,  # type: ignore[arg-type]
                usage=usage,
            )

        # response.created event
        created_event = ResponseCreatedEvent(
            type="response.created",
            response=make_response("in_progress", []),
            sequence_number=seq,
        )
        self._send_sse_chunk(created_event.model_dump_json())
        seq += 1

        # Create message output item
        message_in_progress = ResponseOutputMessage(
            id=item_id,
            type="message",
            role="assistant",
            status="in_progress",
            content=[],
        )

        # response.output_item.added event
        item_added_event = ResponseOutputItemAddedEvent(
            type="response.output_item.added",
            output_index=0,
            item=message_in_progress,
            sequence_number=seq,
        )
        self._send_sse_chunk(item_added_event.model_dump_json())
        seq += 1

        # response.content_part.added event
        text_part_empty = ResponseOutputText(type="output_text", text="", annotations=[])
        content_part_added = ResponseContentPartAddedEvent(
            type="response.content_part.added",
            item_id=item_id,
            output_index=0,
            content_index=0,
            part=text_part_empty,
            sequence_number=seq,
        )
        self._send_sse_chunk(content_part_added.model_dump_json())
        seq += 1

        # Stream text deltas
        for chunk_text in self._chunk_text(content):
            text_delta = ResponseTextDeltaEvent(
                type="response.output_text.delta",
                item_id=item_id,
                output_index=0,
                content_index=0,
                delta=chunk_text,
                logprobs=[],
                sequence_number=seq,
            )
            self._send_sse_chunk(text_delta.model_dump_json())
            seq += 1

        # response.output_text.done event
        text_done = ResponseTextDoneEvent(
            type="response.output_text.done",
            item_id=item_id,
            output_index=0,
            content_index=0,
            text=content,
            logprobs=[],
            sequence_number=seq,
        )
        self._send_sse_chunk(text_done.model_dump_json())
        seq += 1

        # response.content_part.done event
        text_part_done = ResponseOutputText(type="output_text", text=content, annotations=[])
        content_part_done = ResponseContentPartDoneEvent(
            type="response.content_part.done",
            item_id=item_id,
            output_index=0,
            content_index=0,
            part=text_part_done,
            sequence_number=seq,
        )
        self._send_sse_chunk(content_part_done.model_dump_json())
        seq += 1

        # response.output_item.done event
        message_completed = ResponseOutputMessage(
            id=item_id,
            type="message",
            role="assistant",
            status="completed",
            content=[text_part_done],
        )
        item_done_event = ResponseOutputItemDoneEvent(
            type="response.output_item.done",
            output_index=0,
            item=message_completed,
            sequence_number=seq,
        )
        self._send_sse_chunk(item_done_event.model_dump_json())
        seq += 1

        # response.completed event
        output_tokens = _estimate_tokens(content)
        usage = ResponseUsage(
            input_tokens=10,
            output_tokens=output_tokens,
            total_tokens=10 + output_tokens,
            input_tokens_details=InputTokensDetails(cached_tokens=0),
            output_tokens_details=OutputTokensDetails(reasoning_tokens=0),
        )
        completed_event = ResponseCompletedEvent(
            type="response.completed",
            response=make_response("completed", [message_completed], usage),
            sequence_number=seq,
        )
        self._send_sse_chunk(completed_event.model_dump_json())

    def _stream_responses_api_tool_call(
        self,
        req: ResponseCreateParams,
        response_id: str,
        created_at: int,
        model: str,
        tools: list[ToolParam],
    ) -> None:
        """Stream a tool call for OpenAI Responses API using Pydantic models."""
        tool = random.choice(tools)
        # ToolParam is a union; for FunctionToolParam, name/parameters are directly on tool
        # FunctionToolParam has required "name" field, "parameters" is required but can be None
        function_name = str(tool.get("name", "unknown"))
        raw_params = tool.get("parameters")
        # raw_params is typed as 'object' due to union; cast to dict for function tools
        parameters: dict[str, Any] = (
            dict(raw_params)  # type: ignore[call-overload]
            if raw_params
            else {}
        )
        args = _generate_fake_data(parameters)
        args_str = json.dumps(args)
        item_id = _generate_id("item")
        call_id = _generate_tool_call_id()
        seq = 0  # sequence number counter

        # Helper to create base Response
        def make_response(
            status: str, output: list[Any], usage: ResponseUsage | None = None
        ) -> Response:
            return Response(
                id=response_id,
                created_at=float(created_at),
                model=model,
                object="response",
                output=output,
                parallel_tool_calls=True,
                tool_choice="auto",
                tools=[],
                status=status,  # type: ignore[arg-type]
                usage=usage,
            )

        # response.created event
        created_event = ResponseCreatedEvent(
            type="response.created",
            response=make_response("in_progress", []),
            sequence_number=seq,
        )
        self._send_sse_chunk(created_event.model_dump_json())
        seq += 1

        # Create function call output item (in progress)
        func_call_in_progress = ResponseFunctionToolCall(
            type="function_call",
            id=item_id,
            status="in_progress",
            call_id=call_id,
            name=function_name,
            arguments="",
        )

        # response.output_item.added event for function_call
        item_added_event = ResponseOutputItemAddedEvent(
            type="response.output_item.added",
            output_index=0,
            item=func_call_in_progress,
            sequence_number=seq,
        )
        self._send_sse_chunk(item_added_event.model_dump_json())
        seq += 1

        # Stream arguments deltas
        for chunk_text in self._chunk_text(args_str):
            args_delta = ResponseFunctionCallArgumentsDeltaEvent(
                type="response.function_call_arguments.delta",
                item_id=item_id,
                output_index=0,
                delta=chunk_text,
                sequence_number=seq,
            )
            self._send_sse_chunk(args_delta.model_dump_json())
            seq += 1

        # response.function_call_arguments.done event
        args_done = ResponseFunctionCallArgumentsDoneEvent(
            type="response.function_call_arguments.done",
            item_id=item_id,
            output_index=0,
            arguments=args_str,
            name=function_name,
            sequence_number=seq,
        )
        self._send_sse_chunk(args_done.model_dump_json())
        seq += 1

        # Create function call output item (completed)
        func_call_completed = ResponseFunctionToolCall(
            type="function_call",
            id=item_id,
            status="completed",
            call_id=call_id,
            name=function_name,
            arguments=args_str,
        )

        # response.output_item.done event
        item_done_event = ResponseOutputItemDoneEvent(
            type="response.output_item.done",
            output_index=0,
            item=func_call_completed,
            sequence_number=seq,
        )
        self._send_sse_chunk(item_done_event.model_dump_json())
        seq += 1

        # response.completed event
        output_tokens = _estimate_tokens(args_str)
        usage = ResponseUsage(
            input_tokens=10,
            output_tokens=output_tokens,
            total_tokens=10 + output_tokens,
            input_tokens_details=InputTokensDetails(cached_tokens=0),
            output_tokens_details=OutputTokensDetails(reasoning_tokens=0),
        )
        completed_event = ResponseCompletedEvent(
            type="response.completed",
            response=make_response("completed", [func_call_completed], usage),
            sequence_number=seq,
        )
        self._send_sse_chunk(completed_event.model_dump_json())

    # -------------------------------------------------------------------------
    # Anthropic Messages (streaming)
    # -------------------------------------------------------------------------

    def _handle_anthropic_messages(self) -> None:
        """Handle Anthropic messages endpoint (streaming)."""
        raw_body = self._read_json_body()

        # Validate request against Anthropic SDK types
        try:
            req = _ANTHROPIC_MESSAGES_VALIDATOR.validate_python(raw_body)
        except ValidationError as e:
            logger.error(f"Invalid Anthropic messages request: {e}")
            self._send_json_response(
                {"error": {"message": str(e), "type": "invalid_request_error"}},
                status=400,
            )
            return

        model = req.get("model", "claude-3-opus-20240229")
        messages = list(req.get("messages", []))  # Convert from iterator
        tools: list[AnthropicToolUnionParam] = list(req.get("tools") or [])
        tool_choice: Any = req.get("tool_choice", {})

        logger.info(
            f"Anthropic message: model={model}, messages={len(messages)}, tools={len(tools)}"
        )

        message_id = _generate_id("msg")

        # Calculate tokens
        prompt_text = " ".join(
            str(m.get("content", "")) if isinstance(m.get("content"), str) else "" for m in messages
        )
        input_tokens = _estimate_tokens(prompt_text)

        # Send SSE headers
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        # Decide whether to make a tool call
        tool_choice_type = tool_choice.get("type") if isinstance(tool_choice, dict) else None
        should_use_tools = tools and tool_choice_type != "none"

        if should_use_tools:
            self._stream_anthropic_tool_use(message_id, model, tools, input_tokens)
        else:
            self._stream_anthropic_text(message_id, model, messages, input_tokens)

    def _stream_anthropic_text(
        self, message_id: str, model: str, messages: list[Any], input_tokens: int
    ) -> None:
        """Stream text content for Anthropic using Pydantic models.

        Echoes the last user message as the response.
        """
        content = _extract_last_user_message(messages)
        output_tokens = _estimate_tokens(content)

        # message_start event
        message_start = MessageStartEvent(
            type="message_start",
            message=Message(
                id=message_id,
                type="message",
                role="assistant",
                content=[],
                model=model,
                stop_reason=None,
                stop_sequence=None,
                usage=AnthropicUsage(input_tokens=input_tokens, output_tokens=0),
            ),
        )
        self._send_anthropic_event("message_start", message_start.model_dump_json())

        # content_block_start event
        content_block_start = ContentBlockStartEvent(
            type="content_block_start",
            index=0,
            content_block=TextBlock(type="text", text=""),
        )
        self._send_anthropic_event("content_block_start", content_block_start.model_dump_json())

        # Stream content deltas
        for chunk_text in self._chunk_text(content):
            delta_event = RawContentBlockDeltaEvent(
                type="content_block_delta",
                index=0,
                delta=TextDelta(type="text_delta", text=chunk_text),
            )
            self._send_anthropic_event("content_block_delta", delta_event.model_dump_json())

        # content_block_stop event
        content_block_stop = ContentBlockStopEvent(type="content_block_stop", index=0)
        self._send_anthropic_event("content_block_stop", content_block_stop.model_dump_json())

        # message_delta event
        message_delta = MessageDeltaEvent(
            type="message_delta",
            delta=MessageDelta(stop_reason="end_turn", stop_sequence=None),
            usage=MessageDeltaUsage(output_tokens=output_tokens),
        )
        self._send_anthropic_event("message_delta", message_delta.model_dump_json())

        # message_stop event
        message_stop = MessageStopEvent(type="message_stop")
        self._send_anthropic_event("message_stop", message_stop.model_dump_json())
        self.wfile.flush()

    def _stream_anthropic_tool_use(
        self, message_id: str, model: str, tools: list[AnthropicToolUnionParam], input_tokens: int
    ) -> None:
        """Stream a tool use block for Anthropic using Pydantic models."""
        # Pick a random tool
        tool = random.choice(tools)
        # AnthropicToolParam (in union) has required "input_schema" and "name" fields
        # Other tool types in union (ToolBash, ToolTextEditor) don't have these fields
        input_schema = dict(tool["input_schema"])  # type: ignore[typeddict-item]
        tool_input = _generate_fake_data(input_schema)
        tool_use_id = _generate_anthropic_tool_use_id()
        tool_name = str(tool["name"])
        input_json = json.dumps(tool_input)
        output_tokens = _estimate_tokens(input_json)

        # message_start event
        message_start = MessageStartEvent(
            type="message_start",
            message=Message(
                id=message_id,
                type="message",
                role="assistant",
                content=[],
                model=model,
                stop_reason=None,
                stop_sequence=None,
                usage=AnthropicUsage(input_tokens=input_tokens, output_tokens=0),
            ),
        )
        self._send_anthropic_event("message_start", message_start.model_dump_json())

        # content_block_start event for tool_use
        content_block_start = ContentBlockStartEvent(
            type="content_block_start",
            index=0,
            content_block=ToolUseBlock(
                type="tool_use",
                id=tool_use_id,
                name=tool_name,
                input={},
            ),
        )
        self._send_anthropic_event("content_block_start", content_block_start.model_dump_json())

        # Stream input JSON in chunks via content_block_delta
        for chunk_text in self._chunk_text(input_json):
            delta_event = RawContentBlockDeltaEvent(
                type="content_block_delta",
                index=0,
                delta=InputJSONDelta(type="input_json_delta", partial_json=chunk_text),
            )
            self._send_anthropic_event("content_block_delta", delta_event.model_dump_json())

        # content_block_stop event
        content_block_stop = ContentBlockStopEvent(type="content_block_stop", index=0)
        self._send_anthropic_event("content_block_stop", content_block_stop.model_dump_json())

        # message_delta event
        message_delta = MessageDeltaEvent(
            type="message_delta",
            delta=MessageDelta(stop_reason="tool_use", stop_sequence=None),
            usage=MessageDeltaUsage(output_tokens=output_tokens),
        )
        self._send_anthropic_event("message_delta", message_delta.model_dump_json())

        # message_stop event
        message_stop = MessageStopEvent(type="message_stop")
        self._send_anthropic_event("message_stop", message_stop.model_dump_json())
        self.wfile.flush()

    def _send_anthropic_event(self, event_type: str, data: str) -> None:
        """Send an Anthropic SSE event. Data should be a JSON string."""
        self.wfile.write(f"event: {event_type}\n".encode("utf-8"))
        self.wfile.write(f"data: {data}\n\n".encode("utf-8"))
        self.wfile.flush()

    # -------------------------------------------------------------------------
    # AWS Bedrock Converse Stream (binary event stream)
    # -------------------------------------------------------------------------

    def _handle_bedrock_converse_stream(self) -> None:
        """Handle AWS Bedrock ConverseStream endpoint with binary event stream."""
        # Extract model ID from path: /model/{modelId}/converse-stream
        path_parts = self.path.split("/")
        model_id = path_parts[2] if len(path_parts) >= 3 else "unknown"

        raw_body = self._read_json_body()
        # Inject modelId from path into body for validation
        raw_body["modelId"] = model_id

        # Validate request using BaseModel wrapper (handles IO[Any] with arbitrary_types_allowed)
        try:
            # raw_body is dict[str, Any] from JSON parsing; Pydantic validates against TypedDict
            validated = _BedrockConverseRequest(request=raw_body)  # type: ignore[arg-type]
            req = validated.request
        except ValidationError as e:
            logger.error(f"Invalid Bedrock ConverseStream request: {e}")
            self._send_json_response(
                {"error": {"message": str(e), "type": "ValidationException"}},
                status=400,
            )
            return

        messages = list(req.get("messages") or [])
        tool_config: Any = req.get("toolConfig") or {}
        tools: list[BedrockToolTypeDef] = tool_config.get("tools", [])

        logger.info(
            f"Bedrock ConverseStream: model={model_id}, messages={len(messages)}, tools={len(tools)}"
        )

        # Send response with binary event stream content type
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.amazon.eventstream")
        self.send_header("Connection", "close")
        self.end_headers()

        # Decide whether to use tools
        should_use_tools = bool(tools)

        if should_use_tools:
            self._stream_bedrock_tool_use(model_id, messages, tools)
        else:
            self._stream_bedrock_text(model_id, messages)

    def _stream_bedrock_text(self, model_id: str, messages: list[Any]) -> None:
        """Stream text content for Bedrock Converse API.

        Echoes the last user message as the response.
        """
        content = _extract_last_user_message(messages)

        # messageStart event
        self._send_bedrock_event(
            "messageStart",
            MessageStartEventTypeDef(role="assistant"),
        )

        # Note: For text blocks, we skip contentBlockStart since ContentBlockStart
        # is a union type with only toolUse/toolResult/image members (no text member).
        # Text content starts directly with contentBlockDelta events.

        # Stream text deltas via contentBlockDelta events
        for chunk_text in self._chunk_text(content):
            self._send_bedrock_event(
                "contentBlockDelta",
                ContentBlockDeltaEventTypeDef(
                    delta=ContentBlockDeltaTypeDef(text=chunk_text),
                    contentBlockIndex=0,
                ),
            )

        # contentBlockStop event
        self._send_bedrock_event(
            "contentBlockStop",
            ContentBlockStopEventTypeDef(contentBlockIndex=0),
        )

        # messageStop event
        self._send_bedrock_event(
            "messageStop",
            MessageStopEventTypeDef(stopReason="end_turn"),
        )

        # metadata event with usage
        output_tokens = _estimate_tokens(content)
        self._send_bedrock_event(
            "metadata",
            ConverseStreamMetadataEventTypeDef(
                usage=TokenUsageTypeDef(
                    inputTokens=10,
                    outputTokens=output_tokens,
                    totalTokens=10 + output_tokens,
                ),
                metrics=ConverseStreamMetricsTypeDef(latencyMs=100),
            ),
        )
        self.wfile.flush()

    def _stream_bedrock_tool_use(
        self, model_id: str, messages: list[Any], tools: list[BedrockToolTypeDef]
    ) -> None:
        """Stream a tool use response for Bedrock Converse API."""
        # Pick a random tool
        tool = random.choice(tools)
        # BedrockToolTypeDef.toolSpec is NotRequired, but if present has required fields
        tool_spec = tool.get("toolSpec")
        if not tool_spec:
            # Fall back to text if no tool spec
            self._stream_bedrock_text(model_id, messages)
            return
        # ToolSpecificationTypeDef has required "name" and "inputSchema" fields
        tool_name = tool_spec["name"]
        input_schema = dict(tool_spec["inputSchema"].get("json", {}))

        # Generate fake input data
        tool_input = _generate_fake_data(input_schema)
        input_json = json.dumps(tool_input)
        tool_use_id = _generate_bedrock_tool_use_id()

        # messageStart event
        self._send_bedrock_event(
            "messageStart",
            MessageStartEventTypeDef(role="assistant"),
        )

        # contentBlockStart event with toolUse
        self._send_bedrock_event(
            "contentBlockStart",
            ContentBlockStartEventTypeDef(
                start=ContentBlockStartTypeDef(
                    toolUse=ToolUseBlockStartTypeDef(
                        toolUseId=tool_use_id,
                        name=tool_name,
                    ),
                ),
                contentBlockIndex=0,
            ),
        )

        # Stream tool input via contentBlockDelta events
        for chunk_text in self._chunk_text(input_json):
            self._send_bedrock_event(
                "contentBlockDelta",
                ContentBlockDeltaEventTypeDef(
                    delta=ContentBlockDeltaTypeDef(
                        toolUse=ToolUseBlockDeltaTypeDef(input=chunk_text),
                    ),
                    contentBlockIndex=0,
                ),
            )

        # contentBlockStop event
        self._send_bedrock_event(
            "contentBlockStop",
            ContentBlockStopEventTypeDef(contentBlockIndex=0),
        )

        # messageStop event
        self._send_bedrock_event(
            "messageStop",
            MessageStopEventTypeDef(stopReason="tool_use"),
        )

        # metadata event with usage
        output_tokens = _estimate_tokens(input_json)
        self._send_bedrock_event(
            "metadata",
            ConverseStreamMetadataEventTypeDef(
                usage=TokenUsageTypeDef(
                    inputTokens=10,
                    outputTokens=output_tokens,
                    totalTokens=10 + output_tokens,
                ),
                metrics=ConverseStreamMetricsTypeDef(latencyMs=100),
            ),
        )
        self.wfile.flush()

    def _send_bedrock_event(self, event_type: str, payload: BedrockStreamEvent) -> None:
        """Send a Bedrock event using AWS Event Stream binary encoding."""
        # Cast TypedDict to dict[str, Any] for the encoder
        event_bytes = _EventStreamEncoder.encode_event(event_type, dict(payload))
        self.wfile.write(event_bytes)
        self.wfile.flush()

    # -------------------------------------------------------------------------
    # Google GenAI StreamGenerateContent (v1 and v1beta)
    # -------------------------------------------------------------------------

    def _handle_genai_stream_generate_content(self) -> None:
        """Handle Google GenAI streamGenerateContent endpoint.

        Supports both /v1/models/{model}:streamGenerateContent and
        /v1beta/models/{model}:streamGenerateContent endpoints.
        """
        # Extract model from path: /v1/models/{model}:streamGenerateContent
        # or /v1beta/models/{model}:streamGenerateContent
        path_parts = self.path.split("/")
        model_part = path_parts[3] if len(path_parts) >= 4 else "unknown"
        model_id = model_part.split(":")[0]  # Remove :streamGenerateContent

        raw_body = self._read_json_body()

        # Validate request using google-genai Pydantic model
        try:
            _req = GenAIGenerateContentParams(
                model=model_id,
                contents=raw_body.get("contents"),
                config=raw_body.get("generationConfig"),
            )
        except ValidationError as e:
            logger.error(f"Invalid Google GenAI request: {e}")
            self._send_json_response(
                {"error": {"message": str(e), "code": 400, "status": "INVALID_ARGUMENT"}},
                status=400,
            )
            return

        contents = raw_body.get("contents", [])
        tools = raw_body.get("tools", [])

        logger.info(
            f"GenAI StreamGenerateContent: model={model_id}, "
            f"contents={len(contents)}, tools={len(tools)}"
        )

        # Check if SSE format is requested (alt=sse query param)
        self._genai_use_sse = "alt=sse" in self.path

        # Send appropriate headers
        self.send_response(200)
        if self._genai_use_sse:
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Content-Type", "application/json")
            self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Connection", "close")
        self.end_headers()

        # Decide whether to make a tool call
        should_use_tools = bool(tools)

        if should_use_tools:
            self._stream_genai_tool_call(model_id, contents, tools)
        else:
            self._stream_genai_text(model_id, contents)

        # Send terminating data
        if self._genai_use_sse:
            # SSE termination (empty data line)
            self.wfile.write(b"\n")
        else:
            # Send terminating chunk for chunked transfer encoding
            self.wfile.write(b"0\r\n\r\n")
        self.wfile.flush()

    def _stream_genai_text(self, model_id: str, contents: list[Any]) -> None:
        """Stream a text response for Google GenAI.

        Echoes the last user message as the response.
        """
        response_text = _extract_last_user_message(contents)

        # Stream text in chunks
        for chunk in self._chunk_text(response_text):
            response = GenAIGenerateContentResponse(
                candidates=[
                    GenAICandidate(
                        content=GenAIContent(
                            parts=[GenAIPart(text=chunk)],
                            role="model",
                        ),
                        finish_reason=None,
                    )
                ],
                model_version=model_id,
            )
            self._send_genai_chunk(response)
            time.sleep(0.01)

        # Final chunk with finish_reason
        output_tokens = _estimate_tokens(response_text)
        final_response = GenAIGenerateContentResponse(
            candidates=[
                GenAICandidate(
                    content=GenAIContent(
                        parts=[GenAIPart(text="")],
                        role="model",
                    ),
                    finish_reason=GenAIFinishReason.STOP,
                )
            ],
            model_version=model_id,
            usage_metadata=GenAIUsageMetadata(
                prompt_token_count=10,
                candidates_token_count=output_tokens,
                total_token_count=10 + output_tokens,
            ),
        )
        self._send_genai_chunk(final_response)

    def _stream_genai_tool_call(
        self, model_id: str, contents: list[Any], tools: list[GenAIToolDict]
    ) -> None:
        """Stream a tool call response for Google GenAI."""
        # Pick a random tool
        tool = random.choice(tools)
        # Note: The API sends camelCase keys but TypedDict uses snake_case
        function_declarations = cast(
            list[GenAIFunctionDeclarationDict],
            tool.get("functionDeclarations") or [],
        )
        if not function_declarations:
            # Fall back to text if no functions defined
            self._stream_genai_text(model_id, contents)
            return

        func = random.choice(function_declarations)
        func_name = func.get("name", "unknown_function")

        # Check for parameters_json_schema first (standard JSON Schema format),
        # then fall back to parameters (Google's proprietary format with uppercase types)
        if parameters_json_schema := func.get("parameters_json_schema"):
            # Already in standard JSON Schema format
            json_schema = parameters_json_schema
        else:
            # Convert Google schema format to standard JSON Schema for fake data generation
            parameters_schema = func.get("parameters") or {}
            json_schema = _google_schema_to_json_schema(dict(parameters_schema))

        # Generate fake arguments
        func_args = _generate_fake_data(json_schema)

        # Send tool call response
        response = GenAIGenerateContentResponse(
            candidates=[
                GenAICandidate(
                    content=GenAIContent(
                        parts=[
                            GenAIPart(
                                function_call=GenAIFunctionCall(
                                    name=func_name,
                                    args=func_args,
                                )
                            )
                        ],
                        role="model",
                    ),
                    finish_reason=GenAIFinishReason.STOP,
                )
            ],
            model_version=model_id,
            usage_metadata=GenAIUsageMetadata(
                prompt_token_count=10,
                candidates_token_count=5,
                total_token_count=15,
            ),
        )
        self._send_genai_chunk(response)

    def _send_genai_chunk(self, response: GenAIGenerateContentResponse) -> None:
        """Send a Google GenAI streaming chunk."""
        # Use by_alias=True to match Google's API format (camelCase)
        json_str = response.model_dump_json(exclude_none=True, by_alias=True)

        if getattr(self, "_genai_use_sse", False):
            # SSE format: data: {json}\n\n
            sse_data = f"data: {json_str}\n\n".encode("utf-8")
            self.wfile.write(sse_data)
        else:
            # Chunked transfer encoding with newline-delimited JSON
            json_bytes = json_str.encode("utf-8") + b"\n"
            chunk_size = f"{len(json_bytes):x}\r\n".encode("utf-8")
            self.wfile.write(chunk_size)
            self.wfile.write(json_bytes)
            self.wfile.write(b"\r\n")
        self.wfile.flush()

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _chunk_text(self, text: str, chunk_size: int = 10) -> Iterator[str]:
        """Split text into chunks for streaming."""
        for i in range(0, len(text), chunk_size):
            yield text[i : i + chunk_size]
