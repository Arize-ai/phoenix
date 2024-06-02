from datetime import datetime
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay.types import GlobalID, Node, NodeID
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision
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
        version_id = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if dataset_version_id
            else None
        )
        return await info.context.data_loaders.dataset_example_revisions.load(
            (example_id, version_id)
        )
