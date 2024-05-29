from datetime import datetime
from typing import Optional

import strawberry
from aioitertools.itertools import islice
from sqlalchemy import select
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
    connection_from_cursors_and_nodes,
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
        first = first if first is not None else 50
        dataset_version_rowid = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if dataset_version_id
            else None
        )
        query = (
            select(models.DatasetExample).limit(first + 1).order_by(models.DatasetExample.id.desc())
        )
        if after:
            dataset_example_id = from_global_id_with_expected_type(
                global_id=GlobalID.from_id(after),
                expected_type_name=DatasetExample.__name__,
            )
            query = query.where(models.DatasetExample.id <= dataset_example_id)
        async with info.context.db() as session:
            examples = await session.stream(query)
            nodes = [
                (
                    GlobalID(type_name=DatasetExample.__name__, node_id=example.id),
                    DatasetExample(
                        id_attr=example.id,
                        created_at=example.created_at,
                        dataset_version_rowid=dataset_version_rowid,
                    ),
                )
                async for example in islice(examples, first)
            ]
            has_next_page: bool
            try:
                await examples.__anext__()
                has_next_page = True
            except StopAsyncIteration:
                has_next_page = False
        return connection_from_cursors_and_nodes(
            nodes, has_previous_page=False, has_next_page=has_next_page
        )
