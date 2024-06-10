from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import UNSET
from strawberry.relay.types import Connection, GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.Span import Span, to_gql_span


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
            to_gql_span(span)
            if (span := await info.context.data_loaders.dataset_example_spans.load(self.id_attr))
            else None
        )

    @strawberry.field
    async def experiments(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[Experiment]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        example_id = self.id_attr
        query = (
            select(models.Experiment)
            .join(models.ExperimentRun, models.Experiment.id == models.ExperimentRun.experiment_id)
            .where(models.ExperimentRun.dataset_example_id == example_id)
            .order_by(models.Experiment.id.desc())
        )
        async with info.context.db() as session:
            experiments = (await session.scalars(query)).all()
        return connection_from_list(
            [to_gql_experiment(experiment) for experiment in experiments], args
        )
