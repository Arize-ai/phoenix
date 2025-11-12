from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import func, select
from strawberry import UNSET, Private
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.ExperimentRunSort import (
    ExperimentRunSort,
    add_order_by_and_page_start_to_query,
    get_experiment_run_cursor,
)
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.DatasetSplit import DatasetSplit
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.ExperimentAnnotationSummary import ExperimentAnnotationSummary
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    Cursor,
    CursorString,
    connection_from_cursors_and_nodes,
    connection_from_list,
)
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary

_DEFAULT_EXPERIMENT_RUNS_PAGE_SIZE = 50

if TYPE_CHECKING:
    from .Project import Project


@strawberry.type
class Experiment(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.Experiment]] = None
    cached_sequence_number: Private[Optional[int]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Experiment ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.name),
            )
        return val

    @strawberry.field
    async def project_name(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.project_name
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.project_name),
            )
        return val

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.description),
            )
        return val

    @strawberry.field
    async def repetitions(
        self,
        info: Info[Context, None],
    ) -> int:
        if self.db_record:
            val = self.db_record.repetitions
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.repetitions),
            )
        return val

    @strawberry.field
    async def dataset_version_id(
        self,
        info: Info[Context, None],
    ) -> GlobalID:
        if self.db_record:
            version_id = self.db_record.dataset_version_id
        else:
            version_id = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.dataset_version_id),
            )
        return GlobalID(DatasetVersion.__name__, str(version_id))

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.metadata_),
            )
        return val

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.created_at),
            )
        return val

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.updated_at),
            )
        return val

    @strawberry.field(
        description="Sequence number (1-based) of experiments belonging to the same dataset"
    )  # type: ignore
    async def sequence_number(
        self,
        info: Info[Context, None],
    ) -> int:
        if self.cached_sequence_number is None:
            seq_num = await info.context.data_loaders.experiment_sequence_number.load(self.id)
            if seq_num is None:
                raise ValueError(f"invalid experiment: id={self.id}")
            self.cached_sequence_number = seq_num
        return self.cached_sequence_number

    @strawberry.field
    async def runs(
        self,
        info: Info[Context, None],
        first: Optional[int] = _DEFAULT_EXPERIMENT_RUNS_PAGE_SIZE,
        after: Optional[CursorString] = UNSET,
        sort: Optional[ExperimentRunSort] = UNSET,
    ) -> Connection[ExperimentRun]:
        if first is not None and first <= 0:
            raise BadRequest("first must be a positive integer if set")
        page_size = first or _DEFAULT_EXPERIMENT_RUNS_PAGE_SIZE
        experiment_runs_query = (
            select(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id == self.id)
            .limit(page_size + 1)
        )

        after_experiment_run_rowid = None
        after_sort_column_value = None
        if after:
            cursor = Cursor.from_string(after)
            after_experiment_run_rowid = cursor.rowid
            if cursor.sort_column is not None:
                after_sort_column_value = cursor.sort_column.value

        experiment_runs_query = add_order_by_and_page_start_to_query(
            query=experiment_runs_query,
            sort=sort,
            experiment_rowid=self.id,
            after_experiment_run_rowid=after_experiment_run_rowid,
            after_sort_column_value=after_sort_column_value,
        )

        async with info.context.db() as session:
            results = (await session.execute(experiment_runs_query)).all()

        has_next_page = False
        if len(results) > page_size:
            results = results[:page_size]
            has_next_page = True

        cursors_and_nodes = []
        for result in results:
            run = result[0]
            annotation_score = result[1] if len(result) > 1 else None
            gql_run = ExperimentRun(id=run.id, db_record=run)
            cursor = get_experiment_run_cursor(
                run=run, annotation_score=annotation_score, sort=sort
            )
            cursors_and_nodes.append((cursor, gql_run))

        return connection_from_cursors_and_nodes(
            cursors_and_nodes=cursors_and_nodes,
            has_previous_page=False,  # set to false since we are only doing forward pagination (https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo.Fields) # noqa: E501
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def run_count(self, info: Info[Context, None]) -> int:
        return await info.context.data_loaders.experiment_run_counts.load(self.id)

    @strawberry.field
    async def annotation_summaries(
        self, info: Info[Context, None]
    ) -> list[ExperimentAnnotationSummary]:
        experiment_id = self.id
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
        return await info.context.data_loaders.experiment_error_rates.load(self.id)

    @strawberry.field
    async def average_run_latency_ms(self, info: Info[Context, None]) -> Optional[float]:
        latency_ms = await info.context.data_loaders.average_experiment_run_latency.load(self.id)
        return latency_ms

    @strawberry.field
    async def project(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["Project", strawberry.lazy(".Project")]]:
        if self.db_record:
            project_name = self.db_record.project_name
        else:
            project_name = await info.context.data_loaders.experiment_fields.load(
                (self.id, models.Experiment.project_name),
            )

        if project_name is None:
            return None

        db_project = await info.context.data_loaders.project_by_name.load(project_name)

        if db_project is None:
            return None
        from .Project import Project

        return Project(id=db_project.id, db_record=db_project)

    @strawberry.field
    def last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Experiment, self.id)

    @strawberry.field
    async def cost_summary(self, info: Info[Context, None]) -> SpanCostSummary:
        summary = await info.context.data_loaders.span_cost_summary_by_experiment.load(self.id)
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
            .where(models.ExperimentRun.experiment_id == self.id)
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

    @strawberry.field
    async def dataset_splits(
        self,
        info: Info[Context, None],
    ) -> Connection[DatasetSplit]:
        """Returns the dataset splits associated with this experiment."""
        splits = await info.context.data_loaders.experiment_dataset_splits.load(self.id)
        return connection_from_list(
            [DatasetSplit(id=split.id, db_record=split) for split in splits], ConnectionArgs()
        )


def to_gql_experiment(
    experiment: models.Experiment,
    sequence_number: Optional[int] = None,
) -> Experiment:
    """
    Converts an ORM experiment to a GraphQL Experiment.
    """
    return Experiment(
        id=experiment.id,
        db_record=experiment,
        cached_sequence_number=sequence_number,
    )
