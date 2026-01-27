from datetime import datetime, timezone
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

from phoenix.config import EXPERIMENT_STALE_CLAIM_TIMEOUT
from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.Experiment import Experiment


@strawberry.type
class ExperimentJob(Node):
    id: NodeID[int]  # Uses ExperimentExecutionConfig.id (FK to experiments.id)
    db_record: strawberry.Private[Optional[models.ExperimentExecutionConfig]] = None

    @strawberry.field
    def experiment(self) -> Experiment:
        # ExperimentExecutionConfig.id IS the experiment_id (1:1 FK relationship)
        return Experiment(id=self.id)

    @strawberry.field
    async def is_active(self, info: Info[Context, None]) -> bool:
        if self.db_record:
            claimed_at = self.db_record.claimed_at
        else:
            claimed_at = await info.context.data_loaders.experiment_execution_config_fields.load(
                (self.id, models.ExperimentExecutionConfig.claimed_at),
            )
        if claimed_at is None:
            return False
        cutoff = datetime.now(timezone.utc) - EXPERIMENT_STALE_CLAIM_TIMEOUT
        return claimed_at > cutoff

    @strawberry.field
    async def created_at(self, info: Info[Context, None]) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.experiment_execution_config_fields.load(
                (self.id, models.ExperimentExecutionConfig.created_at),
            )
        return val

    @strawberry.field
    async def last_error(self, info: Info[Context, None]) -> Optional[str]:
        if self.db_record:
            val = self.db_record.last_error
        else:
            val = await info.context.data_loaders.experiment_execution_config_fields.load(
                (self.id, models.ExperimentExecutionConfig.last_error),
            )
        return val
