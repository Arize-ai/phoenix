from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Annotated

import strawberry
from sqlalchemy import select
from sqlalchemy.orm import with_polymorphic
from strawberry import UNSET
from strawberry.relay import Node, NodeID
from strawberry.relay.types import Connection
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Evaluator import DatasetEvaluator
from phoenix.server.api.types.ExperimentTaskConfig import PromptTaskConfig
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list

if TYPE_CHECKING:
    from .Experiment import Experiment
    from .ExperimentLog import ExperimentLog


@strawberry.enum
class ExperimentJobStatus(Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    STOPPED = "STOPPED"
    ERROR = "ERROR"


@strawberry.type
class ExperimentJob(Node):
    id: NodeID[int]  # Uses ExperimentJob.id (FK to experiments.id)
    db_record: strawberry.Private[models.ExperimentJob | None] = None

    @strawberry.field
    def experiment(self) -> Annotated["Experiment", strawberry.lazy(".Experiment")]:
        # ExperimentJob.id IS the experiment_id (1:1 FK relationship)
        from .Experiment import Experiment

        return Experiment(id=self.id)

    @strawberry.field
    async def status(self, info: Info[Context, None]) -> ExperimentJobStatus:
        if self.db_record:
            val = self.db_record.status
        else:
            val = await info.context.data_loaders.experiment_job_fields.load(
                (self.id, models.ExperimentJob.status),
            )
        return ExperimentJobStatus(val)

    @strawberry.field
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.experiment_job_fields.load(
                (self.id, models.ExperimentJob.created_at),
            )
        return val

    @strawberry.field(description="Most recent error from this experiment, or null if no errors.")  # type: ignore[untyped-decorator]
    async def last_error(
        self, info: Info[Context, None]
    ) -> Annotated["ExperimentLog", strawberry.lazy(".ExperimentLog")] | None:
        from .ExperimentLog import ExperimentLog

        row = await info.context.data_loaders.last_experiment_errors.load(self.id)
        if row is None:
            return None
        return ExperimentLog.from_orm(row)

    @strawberry.field(description="Errors recorded during experiment execution, most recent first.")  # type: ignore[untyped-decorator]
    async def errors(
        self,
        info: Info[Context, None],
        first: int | None = 50,
        last: int | None = UNSET,
        after: CursorString | None = UNSET,
        before: CursorString | None = UNSET,
    ) -> Connection[Annotated["ExperimentLog", strawberry.lazy(".ExperimentLog")]]:
        from .ExperimentLog import ExperimentLog

        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        poly = with_polymorphic(models.ExperimentLog, "*")
        async with info.context.db.read() as session:
            result = await session.scalars(
                select(poly)
                .where(poly.experiment_id == self.id)
                .where(poly.level == "ERROR")
                .order_by(poly.occurred_at.desc())
            )
            data = [ExperimentLog.from_orm(row) for row in result.all()]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def max_concurrency(self, info: Info[Context, None]) -> int:
        if self.db_record:
            val = self.db_record.max_concurrency
        else:
            val = await info.context.data_loaders.experiment_job_fields.load(
                (self.id, models.ExperimentJob.max_concurrency),
            )
        return val

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Task configuration snapshot. "
        "Use to rehydrate the playground with the exact settings used for this experiment.",
    )
    async def task_config(self, info: Info[Context, None]) -> PromptTaskConfig | None:
        async with info.context.db.read() as session:
            config = await session.get(models.ExperimentPromptTask, self.id)
            if config is None:
                return None
            return PromptTaskConfig.from_orm(config)

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="Dataset evaluators attached to this experiment job.",
    )
    async def dataset_evaluators(
        self,
        info: Info[Context, None],
        first: int | None = 50,
        last: int | None = UNSET,
        after: CursorString | None = UNSET,
        before: CursorString | None = UNSET,
    ) -> Connection[Annotated["DatasetEvaluator", strawberry.lazy(".Evaluator")]]:
        from phoenix.server.api.types.Evaluator import DatasetEvaluator

        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db.read() as session:
            result = await session.scalars(
                select(models.DatasetEvaluators)
                .join(
                    models.ExperimentDatasetEvaluator,
                    models.DatasetEvaluators.id
                    == models.ExperimentDatasetEvaluator.dataset_evaluator_id,
                )
                .where(models.ExperimentDatasetEvaluator.experiment_id == self.id)
            )
            data = [DatasetEvaluator(id=row.id, db_record=row) for row in result.all()]
        return connection_from_list(data=data, args=args)
