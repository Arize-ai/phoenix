from datetime import datetime
from enum import Enum
from typing import Any, Optional, cast

import pandas as pd
import strawberry
from pandas import Series
from strawberry import ID

from phoenix.trace.schemas import SpanKind as CoreSpanKind


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

    _row: strawberry.Private["pd.Series[Any]"]

    @strawberry.field(
        description="Span attributes as a JSON string",
    )  # type: ignore
    def attributes(self) -> str:
        prefix = "attributes."
        is_attribute = self._row.index.str.startswith(prefix)
        keys = self._row.index[is_attribute]
        return cast(
            str,
            self._row.loc[is_attribute]
            .rename({key: key[len(prefix) :] for key in keys})
            .to_json(date_format="iso"),
        )


def to_gql_span(row: "Series[Any]") -> Span:
    """
    Converts a dataframe row to a graphQL span
    """
    return Span(
        _row=row,
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
    )
