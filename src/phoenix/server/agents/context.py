"""The chat contexts a client sends with a turn, and their resolution."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, RootModel
from typing_extensions import assert_never

from phoenix.db.types.data_stream_protocol.ui_state_types import (
    BaseUIContext,
    CodeEvaluatorUIContext,
    DatasetUIContext,
    LlmEvaluatorUIContext,
    PlaygroundUIContext,
    ProjectUIContext,
    PromptUIContext,
    PromptVersionUIContext,
    SessionUIContext,
    SpanUIContext,
    TraceUIContext,
)

logger = logging.getLogger(__name__)


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


class AppContext(BaseUIContext):
    """Per-turn browser clock context for resolving relative time requests."""

    type: Literal["app"]
    current_date_time: str
    time_zone: str


class GraphQLContext(BaseUIContext):
    """Deprecated GraphQL mutations opt-in."""

    model_config = ConfigDict(json_schema_extra={"deprecated": True})

    type: Literal["graphql"]
    mutations_enabled: bool


class WebAccessContext(BaseUIContext):
    """User's per-turn request to expose web search / fetch tools."""

    type: Literal["web_access"]
    enabled: bool


class SubagentsContext(BaseUIContext):
    """User's per-turn request to expose the subagent-spawning tool."""

    type: Literal["subagents"]
    enabled: bool


class ChatContext(
    RootModel[
        Annotated[
            AppContext
            | ProjectUIContext
            | TraceUIContext
            | SessionUIContext
            | PromptUIContext
            | PromptVersionUIContext
            | SpanUIContext
            | PlaygroundUIContext
            | CodeEvaluatorUIContext
            | LlmEvaluatorUIContext
            | DatasetUIContext
            | GraphQLContext
            | WebAccessContext
            | SubagentsContext,
            Field(discriminator="type"),
        ]
    ]
):
    """Discriminated union of every UI-state context the agent understands."""


@dataclass
class ResolvedContexts:
    app: AppContext | None = None
    project: ProjectUIContext | None = None
    trace: TraceUIContext | None = None
    session: SessionUIContext | None = None
    prompt: PromptUIContext | None = None
    prompt_version: PromptVersionUIContext | None = None
    span: SpanUIContext | None = None
    playground: PlaygroundUIContext | None = None
    code_evaluator: CodeEvaluatorUIContext | None = None
    llm_evaluator: LlmEvaluatorUIContext | None = None
    dataset: DatasetUIContext | None = None
    graphql: GraphQLContext | None = None
    web_access: WebAccessContext | None = None
    subagents: SubagentsContext | None = None

    @property
    def graphql_mutations_enabled(self) -> bool:
        """Whether the client allows GraphQL mutations."""
        return self.graphql is None or self.graphql.mutations_enabled


def resolve_contexts(contexts: list[ChatContext]) -> ResolvedContexts:
    resolved = ResolvedContexts()
    for context in contexts:
        context_value = context.root
        if isinstance(context_value, AppContext):
            resolved.app = context_value
        elif isinstance(context_value, PlaygroundUIContext):
            resolved.playground = context_value
        elif isinstance(context_value, CodeEvaluatorUIContext):
            resolved.code_evaluator = context_value
        elif isinstance(context_value, LlmEvaluatorUIContext):
            resolved.llm_evaluator = context_value
        elif isinstance(context_value, DatasetUIContext):
            resolved.dataset = context_value
        elif isinstance(context_value, ProjectUIContext):
            resolved.project = context_value
        elif isinstance(context_value, TraceUIContext):
            resolved.trace = context_value
        elif isinstance(context_value, SessionUIContext):
            resolved.session = context_value
        elif isinstance(context_value, PromptUIContext):
            resolved.prompt = context_value
        elif isinstance(context_value, PromptVersionUIContext):
            resolved.prompt_version = context_value
        elif isinstance(context_value, SpanUIContext):
            resolved.span = context_value
        elif isinstance(context_value, GraphQLContext):
            logger.warning(
                "The 'graphql' chat context is deprecated: GraphQL mutations are "
                "enabled by default and the field will be removed in a future "
                "release. Stop sending it, or upgrade the client."
            )
            resolved.graphql = context_value
        elif isinstance(context_value, WebAccessContext):
            resolved.web_access = context_value
        elif isinstance(context_value, SubagentsContext):
            resolved.subagents = context_value
        else:
            assert_never(context_value)
    return resolved
