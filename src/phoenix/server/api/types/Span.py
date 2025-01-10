import json
from collections.abc import Mapping, Sized
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional, cast

import numpy as np
import strawberry
from openinference.semconv.trace import SpanAttributes
from strawberry import ID, UNSET
from strawberry.relay import Node, NodeID
from strawberry.types import Info
from typing_extensions import Annotated

import phoenix.trace.schemas as trace_schema
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.dataset_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from phoenix.server.api.input_types.InvocationParameters import InvocationParameter
from phoenix.server.api.input_types.SpanAnnotationSort import (
    SpanAnnotationColumn,
    SpanAnnotationSort,
)
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics
from phoenix.server.api.types.Evaluation import DocumentEvaluation
from phoenix.server.api.types.ExampleRevisionInterface import ExampleRevision
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider
from phoenix.server.api.types.MimeType import MimeType
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation, to_gql_span_annotation
from phoenix.server.api.types.SpanIOValue import SpanIOValue
from phoenix.trace.attributes import get_attribute_value

if TYPE_CHECKING:
    from phoenix.server.api.types.Project import Project


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
    evaluator = "EVALUATOR"
    guardrail = "GUARDRAIL"
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
class SpanAsExampleRevision(ExampleRevision): ...


@strawberry.type
class Span(Node):
    id_attr: NodeID[int]
    db_span: strawberry.Private[models.Span]
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
    events: list[SpanEvent]
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
        description=(
            "Annotations associated with the span. This encompasses both "
            "LLM and human annotations."
        )
    )  # type: ignore
    async def span_annotations(
        self,
        info: Info[Context, None],
        sort: Optional[SpanAnnotationSort] = UNSET,
    ) -> list[SpanAnnotation]:
        span_id = self.id_attr
        annotations = await info.context.data_loaders.span_annotations.load(span_id)
        sort_key = SpanAnnotationColumn.name.value
        sort_descending = False
        if sort:
            sort_key = sort.col.value
            sort_descending = sort.dir is SortDir.desc
        annotations.sort(
            key=lambda annotation: getattr(annotation, sort_key), reverse=sort_descending
        )
        return [to_gql_span_annotation(annotation) for annotation in annotations]

    @strawberry.field(
        description="Evaluations of the documents associated with the span, e.g. "
        "if the span is a RETRIEVER with a list of documents in its RETRIEVAL_DOCUMENTS "
        "attribute, an evaluation for each document may assess its relevance "
        "respect to the input query of the span. Note that RETRIEVAL_DOCUMENTS is "
        "a list, and each evaluation is identified by its document's (zero-based) "
        "index in that list."
    )  # type: ignore
    async def document_evaluations(self, info: Info[Context, None]) -> list[DocumentEvaluation]:
        return await info.context.data_loaders.document_evaluations.load(self.id_attr)

    @strawberry.field(
        description="Retrieval metrics: NDCG@K, Precision@K, Reciprocal Rank, etc.",
    )  # type: ignore
    async def document_retrieval_metrics(
        self,
        info: Info[Context, None],
        evaluation_name: Optional[str] = UNSET,
    ) -> list[DocumentRetrievalMetrics]:
        if not self.num_documents:
            return []
        return await info.context.data_loaders.document_retrieval_metrics.load(
            (self.id_attr, evaluation_name or None, self.num_documents),
        )

    @strawberry.field(
        description="All descendant spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def descendants(
        self,
        info: Info[Context, None],
    ) -> list["Span"]:
        span_id = str(self.context.span_id)
        spans = await info.context.data_loaders.span_descendants.load(span_id)
        return [to_gql_span(span) for span in spans]

    @strawberry.field(
        description="The span's attributes translated into an example revision for a dataset",
    )  # type: ignore
    async def as_example_revision(self, info: Info[Context, None]) -> SpanAsExampleRevision:
        span = self.db_span

        # Fetch annotations associated with this span
        span_annotations = await self.span_annotations(info)
        annotations = dict()
        for annotation in span_annotations:
            annotations[annotation.name] = {
                "label": annotation.label,
                "score": annotation.score,
                "explanation": annotation.explanation,
                "metadata": annotation.metadata,
                "annotator_kind": annotation.annotator_kind.value,
            }
        # Merge annotations into the metadata
        metadata = {
            "span_kind": span.span_kind,
            **({"annotations": annotations} if annotations else {}),
        }

        return SpanAsExampleRevision(
            input=get_dataset_example_input(span),
            output=get_dataset_example_output(span),
            metadata=metadata,
        )

    @strawberry.field(description="The project that this span belongs to.")  # type: ignore
    async def project(
        self,
        info: Info[Context, None],
    ) -> Annotated[
        "Project", strawberry.lazy("phoenix.server.api.types.Project")
    ]:  # use lazy types to avoid circular import: https://strawberry.rocks/docs/types/lazy
        from phoenix.server.api.types.Project import to_gql_project

        span_id = self.id_attr
        project = await info.context.data_loaders.span_projects.load(span_id)
        return to_gql_project(project)

    @strawberry.field(description="Indicates if the span is contained in any dataset")  # type: ignore
    async def contained_in_dataset(self, info: Info[Context, None]) -> bool:
        examples = await info.context.data_loaders.span_dataset_examples.load(self.id_attr)
        return bool(examples)

    @strawberry.field(description="Invocation parameters for the span")  # type: ignore
    async def invocation_parameters(self, info: Info[Context, None]) -> list[InvocationParameter]:
        from phoenix.server.api.helpers.playground_clients import OpenAIStreamingClient
        from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY

        db_span = self.db_span
        attributes = db_span.attributes
        llm_provider = GenerativeProvider.get_model_provider_from_attributes(attributes)
        if llm_provider is None:
            return []
        llm_model = get_attribute_value(attributes, SpanAttributes.LLM_MODEL_NAME)
        invocation_parameters = get_attribute_value(
            attributes, SpanAttributes.LLM_INVOCATION_PARAMETERS
        )
        if invocation_parameters is None:
            return []
        invocation_parameters = json.loads(invocation_parameters)
        # find the client class for the provider, if there is no client class or provider,
        # return openai as default
        client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(llm_provider, llm_model)
        if not client_class:
            client_class = OpenAIStreamingClient
        supported_invocation_parameters = client_class.supported_invocation_parameters()
        # filter supported invocation parameters down to those whose canonical_name is in the
        # invocation_parameters keys
        return [
            ip
            for ip in supported_invocation_parameters
            if (
                ip.canonical_name in invocation_parameters
                or ip.invocation_name in invocation_parameters
            )
        ]


