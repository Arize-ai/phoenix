from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import distinct, select
from sqlalchemy.orm import joinedload
from strawberry import UNSET
from strawberry.relay.types import Connection, GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
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
    async def experiments(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        filter_ids: Optional[list[GlobalID]] = UNSET,
    ) -> Connection[Experiment]:
        connection_args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        example_id = self.id_attr
        experiment_ids_subquery = (
            select(distinct(models.ExperimentRun.experiment_id))
            .select_from(models.ExperimentRun)
            .where(models.ExperimentRun.dataset_example_id == example_id)
            .scalar_subquery()
        )
        experiments_query = (
            select(models.Experiment)
            .where(models.Experiment.id.in_(experiment_ids_subquery))
            .order_by(models.Experiment.id.asc())
        )
        if filter_ids:
            filter_rowids = []
            for filter_id in filter_ids:
                try:
                    experiment_rowid = from_global_id_with_expected_type(
                        filter_id, Experiment.__name__
                    )
                except ValueError:
                    raise BadRequest(f"Invalid filter ID: {filter_id}")
                filter_rowids.append(experiment_rowid)

            experiments_query = experiments_query.where(models.Experiment.id.in_(filter_rowids))

        experiments_by_id = {}
        async with info.context.db() as session:
            for experiment in await session.scalars(experiments_query):
                experiments_by_id[experiment.id] = experiment

        for filter_rowid in filter_rowids:
            if filter_rowid not in experiments_by_id:
                experiment_id = str(GlobalID(Experiment.__name__, str(filter_rowid)))
                raise NotFound(f"Could not find experiment with ID {experiment_id}")

        gql_experiments = []
        for db_experiment in experiments_by_id.values():
            gql_experiment = to_gql_experiment(db_experiment)
            gql_experiment.dataset_example_rowid = example_id
            gql_experiments.append(gql_experiment)

        return connection_from_list(gql_experiments, connection_args)

    @strawberry.field
    async def experiment_runs(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
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
            .order_by(models.Experiment.id.desc())
        )
        async with info.context.db() as session:
            runs = (await session.scalars(query)).all()
        return connection_from_list([to_gql_experiment_run(run) for run in runs], args)
