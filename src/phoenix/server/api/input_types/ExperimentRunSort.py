from enum import Enum, auto
from typing import Any, Optional

import strawberry
from sqlalchemy import ColumnElement, Select, select, tuple_
from strawberry import Maybe
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.api.types.SortDir import SortDir


@strawberry.enum
class ExperimentRunMetric(Enum):
    tokenCountTotal = auto()
    latencyMs = auto()
    tokenCostTotal = auto()


@strawberry.input(one_of=True)
class ExperimentRunColumn:
    metric: Maybe[ExperimentRunMetric]
    annotation_name: Maybe[str]


@strawberry.input(description="The sort key and direction for experiment run connections")
class ExperimentRunSort:
    col: ExperimentRunColumn
    dir: SortDir


def add_order_by_and_page_start_to_query(
    query: Select[tuple[models.ExperimentRun]],
    sort: Optional[ExperimentRunSort],
    after_experiment_run_rowid: Optional[int],
) -> Select[tuple[models.ExperimentRun]]:
    order_by_columns = _get_order_by_columns(sort)
    query = query.order_by(*order_by_columns)
    if after_experiment_run_rowid is not None:
        after_expression = _get_after_expression(sort, after_experiment_run_rowid)
        query = query.where(after_expression)
    query = _add_joins_to_query(query, sort)
    return query


def _get_order_by_columns(sort: Optional[ExperimentRunSort]) -> tuple[ColumnElement[Any], ...]:
    if not sort:
        return (
            models.ExperimentRun.dataset_example_id.asc(),
            models.ExperimentRun.repetition_number.asc(),
        )
    sort_direction = sort.dir
    if sort.col.metric:
        metric = sort.col.metric.value
        assert metric is not None
        if metric is ExperimentRunMetric.tokenCountTotal:
            raise NotImplementedError
        elif metric is ExperimentRunMetric.latencyMs:
            if sort_direction is SortDir.asc:
                return (models.ExperimentRun.latency_ms.asc(),)
            else:
                return (models.ExperimentRun.latency_ms.desc(),)
        elif metric is ExperimentRunMetric.tokenCostTotal:
            raise NotImplementedError
        else:
            assert_never(metric)
    raise NotImplementedError


def _get_after_expression(
    sort: Optional[ExperimentRunSort],
    experiment_run_rowid: int,
) -> Any:
    if not sort:
        example_id = (
            select(models.ExperimentRun.dataset_example_id)
            .where(models.ExperimentRun.id == experiment_run_rowid)
            .scalar_subquery()
        )
        repetition_number = (
            select(models.ExperimentRun.repetition_number)
            .where(models.ExperimentRun.id == experiment_run_rowid)
            .scalar_subquery()
        )
        return tuple_(
            models.ExperimentRun.dataset_example_id,
            models.ExperimentRun.repetition_number,
        ) > (
            tuple_(
                example_id,
                repetition_number,
            )
        )
    sort_direction = sort.dir
    if sort.col.metric:
        metric = sort.col.metric.value
        assert metric is not None
        if metric is ExperimentRunMetric.tokenCountTotal:
            raise NotImplementedError
        elif metric is ExperimentRunMetric.latencyMs:
            latency_ms = (
                select(models.ExperimentRun.latency_ms)
                .where(models.ExperimentRun.id == experiment_run_rowid)
                .scalar_subquery()
            )
            if sort_direction is SortDir.asc:
                return models.ExperimentRun.latency_ms > latency_ms
            else:
                return models.ExperimentRun.latency_ms < latency_ms
        elif metric is ExperimentRunMetric.tokenCostTotal:
            raise NotImplementedError
        else:
            assert_never(metric)
    raise NotImplementedError


def _add_joins_to_query(
    query: Select[tuple[models.ExperimentRun]],
    sort: Optional[ExperimentRunSort],
) -> Select[tuple[models.ExperimentRun]]:
    if not sort:
        return query
    if sort.col.metric:
        metric = sort.col.metric.value
        assert metric is not None
        if metric == ExperimentRunMetric.tokenCountTotal:
            raise NotImplementedError
        elif metric == ExperimentRunMetric.latencyMs:
            return query
        elif metric == ExperimentRunMetric.tokenCostTotal:
            raise NotImplementedError
        else:
            assert_never(metric)
    raise NotImplementedError
