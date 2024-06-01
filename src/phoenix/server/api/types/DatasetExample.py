from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import and_, func, select
from strawberry import UNSET
from strawberry.relay.types import GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision, RevisionKind
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.type
class DatasetExample(Node):
    id_attr: NodeID[int]
    cached_revision: strawberry.Private[Optional[DatasetExampleRevision]] = None
    created_at: datetime

    @strawberry.field
    async def revision(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
    ) -> DatasetExampleRevision:
        if not dataset_version_id and self.cached_revision:
            return self.cached_revision

        example_id = self.id_attr
        revision_id = select(func.max(models.DatasetExampleRevision.id)).where(
            models.DatasetExampleRevision.dataset_example_id == example_id
        )
        if dataset_version_id:
            version_id = (
                select(models.DatasetVersion.id)
                .where(
                    models.DatasetVersion.id
                    == from_global_id_with_expected_type(
                        global_id=dataset_version_id, expected_type_name=DatasetVersion.__name__
                    )
                )
                .scalar_subquery()
            )
            revision_id = revision_id.where(
                models.DatasetExampleRevision.dataset_version_id <= version_id
            )

        async with info.context.db() as session:
            if (
                revision := await session.scalar(
                    select(models.DatasetExampleRevision).where(
                        and_(
                            models.DatasetExampleRevision.id == revision_id,
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
