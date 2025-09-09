import re
from base64 import b64decode, b64encode
from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import and_, select
from strawberry import UNSET
from strawberry.relay import GlobalID, Node
from strawberry.relay.types import Connection
from strawberry.types import Info
from typing_extensions import Self, TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import connection_from_cursors_and_nodes
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary

if TYPE_CHECKING:
    from phoenix.server.api.types.DatasetExample import DatasetExample

ExperimentRowId: TypeAlias = int
DatasetExampleRowId: TypeAlias = int

_DEFAULT_FIRST_EXPERIMENT_RUNS_PAGE_SIZE = 3


@strawberry.type
class ExperimentRepeatedRunGroup(Node):
    experiment_rowid: strawberry.Private[ExperimentRowId]
    dataset_example_rowid: strawberry.Private[DatasetExampleRowId]

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
        return strawberry.ID(str(GlobalID("Experiment", str(self.experiment_rowid))))

    @strawberry.field
    async def example(
        self, info: Info
    ) -> Annotated[
        "DatasetExample", strawberry.lazy("phoenix.server.api.types.DatasetExample")
    ]:  # use lazy types to avoid circular import: https://strawberry.rocks/docs/types/lazy
        from phoenix.server.api.types.DatasetExample import DatasetExample

        example_rowid = self.dataset_example_rowid
        example_created_at = (
            select(models.DatasetExample.created_at)
            .where(models.DatasetExample.id == example_rowid)
            .scalar_subquery()
        )
        dataset_version_id = (
            select(models.Experiment.dataset_version_id)
            .select_from(models.Experiment)
            .join(models.ExperimentRun, models.ExperimentRun.experiment_id == models.Experiment.id)
            .where(models.ExperimentRun.dataset_example_id == example_rowid)
            .scalar_subquery()
        )
        async with info.context.db() as session:
            example_created_at, dataset_version_id = await session.scalars(
                select(
                    example_created_at.label("created_at"),
                    dataset_version_id.label("version_id"),
                )
            )
            assert isinstance(example_created_at, datetime)
            assert isinstance(dataset_version_id, int)

        return DatasetExample(
            id_attr=example_rowid,
            created_at=example_created_at,
            version_id=dataset_version_id,
        )

    @strawberry.field
    async def runs(
        self,
        info: Info,
        first: Optional[int] = _DEFAULT_FIRST_EXPERIMENT_RUNS_PAGE_SIZE,
        last: Optional[int] = UNSET,
        after: Optional[strawberry.ID] = UNSET,
        before: Optional[strawberry.ID] = UNSET,
    ) -> Connection[ExperimentRun]:
        page_size = first or _DEFAULT_FIRST_EXPERIMENT_RUNS_PAGE_SIZE
        experiment_id = self.experiment_rowid
        dataset_example_id = self.dataset_example_rowid
        if not after:  # only the initial page load requires a dataloader
            runs_page = (
                await self.info.context.data_loaders.experiment_runs_by_experiment_run_group.load(
                    (
                        experiment_id,
                        dataset_example_id,
                        page_size,
                    )
                )
            )
            cursors_and_nodes = [
                (str(GlobalID(ExperimentRun.__name__, str(run.id))), to_gql_experiment_run(run))
                for run in runs_page.runs
            ]
            return connection_from_cursors_and_nodes(
                cursors_and_nodes,
                has_previous_page=False,  # set to false since we are only doing forward pagination (https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo.Fields) # noqa: E501
                has_next_page=runs_page.has_next,
            )

        run_rowid = from_global_id_with_expected_type(after, models.ExperimentRun.__name__)
        repetition_number = (
            select(models.ExperimentRun.repetition_number)
            .where(models.ExperimentRun.id == run_rowid)
            .scalar_subquery()
        )
        runs_query = (
            select(models.ExperimentRun)
            .where(
                and_(
                    models.ExperimentRun.experiment_id == experiment_id,
                    models.ExperimentRun.dataset_example_id == dataset_example_id,
                    models.ExperimentRun.repetition_number >= repetition_number,
                )
            )
            .order_by(models.ExperimentRun.repetition_number.asc())
            .limit(page_size + 1)
        )
        async with info.context.db() as session:
            runs = (await session.scalars(runs_query)).all()
            has_next_page = len(runs) > page_size
            runs = runs[:page_size]
        cursors_and_nodes = []
        for run in runs:
            cursors_and_nodes.append(
                (str(GlobalID(ExperimentRun.__name__, str(run.id))), to_gql_experiment_run(run))
            )
        return connection_from_cursors_and_nodes(
            cursors_and_nodes,
            has_previous_page=False,  # set to false since we are only doing forward pagination (https://relay.dev/graphql/connections.htm#sec-undefined.PageInfo.Fields) # noqa: E501
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def run_count(
        self,
        info: Info,
    ) -> int:
        return await info.context.data_loaders.experiment_repeated_run_group_run_counts.load(
            (self.experiment_rowid, self.dataset_example_rowid)
        )

    @strawberry.field
    async def cost_summary(self, info: Info[Context, None]) -> SpanCostSummary:
        run_id = self.id_attr
        example_id = self.dataset_example_rowid
        summary = (
            await info.context.data_loaders.span_cost_summary_by_experiment_repeated_run_group.load(
                (run_id, example_id)
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


_EXPERIMENT_REPEATED_RUN_GROUP_NODE_ID_PATTERN = re.compile(
    r"ExperimentRepeatedRunGroup:experiment_id=(\d+):dataset_example_id=(\d+)"
)


def get_experiment_repeated_run_group_node_id(
    experiment_rowid: ExperimentRowId, dataset_example_rowid: DatasetExampleRowId
) -> str:
    return _base64_encode(
        f"ExperimentRepeatedRunGroup:experiment_id={experiment_rowid}:dataset_example_id={dataset_example_rowid}"
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


def _base64_encode(string: str) -> str:
    return b64encode(string.encode()).decode()


def _base64_decode(string: str) -> str:
    return b64decode(string.encode()).decode()
