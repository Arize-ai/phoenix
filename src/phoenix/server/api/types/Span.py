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

    chain = CoreSpanKind.CHAIN
    tool = CoreSpanKind.TOOL
    llm = CoreSpanKind.LLM
    retriever = CoreSpanKind.RETRIEVER
    embedding = CoreSpanKind.EMBEDDING
    unknown = "UNKNOWN"


@strawberry.type
class Span:
    message: str
    parent_id: Optional[ID]
    span_kind: SpanKind
