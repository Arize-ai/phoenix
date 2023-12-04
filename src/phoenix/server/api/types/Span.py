import json
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, DefaultDict, Dict, List, Mapping, Optional, Sized, cast

import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info

import phoenix.trace.schemas as trace_schema
from phoenix.core.traces import ComputedAttributes
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.context import Context
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics
from phoenix.server.api.types.Evaluation import DocumentEvaluation, SpanEvaluation
from phoenix.server.api.types.MimeType import MimeType
from phoenix.trace.schemas import SpanID
from phoenix.trace.semantic_conventions import (
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_VECTOR,
    EXCEPTION_MESSAGE,
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
)


@strawberry.enum
class SpanKind(Enum):
    """
    The type of work that a Span encapsulates.

    NB: this is actively under construction
    """

    chain = trace_schema.SpanKind.CHAIN
    tool = trace_schema.SpanKind.TOOL
    llm = trace_schema.SpanKind.LLM
    retriever = trace_schema.SpanKind.RETRIEVER
    embedding = trace_schema.SpanKind.EMBEDDING
    agent = trace_schema.SpanKind.AGENT
    reranker = trace_schema.SpanKind.RERANKER
    unknown = trace_schema.SpanKind.UNKNOWN

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
    OK = trace_schema.SpanStatusCode.OK
    ERROR = trace_schema.SpanStatusCode.ERROR
    UNSET = trace_schema.SpanStatusCode.UNSET

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
        event: trace_schema.SpanEvent,
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
    def span_evaluations(
        self,
        info: Info[Context, None],
    ) -> List[SpanEvaluation]:
        if not (evals := info.context.evals):
            return []
        span_id = SpanID(str(self.context.span_id))
        return [
            SpanEvaluation.from_pb_evaluation(evaluation)
            for evaluation in evals.get_evaluations_by_span_id(span_id)
        ]

    @strawberry.field(
        description="Evaluations of the documents associated with the span, e.g. "
        "if the span is a RETRIEVER with a list of documents in its RETRIEVAL_DOCUMENTS "
        "attribute, an evaluation for each document may assess its relevance "
        "respect to the input query of the span. Note that RETRIEVAL_DOCUMENTS is "
        "a list, and each evaluation is identified by its document's (zero-based) "
        "index in that list."
    )  # type: ignore
    def document_evaluations(
        self,
        info: Info[Context, None],
    ) -> List[DocumentEvaluation]:
        if not (evals := info.context.evals):
            return []
        span_id = SpanID(str(self.context.span_id))
        return [
            DocumentEvaluation.from_pb_evaluation(evaluation)
            for evaluation in evals.get_document_evaluations_by_span_id(span_id)
        ]

    @strawberry.field(
        description="Retrieval metrics: NDCG@K, Precision@K, Reciprocal Rank, etc.",
    )  # type: ignore
    def document_retrieval_metrics(
        self,
        info: Info[Context, None],
        evaluation_name: Optional[str] = UNSET,
    ) -> List[DocumentRetrievalMetrics]:
        if not self.num_documents or not (evals := info.context.evals):
            return []
        span_id = SpanID(str(self.context.span_id))
        all_document_evaluation_names = evals.get_document_evaluation_names(span_id)
        if not all_document_evaluation_names:
            return []
        if evaluation_name is UNSET:
            evaluation_names = all_document_evaluation_names
        elif evaluation_name not in all_document_evaluation_names:
            return []
        else:
            evaluation_names = [evaluation_name]
        retrieval_metrics = []
        for name in evaluation_names:
            evaluation_scores = evals.get_document_evaluation_scores(
                span_id=span_id,
                evaluation_name=name,
                num_documents=self.num_documents,
            )
            retrieval_metrics.append(
                DocumentRetrievalMetrics(
                    evaluation_name=name,
                    metrics=RetrievalMetrics(evaluation_scores),
                )
            )
        return retrieval_metrics

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
            to_gql_span(cast(trace_schema.Span, traces[span_id]))
            for span_id in traces.get_descendant_span_ids(
                cast(SpanID, self.context.span_id),
            )
        ]


def to_gql_span(span: trace_schema.Span) -> "Span":
    events: List[SpanEvent] = list(map(SpanEvent.from_event, span.events))
    input_value = cast(Optional[str], span.attributes.get(INPUT_VALUE))
    output_value = cast(Optional[str], span.attributes.get(OUTPUT_VALUE))
    retrieval_documents = span.attributes.get(RETRIEVAL_DOCUMENTS)
    num_documents = len(retrieval_documents) if isinstance(retrieval_documents, Sized) else None
    return Span(
        name=span.name,
        status_code=SpanStatusCode(span.status_code),
        parent_id=cast(Optional[ID], span.parent_id),
        span_kind=SpanKind(span.span_kind),
        start_time=span.start_time,
        end_time=span.end_time,
        latency_ms=cast(Optional[float], span.attributes.get(ComputedAttributes.LATENCY_MS.value)),
        context=SpanContext(
            trace_id=cast(ID, span.context.trace_id),
            span_id=cast(ID, span.context.span_id),
        ),
        attributes=json.dumps(
            _nested_attributes(_hide_embedding_vectors(span.attributes)),
            default=_json_encode,
        ),
        num_documents=num_documents,
        token_count_total=cast(
            Optional[int],
            span.attributes.get(LLM_TOKEN_COUNT_TOTAL),
        ),
        token_count_prompt=cast(
            Optional[int],
            span.attributes.get(LLM_TOKEN_COUNT_PROMPT),
        ),
        token_count_completion=cast(
            Optional[int],
            span.attributes.get(LLM_TOKEN_COUNT_COMPLETION),
        ),
        cumulative_token_count_total=cast(
            Optional[int],
            span.attributes.get(ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_TOTAL.value),
        ),
        cumulative_token_count_prompt=cast(
            Optional[int],
            span.attributes.get(ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_PROMPT.value),
        ),
        cumulative_token_count_completion=cast(
            Optional[int],
            span.attributes.get(ComputedAttributes.CUMULATIVE_LLM_TOKEN_COUNT_COMPLETION.value),
        ),
        propagated_status_code=(
            SpanStatusCode.ERROR
            if span.attributes.get(ComputedAttributes.CUMULATIVE_ERROR_COUNT.value)
            else SpanStatusCode(span.status_code)
        ),
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


def _hide_embedding_vectors(
    attributes: Mapping[str, Any],
) -> Dict[str, Any]:
    _attributes = dict(attributes)
    if not (embeddings := _attributes.get(EMBEDDING_EMBEDDINGS)):
        return _attributes
    _embeddings = []
    for embedding in embeddings:
        _embedding = dict(embedding)
        if vector := _embedding.get(EMBEDDING_VECTOR):
            _embedding[EMBEDDING_VECTOR] = f"<{len(vector)} dimensional vector>"
        _embeddings.append(_embedding)
    _attributes[EMBEDDING_EMBEDDINGS] = _embeddings
    return _attributes
