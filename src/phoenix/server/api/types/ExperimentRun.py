from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.Trace import Trace

if TYPE_CHECKING:
    from .DatasetExample import DatasetExample
    from .Trace import Trace


@strawberry.type
class ExperimentRun(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.ExperimentRun]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("ExperimentRun ID mismatch")

    @strawberry.field
    async def experiment_id(self, info: Info[Context, None]) -> GlobalID:
        from .Experiment import Experiment

        if self.db_record:
            experiment_id = self.db_record.experiment_id
        else:
            experiment_id = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.experiment_id),
            )
        return GlobalID(Experiment.__name__, str(experiment_id))

    @strawberry.field
    async def repetition_number(self, info: Info[Context, None]) -> int:
        if self.db_record:
            val = self.db_record.repetition_number
        else:
            val = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.repetition_number),
            )
        return val

    @strawberry.field
    async def trace_id(self, info: Info[Context, None]) -> Optional[str]:
        if self.db_record:
            val = self.db_record.trace_id
        else:
            val = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.trace_id),
            )
        return val

    @strawberry.field
    async def output(self, info: Info[Context, None]) -> Optional[JSON]:
        if self.db_record:
            output_dict = self.db_record.output
        else:
            output_dict = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.output),
            )
        return output_dict.get("task_output") if output_dict else None

    @strawberry.field
    async def start_time(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.start_time
        else:
            val = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.start_time),
            )
        return val

    @strawberry.field
    async def end_time(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.end_time
        else:
            val = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.end_time),
            )
        return val

    @strawberry.field
    async def error(self, info: Info[Context, None]) -> Optional[str]:
        if self.db_record:
            val = self.db_record.error
        else:
            val = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.error),
            )
        return val

    @strawberry.field
    async def latency_ms(self, info: Info[Context, None]) -> float:
        if self.db_record:
            val = self.db_record.latency_ms
        else:
            val = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.latency_ms),
            )
        return val

    @strawberry.field
    async def annotations(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[ExperimentRunAnnotation]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        annotations = await info.context.data_loaders.experiment_run_annotations.load(self.id)
        return connection_from_list(
            [
                ExperimentRunAnnotation(id=annotation.id, db_record=annotation)
                for annotation in annotations
            ],
            args,
        )

    @strawberry.field
    async def trace(
        self, info: Info[Context, None]
    ) -> Optional[Annotated["Trace", strawberry.lazy(".Trace")]]:
        if self.db_record:
            trace_id = self.db_record.trace_id
        else:
            trace_id = await info.context.data_loaders.experiment_run_fields.load(
                (self.id, models.ExperimentRun.trace_id),
            )
        if not trace_id:
            return None
        loader = info.context.data_loaders.trace_by_trace_ids
        if (trace := await loader.load(trace_id)) is None:
            return None
        from .Trace import Trace

        return Trace(id=trace.id, db_record=trace)

    @strawberry.field
    async def example(
        self, info: Info[Context, None]
    ) -> Annotated[
        "DatasetExample", strawberry.lazy(".DatasetExample")
    ]:  # use lazy types to avoid circular import: https://strawberry.rocks/docs/types/lazy
        from .DatasetExample import DatasetExample

        loader = info.context.data_loaders.dataset_examples_and_versions_by_experiment_run
        (example, version_id) = await loader.load(self.id)
        return DatasetExample(id=example.id, db_record=example, version_id=version_id)

    @strawberry.field
    async def cost_summary(self, info: Info[Context, None]) -> SpanCostSummary:
        summary = await info.context.data_loaders.span_cost_summary_by_experiment_run.load(self.id)
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
                coalesce(func.sum(models.SpanCostDetail.cost), 0).label("cost"),
                coalesce(func.sum(models.SpanCostDetail.tokens), 0).label("tokens"),
            )
            .select_from(models.SpanCostDetail)
            .join(models.SpanCost, models.SpanCostDetail.span_cost_id == models.SpanCost.id)
            .join(models.Span, models.SpanCost.span_rowid == models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .join(models.ExperimentRun, models.ExperimentRun.trace_id == models.Trace.trace_id)
            .where(models.ExperimentRun.id == self.id)
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
