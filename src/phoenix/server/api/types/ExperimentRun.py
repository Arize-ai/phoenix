import re
from base64 import b64decode, b64encode
from datetime import datetime
from typing import TYPE_CHECKING, Annotated

import strawberry
from sqlalchemy import select
from strawberry.relay import GlobalID, Node
from strawberry.types import Info
from typing_extensions import Self, TypeAlias

from phoenix.db import models
from phoenix.server.api.types.ExperimentRepetition import ExperimentRepetition

if TYPE_CHECKING:
    from phoenix.server.api.types.DatasetExample import DatasetExample

ExperimentRowId: TypeAlias = int
DatasetExampleRowId: TypeAlias = int


@strawberry.type
class ExperimentRun(Node):
    experiment_rowid: strawberry.Private[ExperimentRowId]
    dataset_example_rowid: strawberry.Private[DatasetExampleRowId]
    repetitions: list[ExperimentRepetition]

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


_EXPERIMENT_RUN_NODE_ID_PATTERN = re.compile(
    r"ExperimentRun:experiment_id=(\d+):dataset_example_id=(\d+)"
)


def get_experiment_run_node_id(
    experiment_rowid: ExperimentRowId, dataset_example_rowid: DatasetExampleRowId
) -> str:
    return _base64_encode(
        f"ExperimentRun:experiment_id={experiment_rowid}:dataset_example_id={dataset_example_rowid}"
    )


def parse_experiment_run_node_id(node_id: str) -> tuple[ExperimentRowId, DatasetExampleRowId]:
    decoded_node_id = _base64_decode(node_id)
    match = re.match(_EXPERIMENT_RUN_NODE_ID_PATTERN, decoded_node_id)
    if not match:
        raise ValueError(f"Invalid node ID format: {node_id}")

    experiment_id = int(match.group(1))
    dataset_example_id = int(match.group(2))
    return experiment_id, dataset_example_id


def _base64_encode(string: str) -> str:
    return b64encode(string.encode()).decode()


def _base64_decode(string: str) -> str:
    return b64decode(string.encode()).decode()
