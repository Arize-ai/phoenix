from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel, model_validator
from typing_extensions import assert_never

from phoenix.server.agents.prompts import AgentInstructions

_MAX_CONDITION_CHARS = 512
_MAX_SHORT_FIELD_CHARS = 128


def _sanitize_untrusted_value(value: str, *, enclosing_tag: str, max_chars: int) -> str:
    """Prepare a client-supplied value for safe inclusion in an XML context block.

    Collapses whitespace to a single line (so a multi-line payload cannot
    visually mimic separate directives), neutralizes the closing tag of the
    enclosing block (so the value cannot break out of its wrapper element and
    inject a sibling XML block that the model would read as authoritative),
    and truncates to ``max_chars`` with a visible ``… [truncated]`` marker.
    """
    collapsed = value.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    collapsed = collapsed.replace("\t", " ").strip()
    collapsed = collapsed.replace(f"</{enclosing_tag}>", f"[/{enclosing_tag}]")
    if len(collapsed) > max_chars:
        collapsed = collapsed[:max_chars] + "… [truncated]"
    return collapsed


class _ChatContextBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @abstractmethod
    def render_instruction(self, instructions: AgentInstructions) -> str:
        """Render this context as the XML block injected into the system prompt."""
        ...


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

    def render_instruction(self, instructions: AgentInstructions) -> str:
        sub_lines: list[str] = []
        if self.span_filter is not None:
            if self.span_filter:
                condition = _sanitize_untrusted_value(
                    self.span_filter,
                    enclosing_tag="phoenix_project_context",
                    max_chars=_MAX_CONDITION_CHARS,
                )
                sub_lines.append(
                    f'  <span_filter status="applied">'
                    f"<condition>{condition}</condition>"
                    f"</span_filter>"
                )
            else:
                sub_lines.append('  <span_filter status="available"/>')
        if self.root_spans_only is True:
            sub_lines.append("  <spans_table_view>root_spans_only</spans_table_view>")
            sub_lines.append(
                "  <spans_table_guidance>To include non-root spans on the next "
                "`set_spans_filter` call, set `rootSpansOnly: false`."
                "</spans_table_guidance>"
            )
        elif self.root_spans_only is False:
            sub_lines.append("  <spans_table_view>all_spans</spans_table_view>")
        optional_fields = "\n" + "\n".join(sub_lines) if sub_lines else ""
        return instructions.project_context.format(
            project_node_id=self.project_node_id,
            optional_fields=optional_fields,
        )


class TraceContext(_ChatContextBase):
    type: Literal["trace"]
    project_node_id: str = Field(alias="projectNodeId")
    otel_trace_id: str = Field(alias="otelTraceId")

    def render_instruction(self, instructions: AgentInstructions) -> str:
        return instructions.trace_context.format(
            project_node_id=self.project_node_id,
            otel_trace_id=self.otel_trace_id,
        )


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

    def render_instruction(self, instructions: AgentInstructions) -> str:
        if self.span_node_id is not None:
            element = f'<span_node_id format="phoenix_node_id">{self.span_node_id}</span_node_id>'
        else:
            assert self.otel_span_id is not None
            element = f'<otel_span_id format="otel_hex">{self.otel_span_id}</otel_span_id>'
        if self.project_node_id is not None:
            project_node_id_element = (
                f'\n  <project_node_id format="phoenix_node_id">'
                f"{self.project_node_id}</project_node_id>"
            )
        else:
            project_node_id_element = ""
        return instructions.span_context.format(
            project_node_id_element=project_node_id_element,
            span_id_element=element,
        )


class AppContext(_ChatContextBase):
    """Per-turn browser clock context for resolving relative time requests."""

    type: Literal["app"]
    current_date_time: str = Field(alias="currentDateTime")
    time_zone: str = Field(alias="timeZone")

    def render_instruction(self, instructions: AgentInstructions) -> str:
        sanitized_current_datetime = _sanitize_untrusted_value(
            self.current_date_time,
            enclosing_tag="phoenix_app_context",
            max_chars=_MAX_SHORT_FIELD_CHARS,
        )
        sanitized_time_zone = _sanitize_untrusted_value(
            self.time_zone,
            enclosing_tag="phoenix_app_context",
            max_chars=_MAX_SHORT_FIELD_CHARS,
        )
        return instructions.app_context.format(
            current_browser_datetime=sanitized_current_datetime,
            time_zone=sanitized_time_zone,
        )


class PlaygroundContext(_ChatContextBase):
    """Playground prompt editor state mounted in the current browser route."""

    type: Literal["playground"]
    instance_ids: list[int] = Field(alias="instanceIds")

    def render_instruction(self, instructions: AgentInstructions) -> str:
        if self.instance_ids:
            lines = [
                f'    <instance label="{chr(65 + index)}" instance_id="{instance_id}"/>'
                for index, instance_id in enumerate(self.instance_ids)
            ]
            instance_elements = "\n" + "\n".join(lines) + "\n  "
        else:
            instance_elements = ""
        return instructions.playground_context.format(instance_elements=instance_elements)


class GraphQLContext(_ChatContextBase):
    """GraphQL runtime state.

    Unlike the other contexts this one always emits a block — when no instance
    is present the policy defaults to ``disabled`` (the safe default). Callers
    in the absent case should use :meth:`render_disabled_default`.
    """

    type: Literal["graphql"]
    mutations_enabled: bool = Field(alias="mutationsEnabled")

    def render_instruction(self, instructions: AgentInstructions) -> str:
        return (
            instructions.graphql_mutations_enabled
            if self.mutations_enabled
            else instructions.graphql_mutations_disabled
        )

    @staticmethod
    def render_disabled_default(instructions: AgentInstructions) -> str:
        return instructions.graphql_mutations_disabled


class ChatContext(
    RootModel[
        Annotated[
            AppContext
            | ProjectContext
            | TraceContext
            | AgentSpanContext
            | PlaygroundContext
            | GraphQLContext,
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
    graphql: GraphQLContext | None = None


def resolve_contexts(contexts: list[ChatContext]) -> ResolvedContexts:
    resolved = ResolvedContexts()
    for context in contexts:
        context_value = context.root
        if isinstance(context_value, AppContext):
            resolved.app = context_value
        elif isinstance(context_value, PlaygroundContext):
            resolved.playground = context_value
        elif isinstance(context_value, ProjectContext):
            resolved.project = context_value
        elif isinstance(context_value, TraceContext):
            resolved.trace = context_value
        elif isinstance(context_value, AgentSpanContext):
            resolved.span = context_value
        elif isinstance(context_value, GraphQLContext):
            resolved.graphql = context_value
        else:
            assert_never(context_value)
    return resolved
