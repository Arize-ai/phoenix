from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import and_, func, select
from strawberry.relay.types import GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision, RevisionKind


@strawberry.type
class DatasetExample(Node):
    id_attr: NodeID[int]
    cached_revision: strawberry.Private[Optional[DatasetExampleRevision]] = None
    created_at: datetime

    @strawberry.field
    async def revision(
        self,
        info: Info[Context, None],
        version_id: Optional[GlobalID] = None,
    ) -> DatasetExampleRevision:
        if version_id:
            raise NotImplementedError
        elif self.cached_revision:
            return self.cached_revision
        example_id = self.id_attr
        latest_revision_id = (
            select(func.max(models.DatasetExampleRevision.id))
            .where(models.DatasetExampleRevision.dataset_example_id == example_id)
            .scalar_subquery()
        )
        async with info.context.db() as session:
            if (
                revision := await session.scalar(
                    select(models.DatasetExampleRevision).where(
                        and_(
                            models.DatasetExampleRevision.id == latest_revision_id,
                            models.DatasetExampleRevision.revision_kind != "DELETE",
                        )
                    )
                )
            ) is None:
                raise ValueError(f"Could not find revision for example: {example_id}")
        return DatasetExampleRevision(
            input=revision.input,
            output=revision.output,
            metadata=revision.metadata_,
            revision_kind=RevisionKind(revision.revision_kind),
            created_at=revision.created_at,
        )
