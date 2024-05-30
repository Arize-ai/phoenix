from datetime import datetime

import strawberry
from strawberry.relay.types import Node, NodeID

from phoenix.server.api.types.DatasetExampleRevision import DatasetExampleRevision


@strawberry.type
class DatasetExample(Node):
    id_attr: NodeID[int]
    created_at: datetime
    revision: DatasetExampleRevision
