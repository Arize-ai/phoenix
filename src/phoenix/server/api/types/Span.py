import json
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, DefaultDict, List, Mapping, Optional, cast

import strawberry
from strawberry import ID
from strawberry.types import Info

import phoenix.trace.schemas as s
from phoenix.core.traces import (
    CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION,
    CUMULATIVE_LLM_TOKEN_COUNT_PROMPT,
    CUMULATIVE_LLM_TOKEN_COUNT_TOTAL,
    LATENCY_MS,
    ReadableSpan,
)
from phoenix.server.api.context import Context
from phoenix.server.api.types.MimeType import MimeType
from phoenix.trace.schemas import SpanID
from phoenix.trace.semantic_conventions import (
    EXCEPTION_MESSAGE,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
)


@strawberry.enum
class SpanKind(Enum):
    """
    The type of work that a Span encapsulates.

    NB: this is actively under construction
    """

    chain = s.SpanKind.CHAIN
    tool = s.SpanKind.TOOL
    llm = s.SpanKind.LLM
    retriever = s.SpanKind.RETRIEVER
    embedding = s.SpanKind.EMBEDDING
    unknown = s.SpanKind.UNKNOWN

    @classmethod
    def _missing_(cls, v: Any) -> Optional["SpanKind"]:
        return None if v else cls.unknown


@strawberry.type
class SpanContext:
    trace_id: ID
    span_id: ID


@strawberry.type
class SpanIOValue:
    mime_type: MimeType
    value: str


@strawberry.enum
class SpanStatusCode(Enum):
    OK = s.SpanStatusCode.OK
    ERROR = s.SpanStatusCode.ERROR
    UNSET = s.SpanStatusCode.UNSET

    @classmethod
    def _missing_(cls, v: Any) -> Optional["SpanStatusCode"]:
        return None if v else cls.UNSET


@strawberry.type
class SpanEvent:
    name: str
    message: str
    timestamp: datetime

    @staticmethod
    def from_event(
        event: s.SpanEvent,
    ) -> "SpanEvent":
        return SpanEvent(
            name=event.name,
            message=cast(str, event.attributes.get(EXCEPTION_MESSAGE) or ""),
            timestamp=event.timestamp,
        )


@strawberry.type
class Span:
    name: str
    status_code: SpanStatusCode
    start_time: datetime
    end_time: Optional[datetime]
    latency_ms: Optional[float]
    parent_id: Optional[ID] = strawberry.field(
        description="the parent span ID. If null, it is a root span"
    )
    span_kind: SpanKind
    context: SpanContext
    attributes: str = strawberry.field(
        description="Span attributes as a JSON string",
    )
    token_count_total: Optional[int]
    token_count_prompt: Optional[int]
    token_count_completion: Optional[int]
    input: Optional[SpanIOValue]
    output: Optional[SpanIOValue]
    events: List[SpanEvent]
    cumulative_token_count_total: Optional[int] = strawberry.field(
        description="Cumulative (prompt plus completion) token count from "
        "self and all descendant spans (children, grandchildren, etc.)",
    )
    cumulative_token_count_prompt: Optional[int] = strawberry.field(
        description="Cumulative (prompt) token count from self and all "
        "descendant spans (children, grandchildren, etc.)",
    )
    cumulative_token_count_completion: Optional[int] = strawberry.field(
        description="Cumulative (completion) token count from self and all "
        "descendant spans (children, grandchildren, etc.)",
    )

    @strawberry.field(
        description="All descendant spans (children, grandchildren, etc.)",
    )  # type: ignore
    def descendants(
        self,
        info: Info[Context, None],
    ) -> List["Span"]:
        if (traces := info.context.traces) is None:
            return []
        return [
            to_gql_span(cast(ReadableSpan, traces[span_id]))
            for span_id in traces.get_descendant_span_ids(
                cast(SpanID, self.context.span_id),
            )
        ]


def to_gql_span(span: ReadableSpan) -> "Span":
    events: List[SpanEvent] = list(map(SpanEvent.from_event, span.events))
    input_value = span.attributes.get(INPUT_VALUE)
    output_value = span.attributes.get(OUTPUT_VALUE)
    return Span(
        name=span.name,
        status_code=SpanStatusCode(span.status_code),
        parent_id=span.parent_id,
        span_kind=SpanKind(span.span_kind),
        start_time=span.start_time,
        end_time=span.end_time,
        latency_ms=span[LATENCY_MS],
        context=SpanContext(
            trace_id=span.context.trace_id,
            span_id=span.context.span_id,
        ),
        attributes=json.dumps(
            _nested_attributes(span.attributes),
            default=_json_encode,
        ),
        token_count_total=span.attributes.get(LLM_TOKEN_COUNT_TOTAL),
        token_count_prompt=span.attributes.get(LLM_TOKEN_COUNT_PROMPT),
        token_count_completion=span.attributes.get(LLM_TOKEN_COUNT_COMPLETION),
        cumulative_token_count_total=span[CUMULATIVE_LLM_TOKEN_COUNT_TOTAL],
        cumulative_token_count_prompt=span[CUMULATIVE_LLM_TOKEN_COUNT_PROMPT],
        cumulative_token_count_completion=span[CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION],
        events=events,
        input=(
            SpanIOValue(
                mime_type=MimeType(span.attributes.get(INPUT_MIME_TYPE)),
                value=input_value,
            )
            if input_value is not None
            else None
        ),
        output=(
            SpanIOValue(
                mime_type=MimeType(span.attributes.get(OUTPUT_MIME_TYPE)),
                value=output_value,
            )
            if output_value is not None
            else None
        ),
    )


def _json_encode(v: Any) -> str:
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)


def _trie() -> DefaultDict[str, Any]:
    return defaultdict(_trie)


def _nested_attributes(
    attributes: Mapping[str, Any],
) -> DefaultDict[str, Any]:
    nested_attributes = _trie()
    for attribute_name, attribute_value in attributes.items():
        trie = nested_attributes
        keys = attribute_name.split(".")
        for key in keys[:-1]:
            trie = trie[key]
        trie[keys[-1]] = attribute_value
    return nested_attributes
