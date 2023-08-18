import json
import math
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, DefaultDict, List, Mapping, Optional, cast

import strawberry
from pandas import Series
from strawberry import ID
from strawberry.types import Info

import phoenix.trace.semantic_conventions as sc
from phoenix.server.api.context import Context
from phoenix.server.api.types.MimeType import MimeType
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, SpanID
from phoenix.trace.schemas import SpanKind as CoreSpanKind
from phoenix.trace.schemas import SpanStatus as CoreSpanStatus
from phoenix.trace.semantic_conventions import (
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

    chain = CoreSpanKind.CHAIN.value
    tool = CoreSpanKind.TOOL.value
    llm = CoreSpanKind.LLM.value
    retriever = CoreSpanKind.RETRIEVER.value
    embedding = CoreSpanKind.EMBEDDING.value
    unknown = "UNKNOWN"


@strawberry.type
class SpanContext:
    trace_id: ID
    span_id: ID


@strawberry.type
class SpanIOValue:
    mime_type: MimeType
    value: Optional[str]


@strawberry.enum
class SpanStatus(Enum):
    success = CoreSpanStatus.SUCCESS.value
    failure = CoreSpanStatus.FAILURE.value


@strawberry.type
class Span:
    name: str
    status: SpanStatus
    start_time: datetime
    end_time: datetime
    latency_ms: int
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
    input: SpanIOValue
    output: SpanIOValue

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
            to_gql_span(traces._dataframe.loc[span_id])  # type: ignore
            for span_id in traces.get_descendant_span_ids(
                cast(SpanID, self.context.span_id),
            )
        ]


def to_gql_span(row: "Series[Any]") -> Span:
    """
    Converts a dataframe row to a graphQL span
    """
    attributes = _extract_attributes(row).to_dict()
    return Span(
        name=row["name"],
        parent_id=row["parent_id"],
        span_kind=row["span_kind"],
        start_time=row["start_time"],
        end_time=row["end_time"],
        latency_ms=int(row["latency_ms"]),
        context=SpanContext(
            trace_id=row["context.trace_id"],
            span_id=row["context.span_id"],
        ),
        attributes=json.dumps(
            _nested_attributes(attributes),
            default=_json_encode,
        ),
        token_count_total=_as_int_or_none(
            attributes.get(LLM_TOKEN_COUNT_TOTAL),
        ),
        token_count_prompt=_as_int_or_none(
            attributes.get(LLM_TOKEN_COUNT_PROMPT),
        ),
        token_count_completion=_as_int_or_none(
            attributes.get(LLM_TOKEN_COUNT_COMPLETION),
        ),
        input=(
            SpanIOValue(
                mime_type=MimeType(
                    sc.MimeType(
                        attributes.get(INPUT_MIME_TYPE),
                    ),
                ),
                value=_as_str_or_none(
                    attributes.get(INPUT_VALUE),
                ),
            )
        ),
        output=(
            SpanIOValue(
                mime_type=MimeType(
                    sc.MimeType(
                        attributes.get(OUTPUT_MIME_TYPE),
                    ),
                ),
                value=_as_str_or_none(
                    attributes.get(OUTPUT_VALUE),
                ),
            )
        ),
    )


def _extract_attributes(row: "Series[Any]") -> "Series[Any]":
    row = row.dropna()
    is_attribute = row.index.str.startswith(ATTRIBUTE_PREFIX)
    keys = row.index[is_attribute]
    return cast(
        "Series[Any]",
        row.loc[is_attribute].rename(
            {key: key[len(ATTRIBUTE_PREFIX) :] for key in keys},
        ),
    )


def _as_str_or_none(v: Any) -> Optional[str]:
    if v is None or isinstance(v, float) and not math.isfinite(v):
        return None
    return str(v)


def _as_int_or_none(v: Any) -> Optional[int]:
    if v is None or isinstance(v, float) and not math.isfinite(v):
        return None
    try:
        return int(v)
    except ValueError:
        return None


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
    return nested_attributes
