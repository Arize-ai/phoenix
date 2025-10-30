import re
from base64 import b64decode
from typing import Optional

import strawberry
from sqlalchemy import func, select
from strawberry.relay import GlobalID, Node
from strawberry.types import Info
from typing_extensions import Self, TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.ExperimentRepeatedRunGroupAnnotationSummary import (
    ExperimentRepeatedRunGroupAnnotationSummary,
)
from phoenix.server.api.types.ExperimentRun import ExperimentRun
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary

ExperimentRowId: TypeAlias = int
DatasetExampleRowId: TypeAlias = int


@strawberry.type
class ExperimentRepeatedRunGroup(Node):
    experiment_rowid: strawberry.Private[ExperimentRowId]
    dataset_example_rowid: strawberry.Private[DatasetExampleRowId]
    cached_runs: strawberry.Private[Optional[list[ExperimentRun]]] = None

    @strawberry.field
    async def runs(self, info: Info[Context, None]) -> list[ExperimentRun]:
        if self.cached_runs is not None:
            return self.cached_runs
        runs = await info.context.data_loaders.experiment_runs_by_experiment_and_example.load(
            (self.experiment_rowid, self.dataset_example_rowid)
        )
        return [ExperimentRun(id=run.id, db_record=run) for run in runs]

    @classmethod
    def resolve_id(
        cls,
        root: Self,
        *,
        info: Info,
    ) -> str:
        return (
            f"experiment_id={root.experiment_rowid}:dataset_example_id={root.dataset_example_rowid}"
        )

    @strawberry.field
    def experiment_id(self) -> strawberry.ID:
        from phoenix.server.api.types.Experiment import Experiment

        return strawberry.ID(str(GlobalID(Experiment.__name__, str(self.experiment_rowid))))

    @strawberry.field
    async def average_latency_ms(self, info: Info[Context, None]) -> Optional[float]:
        return await info.context.data_loaders.average_experiment_repeated_run_group_latency.load(
            (self.experiment_rowid, self.dataset_example_rowid)
        )

    @strawberry.field
    async def cost_summary(self, info: Info[Context, None]) -> SpanCostSummary:
        experiment_id = self.experiment_rowid
        example_id = self.dataset_example_rowid
        summary = (
            await info.context.data_loaders.span_cost_summary_by_experiment_repeated_run_group.load(
                (experiment_id, example_id)
            )
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
        experiment_id = self.experiment_rowid
        example_id = self.dataset_example_rowid
        stmt = (
            select(
                models.SpanCostDetail.token_type,
                models.SpanCostDetail.is_prompt,
                func.sum(models.SpanCostDetail.cost).label("cost"),
                func.sum(models.SpanCostDetail.tokens).label("tokens"),
            )
            .select_from(models.SpanCostDetail)
            .join(models.SpanCost, models.SpanCostDetail.span_cost_id == models.SpanCost.id)
            .join(models.Trace, models.SpanCost.trace_rowid == models.Trace.id)
            .join(models.ExperimentRun, models.ExperimentRun.trace_id == models.Trace.trace_id)
            .where(models.ExperimentRun.experiment_id == experiment_id)
            .where(models.ExperimentRun.dataset_example_id == example_id)
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
    async def annotation_summaries(
        self,
        info: Info[Context, None],
    ) -> list[ExperimentRepeatedRunGroupAnnotationSummary]:
        loader = info.context.data_loaders.experiment_repeated_run_group_annotation_summaries
        summaries = await loader.load((self.experiment_rowid, self.dataset_example_rowid))
        return [
            ExperimentRepeatedRunGroupAnnotationSummary(
                annotation_name=summary.annotation_name,
                mean_score=summary.mean_score,
            )
            for summary in summaries
        ]


_EXPERIMENT_REPEATED_RUN_GROUP_NODE_ID_PATTERN = re.compile(
    r"ExperimentRepeatedRunGroup:experiment_id=(\d+):dataset_example_id=(\d+)"
)


def parse_experiment_repeated_run_group_node_id(
    node_id: str,
) -> tuple[ExperimentRowId, DatasetExampleRowId]:
    decoded_node_id = _base64_decode(node_id)
    match = re.match(_EXPERIMENT_REPEATED_RUN_GROUP_NODE_ID_PATTERN, decoded_node_id)
    if not match:
        raise ValueError(f"Invalid node ID format: {node_id}")

    experiment_id = int(match.group(1))
    dataset_example_id = int(match.group(2))
    return experiment_id, dataset_example_id


def _base64_decode(string: str) -> str:
    return b64decode(string.encode()).decode()
