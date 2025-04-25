import json
from asyncio import gather
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Iterable, Optional, cast

import numpy as np
import pandas as pd
import strawberry
from openinference.semconv.trace import SpanAttributes
from strawberry import ID, UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.types import Info
from typing_extensions import Annotated, TypeAlias

import phoenix.trace.schemas as trace_schema
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.dataset_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from phoenix.server.api.input_types.InvocationParameters import InvocationParameter
from phoenix.server.api.input_types.SpanAnnotationFilter import (
    SpanAnnotationFilter,
    satisfies_filter,
)
from phoenix.server.api.input_types.SpanAnnotationSort import (
    SpanAnnotationColumn,
    SpanAnnotationSort,
)
from phoenix.server.api.types.AnnotationSummary import AnnotationSummary
from phoenix.server.api.types.DocumentRetrievalMetrics import DocumentRetrievalMetrics
from phoenix.server.api.types.Evaluation import DocumentEvaluation
from phoenix.server.api.types.ExampleRevisionInterface import ExampleRevision
from phoenix.server.api.types.GenerativeProvider import GenerativeProvider
from phoenix.server.api.types.MimeType import MimeType
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation, to_gql_span_annotation
from phoenix.server.api.types.SpanIOValue import SpanIOValue, truncate_value
from phoenix.trace.attributes import get_attribute_value

if TYPE_CHECKING:
    from phoenix.server.api.types.Project import Project
    from phoenix.server.api.types.Trace import Trace


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


SpanRowId: TypeAlias = int


@strawberry.type
class Span(Node):
    span_rowid: NodeID[SpanRowId]
    db_span: strawberry.Private[models.Span] = UNSET

    def __post_init__(self) -> None:
        if self.db_span and self.span_rowid != self.db_span.id:
            raise ValueError("Span ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_span:
            return self.db_span.name
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.name),
        )
        return str(value)

    @strawberry.field
    async def status_code(
        self,
        info: Info[Context, None],
    ) -> SpanStatusCode:
        if self.db_span:
            value = self.db_span.status_code
        else:
            value = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.status_code),
            )
        return SpanStatusCode(value)

    @strawberry.field
    async def status_message(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_span:
            return self.db_span.status_message
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.status_message),
        )
        return str(value)

    @strawberry.field
    async def start_time(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_span:
            return self.db_span.start_time
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.start_time),
        )
        return cast(datetime, value)

    @strawberry.field
    async def end_time(
        self,
        info: Info[Context, None],
    ) -> Optional[datetime]:
        if self.db_span:
            return self.db_span.end_time
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.end_time),
        )
        return cast(datetime, value)

    @strawberry.field
    async def latency_ms(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_span:
            return self.db_span.latency_ms
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.latency_ms),
        )
        return cast(float, value)

    @strawberry.field(
        description="the parent span ID. If null, it is a root span",
    )  # type: ignore
    async def parent_id(
        self,
        info: Info[Context, None],
    ) -> Optional[ID]:
        if self.db_span:
            value = self.db_span.parent_id
        else:
            value = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.parent_id),
            )
        return None if value is None else ID(value)

    @strawberry.field
    async def span_kind(
        self,
        info: Info[Context, None],
    ) -> SpanKind:
        if self.db_span:
            value = self.db_span.span_kind
        else:
            value = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.span_kind),
            )
        return SpanKind(value)

    @strawberry.field
    async def span_id(
        self,
        info: Info[Context, None],
    ) -> ID:
        if self.db_span:
            span_id = self.db_span.span_id
        else:
            span_id = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.span_id),
            )
        return ID(span_id)

    @strawberry.field
    async def trace(
        self,
        info: Info[Context, None],
    ) -> Annotated["Trace", strawberry.lazy(".Trace")]:
        if self.db_span:
            trace_rowid = self.db_span.trace_rowid
        else:
            trace_rowid = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.trace_rowid),
            )
        from phoenix.server.api.types.Trace import Trace

        return Trace(trace_rowid=trace_rowid)

    @strawberry.field
    async def context(
        self,
        info: Info[Context, None],
    ) -> SpanContext:
        if self.db_span:
            trace_id = self.db_span.trace.trace_id
            span_id = self.db_span.span_id
        else:
            span_id, trace_id = await gather(
                info.context.data_loaders.span_fields.load(
                    (self.span_rowid, models.Span.span_id),
                ),
                info.context.data_loaders.span_fields.load(
                    (self.span_rowid, models.Trace.trace_id),
                ),
            )
        return SpanContext(trace_id=ID(trace_id), span_id=ID(span_id))

    @strawberry.field(
        description="Span attributes as a JSON string",
    )  # type: ignore
    async def attributes(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_span:
            value = self.db_span.attributes
        else:
            value = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.attributes),
            )
        return json.dumps(_hide_embedding_vectors(value), cls=_JSONEncoder)

    @strawberry.field(
        description="Metadata as a JSON string",
    )  # type: ignore
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_span:
            value = self.db_span.metadata_
        else:
            value = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.metadata_),
            )
        return _convert_metadata_to_string(value)

    @strawberry.field
    async def num_documents(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.num_documents
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.num_documents),
        )
        return cast(int, value)

    @strawberry.field
    async def token_count_total(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.llm_token_count_total
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.llm_token_count_total),
        )
        return cast(Optional[int], value)

    @strawberry.field
    async def token_count_prompt(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.llm_token_count_prompt
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.llm_token_count_prompt),
        )
        return cast(Optional[int], value)

    @strawberry.field
    async def token_count_completion(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.llm_token_count_completion
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.llm_token_count_completion),
        )
        return cast(Optional[int], value)

    @strawberry.field
    async def input(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        if self.db_span:
            input_value = self.db_span.input_value
            if input_value is None or input_value == "":
                return None
            input_value = str(input_value)
            mime_type = self.db_span.input_mime_type
            return SpanIOValue(
                cached_value=input_value,
                mime_type=MimeType(mime_type),
            )
        mime_type, input_value_first_101_chars = await gather(
            info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.input_mime_type),
            ),
            info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.input_value_first_101_chars),
            ),
        )
        if not input_value_first_101_chars:
            return None
        return SpanIOValue(
            span_rowid=self.span_rowid,
            attr=models.Span.input_value,
            truncated_value=truncate_value(input_value_first_101_chars),
            mime_type=MimeType(mime_type),
        )

    @strawberry.field
    async def output(
        self,
        info: Info[Context, None],
    ) -> Optional[SpanIOValue]:
        if self.db_span:
            output_value = self.db_span.output_value
            if output_value is None or output_value == "":
                return None
            output_value = str(output_value)
            mime_type = self.db_span.output_mime_type
            return SpanIOValue(
                cached_value=output_value,
                mime_type=MimeType(mime_type),
            )
        mime_type, output_value_first_101_chars = await gather(
            info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.output_mime_type),
            ),
            info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.output_value_first_101_chars),
            ),
        )
        if not output_value_first_101_chars:
            return None
        return SpanIOValue(
            span_rowid=self.span_rowid,
            attr=models.Span.output_value,
            truncated_value=truncate_value(output_value_first_101_chars),
            mime_type=MimeType(mime_type),
        )

    @strawberry.field
    async def events(
        self,
        info: Info[Context, None],
    ) -> list[SpanEvent]:
        if self.db_span:
            return [SpanEvent.from_dict(event) for event in self.db_span.events]
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.events),
        )
        return [SpanEvent.from_dict(event) for event in value]

    @strawberry.field(
        description="Cumulative (prompt plus completion) token count from self "
        "and all descendant spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def cumulative_token_count_total(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.cumulative_llm_token_count_total
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.cumulative_llm_token_count_total),
        )
        return cast(Optional[int], value)

    @strawberry.field(
        description="Cumulative (prompt) token count from self and all descendant "
        "spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def cumulative_token_count_prompt(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.cumulative_llm_token_count_prompt
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.cumulative_llm_token_count_prompt),
        )
        return cast(Optional[int], value)

    @strawberry.field(
        description="Cumulative (completion) token count from self and all descendant "
        "spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def cumulative_token_count_completion(
        self,
        info: Info[Context, None],
    ) -> Optional[int]:
        if self.db_span:
            return self.db_span.cumulative_llm_token_count_completion
        value = await info.context.data_loaders.span_fields.load(
            (self.span_rowid, models.Span.cumulative_llm_token_count_completion),
        )
        return cast(Optional[int], value)

    @strawberry.field(
        description="Propagated status code that percolates up error status codes from "
        "descendant spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def propagated_status_code(
        self,
        info: Info[Context, None],
    ) -> SpanStatusCode:
        if self.db_span:
            value = self.db_span.cumulative_error_count
        else:
            value = await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.cumulative_error_count),
            )
        return SpanStatusCode.ERROR if value else SpanStatusCode.OK

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
        filter: Optional[SpanAnnotationFilter] = None,
    ) -> list[SpanAnnotation]:
        span_id = self.span_rowid
        annotations = await info.context.data_loaders.span_annotations.load(span_id)
        sort_key = SpanAnnotationColumn.name.value
        sort_descending = False
        if filter:
            annotations = [
                annotation for annotation in annotations if satisfies_filter(annotation, filter)
            ]
        if sort:
            sort_key = sort.col.value
            sort_descending = sort.dir is SortDir.desc
        annotations.sort(
            key=lambda annotation: getattr(annotation, sort_key), reverse=sort_descending
        )
        return [to_gql_span_annotation(annotation) for annotation in annotations]

    @strawberry.field(description=("Notes associated with the span."))  # type: ignore
    async def span_notes(
        self,
        info: Info[Context, None],
    ) -> list[SpanAnnotation]:
        span_id = self.span_rowid
        annotations = await info.context.data_loaders.span_annotations.load(span_id)
        annotations = [annotation for annotation in annotations if annotation.name == "note"]
        annotations.sort(key=lambda annotation: getattr(annotation, "created_at"), reverse=False)
        return [to_gql_span_annotation(annotation) for annotation in annotations]

    @strawberry.field(description="Summarizes each annotation (by name) associated with the span")  # type: ignore
    async def span_annotation_summaries(
        self,
        info: Info[Context, None],
        filter: Optional[SpanAnnotationFilter] = None,
    ) -> list[AnnotationSummary]:
        """
        Retrieves and summarizes annotations associated with this span.

        This method aggregates annotation data by name and label, calculating metrics
        such as count of occurrences and sum of scores. The results are organized
        into a structured format that can be easily converted to a DataFrame.

        Args:
            info: GraphQL context information
            filter: Optional filter to apply to annotations before processing

        Returns:
            A list of AnnotationSummary objects, each containing:
            - name: The name of the annotation
            - data: A list of dictionaries with label statistics
        """
        # Load all annotations for this span from the data loader
        annotations = await info.context.data_loaders.span_annotations.load(self.span_rowid)

        # Apply filter if provided to narrow down the annotations
        if filter:
            annotations = [
                annotation for annotation in annotations if satisfies_filter(annotation, filter)
            ]

        @dataclass
        class Metrics:
            record_count: int = 0
            label_count: int = 0
            score_sum: float = 0
            score_count: int = 0

        summaries: defaultdict[str, defaultdict[Optional[str], Metrics]] = defaultdict(
            lambda: defaultdict(Metrics)
        )
        for annotation in annotations:
            metrics = summaries[annotation.name][annotation.label]
            metrics.record_count += 1
            metrics.label_count += int(annotation.label is not None)
            metrics.score_sum += annotation.score or 0
            metrics.score_count += int(annotation.score is not None)

        result: list[AnnotationSummary] = []
        for name, label_metrics in summaries.items():
            rows = [{"label": label, **asdict(metrics)} for label, metrics in label_metrics.items()]
            result.append(AnnotationSummary(name=name, df=pd.DataFrame(rows), simple_avg=True))
        return result

    @strawberry.field(
        description="Evaluations of the documents associated with the span, e.g. "
        "if the span is a RETRIEVER with a list of documents in its RETRIEVAL_DOCUMENTS "
        "attribute, an evaluation for each document may assess its relevance "
        "respect to the input query of the span. Note that RETRIEVAL_DOCUMENTS is "
        "a list, and each evaluation is identified by its document's (zero-based) "
        "index in that list."
    )  # type: ignore
    async def document_evaluations(
        self,
        info: Info[Context, None],
    ) -> list[DocumentEvaluation]:
        return await info.context.data_loaders.document_evaluations.load(self.span_rowid)

    @strawberry.field(
        description="Retrieval metrics: NDCG@K, Precision@K, Reciprocal Rank, etc.",
    )  # type: ignore
    async def document_retrieval_metrics(
        self,
        info: Info[Context, None],
        evaluation_name: Optional[str] = UNSET,
    ) -> list[DocumentRetrievalMetrics]:
        num_documents = (
            self.db_span.num_documents
            if self.db_span
            else await info.context.data_loaders.span_fields.load(
                (self.span_rowid, models.Span.num_documents),
            )
        )
        if not num_documents:
            return []
        return await info.context.data_loaders.document_retrieval_metrics.load(
            (self.span_rowid, evaluation_name or None, num_documents),
        )

    @strawberry.field
    async def num_child_spans(self, info: Info[Context, None]) -> int:
        return await info.context.data_loaders.num_child_spans.load(self.span_rowid)

    @strawberry.field(
        description="All descendant spans (children, grandchildren, etc.)",
    )  # type: ignore
    async def descendants(
        self,
        info: Info[Context, None],
        max_depth: Annotated[
            Optional[int],
            strawberry.argument(
                description="Maximum depth of breadth first search. For example, "
                "maxDepth=1 searches for only the immediate child spans (if any); "
                "maxDepth=2 searches for the immediate child spans plus their children. "
                "maxDepth=0 (or None) means no limit."
            ),
        ] = 3,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection["Span"]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        span_rowids: Iterable[int] = await info.context.data_loaders.span_descendants.load(
            (self.span_rowid, max_depth or None),
        )
        data = [Span(span_rowid=span_rowid) for span_rowid in span_rowids]
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="The span's attributes translated into an example revision for a dataset",
    )  # type: ignore
    async def as_example_revision(
        self,
        info: Info[Context, None],
    ) -> SpanAsExampleRevision:
        span = (
            self.db_span
            if self.db_span
            else await info.context.data_loaders.span_by_id.load(self.span_rowid)
        )

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
        from phoenix.server.api.types.Project import Project

        span_id = self.span_rowid
        project = await info.context.data_loaders.span_projects.load(span_id)
        return Project(project_rowid=project.id, db_project=project)

    @strawberry.field(description="Indicates if the span is contained in any dataset")  # type: ignore
    async def contained_in_dataset(
        self,
        info: Info[Context, None],
    ) -> bool:
        examples = await info.context.data_loaders.span_dataset_examples.load(self.span_rowid)
        return bool(examples)

    @strawberry.field(description="Invocation parameters for the span")  # type: ignore
    async def invocation_parameters(
        self,
        info: Info[Context, None],
    ) -> list[InvocationParameter]:
        from phoenix.server.api.helpers.playground_clients import OpenAIStreamingClient
        from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY

        db_span: models.Span = await info.context.data_loaders.span_by_id.load(self.span_rowid)
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
