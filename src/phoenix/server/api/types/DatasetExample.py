from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry import UNSET
from strawberry.relay.types import Connection, GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.api.types.DatasetSplit import DatasetSplit, to_gql_dataset_split
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.ExperimentRepeatedRunGroup import (
    ExperimentRepeatedRunGroup,
)
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span


@strawberry.type
class DatasetExample(Node):
    id_attr: NodeID[int]
    created_at: datetime
    version_id: strawberry.Private[Optional[int]] = None

    @strawberry.field
    async def revision(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
    ) -> DatasetExampleRevision:
        example_id = self.id_attr
        version_id: Optional[int] = None
        if dataset_version_id:
            version_id = from_global_id_with_expected_type(
                global_id=dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
        elif self.version_id is not None:
            version_id = self.version_id
        return await info.context.data_loaders.dataset_example_revisions.load(
            (example_id, version_id)
        )

    @strawberry.field
    async def span(
        self,
        info: Info[Context, None],
    ) -> Optional[Span]:
        return (
            Span(span_rowid=span.id, db_span=span)
            if (span := await info.context.data_loaders.dataset_example_spans.load(self.id_attr))
            else None
        )

    @strawberry.field
    async def experiment_runs(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        experiment_ids: Optional[list[GlobalID]] = UNSET,
    ) -> Connection[ExperimentRun]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        example_id = self.id_attr
        query = (
            select(models.ExperimentRun)
            .options(joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id))
            .join(models.Experiment, models.Experiment.id == models.ExperimentRun.experiment_id)
            .where(models.ExperimentRun.dataset_example_id == example_id)
            .order_by(
                models.ExperimentRun.experiment_id.asc(),
                models.ExperimentRun.repetition_number.asc(),
            )
        )
        if experiment_ids:
            experiment_db_ids = [
                from_global_id_with_expected_type(
                    global_id=experiment_id,
                    expected_type_name=models.Experiment.__name__,
                )
                for experiment_id in experiment_ids or []
            ]
            query = query.where(models.ExperimentRun.experiment_id.in_(experiment_db_ids))
        async with info.context.db() as session:
            runs = (await session.scalars(query)).all()
        return connection_from_list([to_gql_experiment_run(run) for run in runs], args)

    @strawberry.field
    async def experiment_repeated_run_groups(
        self,
        info: Info[Context, None],
        experiment_ids: list[GlobalID],
    ) -> list[ExperimentRepeatedRunGroup]:
        example_rowid = self.id_attr
        experiment_rowids = []
        for experiment_id in experiment_ids:
            try:
                experiment_rowid = from_global_id_with_expected_type(
                    global_id=experiment_id,
                    expected_type_name=models.Experiment.__name__,
                )
            except Exception:
                raise BadRequest(f"Invalid experiment ID: {experiment_id}")
            experiment_rowids.append(experiment_rowid)
        repeated_run_groups = (
            await info.context.data_loaders.experiment_repeated_run_groups.load_many(
                [(experiment_rowid, example_rowid) for experiment_rowid in experiment_rowids]
            )
        )
        return [
            ExperimentRepeatedRunGroup(
                experiment_rowid=group.experiment_rowid,
                dataset_example_rowid=group.dataset_example_rowid,
                runs=[to_gql_experiment_run(run) for run in group.runs],
            )
            for group in repeated_run_groups
        ]

    @strawberry.field
    async def dataset_splits(
        self,
        info: Info[Context, None],
    ) -> list[DatasetSplit]:
        return [
            to_gql_dataset_split(split)
            for split in await info.context.data_loaders.dataset_example_splits.load(self.id_attr)
        ]


def to_gql_dataset_example(example: models.DatasetExample) -> DatasetExample:
    return DatasetExample(
        id_attr=example.id,
        created_at=example.created_at,
    )
