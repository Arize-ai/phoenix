from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay.types import Node, NodeID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision, RevisionKind


@strawberry.type
class DatasetExample(Node):
    id_attr: NodeID[int]
    created_at: datetime
    revision: DatasetExampleRevision
    db_revision: strawberry.Private[Optional[models.DatasetExampleRevision]] = None

    async def revision2(
        self,
        info: Info[Context, None],
    ) -> DatasetExampleRevision:
        return DatasetExampleRevision(
            input={},
            output={},
            metadata={},
            revision_kind=RevisionKind.CREATE,
            created_at=datetime.now(),
        )
