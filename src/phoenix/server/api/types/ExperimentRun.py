from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import load_only
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.ExperimentRunAnnotation import (
    ExperimentRunAnnotation,
    to_gql_experiment_run_annotation,
)
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.Trace import Trace

if TYPE_CHECKING:
    from phoenix.server.api.types.DatasetExample import DatasetExample


@strawberry.type
class ExperimentRun(Node):
    id_attr: NodeID[int]
    experiment_id: GlobalID
    trace_id: Optional[str]
    output: Optional[JSON]
    start_time: datetime
    end_time: datetime
    error: Optional[str]

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
        run_id = self.id_attr
        annotations = await info.context.data_loaders.experiment_run_annotations.load(run_id)
        return connection_from_list(
            [to_gql_experiment_run_annotation(annotation) for annotation in annotations], args
        )

    @strawberry.field
    async def trace(self, info: Info) -> Optional[Trace]:
        if not self.trace_id:
            return None
        dataloader = info.context.data_loaders.trace_by_trace_ids
        if (trace := await dataloader.load(self.trace_id)) is None:
            return None
        return Trace(trace_rowid=trace.id, db_trace=trace)

    @strawberry.field
    async def example(
        self, info: Info
    ) -> Annotated[
        "DatasetExample", strawberry.lazy("phoenix.server.api.types.DatasetExample")
    ]:  # use lazy types to avoid circular import: https://strawberry.rocks/docs/types/lazy
        from phoenix.server.api.types.DatasetExample import DatasetExample

        async with info.context.db() as session:
            assert (
                result := await session.execute(
                    select(models.DatasetExample, models.Experiment.dataset_version_id)
                    .select_from(models.ExperimentRun)
                    .join(
                        models.DatasetExample,
                        models.DatasetExample.id == models.ExperimentRun.dataset_example_id,
                    )
                    .join(
                        models.Experiment,
                        models.Experiment.id == models.ExperimentRun.experiment_id,
                    )
                    .where(models.ExperimentRun.id == self.id_attr)
                    .options(load_only(models.DatasetExample.id, models.DatasetExample.created_at))
                )
            ) is not None
            example, version_id = result.first()
        return DatasetExample(
            id_attr=example.id,
            created_at=example.created_at,
            version_id=version_id,
        )


def to_gql_experiment_run(run: models.ExperimentRun) -> ExperimentRun:
    """
    Converts an ORM experiment run to a GraphQL ExperimentRun.
    """

    from phoenix.server.api.types.Experiment import Experiment

    return ExperimentRun(
        id_attr=run.id,
        experiment_id=GlobalID(Experiment.__name__, str(run.experiment_id)),
        trace_id=trace_id
        if (trace := run.trace) and (trace_id := trace.trace_id) is not None
        else None,
        output=run.output.get("task_output"),
        start_time=run.start_time,
        end_time=run.end_time,
        error=run.error,
    )
