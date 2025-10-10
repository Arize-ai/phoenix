import operator
from enum import Enum, auto
from typing import Any, Optional

import strawberry
from sqlalchemy import ColumnElement, Select, and_, func, literal, or_, select, tuple_
from sqlalchemy.sql.selectable import NamedFromClause
from strawberry import Maybe
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.api.types.pagination import (
    Cursor,
    CursorSortColumn,
    CursorSortColumnDataType,
    CursorSortColumnValue,
)
from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ExperimentRunMetric(Enum):
    latencyMs = auto()


@strawberry.input(one_of=True)
class ExperimentRunColumn:
    metric: Maybe[ExperimentRunMetric]
    annotation_name: Maybe[str]


@strawberry.input(description="The sort key and direction for experiment run connections")
class ExperimentRunSort:
    col: ExperimentRunColumn
    dir: SortDir


def get_experiment_run_cursor(
    run: models.ExperimentRun, annotation_score: Optional[float], sort: Optional[ExperimentRunSort]
) -> Cursor:
    sort_column: Optional[CursorSortColumn] = None
    if sort:
        if sort.col.metric:
            metric = sort.col.metric.value
            assert metric is not None
            if metric is ExperimentRunMetric.latencyMs:
                sort_column = CursorSortColumn(
                    type=CursorSortColumnDataType.FLOAT,
                    value=run.latency_ms,
                )
            else:
                assert_never(metric)
        elif sort.col.annotation_name:
            data_type = (
                CursorSortColumnDataType.FLOAT
                if annotation_score is not None
                else CursorSortColumnDataType.NULL
            )
            sort_column = CursorSortColumn(
                type=data_type,
                value=annotation_score,
            )
    return Cursor(rowid=run.id, sort_column=sort_column)


def add_order_by_and_page_start_to_query(
    query: Select[Any],
    sort: Optional[ExperimentRunSort],
    experiment_rowid: int,
    after_experiment_run_rowid: Optional[int],
    after_sort_column_value: Optional[CursorSortColumnValue] = None,
) -> Select[Any]:
    mean_annotation_scores: Optional[NamedFromClause] = None
    if sort and sort.col.annotation_name:
        annotation_name = sort.col.annotation_name.value
        assert annotation_name is not None
        mean_annotation_scores = _get_mean_annotation_scores_subquery(annotation_name)
    order_by_columns = _get_order_by_columns(
        sort=sort, experiment_rowid=experiment_rowid, mean_annotation_scores=mean_annotation_scores
    )
    query = query.order_by(*order_by_columns)
    if after_experiment_run_rowid is not None:
        query = _add_after_expression(
            query=query,
            sort=sort,
            experiment_run_rowid=after_experiment_run_rowid,
            after_sort_column_value=after_sort_column_value,
            mean_annotation_scores=mean_annotation_scores,
        )
    query = _add_joins_and_selects_to_query(
        query=query,
        sort=sort,
        mean_annotation_scores=mean_annotation_scores,
    )
    return query


def _get_order_by_columns(
    sort: Optional[ExperimentRunSort],
    experiment_rowid: int,
    mean_annotation_scores: Optional[NamedFromClause],
) -> tuple[ColumnElement[Any], ...]:
    if not sort:
        # Ideally, this would sort the runs by (example_id, repetition_number),
        # but this would require making the cursor more complex or adding an additional query
        # to handle the after cursor.
        return (models.ExperimentRun.id.asc(),)
    sort_direction = sort.dir
    if sort.col.metric:
        metric = sort.col.metric.value
        assert metric is not None
        if metric is ExperimentRunMetric.latencyMs:
            if sort_direction is SortDir.asc:
                return (models.ExperimentRun.latency_ms.asc(), models.ExperimentRun.id.asc())
            else:
                return (models.ExperimentRun.latency_ms.desc(), models.ExperimentRun.id.desc())
        else:
            assert_never(metric)
    elif sort.col.annotation_name:
        annotation_name = sort.col.annotation_name.value
        assert annotation_name is not None
        assert mean_annotation_scores is not None
        if sort_direction is SortDir.asc:
            return (
                mean_annotation_scores.c.score.asc().nulls_last(),
                models.ExperimentRun.id.asc(),
            )
        else:
            return (
                mean_annotation_scores.c.score.desc().nulls_last(),
                models.ExperimentRun.id.desc(),
            )
    raise NotImplementedError


