from datetime import datetime
from typing import ClassVar, Optional

import strawberry
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import joinedload
from strawberry import UNSET, Private
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.ExperimentRunSort import ExperimentRunSort
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.ExperimentAnnotationSummary import ExperimentAnnotationSummary
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import connection_from_cursors_and_nodes
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary

_DEFAULT_EXPERIMENT_RUNS_PAGE_SIZE = 50


@strawberry.type
class Experiment(Node):
    _table: ClassVar[type[models.Base]] = models.Experiment
    cached_sequence_number: Private[Optional[int]] = None
    id_attr: NodeID[int]
    name: str
    project_name: Optional[str]
    description: Optional[str]
    repetitions: int
    dataset_version_id: GlobalID
    metadata: JSON
    created_at: datetime
    updated_at: datetime

    @strawberry.field(
        description="Sequence number (1-based) of experiments belonging to the same dataset"
    )  # type: ignore
    async def sequence_number(
        self,
        info: Info[Context, None],
    ) -> int:
        if self.cached_sequence_number is None:
            seq_num = await info.context.data_loaders.experiment_sequence_number.load(self.id_attr)
            if seq_num is None:
                raise ValueError(f"invalid experiment: id={self.id_attr}")
            self.cached_sequence_number = seq_num
        return self.cached_sequence_number

    @strawberry.field
    async def runs(
        self,
        info: Info[Context, None],
        first: Optional[int] = _DEFAULT_EXPERIMENT_RUNS_PAGE_SIZE,
        after: Optional[GlobalID] = UNSET,
        sort: Optional[ExperimentRunSort] = UNSET,
    ) -> Connection[ExperimentRun]:
        experiment_id = self.id_attr
        page_size = first if first is not None else _DEFAULT_EXPERIMENT_RUNS_PAGE_SIZE
        experiment_runs_query = (
            select(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == experiment_id)
            .options(joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id))
            .limit(page_size + 1)
        )

        if sort:
            raise NotImplementedError
        else:
            experiment_runs_query = experiment_runs_query.order_by(
                models.ExperimentRun.dataset_example_id.asc(),
                models.ExperimentRun.repetition_number.asc(),
            )

        if after:
            if sort:
                raise NotImplementedError
            try:
                after_run_id = from_global_id_with_expected_type(after, "ExperimentRun")
            except ValueError:
                raise BadRequest(f"Invalid after ID: {after}")
            else:
                after_example_id_subquery = (
                    select(models.ExperimentRun.dataset_example_id)
                    .where(models.ExperimentRun.id == after_run_id)
                    .scalar_subquery()
                )
                after_repetition_number_subquery = (
                    select(models.ExperimentRun.repetition_number)
                    .where(models.ExperimentRun.id == after_run_id)
                    .scalar_subquery()
                )
                experiment_runs_query = experiment_runs_query.where(
                    tuple_(
                        models.ExperimentRun.dataset_example_id,
                        models.ExperimentRun.repetition_number,
                    )
                    > (
                        tuple_(
                            after_example_id_subquery,
                            after_repetition_number_subquery,
                        )
                    )
                )

        async with info.context.db() as session:
            runs = (await session.scalars(experiment_runs_query)).all()

        has_next_page = False
        if len(runs) > page_size:
            runs = runs[:page_size]
            has_next_page = True

        gql_runs = [to_gql_experiment_run(run) for run in runs]
        cursors = [str(GlobalID(ExperimentRun.__name__, str(run.id_attr))) for run in gql_runs]
        return connection_from_cursors_and_nodes(
            cursors_and_nodes=[(cursor, run) for cursor, run in zip(cursors, gql_runs)],
            has_previous_page=False,  # set to false since we are only doing forward pagination (https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo.Fields) # noqa: E501
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def run_count(self, info: Info[Context, None]) -> int:
        experiment_id = self.id_attr
        return await info.context.data_loaders.experiment_run_counts.load(experiment_id)

    @strawberry.field
    async def annotation_summaries(
        self, info: Info[Context, None]
    ) -> list[ExperimentAnnotationSummary]:
        experiment_id = self.id_attr
        return [
            ExperimentAnnotationSummary(
                annotation_name=summary.annotation_name,
                min_score=summary.min_score,
                max_score=summary.max_score,
                mean_score=summary.mean_score,
                count=summary.count,
                error_count=summary.error_count,
            )
            for summary in await info.context.data_loaders.experiment_annotation_summaries.load(
                experiment_id
            )
        ]

    @strawberry.field
    async def error_rate(self, info: Info[Context, None]) -> Optional[float]:
        return await info.context.data_loaders.experiment_error_rates.load(self.id_attr)

    @strawberry.field
    async def average_run_latency_ms(self, info: Info[Context, None]) -> Optional[float]:
        latency_ms = await info.context.data_loaders.average_experiment_run_latency.load(
            self.id_attr
        )
        return latency_ms

    @strawberry.field
    async def project(self, info: Info[Context, None]) -> Optional[Project]:
        if self.project_name is None:
            return None

        db_project = await info.context.data_loaders.project_by_name.load(self.project_name)

        if db_project is None:
            return None

        return Project(
            project_rowid=db_project.id,
            db_project=db_project,
        )

    @strawberry.field
    def last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(self._table, self.id_attr)

    @strawberry.field
    async def cost_summary(self, info: Info[Context, None]) -> SpanCostSummary:
        experiment_id = self.id_attr
        summary = await info.context.data_loaders.span_cost_summary_by_experiment.load(
            experiment_id
        )
        return SpanCostSummary(
            prompt=CostBreakdown(
                tokens=summary.prompt.tokens,
                cost=summary.prompt.cost,
            ),
            completion=CostBreakdown(
                tokens=summary.completion.tokens,
                cost=summary.completion.cost,
            ),
            total=CostBreakdown(
                tokens=summary.total.tokens,
                cost=summary.total.cost,
            ),
        )

    @strawberry.field
    async def cost_detail_summary_entries(
        self, info: Info[Context, None]
    ) -> list[SpanCostDetailSummaryEntry]:
        experiment_id = self.id_attr

        stmt = (
            select(
                models.SpanCostDetail.token_type,
                models.SpanCostDetail.is_prompt,
                func.sum(models.SpanCostDetail.cost).label("cost"),
                func.sum(models.SpanCostDetail.tokens).label("tokens"),
            )
            .select_from(models.SpanCostDetail)
            .join(models.SpanCost, models.SpanCostDetail.span_cost_id == models.SpanCost.id)
            .join(models.Span, models.SpanCost.span_rowid == models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .join(models.ExperimentRun, models.ExperimentRun.trace_id == models.Trace.trace_id)
            .where(models.ExperimentRun.experiment_id == experiment_id)
            .group_by(models.SpanCostDetail.token_type, models.SpanCostDetail.is_prompt)
        )

        async with info.context.db() as session:
            data = await session.stream(stmt)
            return [
                SpanCostDetailSummaryEntry(
                    token_type=token_type,
                    is_prompt=is_prompt,
                    value=CostBreakdown(tokens=tokens, cost=cost),
                )
                async for token_type, is_prompt, cost, tokens in data
            ]


def to_gql_experiment(
    experiment: models.Experiment,
    sequence_number: Optional[int] = None,
) -> Experiment:
    """
    Converts an ORM experiment to a GraphQL Experiment.
    """
    return Experiment(
        cached_sequence_number=sequence_number,
        id_attr=experiment.id,
        name=experiment.name,
        project_name=experiment.project_name,
        description=experiment.description,
        repetitions=experiment.repetitions,
        dataset_version_id=GlobalID(DatasetVersion.__name__, str(experiment.dataset_version_id)),
        metadata=experiment.metadata_,
        created_at=experiment.created_at,
        updated_at=experiment.updated_at,
    )
