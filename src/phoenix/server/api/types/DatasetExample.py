from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import and_, func, select
from sqlalchemy.sql.selectable import ScalarSelect
from strawberry.relay import GlobalID
from strawberry.relay.types import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision, RevisionKind
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.node import from_global_id_with_expected_type

from .ExampleInterface import Example


@strawberry.type
class DatasetExample(Node, Example):
    id_attr: NodeID[int]
    created_at: datetime
    dataset_version_rowid: strawberry.Private[Optional[int]] = None

    @strawberry.field
    async def revision(
        self, info: Info[Context, None], version_id: Optional[GlobalID] = None
    ) -> DatasetExampleRevision:
        dataset_example_rowid = self.id_attr
        maybe_version_rowid = (
            from_global_id_with_expected_type(version_id, DatasetVersion.__name__)
            if version_id is not None
            else None
        )
        version_rowid: ScalarSelect[int]
        if maybe_version_rowid is not None:
            version_rowid = (
                select(models.DatasetVersion.id)
                .where(models.DatasetVersion.id == maybe_version_rowid)
                .scalar_subquery()
            )
        else:
            version_rowid = (
                select(func.max(models.DatasetExampleRevision.dataset_version_id))
                .where(models.DatasetExampleRevision.dataset_example_id == dataset_example_rowid)
                .scalar_subquery()
            )
        query = select(models.DatasetExampleRevision).where(
            and_(
                models.DatasetExampleRevision.dataset_example_id == dataset_example_rowid,
                models.DatasetExampleRevision.dataset_version_id == version_rowid,
            )
        )
        async with info.context.db() as session:
            revision = await session.scalar(query)
        if revision is None:
            raise ValueError(
                (
                    f"No revision for dataset example {dataset_example_rowid} "
                    f"and version {maybe_version_rowid}."
                )
                if maybe_version_rowid is not None
                else f"No revision for dataset example {dataset_example_rowid}."
            )
        return DatasetExampleRevision(
            id_attr=revision.id,
            input=revision.input,
            output=revision.output,
            metadata=revision.metadata,
            revision_kind=RevisionKind(revision.revision_kind),
            created_at=revision.created_at,
        )
