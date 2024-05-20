from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import and_, func, select
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)

from .DatasetVersion import DatasetVersion


@strawberry.type
class Dataset(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    metadata: JSON
    created_at: datetime
    updated_at: datetime

    @strawberry.field
    async def versions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[DatasetVersion]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            versions = await session.scalars(
                select(models.DatasetVersion)
                .filter_by(dataset_id=self.id_attr)
                .order_by(models.DatasetVersion.created_at.desc())
            )
        data = [
            DatasetVersion(
                id_attr=version.id,
                description=version.description,
                metadata=version.metadata,
                created_at=version.created_at,
            )
            for version in versions
        ]
        return connection_from_list(data=data, args=args)

    @strawberry.field
    async def examples(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[DatasetExample]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        latest_revisions = select(
            models.DatasetExampleRevision.dataset_example_id,
            func.max(models.DatasetExampleRevision.dataset_version_id).label("dataset_version_id"),
        ).group_by(models.DatasetExampleRevision.dataset_example_id)
        if dataset_version_id:
            dataset_version_rowid = from_global_id_with_expected_type(
                global_id=dataset_version_id, expected_type_name="DatasetVersion"
            )
            latest_revisions = latest_revisions.where(
                models.DatasetExampleRevision.dataset_version_id <= dataset_version_rowid
            )
        latest_revisions_cte = latest_revisions.cte("latest_revisions")
        query = (
            select(models.DatasetExampleRevision, models.DatasetExample.created_at)
            .join(
                latest_revisions_cte,
                onclause=and_(
                    (
                        models.DatasetExampleRevision.dataset_example_id
                        == latest_revisions_cte.c.dataset_example_id
                    ),
                    (
                        models.DatasetExampleRevision.dataset_version_id
                        == latest_revisions_cte.c.dataset_version_id
                    ),
                ),
            )
            .join(
                models.DatasetExample,
                onclause=models.DatasetExample.id
                == models.DatasetExampleRevision.dataset_example_id,
            )
            .where(
                models.DatasetExampleRevision.revision_kind != "DELETE",
            )
            .order_by(models.DatasetExampleRevision.dataset_example_id)
        )
        async with info.context.db() as session:
            dataset_examples = [
                DatasetExample(
                    id_attr=revision.id,
                    input=revision.input,
                    output=revision.output,
                    metadata=revision.metadata_,
                    created_at=created_at,
                )
                async for revision, created_at in await session.stream(query)
            ]
        return connection_from_list(data=dataset_examples, args=args)
