from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, List, Mapping, NamedTuple, Optional
from uuid import UUID

EXCEPTION_TYPE = "exception.type"
EXCEPTION_MESSAGE = "exception.message"
EXCEPTION_ESCAPED = "exception.escaped"
EXCEPTION_STACKTRACE = "exception.stacktrace"


class SpanStatusCode(Enum):
    UNSET = "UNSET"
    OK = "OK"
    ERROR = "ERROR"

    def __str__(self) -> str:
        return self.value

    @classmethod
    def _missing_(cls, v: Any) -> Optional["SpanStatusCode"]:
        if v and isinstance(v, str) and not v.isupper():
            return cls(v.upper())
        return None if v else cls.UNSET


class SpanKind(Enum):
    """
    SpanKind is loosely inspired by OpenTelemetry's SpanKind
    It captures the type of work that a Span encapsulates.
    """

    TOOL = "TOOL"
    CHAIN = "CHAIN"
    LLM = "LLM"
    RETRIEVER = "RETRIEVER"
    EMBEDDING = "EMBEDDING"
    AGENT = "AGENT"
    RERANKER = "RERANKER"
    EVALUATOR = "EVALUATOR"
    UNKNOWN = "UNKNOWN"

    def __str__(self) -> str:
        return self.value

    @classmethod
    def _missing_(cls, v: Any) -> Optional["SpanKind"]:
        if v and isinstance(v, str) and v.isascii() and not v.isupper():
            return cls(v.upper())
        return cls.UNKNOWN


TraceID = str
SpanID = str
SpanAttributes = Mapping[str, Any]


@dataclass(frozen=True)
class SpanContext:
    """Context propagation for a span"""

    trace_id: TraceID
    span_id: SpanID


@dataclass(frozen=True)
class SpanConversationAttributes:
    conversation_id: UUID


@dataclass(frozen=True)
class SpanEvent:
    """
    A Span Event can be thought of as a structured log message (or annotation)
    on a Span, typically used to denote a meaningful, singular point in time
    during the Span’s duration.

    OpenTelemetry Inspiration:
    https://opentelemetry.io/docs/concepts/signals/traces/#span-events
    """

    name: str
    timestamp: datetime
    attributes: SpanAttributes


@dataclass(frozen=True)
class SpanException(SpanEvent):
    """
    A Span Exception is a special type of Span Event that denotes an error
    that occurred during the execution of a Span.

    The event name MUST be exception.

    Inspiration from OpenTelemetry:
    https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/exceptions.md
    """

    def __init__(
        self,
        timestamp: datetime,
        message: str,
        exception_type: Optional[str] = None,
        exception_escaped: Optional[bool] = None,
        exception_stacktrace: Optional[str] = None,
    ):
        super().__init__(
            name="exception",
            timestamp=timestamp,
            attributes={
                k: v
                for k, v in {
                    EXCEPTION_TYPE: exception_type,
                    EXCEPTION_MESSAGE: message,
                    EXCEPTION_ESCAPED: exception_escaped,
                    EXCEPTION_STACKTRACE: exception_stacktrace,
                }.items()
                if v is not None
            },
        )


@dataclass(frozen=True)
class Span:
    """
    A Span is a single unit of work in a trace
    Conforms to OpenTelemetry
    https://opentelemetry.io/docs/concepts/signals/traces/
    """

    name: str
    context: SpanContext
    """
    SpanKind is loosely inspired by OpenTelemetry's SpanKind
    It captures the type of work that a Span encapsulates.
    """
    span_kind: SpanKind
    "If the parent_id is None, this is the root span"
    parent_id: Optional[SpanID]
    start_time: datetime
    end_time: datetime
    status_code: SpanStatusCode
    status_message: str
    """
    Attributes are key-value pairs that contain metadata that you can use to
    annotate a Span to carry information about the operation it is tracking.

    Keys must be non-null string values. Values must be a non-null string, boolean,
    floating point value, integer, or an array of these values Additionally, there
    are Semantic Attributes, which are known naming conventions for metadata that is
    typically present in common operations. It’s helpful to use semantic attribute
    naming wherever possible so that common kinds of metadata are standardized
    across systems.



    Inspiration from OpenTelemetry
    https://opentelemetry.io/docs/concepts/semantic-conventions/
    """
    attributes: SpanAttributes

    """
    A Span Event can be thought of as a structured log message (or annotation)
    on a Span, typically used to denote a meaningful, singular point in time
    during the Span’s duration.

    OpenTelemetry Inspiration:
    https://opentelemetry.io/docs/concepts/signals/traces/#span-events
    """
    events: List[SpanEvent]

    """
    An extension of the OpenTelemetry Span interface to include the
    conversation_id
    """
    conversation: Optional[SpanConversationAttributes]


class MimeType(Enum):
    TEXT = "text/plain"
    JSON = "application/json"

    @classmethod
    def _missing_(cls, v: Any) -> Optional["MimeType"]:
        return None if v else cls.TEXT


ATTRIBUTE_PREFIX = "attributes."
CONTEXT_PREFIX = "context."
COMPUTED_PREFIX = "__computed__."


class ComputedAttributes(Enum):
    # Enum value must be string prefixed by COMPUTED_PREFIX
    LATENCY_MS = "latency_ms"  # The latency (or duration) of the span in milliseconds
    CUMULATIVE_LLM_TOKEN_COUNT_TOTAL = "cumulative_token_count.total"
    CUMULATIVE_LLM_TOKEN_COUNT_PROMPT = "cumulative_token_count.prompt"
    CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION = "cumulative_token_count.completion"
    ERROR_COUNT = "error_count"
    CUMULATIVE_ERROR_COUNT = "cumulative_error_count"


class ComputedValues(NamedTuple):
    latency_ms: float
    cumulative_error_count: int
    cumulative_llm_token_count_prompt: int
    cumulative_llm_token_count_completion: int
    cumulative_llm_token_count_total: int
