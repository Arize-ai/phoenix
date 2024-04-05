import json
from collections import defaultdict
from datetime import datetime
from enum import Enum
from typing import Any, DefaultDict, Dict, Iterable, List, Mapping, Optional, Sized, cast

import numpy as np
import strawberry
from openinference.semconv.trace import EmbeddingAttributes, SpanAttributes
from sqlalchemy import select
from sqlalchemy.orm import contains_eager
from strawberry import ID, UNSET
from strawberry.types import Info

import phoenix.trace.schemas as trace_schema
from phoenix.core.project import Project
from phoenix.db import models
from phoenix.metrics.retrieval_metrics import RetrievalMetrics
from phoenix.server.api.context import Context
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics
from phoenix.server.api.types.Evaluation import DocumentEvaluation, SpanEvaluation
from phoenix.server.api.types.MimeType import MimeType
from phoenix.trace.schemas import SpanID

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
            timestamp=event["timestamp"],
        )


@strawberry.type
class Span:
    project: strawberry.Private[Project]
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
    def span_evaluations(self) -> List[SpanEvaluation]:
        span_id = SpanID(str(self.context.span_id))
        return [
            SpanEvaluation.from_pb_evaluation(evaluation)
            for evaluation in self.project.get_evaluations_by_span_id(span_id)
        ]

    @strawberry.field(
        description="Evaluations of the documents associated with the span, e.g. "
        "if the span is a RETRIEVER with a list of documents in its RETRIEVAL_DOCUMENTS "
        "attribute, an evaluation for each document may assess its relevance "
        "respect to the input query of the span. Note that RETRIEVAL_DOCUMENTS is "
        "a list, and each evaluation is identified by its document's (zero-based) "
        "index in that list."
    )  # type: ignore
    def document_evaluations(self) -> List[DocumentEvaluation]:
        span_id = SpanID(str(self.context.span_id))
        return [
            DocumentEvaluation.from_pb_evaluation(evaluation)
            for evaluation in self.project.get_document_evaluations_by_span_id(span_id)
        ]

    @strawberry.field(
        description="Retrieval metrics: NDCG@K, Precision@K, Reciprocal Rank, etc.",
    )  # type: ignore
    def document_retrieval_metrics(
        self,
        evaluation_name: Optional[str] = UNSET,
    ) -> List[DocumentRetrievalMetrics]:
        if not self.num_documents:
            return []
        span_id = SpanID(str(self.context.span_id))
        all_document_evaluation_names = self.project.get_document_evaluation_names(span_id)
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
            evaluation_scores = self.project.get_document_evaluation_scores(
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
    async def descendants(
        self,
        info: Info[Context, None],
    ) -> List["Span"]:
        # TODO(persistence): add dataloader (to avoid N+1 queries) or change how this is fetched
        async with info.context.db() as session:
            descendant_ids = (
                select(models.Span.id, models.Span.span_id)
                .filter(models.Span.parent_span_id == str(self.context.span_id))
                .cte(recursive=True)
            )
            parent_ids = descendant_ids.alias()
            descendant_ids = descendant_ids.union_all(
                select(models.Span.id, models.Span.span_id).join(
                    parent_ids,
                    models.Span.parent_span_id == parent_ids.c.span_id,
                )
            )
            spans = await session.scalars(
                select(models.Span)
                .join(descendant_ids, models.Span.id == descendant_ids.c.id)
                .join(models.Trace)
                .options(contains_eager(models.Span.trace))
            )
        return [to_gql_span(span, self.project) for span in spans]


def to_gql_span(span: models.Span, project: Project) -> Span:
    events: List[SpanEvent] = list(map(SpanEvent.from_dict, span.events))
    input_value = cast(Optional[str], span.attributes.get(INPUT_VALUE))
    output_value = cast(Optional[str], span.attributes.get(OUTPUT_VALUE))
    retrieval_documents = span.attributes.get(RETRIEVAL_DOCUMENTS)
    num_documents = len(retrieval_documents) if isinstance(retrieval_documents, Sized) else None
    return Span(
        project=project,
        name=span.name,
        status_code=SpanStatusCode(span.status),
        status_message=span.status_message,
        parent_id=cast(Optional[ID], span.parent_span_id),
        span_kind=SpanKind(span.kind),
        start_time=span.start_time,
        end_time=span.end_time,
        latency_ms=span.latency_ms,
        context=SpanContext(
            trace_id=cast(ID, span.trace.trace_id),
            span_id=cast(ID, span.span_id),
        ),
        attributes=json.dumps(
            _nested_attributes(_hide_embedding_vectors(span.attributes)),
            cls=_JSONEncoder,
        ),
        metadata=_convert_metadata_to_string(span.attributes.get(METADATA)),
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
        cumulative_token_count_total=span.cumulative_llm_token_count_prompt
        + span.cumulative_llm_token_count_completion,
        cumulative_token_count_prompt=span.cumulative_llm_token_count_prompt,
        cumulative_token_count_completion=span.cumulative_llm_token_count_completion,
        propagated_status_code=(
            SpanStatusCode.ERROR if span.cumulative_error_count else SpanStatusCode(span.status)
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
    if not isinstance((embeddings := _attributes.get(EMBEDDING_EMBEDDINGS)), Iterable):
        return _attributes
    _embeddings = []
    for embedding in embeddings:
        _embedding = dict(embedding)
        if isinstance((vector := _embedding.get(EMBEDDING_VECTOR)), Sized):
            _embedding[EMBEDDING_VECTOR] = f"<{len(vector)} dimensional vector>"
        _embeddings.append(_embedding)
    _attributes[EMBEDDING_EMBEDDINGS] = _embeddings
    return _attributes


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
