import json
import math
from datetime import datetime
from enum import Enum
from typing import Any, List, Optional, cast

import strawberry
from pandas import Series
from strawberry import ID
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, SpanID
from phoenix.trace.schemas import SpanKind as CoreSpanKind
from phoenix.trace.semantic_conventions import (
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
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
class Span:
    name: str
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
    tokenCountTotal: Optional[int]
    tokenCountPrompt: Optional[int]
    tokenCountCompletion: Optional[int]

    @strawberry.field(
        description="All descendent spans in a flatten list",
    )  # type: ignore
    def descendent_spans_flatten_list(
        self,
        info: Info[Context, None],
    ) -> List["Span"]:
        ans: List["Span"] = []
        span_id = cast(SpanID, self.context.span_id)
        if (traces := info.context.traces) is None:
            return ans
        adjacency_list = traces.get_adjacency_list(span_id)
        span_ids = adjacency_list[span_id]
        for child_span_id in span_ids:
            ans.append(to_gql_span(traces.loc[child_span_id]))
            span_ids.extend(adjacency_list[child_span_id])
        return ans

    @strawberry.field(
        description="JSON string of the adjacency list representing"
        " the family tree with the current span as the root",
    )  # type: ignore
    def descendent_tree_adjacency_list(
        self,
        info: Info[Context, None],
    ) -> str:
        span_id = cast(SpanID, self.context.span_id)
        if (traces := info.context.traces) is None:
            return json.dumps({span_id: []})
        return json.dumps(traces.get_adjacency_list(span_id))


def to_gql_span(row: "Series[Any]") -> Span:
    """
    Converts a dataframe row to a graphQL span
    """
    attributes = _extract_attributes(row)
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
        attributes=attributes.to_json(date_format="iso"),
        tokenCountTotal=_as_int_or_none(
            attributes.get(LLM_TOKEN_COUNT_TOTAL),
        ),
        tokenCountPrompt=_as_int_or_none(
            attributes.get(LLM_TOKEN_COUNT_PROMPT),
        ),
        tokenCountCompletion=_as_int_or_none(
            attributes.get(LLM_TOKEN_COUNT_COMPLETION),
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


def _as_int_or_none(v: Any) -> Optional[int]:
    if v is None or isinstance(v, float) and not math.isfinite(v):
        return None
    try:
        return int(v)
    except ValueError:
        return None
