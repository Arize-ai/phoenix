from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry import UNSET
from strawberry.relay.types import Connection, GlobalID, Node, NodeID
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.ExperimentRepetition import to_gql_experiment_repetition
from phoenix.server.api.types.ExperimentRun import (
    ExperimentRun,
    get_experiment_run_node_id,
    parse_experiment_run_node_id,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    CursorString,
    connection_from_cursors_and_nodes,
)
from phoenix.server.api.types.Span import Span

_DEFAULT_FIRST = 50


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
        first: Optional[int] = _DEFAULT_FIRST,
        after: Optional[CursorString] = UNSET,
    ) -> Connection[ExperimentRun]:
        example_id = self.id_attr
        experiment_ids_subquery = (
            select(models.ExperimentRun.experiment_id)
            .where(models.ExperimentRun.dataset_example_id == example_id)
            .limit((first or _DEFAULT_FIRST) + 1)
            .scalar_subquery()
        )
        if after:
            after_experiment_id, after_example_id = parse_experiment_run_node_id(after)
            if after_example_id != example_id:
                raise BadRequest(f"Invalid after node ID: {after}")
            experiment_ids_subquery = experiment_ids_subquery.where(
                models.ExperimentRun.experiment_id > after_experiment_id
            )

        query = (
            select(models.ExperimentRun)
            .where(models.ExperimentRun.dataset_example_id == example_id)
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids_subquery))
            .order_by(models.ExperimentRun.experiment_id.asc())
            .options(joinedload(models.ExperimentRun.trace).load_only(models.Trace.trace_id))
        )

        ExperimentId: TypeAlias = int
        async with info.context.db() as session:
            runs_by_experiment_id: dict[ExperimentId, list[models.ExperimentRun]] = {}
            for run in await session.scalars(query):
                experiment_id = run.experiment_id
                if experiment_id not in runs_by_experiment_id:
                    runs_by_experiment_id[experiment_id] = []
                runs_by_experiment_id[experiment_id].append(run)

        has_next_page = False
        if first and len(runs_by_experiment_id) > first:
            has_next_page = True
            runs_by_experiment_id.popitem()

        cursors_and_nodes: list[tuple[str, ExperimentRun]] = []
        for experiment_id, runs in runs_by_experiment_id.items():
            cursor = get_experiment_run_node_id(experiment_id, example_id)
            runs_node = ExperimentRun(
                experiment_rowid=experiment_id,
                dataset_example_rowid=example_id,
                repetitions=[
                    to_gql_experiment_repetition(run)
                    for run in sorted(runs, key=lambda run: run.repetition_number)
                ],
            )
            cursors_and_nodes.append((cursor, runs_node))

        return connection_from_cursors_and_nodes(
            cursors_and_nodes,
            has_previous_page=False,
            has_next_page=has_next_page,
        )