def to_gql_span(span: models.Span) -> Span:
    events: list[SpanEvent] = list(map(SpanEvent.from_dict, span.events))
    input_value = get_attribute_value(span.attributes, INPUT_VALUE)
    if input_value is not None:
        input_value = str(input_value)
    assert input_value is None or isinstance(input_value, str)
    output_value = get_attribute_value(span.attributes, OUTPUT_VALUE)
    if output_value is not None:
        output_value = str(output_value)
    assert output_value is None or isinstance(output_value, str)
    retrieval_documents = get_attribute_value(span.attributes, RETRIEVAL_DOCUMENTS)
    num_documents = len(retrieval_documents) if isinstance(retrieval_documents, Sized) else None
    return Span(
        id_attr=span.id,
        db_span=span,
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
        attributes=json.dumps(_hide_embedding_vectors(span.attributes), cls=_JSONEncoder),
        metadata=_convert_metadata_to_string(get_attribute_value(span.attributes, METADATA)),
        num_documents=num_documents,
        token_count_total=span.llm_token_count_total,
        token_count_prompt=span.llm_token_count_prompt,
        token_count_completion=span.llm_token_count_completion,
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


def _hide_embedding_vectors(attributes: Mapping[str, Any]) -> Mapping[str, Any]:
    if not (
        isinstance(em := attributes.get("embedding"), dict)
        and isinstance(embeddings := em.get("embeddings"), list)
        and embeddings
    ):
        return attributes
    embeddings = embeddings.copy()
    for i, embedding in enumerate(embeddings):
        if not (
            isinstance(embedding, dict)
            and isinstance(emb := embedding.get("embedding"), dict)
            and isinstance(vector := emb.get("vector"), list)
            and vector
        ):
            continue
        embeddings[i] = {
            **embedding,
            "embedding": {**emb, "vector": f"<{len(vector)} dimensional vector>"},
        }
    return {**attributes, "embedding": {**em, "embeddings": embeddings}}


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


INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
METADATA = SpanAttributes.METADATA
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS
