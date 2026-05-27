from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator
from typing_extensions import assert_never


def sanitize_untrusted_value(
    value: str,
    *,
    enclosing_tag: str,
    max_chars: int | None = None,
    preserve_newlines: bool = False,
) -> str:
    """Prepare a client-supplied value for safe inclusion in an XML context block.

    Collapses whitespace to a single line (so a multi-line payload cannot
    visually mimic separate directives), neutralizes the closing tag of the
    enclosing block (so the value cannot break out of its wrapper element and
    inject a sibling XML block that the model would read as authoritative),
    and — when ``max_chars`` is provided — truncates with a visible
    ``… [truncated]`` marker.

    Set ``preserve_newlines=True`` for multi-line payloads (e.g. markdown skill
    content) where structure matters. Closing-tag neutralization and length
    capping still apply.
    """
    if preserve_newlines:
        cleaned = value.strip()
    else:
        cleaned = value.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
        cleaned = cleaned.replace("\t", " ").strip()
    cleaned = cleaned.replace(f"</{enclosing_tag}>", f"[/{enclosing_tag}]")
    if max_chars is not None and len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars] + "… [truncated]"
    return cleaned


class _ChatContextBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ProjectContext(_ChatContextBase):
    """Project the user is currently viewing.

    ``span_filter`` carries the project-scoped span filter expression when the
    span filter field is mounted — empty string when the field is mounted with
    no condition applied, ``None`` when the field is not present at all.

    ``root_spans_only`` carries the current state of the spans-table root vs.
    all toggle when that toggle is mounted — ``True`` when the table is
    restricted to root spans, ``False`` when it shows every span, ``None``
    when the toggle is not present (e.g. on the traces tab).
    """

    type: Literal["project"]
    project_node_id: str = Field(alias="projectNodeId")
    span_filter: str | None = Field(default=None, alias="spanFilter")
    root_spans_only: bool | None = Field(default=None, alias="rootSpansOnly")


class TraceContext(_ChatContextBase):
    type: Literal["trace"]
    project_node_id: str = Field(alias="projectNodeId")
    otel_trace_id: str = Field(alias="otelTraceId")


class AgentSpanContext(_ChatContextBase):
    """Span the user has selected.

    Exactly one of ``span_node_id`` (relay) or ``otel_span_id`` (OpenTelemetry
    hex) must be set. ``project_node_id`` is optional because a span can be
    selected from views outside a project route.
    """

    type: Literal["span"]
    project_node_id: str | None = Field(default=None, alias="projectNodeId")
    span_node_id: str | None = Field(default=None, alias="spanNodeId")
    otel_span_id: str | None = Field(default=None, alias="otelSpanId")

    @model_validator(mode="after")
    def _exactly_one_span_id(self) -> "AgentSpanContext":
        has_node = self.span_node_id is not None
        has_otel = self.otel_span_id is not None
        if has_node == has_otel:
            raise ValueError("AgentSpanContext requires exactly one of spanNodeId or otelSpanId")
        return self


class AppContext(_ChatContextBase):
    """Per-turn browser clock context for resolving relative time requests."""

    type: Literal["app"]
    current_date_time: str = Field(alias="currentDateTime")
    time_zone: str = Field(alias="timeZone")


class PlaygroundContext(_ChatContextBase):
    """Playground prompt editor state mounted in the current browser route."""

    type: Literal["playground"]
    instance_ids: list[int] = Field(alias="instanceIds")


class CodeEvaluatorContext(_ChatContextBase):
    """Code-evaluator create/edit form mounted in the current browser route."""

    type: Literal["code_evaluator"]
    evaluator_node_id: str | None = Field(default=None, alias="evaluatorNodeId")


class DatasetContext(_ChatContextBase):
    """Dataset the user is currently viewing or has bound to a workflow.

    Carries the dataset's relay node id and, when known, the active version
    node id. The agent uses these IDs as a persistence/routing signal — when
    creating a code evaluator the dataset binding is chained onto the create
    mutation; the dataset schema itself is open and the router may add a small
    sample of active examples as prompt context.
    """

    type: Literal["dataset"]
    dataset_node_id: str = Field(alias="datasetNodeId")
    dataset_version_node_id: str | None = Field(default=None, alias="datasetVersionNodeId")


class DatasetEvaluatorsContext(_ChatContextBase):
    """Dataset evaluators tab mounted in the current browser route.

    Carries the dataset relay node id and, when known, the active version
    node id. Advertised by ``DatasetEvaluatorsPage`` so the agent knows the
    surface that can mount the create-code-evaluator slideover is currently
    visible — gating the ``create_code_evaluator`` tool to this page.
    """

    type: Literal["dataset_evaluators"]
    dataset_node_id: str = Field(alias="datasetNodeId")
    dataset_version_node_id: str | None = Field(default=None, alias="datasetVersionNodeId")


class GraphQLContext(_ChatContextBase):
    """GraphQL runtime state."""

    type: Literal["graphql"]
    mutations_enabled: bool = Field(alias="mutationsEnabled")


class WebAccessContext(_ChatContextBase):
    """User's per-turn request to expose web search / fetch tools."""

    type: Literal["web_access"]
    enabled: bool


class ChatContext(
    RootModel[
        Annotated[
            AppContext
            | ProjectContext
            | TraceContext
            | AgentSpanContext
            | PlaygroundContext
            | CodeEvaluatorContext
            | DatasetContext
            | DatasetEvaluatorsContext
            | GraphQLContext
            | WebAccessContext,
            Field(discriminator="type"),
        ]
    ]
):
    """Discriminated union of every UI-state context the agent understands."""


@dataclass
class ResolvedContexts:
    app: AppContext | None = None
    project: ProjectContext | None = None
    trace: TraceContext | None = None
    span: AgentSpanContext | None = None
    playground: PlaygroundContext | None = None
    code_evaluator: CodeEvaluatorContext | None = None
    dataset: DatasetContext | None = None
    dataset_evaluators: DatasetEvaluatorsContext | None = None
    graphql: GraphQLContext | None = None
    web_access: WebAccessContext | None = None


def resolve_contexts(contexts: list[ChatContext]) -> ResolvedContexts:
    resolved = ResolvedContexts()
    for context in contexts:
        context_value = context.root
        if isinstance(context_value, AppContext):
            resolved.app = context_value
        elif isinstance(context_value, PlaygroundContext):
            resolved.playground = context_value
        elif isinstance(context_value, CodeEvaluatorContext):
            resolved.code_evaluator = context_value
        elif isinstance(context_value, DatasetContext):
            resolved.dataset = context_value
        elif isinstance(context_value, DatasetEvaluatorsContext):
            resolved.dataset_evaluators = context_value
        elif isinstance(context_value, ProjectContext):
            resolved.project = context_value
        elif isinstance(context_value, TraceContext):
            resolved.trace = context_value
        elif isinstance(context_value, AgentSpanContext):
            resolved.span = context_value
        elif isinstance(context_value, GraphQLContext):
            resolved.graphql = context_value
        elif isinstance(context_value, WebAccessContext):
            resolved.web_access = context_value
        else:
            assert_never(context_value)
    return resolved
