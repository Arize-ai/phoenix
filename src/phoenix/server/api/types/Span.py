import json
from datetime import datetime
from enum import Enum
from typing import Any, List, Mapping, Optional, Sized, cast

import numpy as np
import strawberry
from openinference.semconv.trace import EmbeddingAttributes, SpanAttributes
from strawberry import ID, UNSET
from strawberry.types import Info

import phoenix.trace.schemas as trace_schema
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics
from phoenix.server.api.types.Evaluation import DocumentEvaluation, SpanEvaluation
from phoenix.server.api.types.MimeType import MimeType
from phoenix.trace.attributes import get_attribute_value

EMBEDDING_EMBEDDINGS = SpanAttributes.EMBEDDING_EMBEDDINGS
EMBEDDING_VECTOR = EmbeddingAttributes.EMBEDDING_VECTOR
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_TOTAL = SpanAttributes.LLM_TOKEN_COUNT_TOTAL
METADATA = SpanAttributes.METADATA
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS


@strawberry.enum
class SpanKind(Enum):
    """
    The type of work that a Span encapsulates.

    NB: this is actively under construction
    """

    chain = "CHAIN"
    tool = "TOOL"
    llm = "LLM"
    retriever = "RETRIEVER"
    embedding = "EMBEDDING"
    agent = "AGENT"
    reranker = "RERANKER"
    unknown = "UNKNOWN"

    @classmethod
    def _missing_(cls, v: Any) -> Optional["SpanKind"]:
        if v and isinstance(v, str) and v.isascii() and not v.isupper():
            return cls(v.upper())
        return cls.unknown


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
    OK = "OK"
    ERROR = "ERROR"
    UNSET = "UNSET"

    @classmethod
    def _missing_(cls, v: Any) -> Optional["SpanStatusCode"]:
        return None if v else cls.UNSET


@strawberry.type
class SpanEvent:
    name: str
    message: str
    timestamp: datetime

    @staticmethod
    def from_dict(
        event: Mapping[str, Any],
    ) -> "SpanEvent":
        return SpanEvent(
            name=event["name"],
            message=cast(str, event["attributes"].get(trace_schema.EXCEPTION_MESSAGE) or ""),
            timestamp=datetime.fromisoformat(event["timestamp"]),
        )


@strawberry.type
class Span:
    span_rowid: strawberry.Private[int]
    name: str
    status_code: SpanStatusCode
    status_message: str
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
    metadata: Optional[str] = strawberry.field(
        description="Metadata as a JSON string",
    )
    num_documents: Optional[int]
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
    propagated_status_code: SpanStatusCode = strawberry.field(
        description="Propagated status code that percolates up error status "
        "codes from descendant spans (children, grandchildren, etc.)",
    )

    @strawberry.field(
        description="Evaluations associated with the span, e.g. if the span is "
        "an LLM, an evaluation may assess the helpfulness of its response with "
        "respect to its input."
    )  # type: ignore
    async def span_evaluations(self, info: Info[Context, None]) -> List[SpanEvaluation]:
        return await info.context.data_loaders.span_evaluations.load(self.span_rowid)

    @strawberry.field(
        description="Evaluations of the documents associated with the span, e.g. "
        "if the span is a RETRIEVER with a list of documents in its RETRIEVAL_DOCUMENTS "
        "attribute, an evaluation for each document may assess its relevance "
        "respect to the input query of the span. Note that RETRIEVAL_DOCUMENTS is "
        "a list, and each evaluation is identified by its document's (zero-based) "
        "index in that list."
    )  # type: ignore
    async def document_evaluations(self, info: Info[Context, None]) -> List[DocumentEvaluation]:
        return await info.context.data_loaders.document_evaluations.load(self.span_rowid)

    @strawberry.field(
        description="Retrieval metrics: NDCG@K, Precision@K, Reciprocal Rank, etc.",
    )  # type: ignore
    async def document_retrieval_metrics(
        self,
        info: Info[Context, None],
        evaluation_name: Optional[str] = UNSET,
    ) -> List[DocumentRetrievalMetrics]:
        if not self.num_documents:
            return []
        return await info.context.data_loaders.document_retrieval_metrics.load(
            (self.span_rowid, evaluation_name or None, self.num_documents),
        )

    @strawberry.field(
        description="All descendant spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def descendants(
        self,
        info: Info[Context, None],
    ) -> List["Span"]:
        span_id = str(self.context.span_id)
        spans = await info.context.data_loaders.span_descendants.load(span_id)
        return [to_gql_span(span) for span in spans]


def to_gql_span(span: models.Span) -> Span:
    events: List[SpanEvent] = list(map(SpanEvent.from_dict, span.events))
    input_value = cast(Optional[str], get_attribute_value(span.attributes, INPUT_VALUE))
    output_value = cast(Optional[str], get_attribute_value(span.attributes, OUTPUT_VALUE))
    retrieval_documents = get_attribute_value(span.attributes, RETRIEVAL_DOCUMENTS)
    num_documents = len(retrieval_documents) if isinstance(retrieval_documents, Sized) else None
    return Span(
        span_rowid=span.id,
        name=span.name,
        status_code=SpanStatusCode(span.status_code),
        status_message=span.status_message,
        parent_id=cast(Optional[ID], span.parent_id),
        span_kind=SpanKind(span.span_kind),
        start_time=span.start_time,
        end_time=span.end_time,
        latency_ms=span.latency_ms,
        context=SpanContext(
            trace_id=cast(ID, span.trace.trace_id),
            span_id=cast(ID, span.span_id),
        ),
        attributes=json.dumps(span.attributes, cls=_JSONEncoder),
        # TODO(persistence): hide the embedding vectors as a string instead,
        # e.g. f"<{len(vector)} dimensional vector>"
        metadata=_convert_metadata_to_string(get_attribute_value(span.attributes, METADATA)),
        num_documents=num_documents,
        token_count_total=cast(
            Optional[int],
            get_attribute_value(span.attributes, LLM_TOKEN_COUNT_TOTAL),
        ),
        token_count_prompt=cast(
            Optional[int],
            get_attribute_value(span.attributes, LLM_TOKEN_COUNT_PROMPT),
        ),
        token_count_completion=cast(
            Optional[int],
            get_attribute_value(span.attributes, LLM_TOKEN_COUNT_COMPLETION),
        ),
        cumulative_token_count_total=span.cumulative_llm_token_count_prompt
        + span.cumulative_llm_token_count_completion,
        cumulative_token_count_prompt=span.cumulative_llm_token_count_prompt,
        cumulative_token_count_completion=span.cumulative_llm_token_count_completion,
        propagated_status_code=(
            SpanStatusCode.ERROR
            if span.cumulative_error_count
            else SpanStatusCode(span.status_code)
        ),
        events=events,
        input=(
            SpanIOValue(
                mime_type=MimeType(get_attribute_value(span.attributes, INPUT_MIME_TYPE)),
                value=input_value,
            )
            if input_value is not None
            else None
        ),
        output=(
            SpanIOValue(
                mime_type=MimeType(get_attribute_value(span.attributes, OUTPUT_MIME_TYPE)),
                value=output_value,
            )
            if output_value is not None
            else None
        ),
    )


class _JSONEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, np.ndarray):
            return list(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)


def _convert_metadata_to_string(metadata: Any) -> Optional[str]:
    """
    Converts metadata to a string representation.
    """

    if metadata is None or isinstance(metadata, str):
        return metadata
    try:
        return json.dumps(metadata)
    except Exception:
        return str(metadata)
