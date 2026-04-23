"""Wire-protocol types for the page contexts advertised by the frontend with
each ``/chat`` request.

The ``type`` discriminator strings (``"project"``, ``"trace"``, ``"span"``,
``"span_filter"``) must stay in sync with the TypeScript union defined in
``app/src/agent/context/agentContextTypes.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class _ChatContextBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class ProjectContext(_ChatContextBase):
    type: Literal["project"]
    project_id: str = Field(alias="projectId")


class TraceContext(_ChatContextBase):
    type: Literal["trace"]
    project_id: str = Field(alias="projectId")
    trace_id: str = Field(alias="traceId")


class SpanContext(_ChatContextBase):
    type: Literal["span"]
    project_id: str | None = Field(default=None, alias="projectId")
    span_id: str = Field(alias="spanId")


class SpanFilterContext(_ChatContextBase):
    type: Literal["span_filter"]
    project_id: str = Field(alias="projectId")
    # Filter DSL string — may contain user-authored content, so do not log at DEBUG.
    condition: str


ChatContext = Annotated[
    ProjectContext | TraceContext | SpanContext | SpanFilterContext,
    Field(discriminator="type"),
]


@dataclass
class ResolvedContexts:
    """Resolved view of the advertised contexts, indexed by type for fast lookup."""

    project: ProjectContext | None = None
    trace: TraceContext | None = None
    span: SpanContext | None = None
    span_filter: SpanFilterContext | None = None


def resolve_contexts(items: list[ChatContext] | None) -> ResolvedContexts:
    """Fold a context list into a ``ResolvedContexts`` struct.

    The last instance of each type wins (contexts advertised later in the
    list override earlier ones), which matches the frontend convention of
    route-derived contexts appearing before mount-advertised ones.
    """
    resolved = ResolvedContexts()
    if not items:
        return resolved
    for item in items:
        if isinstance(item, ProjectContext):
            resolved.project = item
        elif isinstance(item, TraceContext):
            resolved.trace = item
        elif isinstance(item, SpanContext):
            resolved.span = item
        elif isinstance(item, SpanFilterContext):
            resolved.span_filter = item
    return resolved
