"""Evaluator result annotation naming, ORM conversion, and target result queries."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping, Optional, Protocol, Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.sql.selectable import Subquery

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType, as_output_configs
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.evaluators.runtime.base import EvaluationResult, result_annotation_names


class TimeWindow(Protocol):
    @property
    def start(self) -> Optional[datetime]: ...

    @property
    def end(self) -> Optional[datetime]: ...


def evaluation_result_to_model(
    result: EvaluationResult,
    *,
    experiment_run_id: Optional[int] = None,
) -> models.ExperimentRunAnnotation:
    return models.ExperimentRunAnnotation(
        experiment_run_id=experiment_run_id,
        name=result["name"],
        annotator_kind=result["annotator_kind"],
        label=result["label"],
        score=result["score"],
        explanation=result["explanation"],
        trace_id=result["trace_id"],
        error=result["error"],
        metadata_=result["metadata"],
        start_time=result["start_time"],
        end_time=result["end_time"],
    )


def primary_result_annotation(
    project_evaluator: models.ProjectEvaluator,
    evaluator: Optional[models.Evaluator],
) -> tuple[str, Optional[OutputConfigType]]:
    """Resolve the annotation name and output config of an evaluator's primary result.

    The primary result is the first output config's result, named per
    `result_annotation_names`.
    """
    configs = as_output_configs(getattr(evaluator, "output_configs", None))
    names = result_annotation_names(project_evaluator.name.root, configs)
    return names[0], configs[0] if configs else None


@dataclass(frozen=True)
class EvaluatorResultLevel:
    """How one evaluation target maps to its annotation and entity tables."""

    annotation: Any
    entity: Any
    entity_id: Any
    annotation_onclause: Any
    joins_trace: bool
    project_col: Any
    time_col: Any


EVALUATOR_RESULT_LEVELS: Mapping[str, EvaluatorResultLevel] = {
    "SPAN": EvaluatorResultLevel(
        annotation=models.SpanAnnotation,
        entity=models.Span,
        entity_id=models.SpanAnnotation.span_rowid,
        annotation_onclause=models.SpanAnnotation.span_rowid == models.Span.id,
        joins_trace=True,
        project_col=models.Trace.project_rowid,
        time_col=models.Trace.start_time,
    ),
    "TRACE": EvaluatorResultLevel(
        annotation=models.TraceAnnotation,
        entity=models.Trace,
        entity_id=models.TraceAnnotation.trace_rowid,
        annotation_onclause=models.TraceAnnotation.trace_rowid == models.Trace.id,
        joins_trace=False,
        project_col=models.Trace.project_rowid,
        time_col=models.Trace.start_time,
    ),
    "SESSION": EvaluatorResultLevel(
        annotation=models.ProjectSessionAnnotation,
        entity=models.ProjectSession,
        entity_id=models.ProjectSessionAnnotation.project_session_id,
        annotation_onclause=models.ProjectSessionAnnotation.project_session_id
        == models.ProjectSession.id,
        joins_trace=False,
        project_col=models.ProjectSession.project_id,
        time_col=models.ProjectSession.start_time,
    ),
}


def evaluator_annotation_rows(
    *columns: Any,
    project_rowid: int,
    evaluation_target: str,
    annotation_names: Sequence[str],
    time_range: TimeWindow,
) -> Select[Any]:
    """Select annotation rows within the evaluated project's target time range."""
    level = EVALUATOR_RESULT_LEVELS.get(evaluation_target)
    if level is None:
        raise BadRequest(f"Unsupported evaluation target: {evaluation_target}")
    if time_range.start is None:
        raise BadRequest("Start time is required")
    stmt = select(*columns).join_from(
        level.annotation, level.entity, onclause=level.annotation_onclause
    )
    if level.joins_trace:
        stmt = stmt.join_from(
            level.entity, models.Trace, onclause=models.Span.trace_rowid == models.Trace.id
        )
    stmt = (
        stmt.where(level.project_col == project_rowid)
        .where(level.annotation.name.in_(annotation_names))
        .where(time_range.start <= level.time_col)
    )
    if time_range.end:
        stmt = stmt.where(level.time_col < time_range.end)
    return stmt


def latest_evaluator_annotations(
    *,
    project_rowid: int,
    evaluation_target: str,
    annotation_names: Sequence[str],
    time_range: TimeWindow,
) -> Subquery:
    """Keep the most recently updated annotation per target and name across identifiers."""
    level = EVALUATOR_RESULT_LEVELS.get(evaluation_target)
    if level is None:
        raise BadRequest(f"Unsupported evaluation target: {evaluation_target}")
    row_number = (
        func.row_number()
        .over(
            partition_by=[level.entity_id, level.annotation.name],
            order_by=[level.annotation.updated_at.desc(), level.annotation.id.desc()],
        )
        .label("row_number")
    )
    annotated = evaluator_annotation_rows(
        level.entity_id.label("entity_id"),
        level.annotation.name.label("name"),
        level.annotation.label.label("label"),
        level.annotation.score.label("score"),
        row_number,
        project_rowid=project_rowid,
        evaluation_target=evaluation_target,
        annotation_names=annotation_names,
        time_range=time_range,
    ).subquery("evaluator_annotations")
    return (
        select(
            annotated.c.entity_id,
            annotated.c.name,
            annotated.c.label,
            annotated.c.score,
        )
        .where(annotated.c.row_number == 1)
        .subquery("latest_evaluator_annotations")
    )
