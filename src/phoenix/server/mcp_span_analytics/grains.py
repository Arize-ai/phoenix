"""Queryable grains of the span analytics surface.

A grain is the relation a query reads: which rows exist, what one row
means, and which columns are addressable on it. Two grains ship:

- **``spans``** — one row per span, the surface's original and default
  grain. Its fields are the registry's authored catalog plus attribute
  paths observed in the project's data plus annotation enrichment.
- **``annotations``** — one row per annotation, unioned across every
  annotation target Phoenix records (span, trace, document, and session)
  with ``target`` as an ordinary groupable dimension. Its field set is
  closed: annotations carry typed columns, not a free-form attribute blob,
  so nothing here is discovered.

The two grains answer different questions, and which one is right follows
from the subject of the question rather than from the data it touches.
"Correctness by prompt version" is a question about spans, so it belongs to
the ``spans`` grain, where each span contributes one reduced value. "Which
annotators scored this release, and how many times" is a question about
annotations, so it belongs to the ``annotations`` grain, where each
annotation contributes one row. Asking the second question on the first
grain is what makes annotator-mix artifacts invisible.

Both grains bind their project scope and time window through
:meth:`Grain.scoped`, which is the only statement base in this package —
an unscoped query stays inexpressible rather than merely discouraged.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Any, Mapping, Optional, Sequence

from sqlalchemy import (
    Integer,
    Select,
    SQLColumnExpression,
    String,
    cast,
    literal,
    null,
    select,
    union_all,
)
from sqlalchemy.sql.expression import ColumnElement

from phoenix.db import models
from phoenix.server.mcp_span_analytics import registry
from phoenix.server.mcp_span_analytics.registry import AuthoredField

#: Grain ids, as written in a request's ``from``.
SPANS = "spans"
ANNOTATIONS = "annotations"

#: The annotation targets Phoenix records. Every one of them is an arm of
#: the annotations union, so ``target`` discriminates rows that are
#: otherwise identically shaped.
ANNOTATION_TARGETS: tuple[str, ...] = ("span", "trace", "document", "session")


# --------------------------------------------------------------------------
# The annotations union
# --------------------------------------------------------------------------


def _annotation_id(target: str, column: Any) -> ColumnElement[Any]:
    """A row identity unique across the union's arms.

    Each annotation table numbers its rows independently, so the row id
    alone collides across targets; prefixing with the target makes one
    opaque string that identifies an annotation globally.
    """
    return literal(f"{target}:", String) + cast(column, String)


def _span_annotation_arm() -> Select[Any]:
    return (
        select(
            models.Trace.project_rowid.label("project_rowid"),
            models.Span.start_time.label("start_time"),
            literal("span", String).label("target"),
            models.Span.span_id.label("target_id"),
            _annotation_id("span", models.SpanAnnotation.id).label("annotation_id"),
            models.SpanAnnotation.name.label("name"),
            models.SpanAnnotation.label.label("label"),
            models.SpanAnnotation.score.label("score"),
            models.SpanAnnotation.explanation.label("explanation"),
            models.SpanAnnotation.annotator_kind.label("annotator_kind"),
            models.SpanAnnotation.identifier.label("identifier"),
            models.SpanAnnotation.source.label("source"),
            models.SpanAnnotation.created_at.label("created_at"),
            models.Trace.trace_id.label("trace_id"),
            cast(null(), Integer).label("document_position"),
        )
        .select_from(models.SpanAnnotation)
        .join(models.Span, models.SpanAnnotation.span_rowid == models.Span.id)
        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
    )


def _trace_annotation_arm() -> Select[Any]:
    return (
        select(
            models.Trace.project_rowid.label("project_rowid"),
            models.Trace.start_time.label("start_time"),
            literal("trace", String).label("target"),
            models.Trace.trace_id.label("target_id"),
            _annotation_id("trace", models.TraceAnnotation.id).label("annotation_id"),
            models.TraceAnnotation.name.label("name"),
            models.TraceAnnotation.label.label("label"),
            models.TraceAnnotation.score.label("score"),
            models.TraceAnnotation.explanation.label("explanation"),
            models.TraceAnnotation.annotator_kind.label("annotator_kind"),
            models.TraceAnnotation.identifier.label("identifier"),
            models.TraceAnnotation.source.label("source"),
            models.TraceAnnotation.created_at.label("created_at"),
            models.Trace.trace_id.label("trace_id"),
            cast(null(), Integer).label("document_position"),
        )
        .select_from(models.TraceAnnotation)
        .join(models.Trace, models.TraceAnnotation.trace_rowid == models.Trace.id)
    )


def _document_annotation_arm() -> Select[Any]:
    return (
        select(
            models.Trace.project_rowid.label("project_rowid"),
            models.Span.start_time.label("start_time"),
            literal("document", String).label("target"),
            models.Span.span_id.label("target_id"),
            _annotation_id("document", models.DocumentAnnotation.id).label("annotation_id"),
            models.DocumentAnnotation.name.label("name"),
            models.DocumentAnnotation.label.label("label"),
            models.DocumentAnnotation.score.label("score"),
            models.DocumentAnnotation.explanation.label("explanation"),
            models.DocumentAnnotation.annotator_kind.label("annotator_kind"),
            models.DocumentAnnotation.identifier.label("identifier"),
            models.DocumentAnnotation.source.label("source"),
            models.DocumentAnnotation.created_at.label("created_at"),
            models.Trace.trace_id.label("trace_id"),
            models.DocumentAnnotation.document_position.label("document_position"),
        )
        .select_from(models.DocumentAnnotation)
        .join(models.Span, models.DocumentAnnotation.span_rowid == models.Span.id)
        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
    )


def _session_annotation_arm() -> Select[Any]:
    return (
        select(
            models.ProjectSession.project_id.label("project_rowid"),
            models.ProjectSession.start_time.label("start_time"),
            literal("session", String).label("target"),
            models.ProjectSession.session_id.label("target_id"),
            _annotation_id("session", models.ProjectSessionAnnotation.id).label("annotation_id"),
            models.ProjectSessionAnnotation.name.label("name"),
            models.ProjectSessionAnnotation.label.label("label"),
            models.ProjectSessionAnnotation.score.label("score"),
            models.ProjectSessionAnnotation.explanation.label("explanation"),
            models.ProjectSessionAnnotation.annotator_kind.label("annotator_kind"),
            models.ProjectSessionAnnotation.identifier.label("identifier"),
            models.ProjectSessionAnnotation.source.label("source"),
            models.ProjectSessionAnnotation.created_at.label("created_at"),
            cast(null(), String).label("trace_id"),
            cast(null(), Integer).label("document_position"),
        )
        .select_from(models.ProjectSessionAnnotation)
        .join(
            models.ProjectSession,
            models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
        )
    )


#: The four-arm union, built once. Project and time predicates are applied
#: by the outer statement rather than inside the arms: both backends push a
#: predicate on a union column down into every arm, and keeping the arms
#: free of request state means the union is a constant, not a builder.
ANNOTATIONS_UNION = union_all(
    _span_annotation_arm(),
    _trace_annotation_arm(),
    _document_annotation_arm(),
    _session_annotation_arm(),
).subquery("annotations")


# --------------------------------------------------------------------------
# Annotation grain fields
# --------------------------------------------------------------------------


def _union_column(name: str) -> Any:
    column = ANNOTATIONS_UNION.c[name]

    def factory(dialect: Any) -> Any:
        return column

    return factory


ANNOTATION_FIELDS: tuple[AuthoredField, ...] = (
    AuthoredField(
        id="annotation_id",
        label="Annotation ID",
        type="string",
        description=(
            "Stable row identity of an annotation, unique across targets "
            "(e.g. 'span:412'). Always returned by row queries."
        ),
        factory=_union_column("annotation_id"),
    ),
    AuthoredField(
        id="target",
        label="Annotation target",
        type="string",
        description=(
            "What the annotation is attached to: 'span', 'trace', 'document', or "
            "'session'. Annotations of different targets are different populations — "
            "group or filter by target rather than mixing them silently."
        ),
        factory=_union_column("target"),
        groupable=True,
    ),
    AuthoredField(
        id="target_id",
        label="Target ID",
        type="string",
        description=(
            "Public id of the annotated entity, in its target's own namespace: the "
            "span id for 'span' and 'document' targets (recover the record with "
            "getSpan), the trace id for 'trace' (getTrace), the session id for "
            "'session'."
        ),
        factory=_union_column("target_id"),
    ),
    AuthoredField(
        id="name",
        label="Annotation name",
        type="string",
        description=(
            "Annotation name, e.g. 'correctness'. Project data, not a fixed "
            "vocabulary — describeSpans lists the names observed in this project."
        ),
        factory=_union_column("name"),
        groupable=True,
    ),
    AuthoredField(
        id="score",
        label="Score",
        type="float",
        description=(
            "Numeric score, NULL on label-only annotations. Averaging over this grain "
            "weights every annotation equally, so a shift in the annotator mix moves "
            "the average even when no annotator changed its scoring — break down by "
            "annotator_kind to see the composition."
        ),
        factory=_union_column("score"),
        aggregatable=True,
    ),
    AuthoredField(
        id="label",
        label="Label",
        type="string",
        description="Categorical label, NULL on score-only annotations.",
        factory=_union_column("label"),
        groupable=True,
    ),
    AuthoredField(
        id="explanation",
        label="Explanation",
        type="string",
        description=(
            "The annotator's written rationale; NULL when none was recorded. Often "
            "large, so row results clip it to a preview — recover the full text with "
            "getSpan on the row's target_id."
        ),
        factory=_union_column("explanation"),
    ),
    AuthoredField(
        id="annotator_kind",
        label="Annotator kind",
        type="string",
        description=(
            "Who produced the annotation: 'LLM', 'CODE', or 'HUMAN'. The dimension "
            "that separates a real quality change from a change in who was measuring."
        ),
        factory=_union_column("annotator_kind"),
        groupable=True,
    ),
    AuthoredField(
        id="identifier",
        label="Annotator identifier",
        type="string",
        description=(
            "Distinguishes annotators writing under one name; empty string when the "
            "annotation carries no identifier. Uniqueness is (name, target, "
            "identifier), so this is what makes several annotations of one name on "
            "one span legal."
        ),
        factory=_union_column("identifier"),
        groupable=True,
    ),
    AuthoredField(
        id="source",
        label="Source",
        type="string",
        description="How the annotation was written: 'API' or 'APP'.",
        factory=_union_column("source"),
        groupable=True,
    ),
    AuthoredField(
        id="created_at",
        label="Annotation created",
        type="datetime",
        description=(
            "When the annotation was written, UTC. Distinct from start_time, which is "
            "when the annotated work ran — an annotation written today can score a "
            "span from last week. Not filterable: temporal scope has one home, "
            "time_range, and it binds start_time."
        ),
        factory=_union_column("created_at"),
        filterable=False,
    ),
    AuthoredField(
        id="start_time",
        label="Target start time",
        type="datetime",
        description=(
            "Start of the annotated span, trace, or session, UTC — the time this "
            "grain's time_range binds, so the same window selects the same underlying "
            "work on both grains. Not filterable: time_range is its only home."
        ),
        factory=_union_column("start_time"),
        filterable=False,
    ),
    AuthoredField(
        id="trace_id",
        label="Trace ID",
        type="string",
        description=(
            "Trace of the annotated entity; NULL for session annotations, which do not "
            "belong to a single trace. Pass it to getTrace for the span tree."
        ),
        factory=_union_column("trace_id"),
    ),
    AuthoredField(
        id="document_position",
        label="Document position",
        type="integer",
        description=(
            "Zero-based position of the annotated retrieval document within its span; "
            "NULL unless target is 'document'."
        ),
        factory=_union_column("document_position"),
        groupable=True,
    ),
)


# --------------------------------------------------------------------------
# Grains
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Grain:
    """One queryable relation: its fields, its scope, and its row identity."""

    id: str
    label: str
    description: str
    fields: tuple[AuthoredField, ...]
    fields_by_id: Mapping[str, AuthoredField]
    #: Field every row query returns whether or not it was selected, so no
    #: result row is unrecoverable.
    identity_field: str
    default_row_fields: tuple[str, ...]
    #: Field ``time_range`` binds, and the default row ordering key.
    time_field: str
    #: That field's column, held directly so scoping never depends on a
    #: dialect the scope call does not have.
    time_column: SQLColumnExpression[Any]
    #: Unique column ending every ordering, so ties break reproducibly.
    tiebreak_column: SQLColumnExpression[Any]
    #: Whether seeded random sampling is offered. It probes a dense integer
    #: row id; the annotations union has no such key (its arms number their
    #: rows independently), so the capability is published as absent rather
    #: than approximated.
    supports_sampling: bool
    #: Whether identifiers may resolve to attribute paths discovered in the
    #: project's data. Only the spans grain carries a free-form blob.
    admits_observed_paths: bool
    #: Whether ``annotations["name"].score``-style enrichment resolves here.
    #: On the annotations grain the annotation is the row, so a reduction
    #: over it would be answering the question twice.
    admits_annotation_enrichment: bool
    #: Whether the filter grammar's annotation existence predicates apply.
    admits_annotation_predicates: bool

    def scoped(
        self,
        columns: Sequence[Any],
        project_rowid: int,
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> Select[Any]:
        """The grain's only statement base: bound to one project, and to the
        time window when one is given. Deliberately unordered — aggregates
        must not inherit row ordering, and PostgreSQL rejects ordering by
        ungrouped columns.
        """
        stmt: Select[Any] = select(*columns)
        if self.id == SPANS:
            stmt = stmt.select_from(models.Span).join(
                models.Trace, models.Span.trace_rowid == models.Trace.id
            )
            project_column: SQLColumnExpression[Any] = models.Trace.project_rowid
        else:
            stmt = stmt.select_from(ANNOTATIONS_UNION)
            project_column = ANNOTATIONS_UNION.c.project_rowid
        stmt = stmt.where(project_column == project_rowid)
        if start is not None and end is not None:
            stmt = stmt.where(self.time_column >= start, self.time_column < end)
        return stmt


def _by_id(fields: Sequence[AuthoredField]) -> Mapping[str, AuthoredField]:
    return MappingProxyType({f.id: f for f in fields})


SPANS_GRAIN = Grain(
    id=SPANS,
    label="Spans",
    description=(
        "One row per span: the traced unit of work. The default grain, and the one "
        "whose subject is the application's behavior — latency, errors, tokens, cost, "
        "model, and any attribute the application recorded."
    ),
    fields=registry.AUTHORED_FIELDS,
    fields_by_id=registry.AUTHORED_BY_ID,
    identity_field="span_id",
    default_row_fields=(
        "span_id",
        "trace_id",
        "name",
        "span_kind",
        "status_code",
        "start_time",
        "latency_ms",
    ),
    time_field="start_time",
    time_column=models.Span.start_time,
    tiebreak_column=models.Span.id,
    supports_sampling=True,
    admits_observed_paths=True,
    admits_annotation_enrichment=True,
    admits_annotation_predicates=True,
)

ANNOTATIONS_GRAIN = Grain(
    id=ANNOTATIONS,
    label="Annotations",
    description=(
        "One row per annotation — an eval score, label, or human review — across every "
        "target Phoenix annotates (span, trace, document, session), discriminated by "
        "the target dimension. The grain to use when the annotation itself is the "
        "subject: score distributions, annotator composition, label breakdowns. "
        "time_range binds the annotated work's start_time, not the annotation's "
        "created_at, so a window here selects the same population it selects on spans."
    ),
    fields=ANNOTATION_FIELDS,
    fields_by_id=_by_id(ANNOTATION_FIELDS),
    identity_field="annotation_id",
    default_row_fields=(
        "annotation_id",
        "target",
        "target_id",
        "name",
        "label",
        "score",
        "annotator_kind",
        "identifier",
        "start_time",
    ),
    time_field="start_time",
    time_column=ANNOTATIONS_UNION.c.start_time,
    tiebreak_column=ANNOTATIONS_UNION.c.annotation_id,
    supports_sampling=False,
    admits_observed_paths=False,
    admits_annotation_enrichment=False,
    admits_annotation_predicates=False,
)

GRAINS: Mapping[str, Grain] = MappingProxyType(
    {grain.id: grain for grain in (SPANS_GRAIN, ANNOTATIONS_GRAIN)}
)
