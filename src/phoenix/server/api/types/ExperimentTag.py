from typing import Optional, cast

import strawberry
from strawberry.relay import GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.context import Context


@strawberry.type
class ExperimentTag(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.ExperimentTag]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("ExperimentTag ID mismatch")

    @strawberry.field
    async def experiment_id(self, info: Info[Context, None]) -> GlobalID:
        if self.db_record:
            experiment_id = self.db_record.experiment_id
        else:
            experiment_id = await info.context.data_loaders.experiment_tag_fields.load(
                (self.id, models.ExperimentTag.experiment_id)
            )
        return GlobalID("Experiment", str(experiment_id))

    @strawberry.field
    async def name(self, info: Info[Context, None]) -> Identifier:
        if self.db_record:
            value = self.db_record.name
        else:
            value = await info.context.data_loaders.experiment_tag_fields.load(
                (self.id, models.ExperimentTag.name)
            )
        return Identifier.model_validate(value)

    @strawberry.field
    async def description(self, info: Info[Context, None]) -> Optional[str]:
        if self.db_record:
            return self.db_record.description
        return cast(
            Optional[str],
            await info.context.data_loaders.experiment_tag_fields.load(
                (self.id, models.ExperimentTag.description)
            ),
        )
