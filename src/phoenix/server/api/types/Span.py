from enum import Enum
from typing import Optional

import strawberry
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
    parent_id: Optional[ID]
    span_kind: SpanKind
    context: SpanContext