def _add_after_expression(
    query: Select[Any],
    sort: Optional[ExperimentRunSort],
    experiment_run_rowid: int,
    after_sort_column_value: Optional[CursorSortColumnValue],
    mean_annotation_scores: Optional[NamedFromClause],
) -> Select[Any]:
    if not sort:
        # Ideally, this would return the runs sorted by (example_id, repetition_number),
        # but this would require making the cursor more complex or adding an additional query.
        return query.where(models.ExperimentRun.id > literal(experiment_run_rowid))
    sort_direction = sort.dir
    compare_fn = operator.gt if sort_direction is SortDir.asc else operator.lt
    if sort.col.metric:
        metric = sort.col.metric.value
        assert metric is not None
        if metric is ExperimentRunMetric.latencyMs:
            assert after_sort_column_value is not None
            return query.where(
                compare_fn(
                    tuple_(models.ExperimentRun.latency_ms, models.ExperimentRun.id),
                    tuple_(
                        literal(after_sort_column_value),
                        literal(experiment_run_rowid),
                    ),
                )
            )
        else:
            assert_never(metric)
    elif sort.col.annotation_name:
        annotation_name = sort.col.annotation_name.value
        assert annotation_name is not None
        assert mean_annotation_scores is not None
        if after_sort_column_value is None:
            return query.where(
                and_(
                    compare_fn(models.ExperimentRun.id, literal(experiment_run_rowid)),
                    mean_annotation_scores.c.score.is_(None),
                )
            )
        else:
            return query.where(
                or_(
                    compare_fn(
                        tuple_(mean_annotation_scores.c.score, models.ExperimentRun.id),
                        tuple_(
                            literal(after_sort_column_value),
                            literal(experiment_run_rowid),
                        ),
                    ),
                    mean_annotation_scores.c.score.is_(None),
                )
            )
    raise NotImplementedError


def _get_mean_annotation_scores_subquery(annotation_name: str) -> NamedFromClause:
    return (
        select(
            func.avg(models.ExperimentRunAnnotation.score).label("score"),
            models.ExperimentRunAnnotation.experiment_run_id.label("experiment_run_id"),
        )
        .select_from(models.ExperimentRunAnnotation)
        .join(
            models.ExperimentRun,
            models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
        )
        .where(models.ExperimentRunAnnotation.name == annotation_name)
        .group_by(models.ExperimentRunAnnotation.experiment_run_id)
        .subquery()
        .alias("mean_annotation_scores")
    )


def _add_joins_and_selects_to_query(
    query: Select[tuple[models.ExperimentRun]],
    sort: Optional[ExperimentRunSort],
    mean_annotation_scores: Optional[NamedFromClause],
) -> Select[tuple[models.ExperimentRun]]:
    if not sort:
        return query
    if sort.col.metric:
        metric = sort.col.metric.value
        assert metric is not None
        if metric is ExperimentRunMetric.latencyMs:
            return query
        else:
            assert_never(metric)
    elif sort.col.annotation_name:
        annotation_name = sort.col.annotation_name.value
        assert annotation_name is not None
        assert mean_annotation_scores is not None
        query = query.join(
            mean_annotation_scores,
            mean_annotation_scores.c.experiment_run_id == models.ExperimentRun.id,
            isouter=True,
        )
        query = query.add_columns(
            mean_annotation_scores.c.score.label("score")
        )  # the score must be in the select so that the value can be included in the cursor
        return query
    raise NotImplementedError
